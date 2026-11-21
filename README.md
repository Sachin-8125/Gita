# Gita -> issue-triage-agent

Claude-powered GitHub issue triage. Webhook in → classify → deterministic policy → labels / comment / routing → audit log.

## Why it's built this way

| Concern | Design |
|---|---|
| **Prompt injection** (issue bodies are untrusted) | Claude gets *one* forced tool (`submit_triage`) with enum-constrained output. It cannot call GitHub. Untrusted text is delimited + defanged. |
| **Model ≠ decision-maker** | `src/policy.ts` is a pure function that turns the model's *proposal* into actions. LLM free-text is never posted verbatim (mentions/links stripped, templates only). |
| **Hallucinated duplicates** | `duplicate_of` must be in the retrieved candidate set *and* ≥ `duplicateThreshold`. |
| **Blast radius** | Never closes, locks, or deletes. Only labels, templated comments, optional assignment. `DRY_RUN=true` by default. |
| **Low confidence** | Below `confidenceThreshold` → only `needs-triage`; a human decides. |
| **Security reports** | No details echoed publicly; points reporter to private advisories; pings Slack. |
| **Idempotency** | Skips PRs, bots, locked, already-`triaged`, already-commented (webhook redelivery safe). |
| **Ops** | HMAC-verified webhooks, repo allowlist, bounded concurrency, JSONL audit log with tokens + latency + full decision. |
| **Quality** | `npm run eval` regression fixtures (incl. injection + security cases). Run before changing prompt/model. |

## Run it

```bash
cp .env.example .env        # fill in keys
npm install
npm run eval                # sanity-check classification quality
npm run triage -- owner/repo 123            # dry run on a real issue
npm run triage -- owner/repo 123 --apply    # actually label/comment
npm run dev                 # webhook server on :3000
```

GitHub → repo Settings → Webhooks: payload URL `https://<host>/webhook`, content type any, secret = `GITHUB_WEBHOOK_SECRET`, event **Issues**.
Token needs `issues: write` (fine-grained PAT) on the target repos. Edit `triage.config.json` for your areas/owners.

Docker: `docker build -t triage . && docker run --env-file .env -p 3000:3000 triage`

## What turns this into a product

1. **GitHub App auth** (`@octokit/auth-app`) instead of a PAT → multi-tenant installs, per-repo config from `.github/triage.json`.
2. **Embedding-based duplicate retrieval** (pgvector) instead of keyword search; Claude only adjudicates top-k.
3. **Feedback loop**: listen for `issues.labeled/unlabeled` by humans → store corrections → feed into evals and few-shot examples. This is the moat.
4. **Postgres analytics**: swap `data/audit.jsonl` for a table → dashboard of time-to-first-response, label accuracy, $/issue.
5. **Retriage on `issues.edited`** when the reporter adds the info you asked for (drops `needs-info`).
6. **Code-aware routing**: map stack traces/paths to CODEOWNERS.
