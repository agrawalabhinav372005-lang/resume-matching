# ResuMatch — Smart Resume Screener

ResuMatch is a browser-based resume screening tool I built to make the initial candidate screening process faster and easier.

Upload candidate resumes, add a job description, and get ranked results based on skills, experience, education, and qualifications. The application also highlights missing skills and suggests questions that can be useful during interviews.

The application processes documents directly in the browser, without uploading candidate data to a backend server.

**[Live Demo](https://agrawalabhinav372005-lang.github.io/resume-matching/)**

## Features

- **Resume upload:** Upload PDF, DOCX, or TXT files, or paste resume text directly.
- **Job description analysis:** Extract skills, experience requirements, and education criteria from job descriptions.
- **Candidate ranking:** Calculate match scores and rank candidates for a particular role.
- **Skill analysis:** View matched skills, missing requirements, and suggested interview questions.
- **Candidate comparison:** Compare 2–3 candidates side by side.
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

The scores reflect information extracted from submitted resume text. They do not independently verify a candidate's qualifications or experience. Always review the original resume before making a hiring decision.

## Running Locally

Python 3 is required.

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open the following address in your browser:

`http://127.0.0.1:8000`

The application runs in the browser and does not require a backend server, API keys, or a build step.

## Running Tests

Node.js 20 or later is required.

```bash
node --test
```

## Project Structure

```text
resume-matching/
├── dist/
│   ├── index.html
│   ├── assets/
│   │   ├── styles.css
│   │   └── extras.css
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
- **Unusual resume layouts:** Some documents may produce text in an incorrect order. Review the extracted text under "View original resume text" before evaluating a candidate.
- **Year-only date ranges:** Dates such as 2020–2022 are treated as covering the complete calendar years.

## Author

**Abhinav Agrawal**

[GitHub Profile](https://github.com/agrawalabhinav372005-lang)