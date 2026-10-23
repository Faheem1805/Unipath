# Staging release procedure

Use Node **22.23.4** (the container and CI baseline) and **pnpm 11.25.0**. Node 24.19.0 or newer is also supported for local work. Run `corepack enable` and `corepack prepare pnpm@11.25.0 --activate`, then `pnpm install --frozen-lockfile`. Never initialize this repository again: it already has Git history and an origin remote.

## Production configuration and request path

The development file remains `docker-compose.yml`. The standalone production file is `docker-compose.production.yml`; do not combine the two. Copy `.env.production.example` to the ignored `.env.production`, restrict its permissions to the operator (0600 on Linux), and replace every placeholder with independently generated secrets. Use random hexadecimal database passwords so they are safe in PostgreSQL URLs. Supply secrets privately; neither image builds nor Git should contain them. Docker administrators can inspect container environment, so Docker access is privileged access.

```sh
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d --wait
```

Never run plain `compose config` against private environments: it expands secrets. No Azure resources or paid services are required by these files.

The supported request path is **browser HTTPS → host TLS edge → loopback port 8080 → container Nginx → private API port 3001 → private PostgreSQL**. Configure a host TLS proxy with a valid certificate for the exact `PRODUCTION_ORIGIN`, redirect HTTP to HTTPS at that edge, and forward to `127.0.0.1:8080`. Only the TLS edge should publish 443. The Compose frontend binds **127.0.0.1**, and the API and database publish no ports. Keep 8080/3001/5432 closed to external traffic. Remote databases require verified PostgreSQL TLS and a reviewed replacement connection configuration; this file assumes PostgreSQL on the private same-host Docker network.

The TLS edge must overwrite `X-Forwarded-For` with the client's address, never append an untrusted browser value. Set `TRUSTED_EDGE_CIDR` to that proxy's **actual source address as seen inside Nginx**, using a single `/32` for IPv4 (often the Docker bridge gateway). The loopback example is deliberately conservative and must be checked on the VM. Nginx only accepts the real-IP header from that source, then overwrites forwarded address/protocol headers toward the API. Its production protocol is fixed to `https`; the API trusts exactly **one hop**, Nginx. Do not increase API proxy trust to account for the edge: Nginx has collapsed that chain. A different topology needs a separate review. Verify spoofed client forwarding headers, distinct client rate buckets, exact HTTPS origins, Secure cookies, and blocked direct access on the real VM. Local HTTP tests cannot establish these properties.

Nginx resolves its variable backend upstream through Docker DNS `127.0.0.11`, with a two-second validity period. Replacement acceptance reserves the old address with a temporary container and asserts a different replacement address; it checks readiness and authenticated records without restarting Nginx.

## Database identities and existing data

The production provisioning job uses the **bootstrap superuser** only for role/database grants. The **unipath_migrator** login owns the database/schema and migration objects, with no superuser, role-creation, database-creation, replication or RLS-bypass privilege. Only the migration job receives that credential. The **unipath_runtime** API login has CONNECT, schema USAGE, table SELECT/INSERT/UPDATE/DELETE and sequence USAGE/SELECT. It has no DDL, schema CREATE, database CREATE, role management, migration-history access, or membership of the owner role.

`database/provision.sql` sets default privileges **for objects created by unipath_migrator**. Every future migration must use that identity. The migration job also grants existing tables and explicitly revokes all runtime access to `_prisma_migrations`. Review future SECURITY DEFINER functions and new schemas separately; public function execution is revoked by the owner's defaults. Rerunning provisioning is idempotent and rotates the two login passwords to the supplied values; perform rotation during a coordinated release.

**For an existing volume, do not replace it or assume POSTGRES\_\* variables rename its roles.** First back up and rehearse the change in a restored disposable database. Inspect its actual bootstrap login, object owners and migration history. The production file expects a login named `unipath_bootstrap`; on an existing cluster an authorized DBA must establish that login privately, or adapt the provisioning connection to the existing bootstrap identity. Transfer only the application database's existing tables/sequences (including `_prisma_migrations`) to `unipath_migrator` with quoted `ALTER TABLE/SEQUENCE ... OWNER TO` statements after reviewing the inventory. Provisioning changes the database/public-schema owner but deliberately does not mass-reassign existing objects. Do not run a cluster-wide `REASSIGN OWNED` against unrelated data. Rehearse migrate/status/diff and runtime checks before switching the API credential. Never run `down --volumes`, `db push`, or `migrate reset` against wanted data.

