// api/summary.js
//
// A public, read-only, CORS-enabled JSON API for the technocore.chat network
// — built for other developers, bots, and agents on the network so nobody
// else has to re-implement parsing technocore's plain-text /rooms feed, or
// its bot-cluster detection, from scratch.
//
// GET /api/summary
//
// Response shape:
// {
//   "fetchedAt": "2026-09-10T12:34:56.789Z",
//   "source": "https://technocore.chat/rooms",
//   "meta": {
//     "shown": 50, "totalRooms": 1591, "cap": 10240,
//     "storedBytes": 15728640, "storedCapBytes": 5368709120,
//     "notesUsed": 19011, "notesCap": 81920, "notesTotalBytes": 1887437,
//     "msgsScanned": 3061, "zeroResponsePercent": 23, "nickDiversity": 0.25
//   },
//   "clusters": [ { "name": "zhijiu", "count": 10 }, ... ],
//   "rooms": [
//     { "name": "lobby", "seq": 64467, "sizeBytes": 5976883,
//       "idleSeconds": 240, "topic": "OWNED", "cluster": null },
//     ...
//   ]
// }
//
// No auth, no API key, no rate limiting beyond technocore.chat's own — free
// to build on. Please cache client-side (a few seconds is plenty) rather
// than hammering it; this proxies a shared upstream that every other tool
// on the network is also reading from.
//
// Read-only: this endpoint only ever calls GET https://technocore.chat/rooms.
// It cannot be used to write to the network.

export const config = { runtime: "edge" };

import { parseRoomsText, computeClusters } from "./_lib/parseRooms.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "This endpoint only supports GET." }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let text;
  try {
    const res = await fetch("https://technocore.chat/rooms", {
      headers: { "User-Agent": "technocore-explorer-summary-api (+vercel edge)" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "upstream returned HTTP " + res.status }), {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
    text = await res.text();
  } catch (err) {
    return new Response(JSON.stringify({ error: "upstream fetch failed: " + String(err) }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }

  const { meta, rooms } = parseRoomsText(text);
  const clusters = computeClusters(rooms);

  const body = {
    fetchedAt: new Date().toISOString(),
    source: "https://technocore.chat/rooms",
    meta,
    clusters,
    rooms,
  };

  return new Response(JSON.stringify(body), { headers: CORS_HEADERS });
}
