import http from 'k6/http';
import { check, sleep } from 'k6';
const base = __ENV.BASE_URL || 'http://localhost:8080';
const origin = __ENV.ORIGIN || base;
export const options = {
  scenarios: {
    homepage: { executor: 'constant-vus', exec: 'homepage', vus: 2, duration: '30s' },
    courseBrowsing: { executor: 'constant-vus', exec: 'browse', vus: 3, duration: '30s' },
    flowchart: { executor: 'constant-vus', exec: 'flowchart', vus: 2, duration: '30s' },
    ...(__ENV.LOAD_EMAIL && __ENV.LOAD_PASSWORD
      ? { dashboard: { executor: 'constant-vus', exec: 'dashboard', vus: 2, duration: '30s' } }
      : {}),
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] },
};
const headers = { 'Content-Type': 'application/json', 'X-UniPath-Client': 'web', Origin: origin };
export function setup() {
  const list = http.get(`${base}/api/curricula`);
  check(list, { 'curricula available': (r) => r.status === 200 });
  const curriculum = list.status === 200 ? list.json()[0] : null;
  let cookie = null;
  if (__ENV.LOAD_EMAIL && __ENV.LOAD_PASSWORD) {
    const login = http.post(
      `${base}/api/auth/login`,
      JSON.stringify({ email: __ENV.LOAD_EMAIL, password: __ENV.LOAD_PASSWORD }),
      { headers },
    );
    check(login, { 'load account signs in': (r) => r.status === 200 });
    const name = __ENV.COOKIE_NAME || 'unipath_session';
    cookie = login.cookies[name]?.[0]?.value;
    if (!cookie) throw new Error('Load-test login failed.');
  }
  return { id: curriculum?.id, cookie };
}
export function homepage() {
  const r = http.get(base);
  check(r, { 'homepage OK': (r) => r.status === 200 });
  sleep(1);
}
export function browse() {
  const responses = http.batch([
    ['GET', `${base}/api/curricula`],
    ['GET', `${base}/health/ready`],
  ]);
  responses.forEach((r) => check(r, { 'concurrent browsing OK': (r) => r.status === 200 }));
  sleep(1);
}
export function flowchart(data) {
  if (!data.id) throw new Error('Seed a published curriculum first.');
  const r = http.get(`${base}/api/curricula/${data.id}`);
  check(r, {
    'flowchart data OK': (r) => r.status === 200 && r.json().document.courses.length > 0,
  });
  sleep(1);
}
export function dashboard(data) {
  const r = http.get(`${base}/api/student`, {
    cookies: { [__ENV.COOKIE_NAME || 'unipath_session']: data.cookie },
  });
  check(r, { 'private dashboard OK': (r) => r.status === 200 });
  sleep(1);
}
export function teardown(data) {
  if (data.cookie)
    http.post(`${base}/api/auth/logout`, '{}', {
      headers,
      cookies: { [__ENV.COOKIE_NAME || 'unipath_session']: data.cookie },
    });
}
