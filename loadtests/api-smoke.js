import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    readiness: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export default function () {
  const response = http.get(`${baseUrl}/health/ready`, {
    tags: { operation: 'readiness' },
  });
  check(response, {
    'readiness returns 200': (result) => result.status === 200,
    'readiness reports ready': (result) => result.json('status') === 'ready',
  });
  sleep(0.2);
}
