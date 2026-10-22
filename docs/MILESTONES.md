# Implementation milestones

The final test outcomes are recorded in `VERIFICATION.md`. A feature being implemented here does not imply an unexecuted deployment was successful.

| Milestone              | Implemented                                                                                                                                            | Validation                                                                             | Remaining / decisions                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation         | Monorepo, React UI system, Express API, Prisma/PostgreSQL migration, frontend proxy, multi-stage Dockerfiles and Compose                               | Native services connected; schema/seed and TypeScript/web builds executed              | Docker engine absent; images and Compose startup require verification on a Docker host                                 |
| 2 — Academic core      | Immutable curricula, nested AND/OR/corequisite/credit/approval rules, elective accounting, attempts and React Flow interactions                        | Academic unit tests; map/course browser interactions                                   | Full official admission-year AAU curriculum is unavailable; runnable data remains explicitly fictional                 |
| 3 — Student experience | Accounts, onboarding, saved progress, dashboard, course explorer, GPA, future scenarios and saved plans                                                | PostgreSQL privacy/persistence/session tests and desktop/mobile browser journeys       | Estimates assume passing/availability; no timetable solver, registrar integration or repeat-policy assertion           |
| 4 — Administration     | Role authorization, JSON/CSV validation, draft version/course/rule editing, cloning/publishing and instructor/term offering CRUD                       | API tests reject invalid imports/role injection and exercise protected data operations | Trusted administrators review sources; editor uses explicit JSON forms; no verified instructors seeded                 |
| 5 — Cloud readiness    | Shared database sessions/limits, environment configuration, JSON stdout, live/ready endpoints, graceful shutdown, container health checks and k6 suite | API probes, database-shared sessions and limits, source/configuration checks           | Docker/Linux shutdown, k6 execution, backup restore and actual load-balancer behavior have not been executed           |
| 6 — Testing and docs   | Unit/API/browser suites, frozen lockfile, dependency audit, README, architecture/ERD, security/import/operations guides                                | See final verification report for counts and outcomes                                  | Docker acceptance remains pending due to missing host runtime; no cloud infrastructure or GitHub publication performed |

## Significant decisions

- Store academic versions as validated JSON documents in PostgreSQL to preserve coherent provenance and atomic imports. Keep student/session/offering data relational.
- Use an opaque cookie token backed by shared PostgreSQL, rather than memory sessions or a proprietary identity service.
- Use PostgreSQL for rate counters so additional API replicas enforce the same policy without requiring another shared service.
- Make published academic content immutable; clone to make a distinct version. Avoid silently changing students’ degree rules.
- Keep verified AAU facts separate from the fictional functional sample. Do not infer curriculum years or decode ambiguous credits without evidence.
- Keep deployment portable and infrastructure requirements documented. Do not create the user’s Azure, Terraform, CI/CD, load balancing or recovery implementation.
