/** Compress generated HTML without allowing edge transformations of page scripts. */
export function generatedDocumentResponse(request: Request, html: string, status: number, originalHeaders: Headers): Response {
  const headers = new Headers(originalHeaders);
  // Asset validators and lengths describe the unmodified Vite template, not
  // this URL-specific SEO document.
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("content-encoding");
  headers.set("vary", "Accept, Accept-Encoding");

  const acceptsGzip = (request.headers.get("accept-encoding") || "")
    .split(",")
    .some((item) => {
      const [encoding, ...parameters] = item.trim().toLowerCase().split(";");
      if (encoding !== "gzip") return false;
      const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
      return !quality || Number(quality.trim().slice(2)) > 0;
    });
  if (!acceptsGzip) return new Response(html, { status, headers });

  headers.set("content-encoding", "gzip");
  const compressed = new Blob([html]).stream().pipeThrough(new CompressionStream("gzip"));
  // Workers must transmit an already-compressed stream unchanged.
  return new Response(compressed, {
    status,
    headers,
    encodeBody: "manual",
  } as ResponseInit & { encodeBody: "manual" });
}
