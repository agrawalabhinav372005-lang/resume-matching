# RESUME MATCHING

A browser-based résumé screening and hiring review tool. It opens with four fictional candidates and three jobs. Select **Reset workspace** to start with your own data.

1. Upload text-based PDF, DOCX, or UTF-8 TXT files, or paste résumé text directly.
2. Add each job description, extract its criteria, and verify the fields before saving.
3. Select **Run screening** and choose a role. Search by candidate name or skill, or filter by review status. Select two or three candidates to compare their scores and evidence side by side.
4. Open **Review match** to see the score breakdown, suggested follow-up questions, and your review notes for that candidate and role. Open the candidate profile to see job recommendations and the extracted résumé text.

CSV export includes the complete ranking and review status for the selected job. Notes are only visible in the workspace session.

## Scoring

The NLP engine uses an English skill and alias dictionary, section and credential recognition, basic negation detection, and date-range extraction. Job-specific terms can be added in the criteria editor. Overlapping employment periods are counted once. Dates with years only are treated as covering the full calendar years. When employment dates are unavailable, the engine considers an explicit years-of-experience statement. Experience is total detected duration and does not establish years in a particular skill or industry.

The default weights are 60 for required skills, 15 for preferred skills, 15 for experience, 5 for education, and 5 for qualifications. Only criteria specified for the job contribute to the denominator. Skill and credential points are proportional to evidence found. Experience points are capped at the job’s minimum. Education uses the highest detected completed degree level and does not verify subject or equivalence. Ties use required-skill coverage and count before assigning a shared rank. Job recommendations require a positive score and at least one skill match when the job has skill criteria.

Scores summarize evidence in the submitted text. The engine does not verify claims and has no measured hiring accuracy. Review the extracted fields and source documents before acting on scores. Image-only PDFs need OCR elsewhere or pasted text, and complex document layouts may extract out of order.

## Local use

From this directory, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8000 in a current browser. All document parsing and scoring run in the browser. No external model service, API key, database, or build step is needed. Reloading clears workspace inputs, scores, and reviews. Exported CSV files are saved by the browser.

## Project layout

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Application page |
| `dist/js/app.mjs` | Screening, comparison, and review interface |
| `dist/js/engine.mjs` | Résumé extraction, job matching, and scoring |
| `dist/js/documents.mjs` | PDF, DOCX, and TXT readers |
| `dist/js/sample.mjs` | Fictional test résumés and job descriptions |
| `dist/assets/` | Styles and favicon |
| `dist/vendor/` | Browser dependencies and their licenses |
| `tests/` | Matching and scoring regression tests |

`dist/` is the editable application and the directory to serve. Run the tests with Node.js 20 or later.

```sh
node --test
```
