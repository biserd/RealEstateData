const DATABASE_BACKED_PAGE = /^\/(?:unit|properties|building)\/[^/?#]+$/;

export function isDatabaseBackedPagePath(pathname: string): boolean {
  return DATABASE_BACKED_PAGE.test(pathname);
}

export function canonicalRedirectTarget(
  requestedPath: string,
  canonicalPath: string,
): string | null {
  if (!isDatabaseBackedPagePath(requestedPath)) return null;
  return requestedPath === canonicalPath ? null : canonicalPath;
}
