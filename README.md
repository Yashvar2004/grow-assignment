# TalentRank AI

Intelligent Resume Screening & Candidate Ranking. This is an evidence organizer and prototype; it does not make hiring decisions.

## Workspace and dataset status

The workspace started empty. No resumes from the linked Zoho WorkDrive folder were available locally, so the checked-in seed file at `data/candidates.json` intentionally contains zero candidate records. Dashboard counts therefore start at zero. The app does not fabricate the assignment’s 47 resumes or their rankings.

After downloading the supplied files, place the original PDF, DOCX, or TXT files in:

```text
data/resumes/
```

The folder is excluded from Git so original resumes are not accidentally published. Process every supported file and create the seed JSON, CSV, and extraction report with:

```bash
npm run process:dataset
```

The script scans subfolders, retains a record for every supplied file (including unsupported formats and extraction failures), preserves the source filename/path, flags duplicate content without dropping records, and reports the expected and processed file counts. Review `data/processing-report.json`, then inspect the generated `data/candidates.json` and `data/candidates.csv`. The browser dashboard loads `data/candidates.json` as its seed data. Rebuild the app after regenerating it.

The linked job description URLs are kept in the interface. Their contents were not available to the workspace inspection tool, so the initial criteria use the detailed requirements supplied in the assignment brief. The LCA methodology explicitly records the brief’s 4–6 year versus linked JD 2–3 years independent LCA experience conflict and follows the linked JD as the primary scoring source.

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
