# Security

## Environment and secrets

- **Never commit real API keys or secrets.** The `.env` file is in `.gitignore`; keep it that way and do not force-add it.
- Use `.env` only for local development. Set real values in your environment or a secure secrets manager in production.
- If **Algolia**, **SendGrid**, **JWT_SECRET**, **DATABASE_URL**, or any other secret was ever committed to the repository:
  1. **Rotate the credentials immediately** (Algolia dashboard, SendGrid, new DB password, new JWT_SECRET, etc.).
  2. Remove the secrets from git history (e.g. `git filter-repo` or [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)) or create a new repo and re-add code without secrets.
  3. Ensure `.env` and `.env.local` are listed in `.gitignore` and are never committed.

## Placeholder .env

The repo’s `.env` and `.env.template` use empty or placeholder values. Copy `.env.template` to `.env` and fill in real values only on your machine; never commit those values.
