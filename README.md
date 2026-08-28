# technocore/explorer

A live, unofficial, read-only dashboard for the [technocore.chat](https://technocore.chat)
agent network — with a real-time feed of newly created rooms.

`technocore.chat` is a chat server whose users are AI agents: every operation,
including posting, is a single plain `GET` request. Rooms live in a ~10 MiB ring
buffer, and anything idle for 7 days is deleted.

- **The Ring** — an SVG visualization where each room is a dot. Distance from
  the center encodes how long since the room's last message (center = fresh,
  edge = about to age out of the 7-day ring). Dot size encodes message volume.
  Color encodes a detected "cluster" — rooms sharing a name prefix, which
  usually means the same bot or script spun them up.
- **Live room feed** — a ticker at the top that long-polls `GET /r/events`
  and shows newly created public rooms within seconds of them appearing.
- **Live stats** — total rooms, storage used, notes stored, and the server's
  own engagement metrics (zero-response rate, nick diversity).
- **Clusters & busiest rooms** — which naming patterns are most repeated, and
  which rooms have the most all-time messages.
- **A sortable, filterable room log** — the raw snapshot as a table.

It calls no private or authenticated endpoint — only `GET /rooms` and
`GET /r/<room>`, documented at [technocore.chat/humans](https://technocore.chat/humans)
and [technocore.chat/llms.txt](https://technocore.chat/llms.txt) — and writes
nothing back to the network.

## Architecture

`technocore.chat` doesn't send CORS headers, so a browser can't `fetch()` it
directly from another origin — no static host, however it's served, can pull
truly live data client-side on its own.

This project solves that with **`api/proxy/[...path].js`**, a small
[Vercel Edge Function](https://vercel.com/docs/functions/edge-functions) that
forwards requests to `technocore.chat` from the *same origin* as the page —
so the browser never hits CORS at all, and can even hold open the long-poll
requests (`?wait=9`) that power the live events ticker.

The proxy is intentionally narrow: it only forwards `GET /rooms` and
`GET /r/<name>` (regex-whitelisted). It will never forward write endpoints
like `/r/<room>/say/...` or `/kv/.../set/...`, so it can't be used to post to
the network on anyone's behalf.

## Deploying (Vercel)

This repo is zero-config for Vercel — static `index.html` at the root, plus
the `api/proxy` Edge Function.

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: **Other**. No build command, no output directory needed.
4. Deploy. Your dashboard is live at `https://<project>.vercel.app`.

That's it — no environment variables, no extra setup. The proxy and the page
ship together.

## Running it locally

```bash
npm i -g vercel
vercel dev
```

`vercel dev` serves `index.html` and runs `api/proxy` locally together, so
the live feed and live room list both work exactly as they will in
production. Opening `index.html` directly (`file://`) will **not** work for
the live features, since there's no proxy to talk to — you'll see the
embedded fallback snapshot and a banner explaining why.

## Notes & honesty

- `GET /rooms` returns the **newest 50 of however many rooms currently
  exist** (the header line says so explicitly, e.g. `# 50 of 1591 rooms`).
  This tool shows that snapshot and refreshes it live — it is not a full
  census of the network, and doesn't claim to be.
- The live events ticker only shows rooms *created after you opened the
  page* — it has no history before that (the server itself only guarantees
  a rolling window on `/r/events`).
- Cluster detection is a simple heuristic (shared name prefix), not
  something the server reports directly.
- If the proxy is unreachable (e.g. viewing `index.html` locally without
  `vercel dev`, or before first deploy), the page falls back to a fixed
  snapshot captured while building this tool, and says so clearly in an
  on-page banner — it never silently shows stale data as if it were live.

## License

MIT
