# AcademiaX Review 2: progress

Legend: **[x]** done and verified by running it · **[~]** done, verified only partly (see note) · **[ ]** not done

Work was done in two passes: a first draft, then completion, fixes and verification. Everything below reflects the state after the second session. Test evidence is in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Environment notes
- The machine's default JDK is **25**. Lombok 1.18.36 cannot compile on it, so Lombok was bumped to **1.18.42** (the only version change; Spring Boot, Spring Cloud, React and Vite are unchanged).
- Mockito can't spy or mock concrete library classes on JDK 25, so the affected tests use real objects or hand-written stubs instead.
- Local MySQL on 3306 is used for the no-Docker run. Docker Compose was verified the next day (see Phase 8 and TEST_REPORT §8).

## Phase 0: inspection
- [x] Backend and frontend build
- [x] All 12 known defects confirmed in the Review 1 code

## Phase 1: backend defects
- [x] 1 Seat race: atomic `UPDATE … WHERE available_seats > 0`; 409 when full; bulk updates also bump `@Version` so a concurrent course edit can't overwrite a seat change (409 on stale edit)
- [x] 2 Registration is STUDENT-only; instructors are created by ADMIN; ADMIN seeded from env (seeder ordered first so IDs are stable)
- [x] 3 Role and ownership in course-service (instructor edits own courses only); gateway strips client `X-User-*`
- [x] 4 IDOR: identity from `X-User-Id`; ownership checks on enrollments and payments. **Also fixed:** payment-service trusted the client's `amount` and never checked enrollment ownership; it now loads the enrollment as the caller (403 if not theirs), requires `SEAT_HELD` (409), and charges the stored tuition
- [x] 5 Refresh tokens: `token_type`, hashed storage, rotation, reuse revokes the family, logout and logout-all. **Fixed two bugs:** tokens issued in the same second were byte-identical (added `jti`), and reuse-revocation was rolled back by the `@Transactional` 401 (`noRollbackFor`)
- [x] 6 Tuition from the course/enrollment, never hardcoded or client-sent
- [x] 7 Business exceptions in Resilience4j `ignoreExceptions`, mapped to 409/409/422
- [x] 8 Feign `@PathVariable("id")`
- [x] 9 One CORS config (env-driven `CorsWebFilter`, ordered first so 401/403 replies keep CORS headers)
- [x] 10 Scalable compose (no `container_name`, 2× course, 2× enrollment on distinct ports)
- [x] 11 Enrollment deadline enforced (422)
- [x] 12 Automated tests (57 backend + 46 end-to-end checks)
- [x] **Extra security fix:** saga-internal endpoints (`/enrollments/{id}/confirm`, `/courses/{id}/reserve-seat`, `POST /notifications`, …) were reachable through the gateway, so a student could confirm without paying. The gateway now returns 403 for them
- [x] **Extra security fix:** gateway `/admin/**` was public (local controllers bypass route filters); now guarded by `AdminSecurityWebFilter` (ADMIN only)
- [x] No JWT secret defaults in YAML; gateway and auth fail fast if `JWT_SECRET` is missing or < 32 bytes

