# Knowledge Hub API

REST API for the **Knowledge Hub** platform (Nest.js, TypeScript). The service manages **users**, **articles**, **categories**, and **comments** with in-memory storage (ready to be swapped for a database later).

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

| Command        | Description |
| -------------- | ----------- |
| `npm test`     | Builds the project, starts the server on the configured port, runs Jest e2e tests against it, then stops the server. |
| `npm run test:jest` | Runs Jest only. Use when the app is **already running** separately on the same `PORT` (e.g. second terminal: `npm start`). |

## Code quality

```bash
npm run lint    # ESLint (with --fix)
npm run format  # Prettier
```
