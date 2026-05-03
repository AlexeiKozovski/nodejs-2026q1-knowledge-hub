# Knowledge Hub API

REST API for the **Knowledge Hub** platform (Nest.js, TypeScript, Prisma, PostgreSQL). The service manages **users**, **articles**, **categories**, and **comments** backed by a database.

## Requirements

- **Node.js** `>= 24.10.0`
- **npm** `>= 10`

## Installation

```bash
git clone https://github.com/AlexeiKozovski/nodejs-2026q1-knowledge-hub.git

cd nodejs-2026q1-knowledge-hub

git checkout develop

npm install
```

## Configuration

The application reads its configuration from a `.env` file in the project root.

**1. Create your `.env` file from the provided example:**

```bash
cp .env.example .env
```

**2. Edit .env if needed (default port is 4000):**

```env
PORT=4000
```

| Variable   | Description                                      | Default |
| ---------- | ------------------------------------------------ | ------- |
| `PORT`     | HTTP port the server listens on                  | `4000`  |
| `API_KEY`  | If set, every request must send header `x-api-key` with this value (Swagger at `/doc` is excluded). Omit for local development and tests. | _(unset)_ |
| `POSTGRES_USER` | Database user (Docker Compose / future Prisma) | _(see `.env.example`)_ |
| `POSTGRES_PASSWORD` | Database password | _(see `.env.example`)_ |
| `POSTGRES_DB` | Database name | _(see `.env.example`)_ |
| `POSTGRES_HOST` | Database hostname (`db` inside Compose network) | `db` |
| `POSTGRES_PORT` | Database port | `5432` |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key for AI routes | _(required for `/ai/*`)_ |
| `GEMINI_API_BASE_URL` | Gemini REST host | `https://generativelanguage.googleapis.com` |
| `GEMINI_MODEL` | Model id segment in `…/models/{id}:generateContent` | `gemini-2.0-flash` |
| `GEMINI_HTTP_TIMEOUT_MS` | Optional Gemini HTTP timeout per request (ms) | `120000` |
| `AI_RATE_LIMIT_RPM` | Per-IP throttle for **`AiController` only** (requests per rolling minute); returns **429** with **`Retry-After`** headers when exceeded | `20` |
| `AI_CACHE_TTL_SEC` | In-memory TTL for **summarize** and **translate** cache entries (`article.updatedAt` in key) | `300` |

### Obtaining a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/) (Google account required).
2. Open **Get API key** (or API keys section) and create a key for a Google AI / Gemini Developer API project.
3. Restrict usage in Google Cloud Console if desired; copy the key (do not commit it).

### Gemini model

The service calls `POST …/v1beta/models/${GEMINI_MODEL}:generateContent`. Set **`GEMINI_MODEL`** in `.env` to a model your account and region support (defaults are tuned for **`gemini-2.0-flash`**).

### Running and testing AI routes

**Required `.env` for local runs:** copy from **`.env.example`** and set at least **`DATABASE_URL`**, **`GEMINI_API_KEY`**, **`JWT_SECRET_KEY`**, **`JWT_SECRET_REFRESH_KEY`**, **`CRYPT_SALT`** (see the example file for defaults and optional tuning). **Paste the Gemini key** on the line `GEMINI_API_KEY=...` in **`.env`** (project root, same folder as `package.json` — do not commit this file).

```bash
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_*, CRYPT_SALT, and paste your key into GEMINI_API_KEY=...

npm install
npm run prisma:generate
npm run prisma:migrate   # or your existing migration workflow
npm run db:seed          # optional: sample data and article UUIDs for AI routes
npm run start:dev
```

Article-scoped AI calls need a **real `articleId`** from the database (e.g. from **`GET /article`** or seed output); otherwise the API returns **404**.

Swagger: **`http://localhost:4000/doc`** (`/doc` ignores `API_KEY` if configured).

Examples (replace placeholders):