## Phase 2: saga and waitlist
- [x] State-machine enum with allowed transitions (illegal → 409)
- [x] Hold (`SEAT_HELD`, 10 min) → pay → `CONFIRMED`; decline → `PAYMENT_FAILED` + seat released
- [x] `@Scheduled` hold expiry. **Fixed a race:** with two enrollment instances both could release the same seat; each now claims the row with a conditional UPDATE first (single winner). A lapsed hold re-requested by its owner is renewed instead of leaking the seat
- [x] Waitlist with auto-promotion (claimed atomically, undone if the seat can't be reserved)
- [x] Idempotency-Key on `POST /payments`
- [x] If confirmation fails after a successful charge (hold expired mid-payment), the payment is auto-refunded
- [x] Refund releases the seat and promotes the waitlist

## Phase 3: notification service
- [x] `notification-service` in Eureka; enrollment events call it over Feign; notification text names the course (e.g. "PHY401 Quantum Mechanics")
- [x] Frontend bell with unread count, popover, and Notices page

## Phase 4: load balancing proof
- [x] `X-Served-By: course-service@8092` on every response (from the Eureka instance id)
- [x] `GET /courses/whoami` (instance id, port, hostname, per-instance counter)
- [x] `lb://` routes plus Feign through Spring Cloud LoadBalancer (round robin): 10/10 measured
- [x] Failover: gateway retry plus LoadBalancer retry on connection failures only (no double seat reservation), 5 s lease renewal / 10 s expiry, 5 s LB cache. **Hard-killed one course and one enrollment instance under load: 0 errors**
- [x] `X-Correlation-Id` generated at the gateway, forwarded by Feign, logged via MDC, and recorded per hop; `GET /admin/trace/{id}` assembles hops from all instances
- [x] `GET /admin/registry` (live Eureka status) and `GET /admin/circuitbreakers`

## Phase 5: tests
- [x] Auth: login, wrong password, lockout, expired token, tampered token, refresh rotation, reuse revokes the family including the rotated token
- [x] Course: CRUD, ownership, soft delete, pagination; validation → 400 + fieldErrors; wrong role → 403
- [x] Concurrency: 20 threads / 5 seats → exactly 5 (JUnit) and live through the gateway (`scripts/concurrency-demo.mjs`)
- [x] Saga: payment failure releases the seat, hold expiry releases it (and the losing instance doesn't), waitlist promotion and revert
- [x] Payment: idempotency, decline card, refund, IDOR, tuition-not-from-client, auto-refund
- [x] Gateway: refresh token rejected, expired token, header spoofing stripped, internal paths blocked, weak secret fails startup
- [x] `docs/TEST_REPORT.md`

## Phase 6–7: frontend
- [x] Rebuilt on a token-based design system ("University Registrar, editorial": paper `#F6F2EA`, ink, oxblood `#7A1F2B`, hairlines; Fraunces, Inter, IBM Plex Mono). Real dark mode (charcoal, same accent) with a toggle; no flash on load
- [x] Signature pieces: library index-card course cards, seat map, hold countdown bar with mono timer, printed receipt (jsPDF), vertical enrollment timeline
- [x] Silent refresh: one shared in-flight refresh promise for all queued 401s
- [x] Pages: Landing, Login, Register, Catalogue (search, department/semester/level filters, open-only, sort, server pagination), Course detail, Checkout, My enrollments, Student dashboard, Instructor dashboard (courses, fill-rate chart, roster), Course editor, Admin (KPIs, users, courses, enrollments, payments), System Console, Notices, Profile & Security (sessions, log out all devices), 403, 404, error boundary
- [x] Browser-checked: student hold → decline → re-hold → pay → receipt; bell; admin desk; console (registry, 20 requests = 10/10, 12-hop trace, breakers); instructor roster; desktop light and dark; mobile 375 px with **0 px horizontal overflow on 12 routes**
- [~] "Download PDF" was not clicked during verification (it would save a file); the code path uses jsPDF's documented API
- Old Antigravity/Review 1 page files were **moved, not deleted**, to `frontend/legacy-ui/`: the new pages replace them, and keeping them preserves the earlier work for reference (they are not built)

## Phase 8: run, deploy, docs
- [x] `docker-compose.yml`: healthchecks, `service_healthy` ordering, one `.env`, 2+2 instances, Eureka actuator. **Verified:** 11 containers healthy, smoke 46/46, race 6/6, `docker compose kill` failover with 0 errors. MySQL host port is configurable (`MYSQL_HOST_PORT`, default 3307) because the Review 1 stack's `academiax-mysql` container also uses 3307
- [x] Seed: 1 admin, 3 instructors, 10 students, 12 courses; CS301 full + 2 waitlisted, CS499 one seat left, MATH101 past deadline; 24 enrollments and payments created **through the real saga**
- [x] `run-local.ps1` / `stop-local.ps1` (see TEST_REPORT §5 for the clean-slate run)
- [~] `.vscode/launch.json` compound: written; not launched from VS Code in this session
- [x] `deploy/README.md` (single-VM plan; nothing deployed)
- [~] Postman collection (4 folders, about 50 requests with assertions, auto-saved tokens, LB request for the Runner) and environment: generated and JSON-valid, **not executed here** (Newman download was blocked). The same calls pass in `scripts/smoke-test.mjs`
- [x] README (Mermaid architecture and saga, ports, env, PowerShell steps, seed accounts, API, troubleshooting) and `docs/REVIEW2_DEMO.md` (6-minute script and rubric → evidence table)

## Resume here if the session stops
Everything is in place. To re-verify: `.\run-local.ps1`, then `node scripts/smoke-test.mjs` and `node scripts/concurrency-demo.mjs`, then `cd backend; mvn test`.
