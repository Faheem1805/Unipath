# UniPath architecture and implementation plan

UniPath is an independent planning aid. Express owns authentication, validation, authorization and persistence. React consumes its JSON API through TanStack Query. PostgreSQL is the only shared state. A shared TypeScript module contains deterministic academic rules used by both services. Nginx serves the built frontend and proxies relative API URLs. No cloud infrastructure, hosting integrations or AI eligibility decisions are included.

## Milestones

1. Foundation: workspace, React design system, Express API, Prisma migrations, PostgreSQL and production container configuration. Check builds and service connectivity.
2. Academic core: recursive AND/OR, concurrent enrollment and credit requirements; immutable curriculum versions; elective buckets; repeat-safe progress; interactive React Flow. Test rule boundaries and validation.
3. Student experience: opaque database sessions, private academic attempts, onboarding, dashboard, plans, course explorer and configurable GPA projections. Test cross-user isolation and persisted data.
4. Administration: role-protected version/course/rule editing, atomic CSV/JSON imports, validated source metadata, term-specific instructors and offerings. Test rejection and rollback.
5. Operations: readiness/liveness, JSON request logs, database-backed rate limits, graceful shutdown, one-shot migrations, non-root containers and k6 scenarios. Check replica compatibility.
6. Verification: unit/API/browser tests, build, dependency audit, Compose validation where Docker exists, operational documentation, architecture/ERD and explicit test results.

## Data decision

The AAU public page confirms 124 credits and both campuses, but gives no admission-year mapping and includes ambiguous credit notation. Verified facts and links are retained separately in `database/data/aau-source-review.json`. The runnable curriculum is expressly fictional; it must never be presented as an official AAU plan. Version publishing requires coherent totals, existing references and no prerequisite cycles. Administrators can import a fully reviewed version later without changing student records.

## Security and scope

Random 256-bit session tokens are stored only as SHA-256 hashes. Passwords use salted scrypt. Cookies are HTTP-only, same-site and secure in production. Mutations require an allowed Origin plus a custom request header. All authorization is server-side. Rate counters live in PostgreSQL and therefore work across replicas. Request logs omit bodies, query strings, cookies and identities. Admin bootstrap is an explicit local CLI; public registration cannot set roles. No migrations run in replica startup.

## Verification constraint at kickoff

Node.js and a package manager are present. Docker, PostgreSQL and WSL were not installed. A development-only embedded PostgreSQL package will be attempted for actual database/API tests. Container startup cannot be certified without a Docker engine. Results will be recorded in `docs/VERIFICATION.md`.