```bash
# Summarize
curl -s -X POST http://localhost:4000/ai/articles/ARTICLE_UUID/summarize \
  -H "Content-Type: application/json" \
  -d "{\"maxLength\":\"medium\"}"

# Translate (targetLanguage required)
curl -s -X POST http://localhost:4000/ai/articles/ARTICLE_UUID/translate \
  -H "Content-Type: application/json" \
  -d "{\"targetLanguage\":\"en\",\"sourceLanguage\":\"ru\"}"

# Analyze (task optional: review | bugs | optimize | explain)
curl -s -X POST http://localhost:4000/ai/articles/ARTICLE_UUID/analyze \
  -H "Content-Type: application/json" \
  -d "{\"task\":\"review\"}"

# Generic generation (multi-turn optional: send returned sessionId on the next request)
curl -s -X POST http://localhost:4000/ai/generate \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"What is PostgreSQL in one paragraph?\"}"

# Aggregate usage & diagnostics since process start (rate-limited like other /ai routes)
curl -s -H "Accept: application/json" http://localhost:4000/ai/usage

# Continue a conversation started with POST /ai/generate
curl -s -X POST http://localhost:4000/ai/generate \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"Give one drawback.\",\"sessionId\":\"PASTE_SESSION_UUID\",\"resetContext\":false}"
```

All `/ai/*` routes share a dedicated rate limit (`AI_RATE_LIMIT_RPM`), return **429** when exceeded, and may set **`Retry-After`**. Summarize and translate responses are cached in memory for **`AI_CACHE_TTL_SEC`** using a key that includes the article `updatedAt`, so edits invalidate cache.

#### Cross-cutting AI behaviour (assignment checklist)

- **Module & integration**: `AiModule` + `GeminiService` (HTTP to `generativelanguage.googleapis.com`).
- **Prompts**: under `src/ai/prompts/`; controllers contain no prompt text.
- **Validation**: AI bodies use DTOs + global `ValidationPipe` (whitelist / forbid non-whitelisted).
- **Rate limiting**: second Throttler bucket `ai` tied to `AI_RATE_LIMIT_RPM`, only applied to `AiController`; default **100/min** bucket unchanged for the rest of the app.
- **Caching**: in-memory `AiCacheService` for **summarize** and **translate** (deterministic JSON key: type, `articleId`, `updatedAt`, params).
- **Usage + diagnostics**: **`GET /ai/usage`** returns totals, **per-endpoint counters**, optional **Gemini token** sums, rolling **average latency** per endpoint, summarize/translate **cache hit ratios**, and process **uptime** (`AiUsageService`, `AiObservabilityService`).
- **Structured output**: **`class-validator`** DTOs (`GeminiJsonTranslateDto`, `GeminiJsonAnalyzeDto`) validated via **`structured-ai-response.validation.ts`** — translate failures → **503**; analyze misses schema → tolerant fallback + **`schemaValidated: false`** in response.
- **Conversation memory**: **`POST /ai/generate`** accepts optional **`sessionId`** (**UUID v4**) and returns **`sessionId`** to reuse; alternating user/model pairs are capped and evicted via TTL / map size guards (`AiGenerateSessionService`).
- **Errors**: timeouts and network → **503**; exhausted upstream **429**/**5xx** after up to **3** attempts with backoff/`Retry-After` → **503**; **401**/**403** and typical invalid-key **400** payloads → **500** with a generic message (no key in response).
- **Logging**: `GeminiService` uses `AppLogger` and **redacts** substrings that resemble API keys before logging error bodies; request logging still uses the existing HTTP middleware (password/token field redaction).

### Known limitations

- **Quotas and billing**: Free tier and project quotas may return **429** from Google; the client receives **503** after retries in some cases.
- **Regional availability**: Some models or the Developer API may be unavailable in certain countries; errors often mention location or access.
- **Latency**: Large articles and slow networks increase response time; per-request timeout is controlled by **`GEMINI_HTTP_TIMEOUT_MS`** (default **120000** ms when unset).
- **Caching**: In-memory only — not shared across instances; restart clears cache and usage counters.

## Docker

Build and run the API together with PostgreSQL:

```bash
cp .env.example .env
docker compose up --build
```

The API is mapped to **port 4000** (`4000:4000`). Keep `PORT=4000` in `.env` when using this mapping. PostgreSQL is available on **5432** with data in the named volume `postgres_data`. Services use the bridge network **`knowledge-hub`**.

