# Railway deployment

VisaTrack is a monorepo, so Railway needs one service per deployable component. Each
service reads its configuration from the `railway.json` in its root directory.

| Service | Root directory | Config | Health check |
| --- | --- | --- | --- |
| API | `backend` | [backend/railway.json](../../backend/railway.json) | `/health/ready` |
| Worker | `backend` | same image, custom start command `python -m app.workers.main` | none |
| Web | `frontend` | [frontend/railway.json](../../frontend/railway.json) | `/` |

Set the root directory in **Service → Settings → Source**. Without it, Railway builds from
the repository root, where neither `Dockerfile` nor `railway.json` exists.

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
3. **The database is unreachable.** The start script runs `alembic upgrade head` before
   serving, and `/health/ready` executes `SELECT 1`. Both fail when `DATABASE_URL` is
   missing, points at the public proxy from inside the private network, or the Postgres
   service is not attached.

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

Optional: `RUN_MIGRATIONS=false` on any replica that must not apply migrations. Keep it
enabled on exactly one service so schema changes ship with the deployment.

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
