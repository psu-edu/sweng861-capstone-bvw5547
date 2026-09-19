# Testing strategy and results

## Layers

| Layer | Tool | Where | Count | What it proves |
|---|---|---|---|---|
| Backend unit | Jest | `test/unit/` | 27 | The rules in `rules.js` and the LinkedIn client with fetch mocked. No database, no network. |
| Backend integration | Jest, Supertest, mongodb-memory-server | `test/integration/` | 31 | Every endpoint over real HTTP against a fresh in memory MongoDB. Status codes and response bodies. |
| Frontend component | Vitest, React Testing Library | `frontend/test/` | 29 | Every page rendered inside the real router and auth context, with fetch mocked at the route level. |
| Pipeline | act, Docker, Trivy | `.github/workflows/ci.yml` | 3 jobs | Install, audit, build, test with coverage gates, image build, smoke test, vulnerability scan. |

Total: 87 automated tests. Both coverage commands enforce 80 percent lines and statements.

## Results

| Side | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Backend, `backend/**` | 93.6% | 86.8% | 96.4% | 95.5% |
| Frontend, `src/**` | 94.3% | 90.7% | 96.6% | 95.4% |

`rules.js` and `metrics.js` are at 100 percent statements. The uncovered backend lines are the error handler branch for a 500 and a few defensive checks.

## What the unit tests cover

`rules.test.js`: registration validation reports every error at once. Profile validation differs by role. Job validation fills defaults and accepts numeric strings from forms. Eligibility passes at the exact minimum GPA, fails below it, fails on a closed opening, and fails on a missing major, GPA, or resume. Transitions move forward only and never leave a decided state. The job filter defaults to open, maps every query value, and ignores values it does not understand.

`linkedin.test.js`: the authorize URL carries the state and the role scopes. The token exchange posts the form and maps the response. Userinfo maps sub, name, and email. The share posts as the member and returns the post id. Every LinkedIn failure becomes a 502.

## What the integration tests cover

`auth.test.js`: register with 201, 400 with an error list, and 409 on a duplicate. Login 200 and 401. The me endpoint with a good, missing, and bad token. LinkedIn routes return 503 when not configured. Health and metrics.

`jobs.test.js`: create and read, student cannot post, invalid input, owner only edit and close, list filters by type, department, GPA ceiling, and text, closed hidden by default, mine for professors, 404 and 401, share needs LinkedIn.

`applications.test.js`: profile save and read, empty profile shell, GPA below minimum gives 422 with the reason, missing profile gives 422, apply once then 409, professor cannot apply, only the owner lists applicants and reads the applicant profile, status forward only for the owner, closed opening refuses applications.

`linkedin-callback.test.js`: with the LinkedIn client mocked. State cookie set on start, callback rejects a missing or wrong state, callback creates a professor and redirects with a token, callback links an existing account by email, LinkedIn failure gives 502, a LinkedIn professor can share their own opening, share failure gives 502.

## What the frontend tests cover

Login validation, wrong password message, login and registration with the role, LinkedIn links for both roles, route guard and token clearing on 401. Job list loading, items, filters sent as query parameters, empty state, error with retry, my openings. Opening page: GPA rejection reason, apply and submitted state, already applied, not found, owner reviews an applicant through the statuses, views the profile, shares, closes, share without LinkedIn, another professor sees no controls. Job form validation, create, edit prefilled, server error. Profile forms for both roles. Applications list, empty state, error, logout.

## Auth and authorization cases

| Case | Backend test | Frontend test |
|---|---|---|
| No token, 401 | jobs.test.js "unknown or malformed id gives 404 and no token gives 401" | login.test.jsx "protected route redirects to login" |
| Wrong role, 403 | jobs.test.js "student cannot post", applications.test.js "professor cannot apply" | job-detail.test.jsx "another professor sees no owner controls" |
| Not the owner, 403 | jobs.test.js "only the owner can edit or close", applications.test.js "status moves forward for the owner only" | |
| Cross user data, 403 | applications.test.js "only the owning professor lists applicants and reads the applicant profile" | |
| Login CSRF, 400 | linkedin-callback.test.js "callback rejects a missing or mismatched state" | |

## Gaps

- No browser end to end test. The compose stack is exercised by hand for the demo.
- The real LinkedIn API is not called in tests. The client is unit tested against the documented request shapes and mocked in the flow tests.
- Rate limiting is not implemented, so nothing tests it.
