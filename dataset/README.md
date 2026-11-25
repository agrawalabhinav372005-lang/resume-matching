# Resume Matching dataset

Download and extract [dataset.zip](dataset.zip) to get 1,200 fictional resumes with Indian names and 48 job descriptions. Each job has a batch of 25 candidates. The resumes are provided as PDF, DOCX, and TXT files.

The archive includes `START-HERE.txt`, candidate and job indexes, and `expected-rankings.csv` with the expected scores, ranks, and requirement groups for all 1,200 candidates in their assigned jobs.

To test a batch, add its `job.txt` to Resume Matching, select that job under **Assign uploads to**, and upload the 25 resumes from its `resumes/` folder. Compare the results with the CSV for that job ID.
