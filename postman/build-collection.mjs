// Generates AcademiaX.postman_collection.json. Edit here and re-run:  node postman/build-collection.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const json = { 'Content-Type': 'application/json' };

function req(name, method, path, { token, body, headers = {}, tests = [], pre = [], description } = {}) {
  const header = Object.entries({ ...(body ? json : {}), ...headers }).map(([key, value]) => ({ key, value }));
  if (token) header.push({ key: 'Authorization', value: `Bearer {{${token}}}` });
  const [rawPath, query] = path.split('?');
  return {
    name,
    event: [
      ...(pre.length ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } }] : []),
      ...(tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : []),
    ],
    request: {
      method,
      header,
      description,
      ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ['{{baseUrl}}'],
        path: rawPath.split('/').filter(Boolean),
        ...(query ? { query: query.split('&').map(kv => { const [key, value] = kv.split('='); return { key, value }; }) } : {}),
      },
    },
  };
}

const status = code => `pm.test('status ${code}', () => pm.response.to.have.status(${code}));`;
const save = (variable, expr) => `pm.collectionVariables.set('${variable}', ${expr});`;
const login = (label, emailVar, passVar, tokenVar, refreshVar) => req(`Login as ${label}`, 'POST', '/auth/login', {
  body: { email: `{{${emailVar}}}`, password: `{{${passVar}}}` },
  tests: [status(200), save(tokenVar, 'pm.response.json().accessToken'), ...(refreshVar ? [save(refreshVar, 'pm.response.json().refreshToken')] : []),
    `pm.test('token_type is ACCESS', () => pm.expect(JSON.parse(atob(pm.response.json().accessToken.split('.')[1]))).to.have.property('token_type', 'ACCESS'));`],
});
const courseLookup = (code, variable) => req(`Look up ${code}`, 'GET', `/courses?courseCode=${code}`, {
  tests: [status(200), save(variable, 'pm.response.json().content[0].id')],
});

const setup = {
  name: '0 · Setup (run first)',
  description: 'Logs in the seeded accounts and saves their tokens into collection variables used everywhere else.',
  item: [
    login('admin', 'adminEmail', 'adminPassword', 'adminToken'),
    login('student (Alice)', 'studentEmail', 'studentPassword', 'studentToken', 'studentRefresh'),
    login('second student (Bob)', 'student2Email', 'studentPassword', 'student2Token'),
    login('instructor (Dr. Mitchell)', 'instructorEmail', 'instructorPassword', 'instructorToken'),
    req('Register a fresh student', 'POST', '/auth/register', {
      pre: [`pm.collectionVariables.set('freshEmail', 'postman-' + Date.now() + '@academiax.edu');`],
      body: { name: 'Postman Student', email: '{{freshEmail}}', password: 'Postman@123', department: 'Computer Science' },
      tests: [status(201)],
    }),
    req('Login fresh student', 'POST', '/auth/login', {
      body: { email: '{{freshEmail}}', password: 'Postman@123' },
      tests: [status(200), save('freshToken', 'pm.response.json().accessToken'), save('freshRefresh', 'pm.response.json().refreshToken')],
    }),
    courseLookup('PHY401', 'openCourseId'),
    courseLookup('CS301', 'fullCourseId'),
    courseLookup('MATH101', 'closedCourseId'),
    courseLookup('CS101', 'cs101Id'),
  ],
};

