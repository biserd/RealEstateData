const DATABASE_BACKED_PAGE = /^\/(?:unit|properties|property|building)\/[^/?#]+$/;

const PRIVATE_PAGE = /^\/(?:login|register|activate|forgot-password|reset-password|checkout\/success|saved-properties|admin-console|settings|portfolio|api-access)(?:\/|$)/;

export function isDatabaseBackedPagePath(pathname: string): boolean {
  return DATABASE_BACKED_PAGE.test(pathname);
}

export function isPrivatePagePath(pathname: string): boolean {
  return PRIVATE_PAGE.test(pathname);
}

export function canonicalRedirectTarget(
  requestedPath: string,
  canonicalPath: string,
): string | null {
  if (!isDatabaseBackedPagePath(requestedPath)) return null;
  return requestedPath === canonicalPath ? null : canonicalPath;
}
