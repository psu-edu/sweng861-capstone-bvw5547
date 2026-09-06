# Campus Works (Student Jobs)

Campus Works is a job board for internal campus positions such as research assistantships and TA roles. Professors post openings and review applicants. Students build a profile and apply with a resume link once they meet the GPA requirement.

**Author:** Bin Wu

**Course:** SWENG-861

## Project Category

Campus Project Portfolio. Project J: Campus Works (Student Jobs).

## Core Features

Must have:

1. Auth. Two user roles. Professors post and manage openings. Students browse
   and apply. Login with a LinkedIn account is also supported.
2. Profiles. Students store major, GPA, skills, and a resume link. Professors
   store department and contact info.
3. Job board. Professors create, edit, and close openings. Students search and
   filter open positions.
4. Applications. The submit application workflow verifies GPA eligibility,
   stores the resume link, then notifies the professor.

Nice to have:

1. Share an opening. A professor posts an opening to their LinkedIn feed.
2. Email notification when an application status changes.

## Architecture

```
React client  ->  Express API  ->  DynamoDB
                       |
                       +-- /api/auth
                       +-- /api/profiles
                       +-- /api/jobs
                       +-- /api/applications
```

One Express app with four route groups, one DynamoDB table each: users,
profiles, jobs, and applications.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Language | JavaScript (Node.js) |
| Frontend | React with Vite |
| Backend | Node.js with Express |
| Data | Amazon DynamoDB (DynamoDB Local for development) |
| Auth | JWT sessions, LinkedIn login supported |
| Containers | Docker and Docker Compose |
| CI/CD | GitHub Actions |
| Observability | Prometheus and Grafana |

## External Integration: LinkedIn

Users can log in with a LinkedIn account instead of creating another password.
A professor can also share an opening to their LinkedIn feed, listed above as
a nice to have.


## Repository Structure

```
/
├── docs/                   Proposal, architecture diagrams
├── src/
│   ├── client/             Frontend
│   └── server/             API
├── .env.example
├── .gitignore
└── README.md
```

The remaining folders from the course starter template (`.github/workflows`,
`ops`, `tests`) are added when there is something to put in them.

## How to Run

Only placeholders exist right now. The API stub runs with no dependencies:

```bash
node src/server/index.js
```

Then open `src/client/index.html` in a browser.

## Notes

Do not commit secrets or API keys. Copy `.env.example` to `.env` for local values.
