# Gita - GitHub Issue Triage Agent

Gita receives GitHub issue webhooks, classifies them with Google Gemini, applies deterministic policy rules, and optionally adds labels, comments, and assignees. Its audit log records each triage decision, token usage, and latency.

## Why it's built this way

| Concern | Design |
|---|---|
| **Prompt injection** (issue bodies are untrusted) | Gemini receives one forced tool (`submit_triage`) with enum-constrained output. It cannot call GitHub directly. Untrusted text is delimited and defanged. |
| **Model ≠ decision-maker** | `src/policy.ts` is a pure function that turns the model's *proposal* into actions. LLM free-text is never posted verbatim (mentions/links stripped, templates only). |
| **Hallucinated duplicates** | `duplicate_of` must be in the retrieved candidate set *and* ≥ `duplicateThreshold`. |
| **Blast radius** | Never closes, locks, or deletes. Only labels, templated comments, optional assignment. `DRY_RUN=true` by default. |
| **Low confidence** | Below `confidenceThreshold` → only `needs-triage`; a human decides. |
| **Security reports** | No details echoed publicly; points reporter to private advisories; pings Slack. |
| **Idempotency** | Skips PRs, bots, locked, already-`triaged`, already-commented (webhook redelivery safe). |
| **Ops** | HMAC-verified webhooks, repo allowlist, bounded concurrency, JSONL audit log with tokens + latency + full decision. |
| **Quality** | `npm run eval` regression fixtures (incl. injection + security cases). Run before changing prompt/model. |

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create the local environment file:

```powershell
Copy-Item .env.example .env
```

3. Set the required values in `.env`:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_MODELS=gemini-3.8-flash,gemini-2.5-flash
GITHUB_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-random-webhook-secret
ALLOWED_REPOS=owner/repository
DRY_RUN=true
CONCURRENCY=3
PORT=3000
```

The server loads `.env` automatically. `GOOGLE_API_KEY` is also accepted as a Gemini key, but `GEMINI_API_KEY` takes precedence.

For read and dry-run operations, the GitHub token needs repository read access. For `DRY_RUN=false`, it needs permission to manage issue labels and comments and, when owner assignment is enabled, permission to manage assignees.

Edit `triage.config.json` to configure classification areas, confidence thresholds, duplicate thresholds, and owner assignment.

## Run

Development server:

```powershell
npm run dev
```

The server is available at `http://localhost:3000`. Verify it with:

```powershell
curl.exe http://localhost:3000/healthz
```

Run a dry-run triage for an existing issue:

```powershell
npm run triage -- owner/repository 123
```

Apply labels and comments:

```powershell
npm run triage -- owner/repository 123 --apply
```

Run the regression evaluations:

```powershell
npm run eval
```

## Webhook configuration

In the GitHub repository, open **Settings** → **Webhooks** → **Add webhook**:

- Payload URL: `https://<public-host>/webhook`
- Content type: `application/json`
- Secret: the value of `GITHUB_WEBHOOK_SECRET`
- Events: **Issues**

GitHub sends the `issues.opened` event to Gita. The server acknowledges the webhook quickly and processes the issue through a bounded queue.

For local development, expose port `3000` through a tunnel or forwarding tool before configuring the webhook.

## Behavior

- `DRY_RUN=true` by default; classification runs but GitHub changes are not applied.
- Issues are skipped when they are pull requests, authored by bots, locked, already triaged, or already marked by Gita.
- Pull requests are not treated as issues.
- Low-confidence decisions receive `needs-triage`.
- Duplicate and security decisions require the configured policy thresholds and rules.

## Build

```powershell
npm run typecheck
npm run build
npm start
```

This starts the compiled server from `dist/server.js` on port `3000` or `PORT`.

## Production features

Potential next steps:

1. **GitHub App authentication** instead of a PAT, with per-repository installs and configuration.
2. **Embedding-based duplicate retrieval** instead of keyword search.
3. **Feedback loops** that learn from maintainer label corrections.
4. **Postgres analytics**: swap `data/audit.jsonl` for a table → dashboard of time-to-first-response, label accuracy, $/issue.
5. **Retriage on `issues.edited`** when the reporter adds the info you asked for (drops `needs-info`).
6. **Code-aware routing**: map stack traces/paths to CODEOWNERS.