The provenance migration is additive and nullable. Existing records keep their data and verification labels, with **unknown review attribution** rather than invented reviewer identities. Existing fictional data stays fictional.

## Release checks, deadlines and diagnostics

Before release, take and validate a backup, review migration SQL for compatibility with **both old and new replicas**, and run `prisma migrate deploy`, `prisma migrate status`, and `prisma migrate diff --from-schema-datasource database/schema.prisma --to-schema-datamodel database/schema.prisma --exit-code` using the migration credential. Diff does not prove semantic compatibility: review renamed/dropped fields, constraints, data backfills and old writers separately. Use expand/backfill/contract releases for destructive changes, retiring old replicas before contraction. API startup probes all model columns and fails before listening if this release's schema is absent. Readiness is a bounded connectivity probe, not a full migration compatibility certificate.

Runtime DB statements have a five-second deadline, lock waits three seconds, and idle transactions eight seconds. The Prisma connection/pool/socket deadlines are 3/2/5 seconds; interactive transactions wait at most two seconds and run at most six seconds. HTTP headers/requests use 5/10-second budgets (Node requestTimeout limits incoming request receipt; socket inactivity is also bounded at ten seconds). Nginx waits twelve seconds for API responses. Shutdown stops accepting connections, drains active work and disconnects the pool within a fifteen-second deadline. Compose grants **25 seconds** before container termination. A severely failed dependency can still produce a bounded request error or forced exit; no guarantee is made for abrupt host loss.

API logs contain request IDs, route templates, methods, statuses and duration. Unexpected database errors include allowlisted Prisma error codes and error classes, which distinguish connectivity, permissions and schema failures. Logs never serialize raw exceptions/messages, SQL/query parameters, bodies, email addresses, passwords, cookies, tokens or database URLs. Correlate the response's request ID with stdout logs. Schema mismatch at startup is handled by release checks, not by printing credential-bearing connection errors.

## Bootstrap and academic review

Set `SEED_DEMO=false` for an empty catalog. Use the administrator stdin CLI from `docs/OPERATIONS.md`, against the migration job. Administrators without student profiles are directed to `/app/admin`; server-side ADMIN checks remain required. Import the first curriculum as a draft, review it and publish explicitly. Student onboarding requires a published curriculum; administrator catalog work does not.

Verification dates are `YYYY-MM-DD` **UTC calendar dates**, and cannot exceed today's UTC date. Directory forms start with a blank date. The API records authenticated administrator user ID and server UTC review timestamp in separate nullable `reviewedBy`/`reviewedAt` fields; supplied payloads cannot impersonate the reviewer. These IDs are retained as attribution strings if an account is deleted. Curriculum imports/changed verification claims receive attribution, while unchanged publication preserves an existing review. A URL and metadata are an administrator attestation, **not proof of official status**. Real advising requires authoritative university documents and a review of the specific admission year, curriculum version, campus, course rules and applicable policy. Do not promote demo data to official data automatically.

Term labels are exact identifiers. Completed attempts earn prerequisite credit; in-progress attempts provide corequisite context **only for the exact target term**. Proposed course selections also supply concurrent context, without earning completed credits. The map uses the profile's current term and its saved plan; the planner and API use the plan's target term and selected courses. A future-sequence projection is a bounded heuristic, not a registration guarantee or exhaustive optimizer.

## Disposable verification

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
# Requires Docker Linux containers, generated Prisma client, and Playwright Chromium:
pnpm exec playwright install chromium
pnpm test:containers
```

`test:containers` creates a unique Compose project, random synthetic secrets, loopback test ports, and a dedicated volume, and removes that volume in cleanup. It never reads `.env` as configuration. Test-only overrides enable local HTTP cookies and expose the disposable PostgreSQL port on loopback for host test runners. Both API/browser runners require an explicit `TEST_DATABASE_URL`; use only disposable databases. The container suite covers administrator CLI/no-demo bootstrap, runtime permissions/future grants, authentication/private records, persistence, changed-IP replacement, active/idle shutdown, outage/recovery, logical restore, safe diagnostics and desktop/mobile Chromium browser regressions. Evidence stays under ignored `.local/unipath-test-*/`.

The Actions workflow repeats frozen installation, formatting/lint, type checks, builds, unit/API tests, and the Linux container/browser acceptance suite. A checked-in workflow is not evidence of a successful GitHub-hosted run. `docs/STAGING_VERIFICATION.md` records local results separately from the historical audit.
