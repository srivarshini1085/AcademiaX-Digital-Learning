# AcademiaX: Review 2 test report

**Run date:** 29 Oct 2026 · **Environment:** Windows 11, JDK 25.0.4 for Maven builds and tests, JDK 21 for the hand-started services, Maven 3.9.15, Node 22.20, MySQL 8 (local, port 3306).
Sections 1–6 ran with `run-local.ps1` (option A). Section 8 repeats the key checks on the **Docker Compose** stack (option B), run the following day once Docker Desktop was started.

| Suite | Result |
|---|---|
| Backend unit + integration tests (`cd backend; mvn test`) | **57 / 57 passed** · BUILD SUCCESS |
| End-to-end smoke test through the gateway (`node scripts/smoke-test.mjs`) | **46 / 46 passed** |
| Live concurrency race (`node scripts/concurrency-demo.mjs`) | **PASS**: exactly 5 of 20 |
| Failover with an instance hard-killed under load | **0 errors** (course and enrollment) |
| Clean-slate start with `run-local.ps1`, then `stop-local.ps1` | **PASS** |
| Frontend production build (`npm run build`) | **PASS** |
| Browser walkthrough (desktop light/dark, mobile 375 px) | **PASS** (details in §6) |
| Docker Compose: build, health, smoke, race ×6, failover (§8) | **PASS** |
| Postman collection | Not executed in this session (Newman download blocked); same calls covered by the smoke test |

## 1. Backend tests (JUnit 5 + Mockito, Spring Boot test with H2)

| Class | Test | Result |
|---|---|---|
| GatewaySecurityTest | `weakSecretFailsFast` | ✅ pass |
| GatewaySecurityTest | `internalEndpointsBlocked` | ✅ pass |
| GatewaySecurityTest | `expiredTokenRejected` | ✅ pass |
| GatewaySecurityTest | `publicReadsOnly` | ✅ pass |
| GatewaySecurityTest | `spoofedHeadersStripped` | ✅ pass |
| GatewaySecurityTest | `refreshTokenRejected` | ✅ pass |
| AuthServiceTest | `register_SucceedsAsStudent` | ✅ pass |
| AuthServiceTest | `register_DuplicateEmailThrowsConflict` | ✅ pass |
| AuthServiceTest | `register_RoleFieldIgnored` | ✅ pass |
| AuthServiceTest | `login_Success` | ✅ pass |
| AuthServiceTest | `login_WrongPasswordThrows` | ✅ pass |
| AuthServiceTest | `login_FiveFailedAttemptsLocksAccount` | ✅ pass |
| AuthServiceTest | `login_LockedAccountRejectsCorrectPassword` | ✅ pass |
| AuthServiceTest | `login_DeactivatedAccountThrows` | ✅ pass |
| AuthServiceTest | `refresh_SuccessReturnsNewTokens` | ✅ pass |
| AuthServiceTest | `refresh_AccessTokenRejected` | ✅ pass |
| AuthServiceTest | `refresh_TokenReuseRevokesFamily` | ✅ pass |
| AuthServiceTest | `createInstructor_CreatesInstructor` | ✅ pass |
| AuthServiceTest | `jwt_ExpiredTokenRejected` | ✅ pass |
| AuthServiceTest | `createInstructor_DuplicateEmailThrowsConflict` | ✅ pass |
| AuthServiceTest | `jwt_TamperedTokenRejected` | ✅ pass |
| AuthServiceTest | `refresh_ReuseRevokesRotatedToken` | ✅ pass |
| CourseConcurrencyTest | `testConcurrentReservationsNeverOverAllocate` | ✅ pass |
| CourseControllerValidationTest | `wrongRoleReturns403` | ✅ pass |
| CourseControllerValidationTest | `invalidCourseReturns400WithFieldErrors` | ✅ pass |
| CourseServiceTest | `createCourse_failsForStudent` | ✅ pass |
| CourseServiceTest | `deleteCourse_instructorForbidden` | ✅ pass |
| CourseServiceTest | `updateCourse_adminCanEditAnyCourse` | ✅ pass |
| CourseServiceTest | `createCourse_pastDeadlineThrowsDeadlinePassed` | ✅ pass |
| CourseServiceTest | `createCourse_succeedsForInstructor` | ✅ pass |
| CourseServiceTest | `createCourse_duplicateCodeThrowsConflict` | ✅ pass |
| CourseServiceTest | `getCoursesPaged_returnsPaginatedResults` | ✅ pass |
| CourseServiceTest | `deleteCourse_softDeleteHidesFromSearch` | ✅ pass |
| CourseServiceTest | `updateCourse_cannotEditAnotherInstructorsCourse` | ✅ pass |
| EnrollmentServiceTest | `holdSeat_CreatesHeldEnrollment` | ✅ pass |
| EnrollmentServiceTest | `holdSeat_PastDeadlineThrows` | ✅ pass |
| EnrollmentServiceTest | `holdSeat_DuplicateConfirmedThrows` | ✅ pass |
| EnrollmentServiceTest | `confirmEnrollment_TransitionsToConfirmed` | ✅ pass |
| EnrollmentServiceTest | `failEnrollment_ReleasesAndTransitions` | ✅ pass |
| EnrollmentServiceTest | `cancelEnrollment_IDORPrevented` | ✅ pass |
| EnrollmentServiceTest | `getByStudentId_ReturnsOnlyOwn` | ✅ pass |
| EnrollmentServiceTest | `getByStudentId_OtherStudentIDORBlocked` | ✅ pass |
| EnrollmentServiceTest | `stateMachine_AllowedTransitions` | ✅ pass |
| EnrollmentServiceTest | `expireSeatHolds_ReleasesSeat` | ✅ pass |
| EnrollmentServiceTest | `expireSeatHolds_LosingInstanceDoesNotDoubleRelease` | ✅ pass |
| EnrollmentServiceTest | `failEnrollment_PromotesFirstWaitlisted` | ✅ pass |
| EnrollmentServiceTest | `promotion_RevertedWhenReserveFails` | ✅ pass |
| PaymentServiceTest | `processPayment_GoodCardSucceeds` | ✅ pass |
| PaymentServiceTest | `processPayment_FailureCardFails` | ✅ pass |
| PaymentServiceTest | `processPayment_IdempotencyKeyReturnsCached` | ✅ pass |
| PaymentServiceTest | `refundPayment_SuccessfulPaymentRefunded` | ✅ pass |
| PaymentServiceTest | `refundPayment_FailedPaymentThrowsConflict` | ✅ pass |
| PaymentServiceTest | `refundPayment_IDORPrevented` | ✅ pass |
| PaymentServiceTest | `processPayment_UsesEnrollmentTuitionNotClientAmount` | ✅ pass |
| PaymentServiceTest | `processPayment_OtherStudentsEnrollmentForbidden` | ✅ pass |
| PaymentServiceTest | `processPayment_NotHeldConflict` | ✅ pass |
| PaymentServiceTest | `processPayment_ConfirmFailureAutoRefunds` | ✅ pass |

