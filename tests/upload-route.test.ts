import { describe, expect, it } from "vitest";
import { POST } from "../app/api/upload/route";

describe("upload API validation and error reporting", () => {
  it("returns a clear error when no file is supplied", async () => {
    const response = await POST(new Request("http://localhost/api/upload", { method: "POST", body: new FormData() }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/choose a resume/i);
  });
  it("rejects invalid file types before extraction", async () => {
    const form = new FormData();
    form.set("file", new File(["not a resume"], "payload.exe", { type: "application/octet-stream" }));
    const response = await POST(new Request("http://localhost/api/upload", { method: "POST", body: form }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/unsupported file type/i);
  });
  it("retains a failed candidate record when a supported file cannot be extracted", async () => {
    const form = new FormData();
    form.set("file", new File(["not a valid PDF"], "corrupt.pdf", { type: "application/pdf" }));
    const response = await POST(new Request("http://localhost/api/upload", { method: "POST", body: form }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.candidate.filename).toBe("corrupt.pdf");
    expect(body.candidate.extractionStatus).toBe("failed");
    expect(body.candidate.reviewFlags.length).toBeGreaterThan(0);
  });
});
