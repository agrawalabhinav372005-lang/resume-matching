# RESUME MATCHING

A single-user recruiting workspace for collecting resumes, ranking candidates by job, and recording what you verified.

[Open the workspace on GitHub Pages](https://agrawalabhinav372005-lang.github.io/resume-matching/)

## Hiring workflow

1. **Add a job.** Paste the job description, extract the criteria, and check the required skills, experience, education, and credentials before saving.
2. **Collect resumes.** Choose a job in **Assign uploads to**, then upload PDF, DOCX, or TXT files or paste resume text. Resumes with no specific job are considered for every role. Edit a candidate profile to correct the extracted text or change the assignment.
3. **Review the ranking.** Select a job in **Candidate Rankings**. The workspace refreshes scores when resumes or criteria change. Use **Requirements found** or **Needs verification** to filter the ranking. The groups reflect evidence detected in resume text.
4. **Check the evidence.** Open **Review match** to inspect the score breakdown, resume excerpts, and suggested follow-up questions. Record notes and mark the evidence checked yourself. Editing the underlying resume text or role criteria returns checked evidence to **To verify** and keeps the notes.
5. **Compare or export.** Compare up to three candidates side by side or export the complete ranking for the selected role. The CSV includes scores, requirement groups, and verification status.

File parsing and matching run in the browser. Text-based PDFs work directly. For a scanned PDF, paste the extracted text. Match scores reflect the supplied text and support human review.

## Storage and local backend

The GitHub Pages workspace saves records in IndexedDB for the current browser profile. Clearing browser site data removes those records. Use the workspace on a device and browser profile you control.

For a local database, start the Python 3 server from the repository root:

```sh
python3 server.py
```

Open `http://127.0.0.1:8000`. The app saves resume text, job criteria, assignments, and review notes in `workspace-data/workspace.sqlite3`. Use `--database /path/to/workspace.sqlite3` to choose a different file and `--port` to choose a different port. The server listens on the loopback interface for one recruiter. The browser and database modes maintain independent workspaces. Candidate files are supplied through the recruiter's upload and paste controls.

## Matching

| Criterion | Weight |
| --- | ---: |
| Required skills | 60 |
| Preferred skills | 15 |
| Experience | 15 |
| Education | 5 |
| Qualifications | 5 |

The score normalizes the weights to the criteria defined for the role. Overlapping dated roles count once. Ranges written with years only count the complete calendar years. Experience is measured across detected work history. Priority within a tied score goes to candidates with greater required-skill coverage.

## Project layout

- `dist/index.html` and `dist/assets/` contain the workspace UI.
- `dist/js/` contains intake, NLP and scoring, verification, and storage.
- `dist/vendor/` contains the document readers, font, and licenses.
- `server.py` serves the application and the local workspace API.
- `tests/` contains regression tests and fictional fixtures.

Run the regression tests with `node --test`. Pushes to `main` run the tests and publish the static workspace to GitHub Pages.

## Author

Abhinav Agrawal