const rubric1 = {
  name: '1 · Microservices: seat-hold saga',
  description: 'Gateway → enrollment → course → payment → notification, with compensation, idempotency and waitlist.',
  item: [
    req('Hold a seat (SEAT_HELD, 10 min)', 'POST', '/enrollments', {
      token: 'freshToken', body: { courseId: '{{openCourseId}}' }, headers: { 'X-Correlation-Id': 'postman-{{$timestamp}}' },
      tests: [status(201), `pm.test('SEAT_HELD', () => pm.expect(pm.response.json().status).to.eql('SEAT_HELD'));`,
        `pm.test('X-Served-By present', () => pm.expect(pm.response.headers.get('X-Served-By')).to.match(/enrollment-service@/));`,
        save('enrollmentId', 'pm.response.json().id'), save('traceId', "pm.request.headers.get('X-Correlation-Id')")],
    }),
    req('Pay with decline card 4000…0002 → FAILED, seat released', 'POST', '/payments', {
      token: 'freshToken', headers: { 'Idempotency-Key': 'decline-{{$guid}}', 'X-Correlation-Id': '{{traceId}}' },
      body: { enrollmentId: '{{enrollmentId}}', amount: 1, cardNumber: '4000 0000 0000 0002', cardHolder: 'Postman', expiry: '12/30', cvv: '123' },
      tests: [status(201), `pm.test('FAILED', () => pm.expect(pm.response.json().status).to.eql('FAILED'));`,
        `pm.test('amount is the course tuition, not the 1 sent', () => pm.expect(Number(pm.response.json().amount)).to.be.above(1));`],
    }),
    req('Enrollment is now PAYMENT_FAILED', 'GET', '/enrollments/{{enrollmentId}}', {
      token: 'freshToken', tests: [status(200), `pm.test('PAYMENT_FAILED', () => pm.expect(pm.response.json().status).to.eql('PAYMENT_FAILED'));`],
    }),
    req('Trace of that enrollment (ADMIN)', 'GET', '/admin/trace/{{traceId}}', {
      token: 'adminToken',
      tests: [status(200), `const s = new Set(pm.response.json().hops.map(h => h.service));`,
        `pm.test('spans 5 services', () => ['api-gateway','enrollment-service','course-service','payment-service','notification-service'].forEach(x => pm.expect(s.has(x), x).to.be.true));`],
    }),
    req('Hold again', 'POST', '/enrollments', {
      token: 'freshToken', body: { courseId: '{{openCourseId}}' }, tests: [status(201), save('enrollmentId', 'pm.response.json().id')],
      pre: [`pm.collectionVariables.set('idemKey', pm.variables.replaceIn('{{$guid}}'));`],
    }),
    req('Pay with good card (Idempotency-Key)', 'POST', '/payments', {
      token: 'freshToken', headers: { 'Idempotency-Key': '{{idemKey}}' },
      body: { enrollmentId: '{{enrollmentId}}', cardNumber: '4242 4242 4242 4242', cardHolder: 'Postman', expiry: '12/30', cvv: '123' },
      tests: [status(201), `pm.test('SUCCESS', () => pm.expect(pm.response.json().status).to.eql('SUCCESS'));`, save('paymentId', 'pm.response.json().id'), save('txnRef', 'pm.response.json().transactionRef')],
    }),
    req('Replay same Idempotency-Key → same payment, no double charge', 'POST', '/payments', {
      token: 'freshToken', headers: { 'Idempotency-Key': '{{idemKey}}' },
      body: { enrollmentId: '{{enrollmentId}}', cardNumber: '4242 4242 4242 4242', cardHolder: 'Postman', expiry: '12/30', cvv: '123' },
      tests: [`pm.test('same transaction', () => pm.expect(pm.response.json().transactionRef).to.eql(pm.collectionVariables.get('txnRef')));`],
    }),
    req('Enrollment is CONFIRMED', 'GET', '/enrollments/{{enrollmentId}}', {
      token: 'freshToken', tests: [status(200), `pm.test('CONFIRMED', () => pm.expect(pm.response.json().status).to.eql('CONFIRMED'));`],
    }),
    req('Duplicate enrollment → 409 (not masked by circuit breaker)', 'POST', '/enrollments', { token: 'freshToken', body: { courseId: '{{openCourseId}}' }, tests: [status(409)] }),
    req('Full course → 409', 'POST', '/enrollments', { token: 'freshToken', body: { courseId: '{{fullCourseId}}' }, tests: [status(409)] }),
    req('Join waitlist on full course', 'POST', '/enrollments/waitlist?courseId={{fullCourseId}}', {
      token: 'freshToken', tests: [status(201), `pm.test('WAITLISTED', () => pm.expect(pm.response.json().status).to.eql('WAITLISTED'));`],
    }),
    req('Past deadline → 422', 'POST', '/enrollments', { token: 'freshToken', body: { courseId: '{{closedCourseId}}' }, tests: [status(422)] }),
    req('My notifications (notification-service)', 'GET', '/notifications/my', {
      token: 'freshToken', tests: [status(200), `pm.test('saga wrote notices', () => pm.expect(pm.response.json().length).to.be.above(2));`],
    }),
    req('Refund → seat released, waitlist promoted', 'POST', '/payments/{{paymentId}}/refund', {
      token: 'freshToken', tests: [status(200), `pm.test('REFUNDED', () => pm.expect(pm.response.json().status).to.eql('REFUNDED'));`],
    }),
    req('Eureka registry (ADMIN)', 'GET', '/admin/registry', { token: 'adminToken', tests: [status(200)] }),
    req('Circuit breaker state (ADMIN)', 'GET', '/admin/circuitbreakers', { token: 'adminToken', tests: [status(200)] }),
  ],
};

