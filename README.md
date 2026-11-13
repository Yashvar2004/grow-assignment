# TalentRank AI

Intelligent Resume Screening & Candidate Ranking. This is an evidence organizer and prototype; it does not make hiring decisions.

## Workspace and dataset status

The downloaded assignment dataset is present under data/resumes/Software Development Assignment Resumes/. It contains 47 original DOCX files. Source and target inventories were checked and all 47 copies matched their originals by SHA-256. No source files were renamed or edited.

The latest processing run accounts for all 47 files: 46 extracted successfully, 1 failed because it is a blank DOCX, 0 partial, 0 duplicate, 0 OCR-needed, and 0 unsupported format. The blank file remains in data/candidates.json, data/candidates.csv, and data/processing-report.json with its original filename, source path, source hash, candidate reference, failure reason, and evidence reference. Its LCA and UI/UX scores are null and it is marked unscored in the JSON, CSV, and processing report. All 46 successfully extracted records are evaluated independently for both roles. Under the current missing-evidence rules, 22 have no detectable LCA criterion evidence and therefore no LCA fit score, and 3 have no detectable UI/UX criterion evidence and therefore no UI/UX fit score; these remain visible with unknown scores and no numeric rank for that role. Other role scores and ranks are shown when evidence supports a score. A complete per-file audit is in data/processing-report.json; evidence-backed candidate data is in data/candidates.json and the tabular export is in data/candidates.csv.

The resume directory is excluded from Git so original resumes are not accidentally published. PDF, DOCX, and TXT files are parsed; every other non-marker file is still included in the audit as an extraction failure. The root .gitkeep is the only excluded file. To regenerate the seed JSON, CSV, and processing report after changing the source dataset, run npm run process:dataset.

The processor scans subfolders, retains one record per file, preserves relative filenames and source paths, flags duplicates without dropping records, and writes per-file extraction status, OCR state, source hashes, and candidate evidence references. The report distinguishes the expected total from files found/accounted for; duplicate and OCR counts may overlap extraction statuses. The command exits non-zero when the number of files differs from the assignment target of 47 or any file is unaccounted for. Review the file manifest and failed records before treating the dataset as complete. The browser dashboard loads data/candidates.json as its seed dataset.

The linked job description URLs are kept in the interface. Their contents were not available to the workspace inspection tool, so criteria use the detailed requirements supplied in the assignment brief and the previously reported linked-JD experience requirement. The LCA methodology explicitly records the brief's 4-6 year versus linked JD 2-3 years independent LCA experience conflict. The scoring weights and criteria remain those already implemented; verify the linked JD directly before changing any requirement.
## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Upload behavior and storage

Uploads accept PDF, DOCX, and TXT, up to 4 MB per file. A batch is sent one file at a time to the Node.js route handler, which extracts the text, redacts email addresses and phone numbers in stored/displayed extracted text, creates evidence-backed fields, and runs both deterministic scoring systems. Scanned PDFs without embedded text are marked as failures that require OCR; OCR is not included. Extraction failures and duplicates appear in the processing view.

Uploaded candidate records are stored in the current browser tab’s `sessionStorage`; they survive a reload in that tab but are not shared across users or devices and are not durable production storage. Source resume files themselves are not uploaded into durable storage. This is the prototype’s explicit demo-session mode. For shared Vercel use, connect a persistent database and object store (for example, a free-tier compatible Postgres and Blob service), add authentication and access controls, then migrate the upload route to store source files and records under the same retention policy. Do not treat a public deployment as a private applicant-data system before those controls exist.

The upload route uses the Vercel Node.js runtime and a 4 MB file cap to stay below the function request body limit. `maxDuration` is set to 30 seconds. A Vercel plan may impose lower function time or storage limits; confirm those limits for the target project before processing a large batch. Dataset seed files are generated at build time and are not a persistent upload store.

## Tests and checks

```bash
npm run typecheck
npm test
npm run build
```

Tests cover PDF and DOCX extraction, scanned-PDF reporting, invalid and empty uploads, missing experience, duplicate insertion, both-role classification, uncertainty, scoring coverage, deterministic ranking, and extraction errors.

## Vercel deployment

1. Push the app to a Git repository without adding the source resumes under `data/resumes/`.
2. Import that repository in Vercel; use the standard Next.js framework preset and Node.js runtime.
3. No API key or paid service is required for core parsing or scoring. `.env.example` has no required variables; Groq is not used by the deterministic scoring pipeline.
4. Before processing the assignment dataset in a hosted build, download the real source files into `data/resumes/`, run `npm run process:dataset`, check the report counts and failed files, review the generated records, and commit the redacted structured seed outputs if appropriate.
5. Deploy. New browser uploads remain local to that browser session until persistent storage and authentication are configured.

## Scoring and limitations

The scoring weights and evidence rules are in `lib/scoring.ts`; the plain-language explanation is in the Methodology page. Scores are deterministic for identical extracted text and weights. Missing information does not count as positive evidence and is shown separately through evidence coverage. Classification requires contextual role evidence plus a corroborating signal, so a bare skill keyword alone is not a role match. Every candidate remains subject to human review. Dates and overlapping jobs are not reliably normalized into employment tenure, and the prototype cannot validate a portfolio’s quality.