- **Health check:** `GET /` returns `{ "status": "ok" }` (used by the container health check).
- **Adminer** (optional UI for the database): `docker compose --profile debug up --build`, then open `http://localhost:8080` and use server **`db`**, user / password / database from your `.env`.

### Docker Hub image

After you build and push the image from this repository, add your own link here (replace with your Docker Hub namespace):

**https://hub.docker.com/r/alexeikozovski/knowledge-hub**

Example build and push:

```bash
docker build -t alexeikozovski/knowledge-hub:latest .
docker push alexeikozovski/knowledge-hub:latest
```

### Image vulnerability scan

Scan the built image before publishing, for example:

```bash
docker scout cves alexeikozovski/knowledge-hub:latest
# or
trivy image alexeikozovski/knowledge-hub:latest
```

Copy the summary (including whether any **critical** CVEs are present) into your pull request description, as required by the assignment.

## Running the application

| Command            | Description |
| ------------------ | ----------- |
| `npm start`        | Build (if needed) and run the API once (Nest CLI). |
| `npm run start:dev` | Run with **watch** mode (reload on file changes). |
| `npm run start:debug` | Same as `start:dev` with Node inspector. |
| `npm run build`    | Compile TypeScript to `dist/`. |
| `npm run start:prod` | Run compiled app: `node dist/main` (run `npm run build` first). |

After startup, the API is available at:

```text
http://localhost:<PORT>
```

Default: `http://localhost:4000`.

## Using the API

### Conventions

- **Request / response bodies** are **JSON** (`Content-Type: application/json`).
- It is recommended to send **`Accept: application/json`**.
- Identifiers are **UUID v4** unless noted otherwise.

### OpenAPI (Swagger)

Interactive documentation is served at:

```text
http://localhost:4000/doc
```

Use it to explore schemas, try requests, and copy `curl` examples.

### Resource overview

| Prefix       | Purpose |
| ------------ | ------- |
| `/user`      | Users: list, get by id, create, update password, delete. Passwords are never returned in responses. |
| `/article`   | Articles: list (optional filters `status`, `categoryId`, `tag`), CRUD. |
| `/category`  | Categories: list, get by id, create, update, delete. |
| `/comment`   | Comments: list by **`?articleId=`** (required), get by id, create, delete. |

### Quick examples (`curl`)

Replace `4000` if your `PORT` differs.

**List users**

```bash
curl -s -H "Accept: application/json" http://localhost:4000/user
```

**Create a user**

```bash
curl -s -X POST http://localhost:4000/user \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"login\":\"alice\",\"password\":\"secret\"}"
```

**List articles (optional filters)**

```bash
curl -s -H "Accept: application/json" \
  "http://localhost:4000/article?status=published&tag=nodejs"
```

**Create an article** (minimal body; optional fields such as `status`, `authorId`, `categoryId`, `tags` are supported)

```bash
curl -s -X POST http://localhost:4000/article \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Hello\",\"content\":\"Body text\"}"
```

**List comments for an article**

```bash
curl -s -H "Accept: application/json" \
  "http://localhost:4000/comment?articleId=<ARTICLE_UUID>"
```

**Create a comment**

```bash
curl -s -X POST http://localhost:4000/comment \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Nice article\",\"articleId\":\"<ARTICLE_UUID>\"}"
```

If `API_KEY` is set in `.env`, add the header to API calls (not required for `/doc`):

```bash
-H "x-api-key: YOUR_SECRET_KEY"
```

## Testing

| Command | Description |
| ------- | ----------- |
| `npm run test:unit` | Runs unit tests with Vitest (`src/**/*.unit.spec.ts`). |
| `npm run test:coverage` | Runs unit tests with coverage report and fails if thresholds are not met (Lines >= 90%, Branches >= 85%). |
| `npm run test:jest` | Runs Jest integration/e2e tests only. Use when the app is already running on the same `PORT` (e.g. in another terminal: `npm start`). |
| `npm test` | Runs the full pipeline: unit tests, build, start app, run integration/e2e tests, then stop app. |

## Code quality

```bash
npm run lint    # ESLint (with --fix)
npm run format  # Prettier
```
