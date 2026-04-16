export async function onRequest(context) {
  const apiOrigin = context.env.API_ORIGIN;

  if (!apiOrigin) {
    return new Response("Missing API_ORIGIN environment variable", {
      status: 500,
    });
  }

  const requestUrl = new URL(context.request.url);
  const upstreamUrl = new URL(apiOrigin);

  // The frontend targets /api/... while the backend mixes bare routes
  // (/login, /register, /tipos, etc.) and explicit /api/voice routes.
  // Stripping only the first /api preserves /api/voice as /api/voice.
  const upstreamPath = requestUrl.pathname.replace(/^\/api/, "") || "/";
  upstreamUrl.pathname = upstreamPath;
  upstreamUrl.search = requestUrl.search;

  const headers = new Headers(context.request.headers);
  headers.delete("host");

  return fetch(upstreamUrl.toString(), {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "manual",
  });
}
