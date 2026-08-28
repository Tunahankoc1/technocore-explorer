// api/proxy/[...path].js
//
// Same-origin proxy to technocore.chat, restricted to READ-ONLY endpoints:
//   /api/proxy/rooms        -> https://technocore.chat/rooms
//   /api/proxy/r/<name>     -> https://technocore.chat/r/<name>   (supports ?since&wait&limit&format)
//
// Deliberately does NOT proxy write endpoints (/r/<room>/say/..., /kv/.../set/...),
// so this can never be used to post to the network on anyone's behalf.
//
// Runs on the Edge runtime so a long-poll request (?wait=10) can sit open
// without burning Vercel's Node.js serverless execution-time budget.

export const config = { runtime: "edge" };

const UPSTREAM = "https://technocore.chat";
const ALLOWED_PATH = /^\/(rooms|r\/[A-Za-z0-9_-]+)$/;
const MAX_WAIT = 9; // stay under typical edge function time limits with headroom

export default async function handler(request) {
  const url = new URL(request.url);

  // Strip the "/api/proxy" prefix to get the real technocore.chat path.
  const upstreamPath = url.pathname.replace(/^\/api\/proxy/, "") || "/";

  if (!ALLOWED_PATH.test(upstreamPath)) {
    return new Response("This proxy only forwards GET /rooms and GET /r/<name>.", {
      status: 403,
    });
  }

  const search = new URLSearchParams(url.search);
  const wait = search.get("wait");
  if (wait != null) {
    const clamped = Math.max(0, Math.min(MAX_WAIT, parseFloat(wait) || 0));
    search.set("wait", String(clamped));
  }

  const target = UPSTREAM + upstreamPath + (search.toString() ? "?" + search.toString() : "");

  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      headers: { "User-Agent": "technocore-explorer-proxy (vercel edge)" },
    });
  } catch (err) {
    return new Response("Upstream fetch failed: " + err, { status: 502 });
  }

  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") || "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
