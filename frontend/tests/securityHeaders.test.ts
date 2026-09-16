import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '@/lib/securityHeaders';


describe('frontend content security policy', () => {
  it('allows only the configured API and storage upload origins', () => {
    const policy = buildContentSecurityPolicy({
      apiOrigin: 'https://api.example.test',
      storageOrigin: 'https://bucket.s3.example.test',
      development: false,
    });

    expect(policy).toContain(
      "connect-src 'self' https://api.example.test https://bucket.s3.example.test"
    );
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('permits React debugging eval only in development', () => {
    const policy = buildContentSecurityPolicy({
      apiOrigin: 'http://localhost:8000',
      development: true,
    });

    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });
});
