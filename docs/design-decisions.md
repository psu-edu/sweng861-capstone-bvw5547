# Design decisions

Each entry says what I chose, what I considered, and why.

## MongoDB instead of DynamoDB

The proposal said DynamoDB. I switched to MongoDB with mongoose. The goal for this course is a system anyone can run locally with one command. DynamoDB Local works but needs the AWS SDK, table creation scripts, and a different query model for every filter. MongoDB gives text search and compound indexes out of the box and runs as one container. The data model did not change. The trade is that a real deployment would pick a managed MongoDB rather than a serverless table.

## Rules in a pure module

Validation, the GPA check, status transitions, and the job filter live in `rules.js` with no I/O. Routes call them and map the result to a status code. This keeps the routes short and makes the important logic testable in milliseconds. The unit suite for this file runs 20 cases with no database.

## JWT in the client, no server session

The API is stateless. A login returns a JWT with the user id, role, and name, valid for 8 hours. Every protected route reads the bearer header. The client stores the token in localStorage. I considered httpOnly cookies. They resist XSS better but need CSRF protection and complicate the LinkedIn redirect. For a campus app behind a login the token approach is the simpler and more common choice, and React escapes rendered content so stored XSS is unlikely.

## LinkedIn by hand, not through a library

The sign in flow is three HTTP calls: authorize redirect, token exchange, userinfo. The share is one POST. Writing them with fetch is about 90 lines and leaves no library to audit. The state parameter goes in a short lived httpOnly cookie and is checked on the callback, which blocks login CSRF. The token needed for sharing is stored on the user document and excluded from every JSON response.

## Role picked at registration, LinkedIn keeps it

LinkedIn does not know whether a member is a student or a professor. The LinkedIn button carries the role, and the role is only used when the account is new. An existing account keeps its role. Professors get the extra `w_member_social` scope so they can share. Students never grant posting rights.

## Ownership checks in the routes

Every write on an opening or an application checks that the caller owns the opening. A professor can read an applicant profile only when that student applied to one of their openings. These checks live next to the routes rather than in a generic policy layer because there are four of them and the rule is easy to read in place.

## Snapshot GPA and resume on the application

The application copies the GPA and resume link at apply time. The professor reviews what the student submitted, and a later profile edit cannot move an application over the bar after the fact.

## Nginx in front of the client

The web container serves the built React app and proxies `/api` and `/auth` to the API. The browser sees one origin, so there is no CORS configuration. The same layout works in development, where Vite's dev server proxies the same two paths.

## Observability copied from the weekly assignment

Logging, metrics, health endpoints, the Dockerfile, the compose stack, and the CI workflow follow the patterns from week 6. The metric names changed to match the domain. Reusing a proven layout meant these parts took an hour instead of a day.

## What I would change with more time

- Move sessions and rate limiting to Redis before running more than one API replica.
- Add email notification on status change through a queue.
- Store resumes as files with size and type checks instead of links.
- Add end to end tests with Playwright against the compose stack.
