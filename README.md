# RESUME MATCHING

RESUME MATCHING is a browser-based tool for reviewing resumes against job requirements.

Upload candidate resumes, add a job description, and get ranked results based on skills, experience, education, and qualifications. The application also highlights missing skills and suggests questions that can be useful during interviews.

The application processes documents directly in the browser, without uploading candidate data to a backend server.

**[Live Demo](https://agrawalabhinav372005-lang.github.io/resume-matching/)**

The demo opens with fictional candidates and jobs. Try changing the selected role or comparing two candidates. Select **Reset** to start with your own resumes and job descriptions.

## Test dataset

[Download the test dataset](https://agrawalabhinav372005-lang.github.io/resume-matching/dataset/resume-matching-test-dataset.zip) to try the upload workflow. It includes four fictional resumes in PDF, DOCX, and TXT formats, three job descriptions, and an expected rankings CSV.

1. Open the live demo and select **Reset** to clear the built-in examples.
2. Upload the four files in the `resumes/` folder.
3. For each file in `jobs/`, select **Add Job**, enter the job title, paste the description, and save the extracted criteria.
4. Select **Run Screening**. Use the role selector to compare the results with `expected-rankings.csv`.

## Features

- **Resume upload:** Upload PDF, DOCX, or TXT files, or paste resume text directly.
- **Job description analysis:** Extract skills, experience requirements, and education criteria from job descriptions.
- **Candidate ranking:** Calculate match scores and rank candidates for a particular role.
- **Skill analysis:** View matched skills, missing requirements, and suggested interview questions.
- **Candidate comparison:** Compare 2–3 candidates side by side.
- **Candidate review:** Filter by name, skill, or review status. Save notes for a candidate and role, and correct the candidate name or extracted resume text from their profile.
- **CSV export:** Download candidate rankings for further analysis.

## Scoring Method

The matching engine uses an English skills dictionary along with role-specific terms added by the user.

It also supports common skill aliases (for example, JS → JavaScript), basic negation detection, and date range extraction from work experience.

Default score weights:

| Category | Weight |
|---|---:|
| Required skills | 60% |
| Preferred skills | 15% |
| Experience | 15% |
| Education | 5% |
| Qualifications and certifications | 5% |
| **Total** | **100%** |

The weights are scaled to the criteria defined for each job. Run screening again after editing a resume or job description to refresh the ranking.

The scores reflect information extracted from submitted resume text. They do not independently verify a candidate's qualifications or experience. Always review the original resume before making a hiring decision.

## Running Locally

Python 3 is required.

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open the following address in your browser:

`http://127.0.0.1:8000`

The application runs in the browser and does not require a backend server, API keys, or a build step.

## Running Tests

Node.js 20 or later is required.

```bash
node --test
```

Pushes to `main` trigger the GitHub Pages workflow. It runs the matching tests before packaging and deploying `dist/`.

## Project Structure

```text
resume-matching/
├── dist/
│   ├── index.html
│   ├── assets/
│   │   ├── styles.css
│   │   └── extras.css
│   ├── dataset/
│   │   └── resume-matching-test-dataset.zip
│   ├── js/
│   │   ├── app.mjs
│   │   ├── engine.mjs
│   │   ├── documents.mjs
│   │   └── sample.mjs
│   └── vendor/
│       ├── pdfjs
│       └── mammoth
├── tests/
│   └── engine.test.mjs
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
└── README.md
```

## Technology Stack

- Vanilla JavaScript
- JavaScript ES Modules
- PDF.js for PDF document parsing
- Mammoth.js for DOCX document parsing
- Node.js for running tests

No frontend framework or build tools are required.

## Known Limitations

- **Scanned PDFs:** Image-only PDFs are not supported because the document parser extracts text layers rather than performing OCR. Resume text can be pasted manually instead.
- **Unusual resume layouts:** Some documents may produce text in an incorrect order. Compare the original file with **View resume text** and correct the extraction with **Edit resume**.
- **Year-only date ranges:** Dates such as 2020–2022 are treated as covering the complete calendar years.
- **Session data:** Reloading clears resumes, jobs, scores, and review notes.

## Author

**Abhinav Agrawal**

[GitHub Profile](https://github.com/agrawalabhinav372005-lang)
