# Requirements and success criteria

## Problem

Research assistant and TA openings at a university are posted wherever each professor chooses: a lab page, a course forum, an email list. Students look in many places and miss openings they qualify for. Professors get fewer applicants and screen GPA by hand.

## Users

- Students looking for RA and TA positions. They want one list, filters that match their situation, and a clear answer on whether they qualify.
- Professors and lab leads who need to fill positions. They want to post once, see only eligible applicants, and reach students where they already are.

## Functional requirements

| Id | Requirement | Done when |
|---|---|---|
| F1 | Two roles, student and professor, chosen at registration | A student cannot post an opening. A professor cannot apply. The API returns 403 in both cases. |
| F2 | Login with email and password | Register, login, and a bearer token that works on every protected route. |
| F3 | Login with LinkedIn | A user with no account gets one from the LinkedIn profile. A user with a matching email gets linked. |
| F4 | Student profile with major, GPA, skills, resume link | Saved and read back. GPA outside 0 to 4 is refused. |
| F5 | Professor profile with department and contact | Saved and read back. |
| F6 | Professors create, edit, and close openings | Only the owner can edit or close. Others get 403. |
| F7 | Students search and filter open positions | Text search, department, type, and a GPA ceiling all narrow the list. Closed openings are hidden by default. |
| F8 | Apply with a GPA check | An application is created only when the profile is complete, the opening is open, and the GPA meets the minimum. Otherwise the API returns 422 with the reason. |
| F9 | One application per student per opening | A second attempt returns 409. |
| F10 | Professors review applicants and change status | Only the owning professor. Status moves forward only: submitted, reviewed, accepted, rejected. |
| F11 | Professor reads an applicant profile | Only when that student applied to one of the professor's openings. |
| F12 | Share an opening on LinkedIn | A professor signed in through LinkedIn posts the opening to their feed and gets the post id back. |

## Non functional requirements

| Id | Requirement | Done when |
|---|---|---|
| N1 | Runs on one machine with one command | `docker compose up` starts web, API, database, Prometheus, and Grafana. |
| N2 | No secrets in the repo or the image | `.env` is ignored. Trivy and `docker history` show nothing. |
| N3 | Observable | Every request logs a JSON line with a request id. `/metrics` exposes request and domain counters. Grafana shows traffic, errors, latency, and applications. |
| N4 | Tested | Unit tests on the rules, integration tests on every endpoint, component tests on every page. Coverage above 80 percent on both sides, enforced in CI. |
| N5 | Fast enough for a campus | p95 under 500 ms for the job list at 50 concurrent users. Measured on the dashboard. |
| N6 | Secure by default | Passwords hashed with bcrypt. JWT expires in 8 hours. Ownership checked on every write. LinkedIn state parameter checked on callback. Non root container. |

## Out of scope

- Email notification on status change. Logged as an event instead.
- File upload for resumes. A link is stored.
- Admin role and moderation.
