# Railway deployment

VisaTrack is a monorepo, so Railway needs one service per deployable component. Each
service reads its configuration from the `railway.json` in its root directory.

| Service | Root directory | Config | Health check |
| --- | --- | --- | --- |
| API | `backend` | [backend/railway.json](../../backend/railway.json) | `/health/live` |
| Worker | `backend` | same image, custom start command `python -m app.workers.main` | none |
| Web | `frontend` | [frontend/railway.json](../../frontend/railway.json) | `/` |

Set the root directory in **Service → Settings → Source**. Without it, Railway builds from
the repository root, where neither `Dockerfile` nor `railway.json` exists.

`RAILPACK_PYTHON_VERSION` on a service means Railway is using Railpack, not the
`backend/Dockerfile`. Railpack does not run that image's `CMD`, so it will not pick up
`${PORT}` unless you set a start command or switch the builder to Dockerfile after setting
the root directory to `backend`. Until that switch, use:

```text
sh backend/scripts/start.sh
```

as the service start command (or `sh scripts/start.sh` once the root directory is
`backend`). `backend/Procfile` is the same command for Railpack when the root is
`backend`.

## Why a health check fails

Railway waits for the health check to return `2xx` on the port the container listens on. A
`Network › Healthcheck` failure after the build and deploy steps succeed means the process
never answered there. The three causes to rule out, in order:

1. **Wrong port.** Railway assigns the port through `PORT`. The API start script
   ([backend/scripts/start.sh](../../backend/scripts/start.sh)) binds `${PORT:-8000}`, and
   the web service binds `${PORT:-3000}`. A hard-coded port makes every health check time
   out even though the container is running.
2. **The process exited.** `Settings.validate_security()` refuses to start outside
   `development`, `local`, and `test` when required variables are missing, and lists all of
   them in one error. Check the deploy logs for `Invalid configuration for APP_ENV=`.
3. **The health-check path is not served.** The rollout gate is `/health/live`, which never
   touches the database, so a managed-database hiccup cannot fail a deploy. `/health/ready`
   executes `SELECT 1` and belongs in monitoring instead of the rollout gate.

## Required API variables

Reference the Postgres service instead of pasting credentials:
`DATABASE_URL=${{Postgres.DATABASE_URL}}`. `postgres://` URLs are rewritten to
`postgresql://` at load time, so either scheme works.

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `FRONTEND_ORIGIN` | public URL of the web service, comma-separated for multiple origins |
| `AUTH_SECRET_KEY` | random value of at least 32 bytes |
| `MFA_ENCRYPTION_KEY` | random value, different from `AUTH_SECRET_KEY` |
| `AUTH_COOKIE_SECURE` | `true` |
| `S3_BUCKET_NAME`, `AWS_KMS_KEY_ID`, `AUDIT_ARCHIVE_BUCKET` | AWS resources from [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | credentials for those buckets |
| `RESEND_API_KEY` | transactional email key |
| `FORWARDED_ALLOW_IPS` | `*` so audit logs record the client IP from Railway's proxy instead of the proxy itself |

### Migrations on boot

`RUN_MIGRATIONS` defaults to `false`. The baseline revision runs the `Database/*.sql`
files, which use plain `CREATE TABLE`, so `alembic upgrade head` fails against a database
that already has the schema but no `alembic_version` table. Stamp such a database once
from a machine that can reach it:

```bash
cd backend && alembic stamp head
```

Then set `RUN_MIGRATIONS=true` on exactly one service so later schema changes ship with
the deployment.

Login depends on this: `POST /api/v1/auth/login` writes a row to `user_sessions` and reads
`users.token_version`, both added after the baseline. A database still on the baseline
schema answers login with a `500`, so a deployment that passes its health check can still
fail every sign-in until the pending revisions are applied. All revisions after the
baseline guard their statements with `IF EXISTS`/`IF NOT EXISTS` or create new tables, so
`alembic upgrade head` is safe to run once the baseline is stamped.

## Typical gap against a live API service

These are already enough for the API to talk to storage, mail, and Postgres. They are not
enough to boot with `APP_ENV=production`, and they do not bind Railway's port:

| Status | Variables |
| --- | --- |
| Present | `DATABASE_URL`, `FRONTEND_ORIGIN`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_KMS_KEY_ID`, `S3_BUCKET_NAME`, `S3_MAX_UPLOAD_BYTES`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `BUG_REPORT_TO_EMAIL` |
| Missing, required for production | `APP_ENV=production`, `AUTH_SECRET_KEY` (32+ random bytes), `MFA_ENCRYPTION_KEY` (different 32+ random bytes), `AUTH_COOKIE_SECURE=true`, `AUDIT_ARCHIVE_BUCKET` |
| Recommended | `FORWARDED_ALLOW_IPS=*` |
| Wrong service | `NEXT_PUBLIC_GITHUB_ISSUES_URL` belongs on the frontend, not the API |
| Builder only | `RAILPACK_PYTHON_VERSION` is not read by the app; drop it after switching to the Dockerfile |

Generate the two auth secrets locally and paste the values into Railway — do not commit them:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

`AUDIT_ARCHIVE_BUCKET` is a second S3 bucket (see `.env.example`'s `visatrack-audit-prod`),
not the documents bucket. Without it, `APP_ENV=production` refuses to start.

Do not put `AUTH_SECRET_KEY`, `MFA_ENCRYPTION_KEY`, AWS keys, `DATABASE_URL`, or
`RESEND_API_KEY` in the repository, pull requests, or chat. If any of those values have
been pasted into a ticket or chat, rotate them in AWS, Supabase, Resend, and Railway
before the next deploy.

## Required web variables

`NEXT_PUBLIC_API_URL` is inlined at build time. Railway exposes service variables as build
arguments, so set it on the web service to the API's public URL and redeploy after it
changes; a rebuild is required for the new value to take effect.

## Verifying a deployment

```bash
curl -fsS https://<api-domain>/health/live    # process is up
curl -fsS https://<api-domain>/health/ready   # database is reachable and migrated
```

`/health/live` never touches the database, which makes it the right target when
distinguishing a crashed process from a database problem.
