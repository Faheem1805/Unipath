# Verification report

Recorded October 22, 2026. This report distinguishes executed checks from files that still need runtime verification.

## Executed and passed

| Check                               | Result                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| PostgreSQL startup                  | Actual local PostgreSQL 17.6 cluster, persisted under ignored `.local/postgres`         |
| Prisma client generation            | Passed using checked-in PostgreSQL schema and explicit generated-client location        |
| Initial SQL migration               | Applied successfully with `prisma migrate deploy`                                       |
| Idempotent demo seed                | Fictional curriculum inserted; existing versions preserved; no default accounts created |
| Workspace TypeScript checks         | Shared, backend and frontend passed                                                     |
| Production TypeScript/Vite builds   | Shared engine, API and frontend built successfully                                      |
| Academic unit tests                 | **19 passed**                                                                           |
| PostgreSQL API integration tests    | **15 passed** in an isolated schema, dropped afterward                                  |
| Desktop Chromium browser tests      | **3 passed**: guest exploration, private student journey, administrator workflow        |
| Mobile-sized Chromium browser tests | **3 passed**: same workflows at iPhone 13 viewport settings                             |
| Full dependency audit               | **0 reported advisories**, including development dependencies, after updates            |
| k6 file syntax                      | JavaScript syntax check passed; no actual load run                                      |
| Compose YAML syntax                 | Parsed by the formatter; not validated by Docker Compose                                |

There are **40 passing automated tests** across the academic, API and browser suites. Browser fixture cleanup removes this invocation’s synthetic administrator, students, imported versions, instructors and offerings. The three synthetic accounts from earlier direct debugging runs were also removed after verification. No default accounts or known production credentials are shipped.

## Coverage and observed behavior

Academic checks cover nested AND/OR requirements, corequisites, exact credit thresholds, unresolved approvals, completed-vs-enrolled distinctions, repeated attempts, capped elective credits, degree completion totals, legal simulated sequences, chain traversal, weighted GPA, cumulative quality points, configurable repeat assumptions and malformed/invalid imports.

PostgreSQL tests verify registration, password hashing and role-injection rejection; allowed-origin mutation checks; private record isolation; profile selection without inferred progress; optimistic-write conflicts; repeated attempts; rejected invalid records without data loss; prerequisite-validated saved plans; protected imports and immutable published versions; term-specific instructor/offerings; sessions reused across two Express app instances; logout/password-change revocation; export/deletion; readiness 503 on a synthetic dependency failure; and shared rate limits that do not consume login allowance on session lookups.

Browser tests verify landing-to-guest navigation, 47 interactive map nodes, course search/selection and prerequisite details, course completion reflected in dashboard credits, saved plans surviving reload, GPA recalculation, theme persistence, registration, explicit degree setup, recorded grades surviving reload, logout/login, server-enforced student admin rejection, and administrator import/edit/publish plus instructor/term offering entry on desktop and mobile layouts. Guest page error listeners observed no uncaught runtime exceptions in those journeys. Browser screenshots were visually inspected.

During verification, browser tests exposed an overbroad login limiter, unreachable sidebar controls on short screens, and a draft-slug limit that conflicted with version cloning. These were corrected and the affected desktop/mobile journeys passed afterward. A full dependency audit prompted patches to CSV parsing, Prisma transitive dependencies and the test runner; the final audit returned no advisories. This is a point-in-time result, not a security certification.

The repeated synthetic browser runs used an increased authentication allowance on the local verification API only. The committed default remains 12 authentication mutations per IP per 15 minutes. The API integration suite separately verifies strict rate limiting with a one-request limit.

Vite emitted a non-blocking bundle-size advisory for the main JavaScript chunk (about 524 KB before gzip, 158 KB gzipped). The degree-map and administration screens load as separate chunks. This does not change the passing build result; further bundle optimization is an optional future improvement.

## Not executed

- **Docker image builds and `docker compose up --build`:** Docker Engine/Desktop is not installed and WSL is unavailable. Compose startup is an outstanding acceptance check. Container configuration and a one-shot migration job are supplied, but their successful execution is not claimed.
- **Nginx runtime/header validation:** the template, same-origin proxy, JSON access log format and unprivileged image configuration were prepared but could not be launched without the container runtime.
- **k6 execution or performance benchmarks:** k6 is unavailable. Scenarios and instructions are supplied. No throughput, latency, concurrency capacity, autoscaling or resilience result is claimed.
- **Linux container graceful-shutdown verification, actual multi-VM load balancing, backup/restore drills, zone failure or cloud disaster recovery:** these require an appropriate host/infrastructure. Hooks and application requirements are documented; the user’s cloud engineering stages are not implemented.
- **WebKit/Safari/Firefox behavior or a formal accessibility audit:** only desktop and mobile-sized Chromium journeys were executed. Semantic controls, labels, focus states, keyboard dialogs, reduced-motion CSS and responsive layouts are implemented.
- **A verified admission-year AAU curriculum:** public program facts and sources were reviewed, but version mapping and ambiguous credits remain unresolved. The functional curriculum and sample student are explicitly fictional.

## Reproduce

Follow the README to start the database, migrate/seed and run the API/frontend. Then execute:

```sh
pnpm typecheck
pnpm test:unit
pnpm test:api
pnpm build
pnpm test:e2e
pnpm audit
```

On a Docker-capable host, complete the pending container acceptance check separately:

```sh
docker compose config --quiet
docker compose up --build
```

Confirm frontend access, `/health/ready`, registration, saved records after a restart, and the migration job’s exit status before treating Docker acceptance as complete. Avoid publishing `docker compose config` output: its resolved form can contain secrets. No Azure resources, Terraform, CI/CD, production DNS, paid services or GitHub publication were created.
