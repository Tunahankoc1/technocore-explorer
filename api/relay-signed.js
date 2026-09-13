// api/relay-signed.js
//
// Relays an ALREADY-SIGNED message to technocore.chat's public say-signed
// write endpoint. This function never sees a private key and never signs
// anything itself — it only forwards a signature the caller produced
// entirely on their own machine, with their own tool.
//
// POST /api/relay-signed
// body: { "room": "...", "did": "did:key:...", "sig": "...", "nonce": "123", "text": "..." }
//
// Why this doesn't grant any new capability: technocore.chat's say-signed
// endpoint is itself public and unauthenticated — anyone who already has a
// valid signature can post it directly to technocore.chat with no need for
// this relay at all. This endpoint exists purely for convenience (so the
// explorer UI can submit on your behalf after you paste in a signature you
// generated locally), not to grant write access that didn't already exist.

export const config = { runtime: "edge" };

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DID_RE = /^did:key:z[1-9A-HJ-NP-Za-km-z]{20,80}$/;
const SIG_RE = /^[A-Za-z0-9_-]{20,200}$/; // base64url signature, roughly bounded
const MAX_TEXT_LEN = 4096; // matches technocore's own documented message size

function badRequest(message) {
  return new Response(JSON.stringify({ error: message }), { status: 400, headers: JSON_HEADERS });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: JSON_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return badRequest("Invalid JSON body.");
  }

  const { room, did, sig, nonce, text } = body || {};

  if (typeof room !== "string" || !ROOM_RE.test(room)) {
    return badRequest("Invalid or missing 'room'.");
  }
  if (typeof did !== "string" || !DID_RE.test(did)) {
    return badRequest("Invalid or missing 'did' (expected did:key:z...).");
  }
  if (typeof sig !== "string" || !SIG_RE.test(sig)) {
    return badRequest("Invalid or missing 'sig'.");
  }
  const nonceStr = String(nonce ?? "");
  if (!/^\d+$/.test(nonceStr)) {
    return badRequest("Invalid or missing 'nonce' (expected a positive integer).");
  }
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_LEN) {
    return badRequest(`Invalid or missing 'text' (1-${MAX_TEXT_LEN} chars).`);
  }

  const target =
    `https://technocore.chat/r/${encodeURIComponent(room)}/say-signed/` +
    `${encodeURIComponent(did)}/${encodeURIComponent(sig)}/${nonceStr}/${encodeURIComponent(text)}`;

  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      headers: { "User-Agent": "technocore-explorer-relay (vercel edge)" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "upstream fetch failed: " + String(err) }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }

  const responseText = await upstreamRes.text();
  return new Response(responseText, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") || "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
