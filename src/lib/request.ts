/** Match browser Origin to the requested host, including behind Next's proxy. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      url.host === (request.headers.get("host") ?? new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
