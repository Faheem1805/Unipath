# Running and operating UniPath

These are application procedures and requirements. They do not provision Azure resources, configure cloud networking, or implement the portfolio’s infrastructure exercises.

## Startup, release and replicas

1. Supply secrets and exact allowed origins through the environment.
2. Make PostgreSQL reachable and establish a backup appropriate to the release.
3. Run the migration job once and check its exit status.
4. Start or replace API replicas; each checks database connectivity and schema presence before listening.
5. Route requests through the frontend/proxy and check readiness plus an authenticated request.

Local Compose encodes this dependency chain:

```sh
docker compose up --build
docker compose ps -a
docker compose logs migrate
docker compose logs --tail 50 backend
```

When using an external PostgreSQL service, replace `DATABASE_URL` and use a separate migration task. PostgreSQL must support standard Prisma PostgreSQL semantics, transactions, JSONB, arrays and unique constraints. Configure verified TLS and size total connections as `replicas × per-replica connection_limit`, leaving capacity for migrations, backups and administrative access. The default API pool limit in Compose is 10 per replica.

Do not run `prisma migrate dev` or `db push` on production. Do not place migrations in backend startup. A future migration should be reviewed for compatibility with both old and new application replicas before a rolling release. The seed is idempotent and never changes an existing curriculum document.

Multiple API instances use the same database and `RATE_LIMIT_SECRET`, compatible cookie configuration, and the same exact allowed origins. There is no instance session affinity requirement. Nginx now resolves the backend at runtime through Docker DNS and follows changed addresses. See [staging release instructions](STAGING.md) for production identities, proxy trust and acceptance.

For a local scaling experiment on a machine with Docker:

```sh
docker compose up -d --scale backend=2
```

This example is not a verified benchmark or an Azure scaling configuration. Verify cookies and rate limits across your own instances. Backend containers publish no host port; do not expose an untrusted direct path around the proxy.

## Health and logs

| Endpoint        | Expected behavior                                                                         |
| --------------- | ----------------------------------------------------------------------------------------- |
| `/health/live`  | 200 if the Express process is serving requests                                            |
| `/health/ready` | 200 after a successful PostgreSQL probe; 503 when it cannot reach the critical dependency |
| `/health/web`   | 200 from the Nginx frontend                                                               |

Health probes intentionally do not require authentication and do not consume API rate buckets. API startup probes all model columns for release-schema presence. Readiness remains a bounded connectivity probe; migration status/diff and compatibility review are separate release requirements in [STAGING.md](STAGING.md).

Request logs go to stdout as JSON: request ID, method, route template, status and duration. Operational logs include startup, shutdown, account creation, imports, cleanup failures and safe application errors. Sensitive request data is not included. Capture stdout/stderr using your chosen platform logging tools. Browser errors display a request ID for correlation.

API shutdown on Linux SIGTERM/SIGINT drains connections and disconnects Prisma. The 15-second forced deadline fits inside the explicit 25-second container stop grace; request and database budgets are documented in [STAGING.md](STAGING.md). Abrupt VM/process loss is still possible; persistent state is in PostgreSQL.

## Bootstrap an administrator

There are no default accounts. A bootstrap administrator is created through stdin JSON, never public signup. The application CLI uses the same scrypt hashing as registration. Use a unique email and a password of at least 16 characters.

On PowerShell, this interactive method keeps the password out of your shell command history:

```powershell
$adminEmail = Read-Host 'Administrator email'
$adminName = Read-Host 'Administrator name'
$adminSecurePassword = Read-Host 'Administrator password (16+ characters)' -AsSecureString
$adminCredential = [System.Management.Automation.PSCredential]::new('unipath-bootstrap', $adminSecurePassword)
$adminJson = @{ email=$adminEmail; name=$adminName; password=$adminCredential.GetNetworkCredential().Password } | ConvertTo-Json -Compress
$adminJson | pnpm admin:create
$adminJson = $null
$adminCredential = $null
$adminSecurePassword = $null
```

For the containerized database, pipe the same JSON into the migration image instead of a local URL:

```powershell
$adminJson | docker compose run --rm -T migrate node node_modules/tsx/dist/cli.mjs backend/src/create-admin.ts
```

Run that alternative **before** clearing the variables. The migration image contains the administrative CLI; the lean request-serving image does not contain TypeScript source. Do not include real credentials in issue reports, load-test files or committed scripts.

On Bash, use a silent prompt and send JSON through stdin:

