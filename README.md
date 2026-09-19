Author Name: Bin Wu
Course Name: SWENG 861 - Software Construction
Description: Campus Works. A job board for research assistant and TA openings. Professors post, students apply after a GPA check, LinkedIn handles sign in and sharing.

## What it does

Research assistant and TA openings are posted wherever each professor chooses, so students miss them and professors screen GPA by hand. Campus Works puts every opening in one list and runs the GPA check before an application goes through.

- Two roles. Professors post, edit, close, and share openings and review applicants. Students keep a profile and apply.
- Login with email and password, or with LinkedIn. Both roles can use either.
- The apply step checks the profile is complete and the GPA meets the opening's minimum. The API refuses with the reason otherwise.
- A professor signed in through LinkedIn can post an opening to their LinkedIn feed with one click.
- Structured JSON logs, Prometheus metrics, health endpoints, and a Grafana dashboard.

## Run it with Docker

Prerequisites: Docker Desktop. Nothing else.

```powershell
Copy-Item .env.example .env
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec api node scripts/seed.js
```

| Service | URL |
|------|--------------|
| Web app | http://localhost:8080 |
| API and Swagger docs | http://localhost:3000/docs |
| Grafana dashboard | http://localhost:3001/d/campus-works (admin / admin) |
| Prometheus | http://localhost:9090 |

The seed step creates four accounts. The password for all of them is `Password123`.

| Email | Role | Notes |
|------|--------------|--------------|
| prof@psu.edu | professor | Owns three openings in Computer Science |
| prof2@psu.edu | professor | Owns one opening in Mathematics |
| student@psu.edu | student | GPA 3.7, qualifies for three openings |
| student2@psu.edu | student | GPA 2.8, qualifies for one opening |

LinkedIn sign in and sharing need a LinkedIn developer app. Put its client id and secret in `.env`. Without them the app runs and the LinkedIn buttons return a clear "not configured" message.

Stop everything with `docker compose -f docker/docker-compose.yml down`. Add `-v` to also drop the data.

## Run it for development

Prerequisites: Node.js 22 or newer, and a MongoDB on localhost:27017. The quickest MongoDB is `docker run -d --name mongo-local -p 27017:27017 mongo:8`.

```powershell
npm install
Copy-Item .env.example .env
npm run seed
npm start
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/auth` to the API on port 3000.

## Run the tests

Backend, from the repo root. Unit tests need nothing. Integration tests start their own in memory MongoDB.

```powershell
npm test
npm run test:coverage
```

Frontend, from `frontend/`:

```powershell
npm test
npm run test:coverage
```

Both coverage commands fail below 80 percent lines and statements.

## CI pipeline

`.github/workflows/ci.yml` runs on every push and pull request to `main`. Backend and frontend jobs install, audit dependencies at the high level, build, and test with the coverage gate. A package job then builds the API image, starts it next to MongoDB and checks `/health`, and scans it with Trivy. High or critical findings fail the job.

GitHub Actions is disabled by the organization on this repository, so the pipeline runs locally with [act](https://github.com/nektos/act):

```powershell
act push -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

## Repository layout

| Path | What it holds |
|------|--------------|
| `backend/app.js`, `backend/index.js` | Express app and the server entry point |
| `backend/auth.js` | Local login, JWT, LinkedIn sign in, requireAuth and requireRole |
| `backend/rules.js` | Business rules: validation, GPA eligibility, status transitions, job filters |
| `backend/db.js` | Mongoose models and data access |
| `backend/routes/` | profiles, jobs, applications |
| `backend/services/linkedin.js` | LinkedIn token exchange, userinfo, and share |
| `backend/logger.js`, `backend/metrics.js` | Structured logs and Prometheus metrics |
| `frontend/src/` | React client: api client, auth context, pages, components |
| `test/`, `frontend/test/` | Backend unit and integration tests, frontend component tests |
| `docker/` | Dockerfile, compose stack, Prometheus and Grafana config |
| `scripts/seed.js` | Demo accounts and openings |

## Secrets

`.env` is ignored by git and Docker. `.env.example` lists every key with a placeholder. The LinkedIn secret and the JWT secret never appear in code, images, or logs.