What each group proves:
- **GatewaySecurityTest** (api-gateway): weak or missing `JWT_SECRET` fails startup; refresh and expired tokens get 401; client `X-User-*` headers are replaced by the JWT identity; saga-internal paths get 403 even with a valid token; catalogue reads are public and writes are not.
- **AuthServiceTest** (`@SpringBootTest`, H2): registration is always STUDENT; login success and wrong password; 5 failures lock the account; locked and deactivated accounts are refused; expired and tampered JWTs are rejected; refresh rotates to a *different* token; an access token can't refresh; reusing a refresh token revokes the whole family, including the token it was rotated into.
- **CourseConcurrencyTest** (`@SpringBootTest`, H2): 20 threads released by one latch against a 5-seat course → exactly 5 successes, 15 `CourseFullException`, 0 seats left.
- **CourseServiceTest / CourseControllerValidationTest**: role and ownership rules, soft delete, pagination; invalid input → 400 with a `fieldErrors` entry per field and the caller's `correlationId`; wrong role → 403 in the shared `ApiError` shape.
- **EnrollmentServiceTest**: hold, deadline (422), duplicates, IDOR; payment failure releases the seat; hold expiry releases the seat, and the instance that loses the claim does **not** release it again; waitlist promotion, and its revert when the seat can't be reserved; state-machine transitions.
- **PaymentServiceTest**: approve and decline cards; Idempotency-Key replay; refund and its IDOR check; tuition comes from the enrollment (a tampered `amount: 1` is ignored); paying for another student's enrollment → 403; an enrollment that isn't held → 409; auto-refund when confirmation fails after charging.

## 2. End-to-end smoke test (46 checks against the running stack)

Run against a freshly seeded stack started by `run-local.ps1`. Every request goes through the gateway on :8080.

**Rubric 2: JWT authentication**
- ✅ public registration ignores role=ADMIN (creates STUDENT)
- ✅ weak password rejected with 400 + fieldErrors
- ✅ wrong password -> 401
- ✅ no token -> 401
- ✅ tampered token -> 401
- ✅ refresh token used as access token -> 401
- ✅ refresh rotates the token pair
- ✅ reusing an old refresh token -> 401
- ✅ reuse revokes the whole family (new token also dead)
- ✅ 5 failed logins lock the account (correct password refused)

