# Fieldnotes · Schoology Client

A personal, dark-mode Schoology workspace built with plain HTML, CSS, and JavaScript. The frontend is static; a Cloudflare Worker keeps the Schoology OAuth consumer secret off the client and signs API requests.

## What's included

- Overview, courses, assignments, grades, calendar, announcements, messages, and notifications views.
- A clearly marked preview workspace so the interface is usable before API access is configured.
- Schoology API sync for the current user, enrolled sections, section assignments, and calendar events where the account permits those endpoints.
- Grades, announcements, messages, and notifications are preview-only. The Worker does not claim that those endpoints are available to your API credentials.
- The Worker accepts only read-only requests to an explicit endpoint allowlist and requires a separate private bearer token.

## Requirements

- A Cloudflare account with Workers enabled and Wrangler installed (`npm install --global wrangler`).
- A Schoology API consumer key and secret issued by an administrator with the necessary API permissions. Personal API keys may not access other users' data, and school settings can restrict endpoints.
- A private token for this Worker. Generate one locally with `openssl rand -hex 32`; do not commit it or put it in frontend source.

## Deploy the Worker

From the repository root, install/authenticate Wrangler if needed, then set the server-side secrets:

```sh
npm install --global wrangler
wrangler login
wrangler secret put SCHOOLOGY_CONSUMER_KEY --config backend/wrangler.toml
wrangler secret put SCHOOLOGY_CONSUMER_SECRET --config backend/wrangler.toml
wrangler secret put CLIENT_ACCESS_TOKEN --config backend/wrangler.toml
```

Paste each value into Wrangler's prompt. The token must be the same private token you'll enter in the frontend connection dialog. Set `ALLOWED_ORIGINS` in [backend/wrangler.toml](backend/wrangler.toml) to the exact origin serving the frontend, then deploy:

```sh
wrangler deploy --config backend/wrangler.toml
```

The command prints your Worker URL. Keep the Worker private: the bearer token is a second gate, and both its value and the Worker URL should only be given to your own browser. CORS is not authentication; do not remove the bearer-token check.

## Run locally

Serve the `frontend` directory over HTTP (opening `index.html` directly will not work reliably):

```sh
python3 -m http.server 8000 --directory frontend
```

Open `http://localhost:8000`, select **Connect Schoology**, and enter the deployed Worker URL and the same private token. For local use, the default Worker config already permits `http://localhost:8000`.

## Publish the frontend

GitHub Pages can publish the `frontend` directory as the site source if configured for this repository. For a `username.github.io` project page, set `ALLOWED_ORIGINS` to the exact published origin (for example `https://mrguy987.github.io`). Redeploy the Worker after changing the origin. Do not publish API consumer credentials or your private access token in the repository.

## API notes

Schoology's API uses OAuth 1.0a HMAC-SHA1. The Worker percent-encodes and sorts query and OAuth parameters before signing each request. It currently exposes `GET /api/me`, `GET /api/sections`, `GET /api/events`, and `GET /api/sections/{id}/assignments`, `/updates`, or `/grades`. The interface only syncs profile, sections, assignments, and events. Schoology API access and response shapes vary by school; inspect Worker logs and the official Schoology API documentation if a permitted endpoint returns an error.

Never put the OAuth consumer secret in `frontend/`, browser storage, or a public repository. Treat the Worker token as a password: anyone who knows it and the Worker URL can make requests through your Schoology connection.
