export function buildContentSecurityPolicy(input: {
  apiOrigin: string;
  storageOrigin?: string;
  development: boolean;
}): string {
  const developmentScriptPolicy = input.development ? " 'unsafe-eval'" : '';
  const storagePolicy = input.storageOrigin ? ` ${input.storageOrigin}` : '';

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${developmentScriptPolicy}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${input.apiOrigin}${storagePolicy}`,
  ].join('; ');
}
