// AcademiaX live concurrency demo: 20 students race for a 5-seat course at the same instant.
// Requests go through the gateway, so they are spread across both enrollment-service and both course-service
// instances. Exactly 5 must win; the other 15 get 409 Course Full.
//
// Usage (PowerShell):  node scripts/concurrency-demo.mjs
//                      $env:GATEWAY="http://host:8080"; node scripts/concurrency-demo.mjs

const GW = process.env.GATEWAY || 'http://localhost:8080';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@academiax.edu', password: process.env.ADMIN_PASSWORD || 'Admin@Academiax1' };
const SEATS = 5;
const RACERS = 20;
const run = Date.now().toString(36).toUpperCase();

async function call(method, path, { token, body } = {}) {
  const res = await fetch(GW + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, servedBy: res.headers.get('x-served-by') };
}

const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).json.accessToken;

const admin = await login(ADMIN.email, ADMIN.password);
const course = (await call('POST', '/courses', {
  token: admin,
  body: {
    code: `RACE${run.slice(-4)}`, title: 'Concurrency Demo Seminar', description: `${SEATS} seats, ${RACERS} students`,
    department: 'Computer Science', semester: 'Fall 2026', academicYear: '2026-27', credits: 1, level: 'Undergraduate',
    totalSeats: SEATS, tuitionFee: 100, enrollmentDeadline: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 19),
  },
})).json;
console.log(`Created ${course.code} with ${course.totalSeats} seats (course id ${course.id})`);

// Setup is not the thing under test: create the students a few at a time (BCrypt-12 is deliberately slow),
// retrying once on a dropped connection (register is idempotent here, a repeat just answers 409).
async function withRetry(fn) {
  try { return await fn(); } catch (e) { await new Promise(r => setTimeout(r, 500)); return fn(); }
}
async function createRacer(i) {
  const email = `racer${i + 1}-${run.toLowerCase()}@academiax.edu`;
  await withRetry(() => call('POST', '/auth/register', { body: { name: `Racer ${i + 1}`, email, password: 'Racer@12345', department: 'Computer Science' } }));
  return withRetry(() => login(email, 'Racer@12345'));
}

console.log(`Registering ${RACERS} students...`);
const tokens = [];
for (let i = 0; i < RACERS; i += 4) {
  tokens.push(...await Promise.all(Array.from({ length: Math.min(4, RACERS - i) }, (_, k) => createRacer(i + k))));
}

console.log(`Firing ${RACERS} enrollment requests at the same time...\n`);
const results = await Promise.all(tokens.map(token => call('POST', '/enrollments', { token, body: { courseId: course.id } })));

const byStatus = {};
const byInstance = {};
for (const r of results) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  byInstance[r.servedBy] = (byInstance[r.servedBy] || 0) + 1;
}
const after = (await call('GET', `/courses/${course.id}`)).json;

console.log('HTTP status counts:   ', byStatus, '(201 = seat held, 409 = course full)');
console.log('Handled by instance:  ', byInstance);
console.log(`Seats left in course:  ${after.availableSeats} of ${after.totalSeats}`);

const ok = byStatus[201] === SEATS && after.availableSeats === 0 && (byStatus[409] || 0) === RACERS - SEATS;
console.log(ok ? `\nPASS: exactly ${SEATS} of ${RACERS} got a seat, no over-allocation.` : '\nFAIL: seat count does not add up.');

// Clean up so the demo course doesn't linger in the catalogue: winners release their holds, then the admin withdraws it.
if (!process.argv.includes('--keep')) {
  await Promise.all(results.map((r, i) => (r.status === 201 ? call('PUT', `/enrollments/${r.json.id}/cancel`, { token: tokens[i] }) : null)));
  const removed = await call('DELETE', `/courses/${course.id}`, { token: admin });
  console.log(removed.status === 204 ? `Cleaned up: holds released and ${course.code} withdrawn (run with --keep to leave it).` : `Cleanup: could not withdraw ${course.code} (${removed.status}).`);
}
process.exit(ok ? 0 : 1);