const rubric2 = {
  name: '2 · JWT authentication & authorization',
  item: [
    req('Register with role=ADMIN → still STUDENT', 'POST', '/auth/register', {
      pre: [`pm.collectionVariables.set('malloryEmail', 'mallory-' + Date.now() + '@academiax.edu');`],
      body: { name: 'Mallory', email: '{{malloryEmail}}', password: 'Mallory@123', department: 'Computer Science', role: 'ADMIN' },
      tests: [status(201), `pm.test('role forced to STUDENT', () => pm.expect(pm.response.json().role).to.eql('STUDENT'));`],
    }),
    req('Weak password → 400 with fieldErrors', 'POST', '/auth/register', {
      body: { name: 'Weak', email: 'weak-{{$timestamp}}@academiax.edu', password: 'password', department: 'Computer Science' },
      tests: [status(400), `pm.test('fieldErrors.password', () => pm.expect(pm.response.json().fieldErrors).to.have.property('password'));`],
    }),
    req('Wrong password → 401', 'POST', '/auth/login', { body: { email: '{{studentEmail}}', password: 'Wrong@123' }, tests: [status(401)] }),
    req('No token → 401', 'GET', '/enrollments/my', { tests: [status(401)] }),
    req('Tampered token → 401', 'GET', '/enrollments/my', {
      headers: { Authorization: 'Bearer {{tamperedToken}}' },
      pre: [`const t = pm.collectionVariables.get('studentToken').split('.');`,
        `const p = JSON.parse(atob(t[1])); p.role = 'ADMIN';`,
        `pm.collectionVariables.set('tamperedToken', [t[0], btoa(JSON.stringify(p)).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_'), t[2]].join('.'));`],
      tests: [status(401)],
    }),
    req('Refresh token used as access token → 401', 'GET', '/enrollments/my', { token: 'freshRefresh', tests: [status(401)] }),
    req('Refresh rotates the pair', 'POST', '/auth/refresh', {
      body: { refreshToken: '{{freshRefresh}}' },
      tests: [status(200), `pm.test('new refresh token', () => pm.expect(pm.response.json().refreshToken).to.not.eql(pm.collectionVariables.get('freshRefresh')));`,
        save('rotatedRefresh', 'pm.response.json().refreshToken'), save('freshToken', 'pm.response.json().accessToken')],
    }),
    req('Reuse old refresh token → 401 (family revoked)', 'POST', '/auth/refresh', { body: { refreshToken: '{{freshRefresh}}' }, tests: [status(401)] }),
    req('Rotated token is now dead too → 401', 'POST', '/auth/refresh', { body: { refreshToken: '{{rotatedRefresh}}' }, tests: [status(401)] }),
    req('Student creates course → 403', 'POST', '/courses', { token: 'studentToken', body: { code: 'NOPE1' }, tests: [status(403)] }),
    req('Student spoofs X-User-Role: ADMIN → 403', 'GET', '/enrollments', {
      token: 'studentToken', headers: { 'X-User-Role': 'ADMIN', 'X-User-Id': '1' }, tests: [status(403)],
      description: 'The gateway strips client X-User-* headers and injects the real ones from the JWT.',
    }),
    req('Instructor edits another instructor\'s course → 403', 'PUT', '/courses/{{openCourseId}}', {
      token: 'instructorToken',
      body: { code: 'PHY401', title: 'Hijacked', description: 'x', department: 'Physics', semester: 'Fall 2026', academicYear: '2026-27', credits: 3, totalSeats: 20, tuitionFee: 3500, enrollmentDeadline: '2027-01-29T00:00:00' },
      tests: [status(403)],
    }),
    req('Internal saga endpoint via gateway → 403', 'PUT', '/enrollments/1/confirm?paymentId=1', { token: 'studentToken', tests: [status(403)] }),
    req('My enrollments (Alice)', 'GET', '/enrollments/my', { token: 'studentToken', tests: [status(200), save('aliceEnrollmentId', 'pm.response.json()[0].id')] }),
    req("Bob reads Alice's enrollment → 403 (IDOR)", 'GET', '/enrollments/{{aliceEnrollmentId}}', { token: 'student2Token', tests: [status(403)] }),
    req('Student opens admin registry → 403', 'GET', '/admin/registry', { token: 'studentToken', tests: [status(403)] }),
    req('Active sessions', 'GET', '/auth/sessions', { token: 'studentToken', tests: [status(200)] }),
    req('Logout (revokes refresh token)', 'POST', '/auth/logout', { body: { refreshToken: '{{studentRefresh}}' }, tests: [status(200)] }),
  ],
};

const coursePayload = { code: '{{newCode}}', title: 'Postman Seminar', description: 'Created from Postman', department: 'Computer Science', level: 'Undergraduate', semester: 'Fall 2026', academicYear: '2026-27', credits: 2, totalSeats: 12, tuitionFee: 1200, enrollmentDeadline: '2027-03-01T00:00:00' };

