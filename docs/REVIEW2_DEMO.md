# Review 2: 6-minute demo script

## Before the reviewer arrives (5 minutes, not timed)

1. Start everything: `.\run-local.ps1` and wait for **"AcademiaX is up."** Or use Docker: `$env:MYSQL_HOST_PORT=3308; docker compose up --build -d` and wait until `docker compose ps` shows every service healthy. Port 3308 is needed because the old Review 1 MySQL container holds 3307.
2. Open four browser tabs:
   - **Tab A:** http://localhost:5173 signed in as the **admin** (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`), on **System console**
   - **Tab B:** a private window at http://localhost:5173, signed out
   - **Tab C:** http://localhost:8761 (Eureka dashboard)
   - **Tab D:** Postman with the `AcademiaX · Review 2` collection and the `AcademiaX local` environment selected; run folder **0 · Setup** once
3. Open a PowerShell window in the project folder for the live commands.
4. Check the dark-mode toggle works (it's a nice 2-second moment if asked about the UI).

---

## 0:00–0:30 · What it is

**Show:** Tab C (Eureka). **Say:**
> "AcademiaX is course enrollment and tuition processing. Seven Spring Boot services sit behind a Spring Cloud Gateway, all registered in Eureka. Course and enrollment each run **two instances**, on 8082/8092 and 8083/8093. Every service owns its own MySQL schema."

## 0:30–2:30 · Rubric 1: microservices that really talk to each other

**Tab B:** click **Sign in** and use `student10@academiax.edu` / `Student@123`.
1. **Catalogue** → open **PHY401 Quantum Mechanics**. Point at the **seat map**.
2. Click **Hold my seat for 10 minutes**.
   > "Enrollment-service asked course-service to reserve a seat atomically, stored a SEAT_HELD enrollment, and notification-service wrote me a notice. Here's the 10-minute hold timer. My seat is the red square."
3. Under **Test cards**, click **4000 0000 0000 0002**, then **Pay**.
   > "The card is declined. That's the saga's compensating step: payment-service told enrollment-service, which **released the seat** back to course-service. The seat count is back up, and the timeline branches to 'Payment declined'."
4. Click **Hold a seat again** → click **4242 4242 4242 4242** → **Pay**.
   > "Confirmed. Here's the printed registrar receipt (it downloads as a PDF). The amount comes from the course's tuition on the server: I tested sending ₹1 from the client and it's ignored."
5. Click the **bell**: show the four saga notices.
6. **Tab A** → **03 Request trace** → **Trace one enrollment**.
   > "One X-Correlation-Id, twelve hops: gateway → enrollment → course → notification, then gateway → payment → enrollment → course → notification. Each hop shows which instance served it and how long it took. You can see enrollment's two Feign calls landing on **different** course instances."
7. Scroll to **04 Circuit breakers**: "Resilience4j breakers on each Feign client, all CLOSED. Business errors like 'course full' are in `ignoreExceptions`, so they return 409 instead of tripping the breaker."

## 2:30–4:00 · Rubric 2: JWT that's actually secure

**Tab D (Postman):** run folder **2 · JWT authentication & authorization** in the Runner. All green, about 18 requests. Call out four of them:
- **"Register with role=ADMIN → still STUDENT"**: "Public sign-up can't pick its role. Instructors are created by the admin. The admin comes from environment variables."
- **"Reuse old refresh token → 401"** then **"Rotated token is now dead too"**: "Refresh tokens are stored hashed and rotate on every use. Replaying an old one revokes the whole family, which is how you detect a stolen token."
- **"Student spoofs X-User-Role: ADMIN → 403"**: "The gateway strips client X-User headers and injects the identity from the verified JWT."
- **"Internal saga endpoint via gateway → 403"**: "Even with a valid token you can't call `/enrollments/{id}/confirm` and skip paying."

**Tab B:** open **Jack → Profile & security**.
> "Active sessions are refresh-token families. 'Log out all devices' revokes every one. Access tokens last 15 minutes, and the frontend refreshes silently with a single shared in-flight refresh. Five wrong passwords lock the account for 15 minutes. BCrypt strength 12. The JWT secret comes only from env, and the app refuses to start if it's shorter than 32 bytes."

Then type http://localhost:5173/admin into Tab B → the **403** page.

## 4:00–6:00 · Rubric 3: CRUD with load balancing you can see

**Tab A → Registrar → Courses tab:**
1. **New course** → fill in (or show the validation messages by submitting empty) → **Publish**. Edit the title → **Save**. Back on Courses, **Withdraw** it.
2. Try **Withdraw** on **CS101** → toast: refused, because students hold seats there (409).
   > "Full CRUD with server-side search, filters, sorting and pagination, soft delete, and one ApiError format with field errors everywhere."

**Tab A → System console → 02 Load balancing → Fire 20 requests.**
> "Ten and ten. Round-robin across both course instances. Every response carries an X-Served-By header."

**The kill.** In PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 8092 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
(With Docker: `docker compose kill course-service-2`.) **Immediately** click **Fire 20 requests** again.
> "I just hard-killed course-service on 8092 with no graceful shutdown. All 20 still succeed, now 20 to 0. The gateway's retry filter and LoadBalancer retries move traffic to 8082, so the user sees no errors. Within about 10 seconds Eureka drops it from the registry." (Point at section 01.)

**The race.** In PowerShell:
```powershell
node scripts/concurrency-demo.mjs
```
> "Twenty students hit a 5-seat course at the same instant, through both enrollment instances. Exactly five get 201, fifteen get 409, and zero seats are left. The seat update is a single conditional SQL UPDATE, so even two course instances can't double-book. The same race runs as a JUnit test."

Restart the killed instance in its window (`mvn -q -pl course-service spring-boot:run` with `$env:PORT=8092`, or `docker compose start course-service-2`).

**Close (5 seconds):** "57 backend tests, 46 end-to-end checks, and the Postman collection all pass. The report is in `docs/TEST_REPORT.md`."

---

## Rubric → evidence

| Rubric row | Feature | Where to show it | Automated proof |
|---|---|---|---|
| **1 Microservices** | 7 services + Eureka + gateway, DB per service | Eureka dashboard, Console §01 | smoke: `Eureka: 2 course-service and 2 enrollment-service instances` |
| | Seat-hold saga with compensation | Checkout: decline → seat released | `failEnrollment_ReleasesAndTransitions`, `processPayment_FailureCardFails` |
| | Hold expiry (`@Scheduled`), single winner across instances | My enrollments after 10 min | `expireSeatHolds_ReleasesSeat`, `expireSeatHolds_LosingInstanceDoesNotDoubleRelease` |
| | Waitlist auto-promotion | CS301 roster (instructor1) | `failEnrollment_PromotesFirstWaitlisted`, `promotion_RevertedWhenReserveFails` |
| | State machine, illegal transition → 409 | — | `stateMachine_AllowedTransitions` |
| | Idempotency-Key | Checkout footer shows the key | `processPayment_IdempotencyKeyReturnsCached`, smoke: `same Idempotency-Key returns the same payment` |
| | Notification service over Feign | Bell, Notices page | smoke: `trace spans gateway, enrollment, course, payment, notification` |
| | Correlation-ID trace | Console §03 | smoke trace check; Postman `Trace of that enrollment` |
| | Business errors not swallowed by circuit breaker | Duplicate / full / late → 409/409/422 | smoke: `duplicate enrollment -> 409`, `full course -> 409`, `past deadline -> 422` |
| **2 JWT** | Public sign-up is STUDENT only; admin from env | Register page | `register_RoleFieldIgnored` |
| | Refresh rotation, hashed storage, reuse → family revoked | Profile → Security | `refresh_TokenReuseRevokesFamily`, `refresh_ReuseRevokesRotatedToken` |
| | `token_type`: refresh can't call the API | — | `refresh_AccessTokenRejected`, `GatewaySecurityTest.refreshTokenRejected` |
| | Expired / tampered tokens | — | `jwt_ExpiredTokenRejected`, `jwt_TamperedTokenRejected`, `GatewaySecurityTest.expiredTokenRejected` |
| | Lockout after 5 failures | Login page message | `login_FiveFailedAttemptsLocksAccount`, `login_LockedAccountRejectsCorrectPassword` |
| | Header spoofing stripped | Postman folder 2 | `GatewaySecurityTest.spoofedHeadersStripped` |
| | Internal endpoints blocked | Postman folder 2 | `GatewaySecurityTest.internalEndpointsBlocked` |
| | Wrong role → 403, instructor edits only own course | 403 page; Postman | `createCourse_failsForStudent`, `updateCourse_cannotEditAnotherInstructorsCourse`, `CourseControllerValidationTest.wrongRoleReturns403` |
| | IDOR: other student's enrollment/payment → 403 | Postman `Bob reads Alice's enrollment` | `cancelEnrollment_IDORPrevented`, `getByStudentId_OtherStudentIDORBlocked`, `refundPayment_IDORPrevented`, `processPayment_OtherStudentsEnrollmentForbidden` |
| | Secret from env only, fail fast | Remove `JWT_SECRET` → startup error | `GatewaySecurityTest.weakSecretFailsFast` |
| **3 CRUD + LB** | Course CRUD, search/filter/sort/paging, soft delete | Catalogue filters; Admin → Courses | `getCoursesPaged_returnsPaginatedResults`, `deleteCourse_softDeleteHidesFromSearch` |
| | Validation → 400 + fieldErrors | Course editor | `CourseControllerValidationTest.invalidCourseReturns400WithFieldErrors` |
| | Users / enrollments / payments admin CRUD | Admin tabs | Postman folder 3 |
| | Round-robin across 2 instances | Console §02 (10/10) | smoke: `/courses/whoami spread over 2 course instances`; Postman `Load balancing: whoami` ×10 |
| | Failover on instance kill | Kill 8092 live | Verified manually: 120 requests during a hard kill, 0 errors (TEST_REPORT §3) |
| | No over-allocation across instances | `concurrency-demo.mjs` | `CourseConcurrencyTest.testConcurrentReservationsNeverOverAllocate` (20 threads, 5 seats) |