```bash
read -r -p 'Admin email: ' UNIPATH_ADMIN_EMAIL
read -r -p 'Admin name: ' UNIPATH_ADMIN_NAME
read -r -s -p 'Admin password (16+ characters): ' UNIPATH_ADMIN_PASSWORD
export UNIPATH_ADMIN_EMAIL UNIPATH_ADMIN_NAME UNIPATH_ADMIN_PASSWORD
node -e 'process.stdout.write(JSON.stringify({email:process.env.UNIPATH_ADMIN_EMAIL,name:process.env.UNIPATH_ADMIN_NAME,password:process.env.UNIPATH_ADMIN_PASSWORD}))' | pnpm admin:create
unset UNIPATH_ADMIN_EMAIL UNIPATH_ADMIN_NAME UNIPATH_ADMIN_PASSWORD
```

The password exists briefly in process memory/environment; use a trusted administrative workstation. No credential is echoed by the application. Administrators can open Administration immediately, including with an empty catalog and no student profile. A bootstrap command fails on an existing email rather than silently promoting or resetting another account. For the production stack, include `--env-file .env.production -f docker-compose.production.yml` in Compose commands.

## Backup and restore

Back up PostgreSQL, not container files. A volume makes local data persistent; it is not itself a backup. Choose backup scheduling, encryption, access controls, off-host copies, retention and recovery targets as your own infrastructure exercise. Test restoration before relying on a backup.

The following portable Compose commands avoid redirecting a binary dump through older PowerShell versions:

```sh
docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/unipath.dump'
docker compose cp database:/tmp/unipath.dump ./unipath.dump
```

Copy/encrypt/store the dump in your own chosen backup system. It contains private student records and session digests. Keep it outside Git. To test a restore into a **new disposable database**:

```sh
docker compose cp ./unipath.dump database:/tmp/unipath-restore.dump
docker compose exec -T database sh -c 'createdb -U "$POSTGRES_USER" unipath_restore_check'
docker compose exec -T database sh -c 'pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d unipath_restore_check /tmp/unipath-restore.dump'
docker compose exec database sh -c 'psql -U "$POSTGRES_USER" -d unipath_restore_check'
```

The last command opens an interactive SQL prompt. Issue `SELECT count(*) FROM "Curriculum";`, inspect the result, and use `\q` to exit. Validate restored student counts and synthetic credentials against the restored database before considering the exercise successful. Never restore over a live database without an explicit recovery procedure. Current disposable restore evidence is recorded in [STAGING_VERIFICATION.md](STAGING_VERIFICATION.md).

For managed PostgreSQL, use the service’s supported dump/restore or point-in-time recovery workflow; do not assume all extensions/roles transfer automatically. Restore drills, disaster simulations and Azure recovery architecture are intentionally not implemented.

## Load testing

The supplied k6 suite uses modest concurrency and 30-second scenarios. All checks and timing thresholds are test targets, not recorded performance results. Test only your own local/staging application.

```sh
k6 run tests/load/unipath.js
```

Environment variables:

- `BASE_URL`: frontend origin, default `http://localhost:8080`.
- `ORIGIN`: exact browser origin accepted by the API; defaults to `BASE_URL`.
- `LOAD_EMAIL`, `LOAD_PASSWORD`: optional existing synthetic account credentials, supplied through environment variables.
- `COOKIE_NAME`: use only if changed from `unipath_session`.

Create a synthetic account with a degree profile before enabling the private dashboard scenario. The login happens once in setup; the opaque cookie is supplied to test VUs. Teardown logs it out. Never print the setup result, save a session cookie in source, or use actual student credentials.

The homepage scenario loads the HTML entry point, not all browser assets. The browsing scenario batches curriculum and readiness requests. The map scenario retrieves the same curriculum document consumed by React Flow. The private scenario retrieves stored student data. It is an HTTP load suite, separate from browser interaction tests.

Default production rate limits can intentionally cause 429s under load. For an isolated capacity experiment, raise `API_RATE_LIMIT` to an explicitly chosen test value (for example 1200) and restart the API, then restore normal deployment policy. Keep a separate rate-limit test to verify 429 behavior. Respect host capacity and stop a run that affects other workloads. No k6 benchmark was run or fabricated for this delivery.

## Local helper recovery

`pnpm db:local` persists a real cluster under `.local/postgres`. If the parent terminal is forcibly closed, the database process may remain. Use the same embedded package’s `pg_ctl` path and the exact cluster directory to stop it; do not delete `postmaster.pid` while a server is running. Restart the helper with the original `.env` credentials. The helper is not intended to recover corrupted clusters or supervise production instances.

## Production checklist within application scope

Use [STAGING.md](STAGING.md) and the standalone production Compose file for exact HTTPS origins, secure cookies, private credentials, least-privilege roles, proxy trust and loopback binding. Apply one migration job, check health endpoints and authenticated access through the real TLS edge, and define backup retention and monitoring. GitHub Actions checks are supplied; cloud account changes, infrastructure resources and public deployment are outside this work.