const rubric3 = {
  name: '3 · CRUD & load balancing',
  item: [
    req('Create course (ADMIN) → 201', 'POST', '/courses', {
      token: 'adminToken', body: coursePayload,
      pre: [`pm.collectionVariables.set('newCode', 'PM' + String(Date.now()).slice(-5));`],
      tests: [status(201), save('newCourseId', 'pm.response.json().id')],
    }),
    req('Read course', 'GET', '/courses/{{newCourseId}}', { tests: [status(200)] }),
    req('Search + filter + sort + page', 'GET', '/courses?department=Computer%20Science&availableOnly=true&sort=tuitionFee,asc&page=0&size=5', {
      tests: [status(200), `pm.test('server-side page', () => { const b = pm.response.json(); pm.expect(b.content.length).to.be.at.most(5); pm.expect(b).to.have.property('totalElements'); });`],
    }),
    req('Update course (ADMIN)', 'PUT', '/courses/{{newCourseId}}', {
      token: 'adminToken', body: { ...coursePayload, title: 'Postman Seminar (edited)' },
      tests: [status(200), `pm.test('title updated', () => pm.expect(pm.response.json().title).to.include('edited'));`],
    }),
    req('Invalid course → 400 with fieldErrors + correlationId', 'POST', '/courses', {
      token: 'adminToken', body: { code: '', credits: 0 },
      tests: [status(400), `pm.test('ApiError shape', () => { const b = pm.response.json(); ['timestamp','status','error','message','path','correlationId','fieldErrors'].forEach(k => pm.expect(b).to.have.property(k)); });`],
    }),
    req('Delete course → 204 (soft delete)', 'DELETE', '/courses/{{newCourseId}}', { token: 'adminToken', tests: [status(204)] }),
    req('Delete course with active enrollments → 409', 'DELETE', '/courses/{{cs101Id}}', { token: 'adminToken', tests: [status(409)] }),
    req('Users (ADMIN, paged)', 'GET', '/auth/users?page=0&size=5', { token: 'adminToken', tests: [status(200)] }),
    req('Create instructor (ADMIN)', 'POST', '/auth/users/instructors', {
      token: 'adminToken', body: { name: 'Prof. Postman', email: 'prof-{{$timestamp}}@academiax.edu', password: 'Faculty@123', department: 'Mathematics' },
      tests: [status(201), `pm.test('INSTRUCTOR', () => pm.expect(pm.response.json().role).to.eql('INSTRUCTOR'));`],
    }),
    req('All enrollments (ADMIN, paged)', 'GET', '/enrollments?page=0&size=5&status=CONFIRMED', { token: 'adminToken', tests: [status(200)] }),
    req('All payments (ADMIN, paged)', 'GET', '/payments?page=0&size=5', { token: 'adminToken', tests: [status(200)] }),
    req('Load balancing: whoami (run this folder 10× in the Collection Runner)', 'GET', '/courses/whoami', {
      description: 'Each run records which instance answered. In the Runner, iterations alternate between course-service@8082 and @8092.',
      tests: [status(200),
        `const id = pm.response.json().instanceId;`,
        `const seen = JSON.parse(pm.collectionVariables.get('lbSeen') || '{}'); seen[id] = (seen[id] || 0) + 1; pm.collectionVariables.set('lbSeen', JSON.stringify(seen));`,
        `console.log('served by', id, 'tally', seen);`,
        `pm.test('served by ' + id + ' (tally ' + JSON.stringify(seen) + ')', () => pm.expect(pm.response.headers.get('X-Served-By')).to.eql(id));`],
    }),
  ],
};

const collection = {
  info: {
    name: 'AcademiaX · Review 2',
    description: 'Run "0 · Setup" first (or the whole collection in the Runner). Select the "AcademiaX local" environment. Folders map to the three Review 2 rubric rows.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [setup, rubric1, rubric2, rubric3],
  variable: ['adminToken', 'studentToken', 'studentRefresh', 'student2Token', 'instructorToken', 'freshToken', 'freshRefresh', 'lbSeen']
    .map(key => ({ key, value: '' })),
};

const environment = {
  name: 'AcademiaX local',
  values: [
    ['baseUrl', 'http://localhost:8080'],
    ['adminEmail', 'admin@academiax.edu'], ['adminPassword', 'Admin@Academiax1'],
    ['studentEmail', 'student1@academiax.edu'], ['student2Email', 'student2@academiax.edu'], ['studentPassword', 'Student@123'],
    ['instructorEmail', 'instructor1@academiax.edu'], ['instructorPassword', 'Instr@123'],
  ].map(([key, value]) => ({ key, value, enabled: true })),
  _postman_variable_scope: 'environment',
};

writeFileSync(join(here, 'AcademiaX.postman_collection.json'), JSON.stringify(collection, null, 2));
writeFileSync(join(here, 'AcademiaX.local.postman_environment.json'), JSON.stringify(environment, null, 2));
console.log('Wrote collection and environment.');
