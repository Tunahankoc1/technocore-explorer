[README.md](https://github.com/user-attachments/files/31437348/README.md)
# technocore/explorer

A live, unofficial, read-only dashboard for the [technocore.chat](https://technocore.chat)
agent network.

`technocore.chat` is a chat server whose users are AI agents: every operation,
including posting, is a single plain `GET` request. Rooms live in a ~10 MiB ring
buffer, and anything idle for 7 days is deleted. This project fetches the
public, unauthenticated `GET /rooms` feed and turns it into:

- **The Ring** — an SVG visualization where each room is a dot. Distance from
  the center encodes how long since the room's last message (center = fresh,
  edge = about to age out of the 7-day ring). Dot size encodes message volume.
  Color encodes a detected "cluster" — rooms sharing a name prefix, which
  usually means the same bot or script spun them up.
- **Live stats** — total rooms, storage used, notes stored, and the server's
  own engagement metrics (zero-response rate, nick diversity).
- **Clusters & busiest rooms** — which naming patterns are most repeated, and
  which rooms have the most all-time messages.
- **A sortable, filterable room log** — the raw snapshot as a table.

It calls no private or authenticated endpoint. It reads exactly the same
`GET /rooms` route documented at
[technocore.chat/humans](https://technocore.chat/humans) and
[technocore.chat/llms.txt](https://technocore.chat/llms.txt), and writes
nothing back to the network.

## Running it

No build step, no dependencies. It's a single static HTML file.

```bash
# just open it
open index.html

# or serve it (recommended, avoids some browsers' file:// fetch restrictions)
npx serve .
```

## Deploying it (for a public link / contribution URL)

The simplest option is GitHub Pages:

1. Push this folder to a public GitHub repo.
2. Repo Settings → Pages → Deploy from branch → `main` / root.
3. Your live dashboard is at `https://<username>.github.io/<repo>/`.

## Why there's a GitHub Action in here

`technocore.chat` doesn't send CORS headers that allow a browser, on another
origin, to `fetch()` it directly — so a page hosted on GitHub Pages can't
reliably pull live data client-side, even over `https://`.

Instead, `.github/workflows/update-data.yml` runs server-side (no browser,
no CORS) every ~10 minutes, fetches `technocore.chat/rooms`, and commits the
result to `data/rooms.txt`. The page then fetches that file — same origin,
zero CORS issues — and only falls back to a fixed, embedded snapshot if
even that isn't available yet (e.g. right after first deploy, before the
workflow has run once).

**One-time setup required:** in your repo, go to
**Settings → Actions → General → Workflow permissions** and select
**"Read and write permissions"**, then save. Without this, the workflow can
fetch the data but can't commit it back.

You can also trigger it manually: **Actions → Update room snapshot → Run workflow**.

## Notes & honesty

- `GET /rooms` returns the **newest 50 of however many rooms currently exist**
  (the header line says so explicitly, e.g. `# 50 of 1591 rooms`). This tool
  shows that snapshot and refreshes it every 60 seconds — it is not a full
  census of the network, and doesn't claim to be.
- Cluster detection is a simple heuristic (shared name prefix, minus a
  trailing random-looking token), not something the server reports directly.
- If the live fetch is blocked by the browser (CORS) or network, the page
  falls back to a real snapshot captured while building this tool, and says
  so clearly in an on-page banner — it never silently shows stale data as if
  it were live.

## License

MIT
