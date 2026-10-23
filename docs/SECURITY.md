# Security model and deployment considerations

## Implemented controls

- Salted scrypt password hashing; minimum 12-character student passwords and 16-character bootstrap administrator passwords.
- Random 256-bit opaque session tokens, stored in PostgreSQL only as SHA-256 digests; HttpOnly, SameSite=Lax cookies; absolute expiry; secure cookies enforced in production.
- Database lookup of session and current role on each request. Logout and password changes revoke database sessions across replicas. Account deletion cascades private records.
- Exact allowed origins, a custom `X-UniPath-Client: web` header and JSON content type on every mutation. These controls force browser preflight and reject cross-origin form CSRF. They are not substitutes for authentication.
- Server-side authorization on student and administrator APIs. Record ownership comes from the session, never a submitted user ID. Registration rejects role injection.
- Validated, bounded request bodies and academic expressions; parameterized database queries; HTTPS-only source URLs; safe JSON errors without stack traces or database internals.
- Atomic, database-backed IP/window rate buckets shared by every replica. Authentication mutations have a stricter limit. PostgreSQL failure prevents application requests rather than bypassing rate limits.
- Helmet API headers and Nginx document security policy, HTTP-only database/service networks in Compose, non-root request-serving containers and reduced container capabilities.
- JSON operational/request logging without passwords, tokens, cookies, request bodies, query strings, names, emails or academic records. Request IDs are bounded/sanitized. Database rate keys use HMAC rather than storing raw IP addresses.
- Optimistic record revisions, transactions and immutable published academic documents protect against accidental cross-tab overwrites and silent curriculum changes.

## Before real student use

Choose a lawful data-retention/privacy process, verify academic rules, terminate HTTPS with a valid certificate, restrict database connectivity, use verified PostgreSQL TLS where applicable, manage and rotate deployment secrets, review proxy trust boundaries, and test restores. Decide whether to add email verification, reset flows, MFA, abuse controls, audit retention and monitoring. Those identity features are not included in this portfolio foundation.

This is a self-reported planning application. It does not establish official academic eligibility, registrar approval, instructor identity, or transfer equivalence. The verified marker means a trusted administrator reviewed documented sources; it is not a university signature. Avoid putting sensitive personal identifiers into course/term/source free-text fields.

Rate limits are per apparent IP. Many students behind one NAT share limits; a deployment operator must size them with expected traffic. Proxy hop trust must match the actual network path, and direct backend exposure should be prevented. Do not set trust proxy to a blanket boolean. CORS should list only the actual application origins. Production should remove loopback development origins.

Development Compose uses broad ownership for convenience. The separate production stack provisions bootstrap, migration-owner and runtime roles, including future-object grants and exclusion of migration history. See [STAGING.md](STAGING.md) for existing-volume adoption, private networking and the trusted TLS edge path. Containers are application packaging, not a complete hardened hosting system.

Admin bootstrap accepts sensitive credentials through stdin; do not save password JSON in the repository or use real credentials in load tests. There is no public administrator signup or preconfigured admin password. Administrative edits use JSON forms to keep complex rules explicit and reviewable. Independently review this application before collecting real records.

Run `pnpm audit` periodically and after updates. Audit findings are time-dependent; passing the recorded audit is not a security guarantee. Transitive overrides for `effect` and `deepmerge-ts` are pinned in the workspace configuration and must be retested when upgrading Prisma or Vitest.
