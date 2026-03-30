/** mockApi: mockapi implementation. */

import { useLayoutEffect } from 'react';
import type { Decorator } from '@storybook/react';

export type MockApiRoute = {
  method?: string;
  path: string | RegExp;
  status?: number;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
};

type StoryParameters = {
  mockApi?: MockApiRoute[];
  mockStorage?: Record<string, string | null>;
};

function matches(route: MockApiRoute, method: string, pathname: string) {
  const expectedMethod = (route.method ?? 'GET').toUpperCase();
  if (expectedMethod !== method) {
    return false;
  }

  if (typeof route.path === 'string') {
    return route.path === pathname;
  }

  return route.path.test(pathname);
}

function buildResponse(route: MockApiRoute): Response {
  const status = route.status ?? 200;
  const headers = new Headers(route.headers ?? {});

  if (route.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(route.json), { status, headers });
  }

  return new Response(route.body ?? '', { status, headers });
}

function createMockFetch(routes: MockApiRoute[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl, 'http://localhost');
    const method = (init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();

    const route = routes.find((entry) => matches(entry, method, url.pathname));
    if (!route) {
      return new Response(
        JSON.stringify({ detail: `Unhandled mock route: ${method} ${url.pathname}` }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return buildResponse(route);
  };
}

function MockApiProvider({
  routes,
  storage,
  children,
}: {
  routes: MockApiRoute[];
  storage: Record<string, string | null>;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    const previousFetch = globalThis.fetch;
    const previousStorage = new Map<string, string | null>();

    globalThis.fetch = createMockFetch(routes);

    if (typeof window !== 'undefined') {
      for (const [key, value] of Object.entries(storage)) {
        previousStorage.set(key, window.localStorage.getItem(key));
        if (value === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, value);
        }
      }
    }

    return () => {
      globalThis.fetch = previousFetch;
      if (typeof window !== 'undefined') {
        for (const [key, value] of previousStorage.entries()) {
          if (value === null) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, value);
          }
        }
      }
    };
  }, [routes, storage]);

  return <>{children}</>;
}

export const withMockApi: Decorator = (Story, context) => {
  const parameters = context.parameters as StoryParameters;
  const routes = parameters.mockApi ?? [];
  const storage = parameters.mockStorage ?? {};

  return (
    <MockApiProvider routes={routes} storage={storage}>
      <Story />
    </MockApiProvider>
  );
};

export function jsonRoute(method: string, path: string | RegExp, json: unknown, status = 200): MockApiRoute {
  return { method, path, json, status };
}
