import { beforeEach, describe, expect, it } from 'vitest';

import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/api';

describe('browser auth session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAccessToken();
  });

  it('keeps access tokens in memory instead of localStorage', () => {
    setAccessToken('short-lived-access-token');

    expect(getAccessToken()).toBe('short-lived-access-token');
    expect(window.localStorage.getItem('visatrack.access_token')).toBeNull();
  });

  it('removes access tokens persisted by older releases', () => {
    window.localStorage.setItem('visatrack.access_token', 'legacy-token');

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem('visatrack.access_token')).toBeNull();
  });
});
