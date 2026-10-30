// AcademiaX end-to-end smoke test against the running stack (through the API gateway).
// Usage (PowerShell):  node scripts/smoke-test.mjs            # default gateway http://localhost:8080
//                      $env:GATEWAY="http://host:8080"; node scripts/smoke-test.mjs
// Needs the seeded demo data. Creates a few throwaway student accounts; safe to run repeatedly.

const GW = process.env.GATEWAY || 'http://localhost:8080';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@academiax.edu', password: process.env.ADMIN_PASSWORD || 'Admin@Academiax1' };
const run = Date.now().toString(36);
let passed = 0;
let failed = 0;

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(GW + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}

async function login(email, password) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

async function newStudent(tag) {
  const email = `smoke-${tag}-${run}@academiax.edu`;
  const password = 'Smoke@12345';
  await call('POST', '/auth/register', { body: { name: `Smoke ${tag}`, email, password, department: 'Computer Science' } });
  return login(email, password);
}

async function courseByCode(code) {
  const r = await call('GET', `/courses?courseCode=${code}`);
  return r.json.content[0];
}

async function main() {
  console.log(`AcademiaX smoke test against ${GW}\n`);

  const admin = await login(ADMIN.email, ADMIN.password);
  const instr1 = await login('instructor1@academiax.edu', 'Instr@123');
  const instr2 = await login('instructor2@academiax.edu', 'Instr@123');
  const alice = await login('student1@academiax.edu', 'Student@123');
  const bob = await login('student2@academiax.edu', 'Student@123');

  console.log('Rubric 2: JWT authentication');
  {
    const r = await call('POST', '/auth/register', { body: { name: 'Mallory', email: `mallory-${run}@x.edu`, password: 'Mallory@1234', role: 'ADMIN', department: 'CS' } });
    check('public registration ignores role=ADMIN (creates STUDENT)', r.status === 201 || r.status === 200 ? r.json.role === 'STUDENT' : false, JSON.stringify(r.json));
    const weak = await call('POST', '/auth/register', { body: { name: 'Weak', email: `weak-${run}@x.edu`, password: 'password', department: 'CS' } });
    check('weak password rejected with 400 + fieldErrors', weak.status === 400 && weak.json.fieldErrors, `${weak.status}`);
    const bad = await call('POST', '/auth/login', { body: { email: 'student1@academiax.edu', password: 'wrong' } });
    check('wrong password -> 401', bad.status === 401, `${bad.status}`);
    const none = await call('GET', '/enrollments/my');
    check('no token -> 401', none.status === 401, `${none.status}`);
    const tampered = alice.accessToken.slice(0, -4) + (alice.accessToken.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    check('tampered token -> 401', (await call('GET', '/enrollments/my', { token: tampered })).status === 401);
    check('refresh token used as access token -> 401', (await call('GET', '/enrollments/my', { token: alice.refreshToken })).status === 401);

    const s = await newStudent('refresh');
    const rotated = await call('POST', '/auth/refresh', { body: { refreshToken: s.refreshToken } });
    check('refresh rotates the token pair', rotated.status === 200 && rotated.json.refreshToken !== s.refreshToken, `${rotated.status}`);
    const reuse = await call('POST', '/auth/refresh', { body: { refreshToken: s.refreshToken } });
    check('reusing an old refresh token -> 401', reuse.status === 401, `${reuse.status}`);
    const family = await call('POST', '/auth/refresh', { body: { refreshToken: rotated.json.refreshToken } });
    check('reuse revokes the whole family (new token also dead)', family.status === 401, `${family.status}`);

    const victim = await newStudent('lockout');
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      lastStatus = (await call('POST', '/auth/login', { body: { email: `smoke-lockout-${run}@academiax.edu`, password: 'Wrong@12345' } })).status;
    }
    const locked = await call('POST', '/auth/login', { body: { email: `smoke-lockout-${run}@academiax.edu`, password: 'Smoke@12345' } });
    check('5 failed logins lock the account (correct password refused)', locked.status === 423 || locked.status === 401 || locked.status === 403, `${locked.status}`);
    void victim; void lastStatus;
  }

  console.log('\nRubric 1 & 2: roles, ownership and spoofing');
  const cs101 = await courseByCode('CS101');
  const newCourse = {
    code: `SMK${run.slice(-4).toUpperCase()}`, title: 'Smoke Test Seminar', description: 'Created by smoke test', department: 'Computer Science',
    semester: 'Fall 2026', academicYear: '2026-27', credits: 3, level: 'Undergraduate', totalSeats: 5,
    tuitionFee: 1000, enrollmentDeadline: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 19),
  };
  {
    check('student POST /courses -> 403', (await call('POST', '/courses', { token: alice.accessToken, body: newCourse })).status === 403);
    const spoof = await call('POST', '/courses', { token: alice.accessToken, body: newCourse, headers: { 'X-User-Role': 'ADMIN', 'X-User-Id': '1' } });
    check('student spoofing X-User-Role: ADMIN is still 403', spoof.status === 403, `${spoof.status}`);
    const other = await call('PUT', `/courses/${cs101.id}`, { token: instr2.accessToken, body: { ...newCourse, code: cs101.code, title: cs101.title } });
    check("instructor editing another instructor's course -> 403", other.status === 403, `${other.status}`);
    const own = await call('PUT', `/courses/${cs101.id}`, { token: instr1.accessToken, body: { ...cs101, enrollmentDeadline: cs101.enrollmentDeadline } });
    check('instructor editing own course -> 200', own.status === 200, `${own.status} ${JSON.stringify(own.json).slice(0, 200)}`);
    const internal = await call('PUT', '/enrollments/1/confirm?paymentId=1', { token: alice.accessToken });
    check('internal saga endpoint via gateway -> 403', internal.status === 403, `${internal.status}`);
    const reserve = await call('PUT', `/courses/${cs101.id}/reserve-seat`, { token: alice.accessToken });
    check('internal reserve-seat via gateway -> 403', reserve.status === 403, `${reserve.status}`);
    const mine = await call('GET', '/enrollments/my', { token: alice.accessToken });
    const aliceEnrollment = mine.json[0];
    check("student reading another student's enrollment -> 403", (await call('GET', `/enrollments/${aliceEnrollment.id}`, { token: bob.accessToken })).status === 403);
    check("student cancelling another student's enrollment -> 403", (await call('PUT', `/enrollments/${aliceEnrollment.id}/cancel`, { token: bob.accessToken })).status === 403);
    check('student GET /admin/registry -> 403', (await call('GET', '/admin/registry', { token: alice.accessToken })).status === 403);
  }

  console.log('\nRubric 3: CRUD and validation');
  let created;
  {
    const invalid = await call('POST', '/courses', { token: admin.accessToken, body: { code: '', credits: -1 } });
    check('invalid course -> 400 with fieldErrors', invalid.status === 400 && invalid.json.fieldErrors, `${invalid.status}`);
    check('ApiError carries correlationId', invalid.json && 'correlationId' in invalid.json, JSON.stringify(invalid.json).slice(0, 200));
    const c = await call('POST', '/courses', { token: admin.accessToken, body: newCourse });
    created = c.json;
    check('admin creates course -> 201', c.status === 201, `${c.status} ${JSON.stringify(c.json).slice(0, 200)}`);
    const page = await call('GET', '/courses?department=Computer%20Science&availableOnly=true&page=0&size=3&sort=tuitionFee,asc');
    check('search + filter + sort + server-side pagination', page.status === 200 && page.json.content.length <= 3 && page.json.totalElements >= 1);
    const upd = await call('PUT', `/courses/${created.id}`, { token: admin.accessToken, body: { ...newCourse, title: 'Smoke Test Seminar (edited)' } });
    check('admin updates course -> 200', upd.status === 200 && upd.json.title.includes('edited'));
  }

  console.log('\nRubric 1: seat-hold saga');
  {
    const s = await newStudent('saga');
    const cid = `smoke-fail-${run}`;
    const hold = await call('POST', '/enrollments', { token: s.accessToken, body: { courseId: created.id }, headers: { 'X-Correlation-Id': cid } });
    check('hold seat -> SEAT_HELD with ~10 min hold', hold.status === 201 && hold.json.status === 'SEAT_HELD' && hold.json.secondsRemaining > 550, `${hold.status} ${JSON.stringify(hold.json).slice(0, 200)}`);
    check('seat taken in course-service', (await call('GET', `/courses/${created.id}`)).json.availableSeats === 4);
    const fail = await call('POST', '/payments', { token: s.accessToken, body: { enrollmentId: hold.json.id, amount: 1, cardNumber: '4000 0000 0000 0002', cardHolder: 'Smoke', expiry: '12/30', cvv: '123' }, headers: { 'X-Correlation-Id': cid } });
    check('declined card -> payment FAILED', fail.json.status === 'FAILED', `${fail.status} ${JSON.stringify(fail.json).slice(0, 200)}`);
    check('payment amount is the real tuition (client sent 1)', Number(fail.json.amount) === 1000, `${fail.json.amount}`);
    const after = await call('GET', `/enrollments/${hold.json.id}`, { token: s.accessToken });
    check('enrollment -> PAYMENT_FAILED', after.json.status === 'PAYMENT_FAILED', after.json.status);
    check('compensation released the seat', (await call('GET', `/courses/${created.id}`)).json.availableSeats === 5);

    const hold2 = await call('POST', '/enrollments', { token: s.accessToken, body: { courseId: created.id } });
    const key = `smoke-idem-${run}`;
    const pay = { enrollmentId: hold2.json.id, cardNumber: '4242 4242 4242 4242', cardHolder: 'Smoke', expiry: '12/30', cvv: '123' };
    const p1 = await call('POST', '/payments', { token: s.accessToken, body: pay, headers: { 'Idempotency-Key': key } });
    const p2 = await call('POST', '/payments', { token: s.accessToken, body: pay, headers: { 'Idempotency-Key': key } });
    check('good card -> SUCCESS', p1.json.status === 'SUCCESS', JSON.stringify(p1.json).slice(0, 200));
    check('same Idempotency-Key returns the same payment (no double charge)', p1.json.id === p2.json.id && p1.json.transactionRef === p2.json.transactionRef);
    check('enrollment -> CONFIRMED', (await call('GET', `/enrollments/${hold2.json.id}`, { token: s.accessToken })).json.status === 'CONFIRMED');
    const other = await newStudent('payother');
    check("paying for someone else's enrollment -> 403", (await call('POST', '/payments', { token: other.accessToken, body: pay })).status === 403);

    const trace = await call('GET', `/admin/trace/${cid}`, { token: admin.accessToken });
    const services = new Set((trace.json.hops || []).map(h => h.service));
    check('trace spans gateway, enrollment, course, payment, notification',
      ['api-gateway', 'enrollment-service', 'course-service', 'payment-service', 'notification-service'].every(x => services.has(x)), [...services].join(','));

    const cs301 = await courseByCode('CS301');
    const full = await call('POST', '/enrollments', { token: s.accessToken, body: { courseId: cs301.id } });
    check('full course -> 409', full.status === 409, `${full.status}`);
    const wl = await call('POST', `/enrollments/waitlist?courseId=${cs301.id}`, { token: s.accessToken });
    check('join waitlist -> WAITLISTED', wl.json.status === 'WAITLISTED', JSON.stringify(wl.json).slice(0, 150));
    const math101 = await courseByCode('MATH101');
    const late = await call('POST', '/enrollments', { token: s.accessToken, body: { courseId: math101.id } });
    check('past deadline -> 422', late.status === 422, `${late.status}`);
    const dupe = await call('POST', '/enrollments', { token: s.accessToken, body: { courseId: created.id } });
    check('duplicate enrollment -> 409 (not swallowed by circuit breaker)', dupe.status === 409, `${dupe.status}`);

    const del = await call('DELETE', `/courses/${created.id}`, { token: admin.accessToken });
    check('delete course with active enrollments -> 409', del.status === 409, `${del.status}`);
    const refund = await call('POST', `/payments/${p1.json.id}/refund`, { token: s.accessToken });
    check('refund -> REFUNDED and seat released', refund.json.status === 'REFUNDED' && (await call('GET', `/courses/${created.id}`)).json.availableSeats === 5);
    check('course with no active enrollments can be deleted', (await call('DELETE', `/courses/${created.id}`, { token: admin.accessToken })).status === 204);
  }

  console.log('\nRubric 3: load balancing');
  {
    const counts = {};
    for (let i = 0; i < 20; i++) {
      const r = await call('GET', '/courses/whoami');
      counts[r.json.instanceId] = (counts[r.json.instanceId] || 0) + 1;
    }
    console.log('        whoami x20:', JSON.stringify(counts));
    check('/courses/whoami spread over 2 course instances', Object.keys(counts).length >= 2);
    const served = new Set();
    for (let i = 0; i < 6; i++) served.add((await call('GET', '/courses?size=1')).headers.get('x-served-by'));
    check('X-Served-By header alternates between instances', served.size >= 2, [...served].join(','));
    const reg = await call('GET', '/admin/registry', { token: admin.accessToken });
    const svc = reg.json.services || {};
    const n = k => (Object.entries(svc).find(([name]) => name.toLowerCase() === k)?.[1] || []).length;
    check('Eureka: 2 course-service and 2 enrollment-service instances', n('course-service') === 2 && n('enrollment-service') === 2, JSON.stringify(Object.keys(svc)));
    const cb = await call('GET', '/admin/circuitbreakers', { token: admin.accessToken });
    check('circuit breaker state is exposed', cb.status === 200 && cb.json.some(e => Object.keys(e.circuitBreakers || {}).length > 0));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
