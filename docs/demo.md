# How to demo

About 6 minutes. Everything below runs from the compose stack after the seed step in the README.

## Before the demo

1. `docker compose -f docker/docker-compose.yml up -d --build`
2. `docker compose -f docker/docker-compose.yml exec api node scripts/seed.js`
3. Open four tabs: http://localhost:8080, http://localhost:3000/docs, http://localhost:3001/d/campus-works, and a terminal with `docker compose -f docker/docker-compose.yml logs -f api`.
4. Log out of any LinkedIn session in the browser you use, so the LinkedIn consent screen shows.

## Flow

| Step | Do | Say |
|---|---|---|
| 1 | Show http://localhost:8080 login page | Two ways in: email and password, or LinkedIn as a student or a professor. |
| 2 | Log in as student2@psu.edu, GPA 2.8 | Openings page. Filters: type, department, my GPA. Type 2.8 in the GPA box and search. Only the calculus TA shows. |
| 3 | Clear the GPA filter, open the vision lab RA, minimum 3.5, click Apply | The API refuses with the exact reason. Point at the log line with the request id in the terminal. |
| 4 | Log out, log in as student@psu.edu, GPA 3.7, open the same RA, Apply | Submitted. Show My applications. |
| 5 | Log out, click Continue with LinkedIn as a professor | Consent screen, then straight into the app with the LinkedIn name. Mention the state cookie check. |
| 6 | Profile, set department, save. Post opening: title, department, RA, min GPA 3.0 | The opening shows in My openings. |
| 7 | Open the vision lab RA as prof@psu.edu instead, or use the LinkedIn professor's new opening after a student applies | Applicants table with GPA at apply time. Click View profile, then Mark reviewed, then Accept. |
| 8 | Click Share on LinkedIn on an opening owned by the LinkedIn professor | Toast with the post id. Open LinkedIn in a tab and show the post with the link back. |
| 9 | Swagger at /docs | Every endpoint documented from the source. Try /health. |
| 10 | Grafana | Request rate by route, error rate with the 422 from step 3, p95 latency, applications by outcome, login success rate, LinkedIn shares. |

## Fallbacks

- If LinkedIn login fails, log in as prof@psu.edu with the password and say the LinkedIn path is covered by the mocked flow tests. Show `test/integration/linkedin-callback.test.js`.
- If the share returns 502, LinkedIn is rate limiting or the token expired. Sign in through LinkedIn again and retry once.
- If Grafana panels are empty, click around the app for a minute and set the time range to the last 15 minutes.