**Rubric 1 & 2: roles, ownership and spoofing**
- ✅ student POST /courses -> 403
- ✅ student spoofing X-User-Role: ADMIN is still 403
- ✅ instructor editing another instructor's course -> 403
- ✅ instructor editing own course -> 200
- ✅ internal saga endpoint via gateway -> 403
- ✅ internal reserve-seat via gateway -> 403
- ✅ student reading another student's enrollment -> 403
- ✅ student cancelling another student's enrollment -> 403
- ✅ student GET /admin/registry -> 403

**Rubric 3: CRUD and validation**
- ✅ invalid course -> 400 with fieldErrors
- ✅ ApiError carries correlationId
- ✅ admin creates course -> 201
- ✅ search + filter + sort + server-side pagination
- ✅ admin updates course -> 200

**Rubric 1: seat-hold saga**
- ✅ hold seat -> SEAT_HELD with ~10 min hold
- ✅ seat taken in course-service
- ✅ declined card -> payment FAILED
- ✅ payment amount is the real tuition (client sent 1)
- ✅ enrollment -> PAYMENT_FAILED
- ✅ compensation released the seat
- ✅ good card -> SUCCESS
- ✅ same Idempotency-Key returns the same payment (no double charge)
- ✅ enrollment -> CONFIRMED
- ✅ paying for someone else's enrollment -> 403
- ✅ trace spans gateway, enrollment, course, payment, notification
- ✅ full course -> 409
- ✅ join waitlist -> WAITLISTED
- ✅ past deadline -> 422
- ✅ duplicate enrollment -> 409 (not swallowed by circuit breaker)
- ✅ delete course with active enrollments -> 409
- ✅ refund -> REFUNDED and seat released
- ✅ course with no active enrollments can be deleted

**Rubric 3: load balancing**
        whoami x20: {"course-service@8092":10,"course-service@8082":10}
- ✅ /courses/whoami spread over 2 course instances
- ✅ X-Served-By header alternates between instances
- ✅ Eureka: 2 course-service and 2 enrollment-service instances
- ✅ circuit breaker state is exposed

46 passed, 0 failed

## 3. Load balancing and failover

**Round robin.** Smoke test: 20 × `GET /courses/whoami` → `{"course-service@8092":10,"course-service@8082":10}`. The System Console's "Fire 20 requests" button showed the same 10/10 split.

**Hard kill under load** (process terminated with `taskkill /F`, so no graceful deregistration, the worst case), on the stack started by `run-local.ps1`:

| Scenario | Requests | Served by | Errors |
|---|---|---|---|
| 120 × `GET /courses/whoami`, one request every 200 ms; course-service@8092 killed after ~4 s | 120 | 8082: 110, 8092: 10 (before the kill) | **0** |
| 100 × authenticated `GET /enrollments/my` (which also calls course-service over Feign); enrollment-service@8093 killed after ~5 s | 100 | 8083: 92, 8093: 8 | **0** |

The same two kills were also run earlier on a stack started by hand: 0 errors both times.

What makes this work: the gateway's `Retry` filter (which retries `IOException`s, i.e. connection refused) re-runs load-balancer selection; Spring Cloud LoadBalancer retries the next instance on `ConnectException` only, so a PUT that may have executed is never repeated; the 5 s LoadBalancer cache; and Eureka's 5 s renewal / 10 s expiry / 5 s eviction.

## 4. Concurrency race through the gateway

```
Created RACEJUEY with 5 seats (course id 14)
Registering 20 students...
Firing 20 enrollment requests at the same time...

HTTP status counts:    { '201': 5, '409': 15 } (201 = seat held, 409 = course full)
Handled by instance:   { 'enrollment-service@8093': 10, 'enrollment-service@8083': 10 }
Seats left in course:  0 of 5

PASS: exactly 5 of 20 got a seat, no over-allocation.
Cleaned up: holds released and RACEJUEY withdrawn (run with --keep to leave it).
```

The 20 requests were spread over **both** enrollment instances, which both called **both** course instances. All state lives in MySQL, and the seat update is a single conditional `UPDATE … WHERE available_seats > 0`, so there's no over-allocation across instances.

## 5. Clean-slate start with the PowerShell scripts

1. All AcademiaX schemas created during testing were dropped (`academiax_auth`, `_course`, `_enrollment`, `_payment`, `_notification`). The Review 1 schemas were left untouched.
2. `.\run-local.ps1` built the backend, started 9 service windows plus the frontend in order, waited for each health check, and printed "AcademiaX is up." (exit code 0).
3. Seeded state, read from MySQL afterwards:
   - users 1 = admin, 2–4 = instructors, 5–14 = students
   - enrollments: 24 CONFIRMED and 2 WAITLISTED; 24 SUCCESS payments; 50 notifications
   - CS301 6/6 full (2 waitlisted), CS499 9/10, MATH101 past its deadline
