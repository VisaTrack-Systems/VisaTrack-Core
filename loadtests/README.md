# Load tests

Run the smoke baseline against an isolated staging environment:

```bash
k6 run -e BASE_URL=https://staging-api.example.com -e VUS=25 \
  -e DURATION=2m loadtests/api-smoke.js
```

The committed thresholds are safety floors, not production capacity claims:

- error rate below 1%
- p95 below 500 ms
- p99 below 1 second

Do not run load tests against production without an approved change window, monitoring,
synthetic tenant data, and rollback owner. Add authenticated dashboard, upload-initiation,
and archive scenarios only after staging credentials and representative data volumes are
available. Record environment size, database volume, scanner/worker capacity, and results
with each release-readiness review.
