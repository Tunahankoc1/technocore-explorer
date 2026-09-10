// api/_lib/parseRooms.js
//
// Parses technocore.chat's plain-text GET /rooms response into structured
// data. Shared by api/summary.js. Kept dependency-free so it works directly
// in the Edge runtime with no build step.

export function parseSize(str) {
  const m = /^([\d.]+)\s*([KMGB]?)$/i.exec(String(str).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "B").toUpperCase();
  const mult = { B: 1, K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 }[unit] || 1;
  return Math.round(n * mult);
}

export function parseIdle(str) {
  const m = /^([\d.]+)([smhd])$/.exec(String(str).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
  return Math.round(n * mult);
}

// Groups by the first name segment — bots/scripts that spin up many rooms
// tend to share a leading word (zhijiu-*, floppy-*, vortex-outpost-*…) even
// when everything after it is a unique random token.
export function clusterOf(name) {
  const idx = name.indexOf("-");
  if (idx === -1) return null;
  return name.slice(0, idx);
}

export function parseRoomsText(text) {
  const meta = {
    shown: 0,
    totalRooms: null,
    cap: null,
    storedBytes: null,
    storedCapBytes: null,
    notesUsed: null,
    notesCap: null,
    notesTotalBytes: null,
    msgsScanned: null,
    zeroResponsePercent: null,
    nickDiversity: null,
  };
  const rooms = [];

  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line[0] === "#") {
      let m;
      m = /^#\s*(\d+)\s+of\s+(\d+)\s+rooms\s+\(cap\s+(\d+),\s+([\d.]+[KMGB]?)\s+of\s+([\d.]+[KMGB]?)\s+stored\)/.exec(line);
      if (m) {
        meta.shown = +m[1];
        meta.totalRooms = +m[2];
        meta.cap = +m[3];
        meta.storedBytes = parseSize(m[4]);
        meta.storedCapBytes = parseSize(m[5]);
      }
      m = /^#\s*notes\s+(\d+)\s+of\s+(\d+)\s+\(([\d.]+[KMGB]?)\s+total/.exec(line);
      if (m) {
        meta.notesUsed = +m[1];
        meta.notesCap = +m[2];
        meta.notesTotalBytes = parseSize(m[3]);
      }
      m = /^#\s*engagement over (\d+) msgs scanned:\s*zero-response\s+(\d+)%,\s*nick diversity\s+([\d.]+)/.exec(line);
      if (m) {
        meta.msgsScanned = +m[1];
        meta.zeroResponsePercent = +m[2];
        meta.nickDiversity = +m[3];
      }
      continue;
    }

    const m = /^\/r\/(\S+)\s+seq\s+(\d+)\s+([\d.]+[KMGB]?)\s+([\d.]+[smhd])\s+ago(?:\s*·\s*(.*))?$/.exec(line);
    if (m) {
      const name = m[1];
      rooms.push({
        name,
        seq: +m[2],
        sizeBytes: parseSize(m[3]),
        idleSeconds: parseIdle(m[4]),
        topic: (m[5] || "").trim() || null,
        cluster: clusterOf(name),
      });
    }
  }

  return { meta, rooms };
}

// Rooms sharing a name-prefix cluster, sorted by size descending. Only
// clusters with 2+ members are included — a singleton isn't a pattern.
export function computeClusters(rooms) {
  const counts = {};
  for (const r of rooms) {
    if (!r.cluster) continue;
    counts[r.cluster] = (counts[r.cluster] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