4. The smoke test, concurrency race and failover runs in §2–4 ran against this stack.
5. `.\stop-local.ps1` printed "AcademiaX stopped." and no AcademiaX port was still listening.

## 6. Browser walkthrough (built-in browser, Vite dev server)

| Flow | Checked |
|---|---|
| Student: sign in → dashboard → PHY401 → **Hold my seat** → checkout (09:59 countdown, seat shown as "yours") → decline card → "Payment declined… seat released", seat map back to 20 open → **Hold a seat again** → approve card → receipt + timeline Held → Paid → Confirmed | ✅ |
| Notification bell: unread count and saga notices | ✅ |
| My enrollments: timeline, Receipt, Request refund | ✅ (refund itself verified by the smoke test) |
| Admin: KPIs, enrollments-by-status chart, payments ledger | ✅ |
| System Console: registry (8 instances, 2+2), Fire 20 → 10/10 chart, request trace (12 hops across 5 services, with Feign calls on different course instances), circuit breakers (all CLOSED) | ✅ |
| Instructor: fill-rate chart, CS301 roster with waitlist positions | ✅ |
| Instructor opening `/admin` → 403 page | ✅ |
| Light and dark mode on desktop | ✅ |
| Mobile 375 px: 0 px horizontal overflow on `/`, `/courses`, `/courses/3`, `/courses/new`, `/instructor`, `/notifications`, `/profile`, `/dashboard`, `/enrollments`, `/checkout/:id`, 404 | ✅ |
| Receipt "Download PDF" | not clicked (it would save a file) |

Bugs found during this walkthrough and fixed: chart bars drawn too short (recharts animation and domain), a data field named `fill` overriding the bar colour, the trace demo picking a course past its deadline, a wrapping status pill, and the instructor's name shown as "Dr.".

## 7. Not verified in this session

- The Postman collection was generated and is valid JSON but wasn't executed (the Newman download was blocked). Its requests mirror the smoke test, which passed.
- The VS Code compound launch configuration was not started from VS Code.

## 8. Docker Compose run (option B)

Docker Engine 29.7.2, Compose v5.5.0, 8 GB allocated to Docker.

- `docker compose up --build -d` built all images and started **11 containers**. Every container with a healthcheck reported **healthy**: MySQL, Eureka, auth, course ×2, enrollment ×2, payment, notification and the gateway, started in `service_healthy` order. This also confirms `curl` is present in the runtime image.
- Eureka listed `course-service@8082`, `course-service@8092`, `enrollment-service@8083`, `enrollment-service@8093` and the other services, all **UP**. The seeder created 26 enrollments through the saga. The nginx frontend on :5173 answered 200 and rendered the catalogue from the gateway.
- **Smoke test: 46 / 46 passed**, run twice: on the first build, and again after rebuilding the course services and frontend. `whoami` ×20 split **10 / 10**.
- **Concurrency race: 6 / 6 runs passed**, each exactly 5 × 201 and 15 × 409, with 10 / 10 across the two enrollment containers. The first attempts had an intermittent `ECONNRESET` during the script's *setup* (20 parallel registrations plus logins, i.e. 40 BCrypt-12 hashes at once). The script now creates students 4 at a time with one retry; the 20 racing enrollment requests are still fired simultaneously.
- **Failover with `docker compose kill`** (SIGKILL) under load:

| Killed | Requests | Served by | Errors |
|---|---|---|---|
| course-service-2 | 120 × `GET /courses/whoami` | 8082: 109, 8092: 11 (before the kill) | **0** |
| enrollment-service-2 | 100 × authenticated `GET /enrollments/my` | 8083: 91, 8093: 9 | **0** |

  After `docker compose start course-service-2 enrollment-service-2`, both went healthy again and the next 20 requests were back to 10 / 10.
- **Port note:** this machine also has the Review 1 stack (`C:\varshini\AcademiaX`), whose `academiax-mysql` container restarts with Docker and holds port 3307. The MySQL host port is now configurable (`MYSQL_HOST_PORT`, default 3307), and this run used 3308. Services reach MySQL inside the Docker network, so the host port only matters for inspecting the database.
- **Bug found and fixed:** the Level filter listed both "UNDERGRADUATE" and "Undergraduate", because the seeder wrote mixed case while the API stores uppercase. The seeder now writes the canonical values, and the UI dedupes and title-cases them. (The running Docker database still holds the earlier mixed-case seed rows; `docker compose down -v` gives a fresh, uniform seed.)
