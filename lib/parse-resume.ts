import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { classify, scoreText, yearsFromText } from "./scoring";
import type { Candidate, EvidenceField } from "./types";

const MAX_BYTES = 4 * 1024 * 1024;
const emailOrPhone = /(?:\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d\s().-]{7,}\d))/gi;
const pickLines = (text: string, pattern: RegExp): EvidenceField[] => text.split(/\n+/).map((line) => line.trim()).filter((line) => pattern.test(line)).slice(0, 12).map((line) => ({ value: line.slice(0, 180), excerpt: line.slice(0, 280), verified: true }));

export async function extractText(bytes: Buffer, filename: string): Promise<{ text: string; status: Candidate["extractionStatus"]; message?: string }> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "txt") return { text: bytes.toString("utf8"), status: bytes.toString("utf8").trim() ? "success" : "failed", message: "" };
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = result.value.trim();
    return { text, status: text ? "success" : "failed", message: text ? undefined : "The document contains no extractable text." };
  }
  if (ext === "pdf") {
    const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map((item) => "str" in item ? item.str : "").join(" ");
    }));
    const text = pages.join("\n").trim();
    if (!text) return { text: "", status: "failed", message: "No embedded text was found. This may be a scanned PDF; OCR is not configured." };
    return { text, status: "success" };
  }
  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
}

export async function parseResume(bytes: Buffer, filename: string): Promise<Candidate> {
  if (bytes.byteLength === 0) throw new Error("The uploaded file is empty.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("File exceeds the 4 MB upload limit.");
  if (!/\.(pdf|docx|txt)$/i.test(filename)) throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  const { text, status, message } = await extractText(bytes, filename);
  const extractedText = text.replace(/\r\n?/g, "\n").replace(emailOrPhone, "[contact redacted]");
  const normalized = extractedText.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const scores = scoreText(normalized);
  const flags: string[] = [];
  if (status === "failed") flags.push(message?.trim() ? message : "No text could be extracted from this file.");
  if (yearsFromText(normalized) === null) flags.push("Experience duration not verified");
  if (scores.lcaCriteria.find((item) => item.id === "experience")?.missing.some((item) => item.includes("Linked JD asks"))) flags.push("Linked JD requirement for independent LCA experience needs review");
  if (normalized.length > 0 && normalized.length < 180) flags.push("Very short extracted text; review source file");
  if (/\b(?:lca|figma|user experience|sustainability)\b/i.test(normalized) && !/\n/.test(normalized)) flags.push("Evidence appears in unstructured text; review context");
  if (!normalized) flags.push("No extracted resume text available");
  const id = `C-${createHash("sha256").update(`${filename}\n${normalized || bytes}`).digest("hex").slice(0, 8).toUpperCase()}`;
  const skills = [...new Set([...scores.lcaCriteria, ...scores.uiuxCriteria].flatMap((item) => item.evidence.length ? [item.label] : []))];
  const tools = ["GaBi", "SimaPro", "Figma"].filter((tool) => new RegExp(tool.replace(".", "\\."), "i").test(normalized));
  const lcaScore = scores.lca.score;
  const uiuxScore = scores.uiux.score;
  const extractionConfidence = normalized.length === 0 ? 0 : Math.min(98, Math.max(25, Math.round(40 + Math.min(2500, normalized.length) / 50)));
  return {
    id, filename, source: `upload:${filename}`, sourceSha256: createHash("sha256").update(bytes).digest("hex"), createdAt: new Date().toISOString(), extractedText, normalizedText: normalized,
    education: pickLines(normalized, /\b(?:bachelor|master|ph\.?d|degree|university|college|institute|education)\b/i),
    experience: pickLines(normalized, /\b(?:experience|intern|employment|professional|engineer|designer|analyst|consultant|manager)\b/i),
    projects: pickLines(normalized, /\b(?:project|case study|assessment|model|designed|developed|research)\b/i),
    certifications: pickLines(normalized, /\b(?:certif|iso 1404|credential)\b/i),
    skills, tools, portfolioLinks: [...new Set(normalized.match(/https?:\/\/[^\s)>]+/gi) ?? [])].filter((url) => /portfolio|behance|dribbble|figma|notion|framer/i.test(url)),
    classification: classify(lcaScore, uiuxScore, scores.lcaCriteria, scores.uiuxCriteria), lcaScore, uiuxScore,
    lcaCoverage: scores.lca.coverage, uiuxCoverage: scores.uiux.coverage,
    lcaCriteria: scores.lcaCriteria, uiuxCriteria: scores.uiuxCriteria,
    extractionStatus: status, extractionConfidence, reviewFlags: flags, yearsExperience: yearsFromText(normalized),
  };
}
