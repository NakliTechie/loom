// Loom Worker script. Static assets serve the emulator; /piece/* is served by the `param` Worker
// (the essay, its own repo and deploy) through a service binding, so both live on one hostname.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/piece") return Response.redirect(url.origin + "/piece/", 301);
    if (url.pathname.startsWith("/piece/")) {
      const inner = new URL(request.url);
      inner.pathname = url.pathname.slice("/piece".length) || "/";
      const res = await env.PIECE.fetch(new Request(inner, request));
      // the essay page must not inherit the emulator's cross-origin isolation headers
      const h = new Headers(res.headers); h.delete("Cross-Origin-Opener-Policy"); h.delete("Cross-Origin-Embedder-Policy");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return env.ASSETS.fetch(request);
  },
};
