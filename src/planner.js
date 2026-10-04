import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const DAY = 86400000;
const toDate = (s) => new Date(s + "T00:00:00Z");          // UTC: no timezone bugs
const toStr = (d) => d.toISOString().slice(0, 10);
const fmt = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function findLongWeekends({ holidays, from = new Date(), days = 365, maxLeaveDays = 3 }) {
  const start = toDate(toStr(from));
  const hol = new Map(holidays.map((h) => [h.date, h]));

  // 1. Build the calendar: each day is off (weekend/holiday) or work
  const cal = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const h = hol.get(toStr(d));
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    cal.push({ d, off: weekend || !!h, holiday: h });
  }

  // 2. Group consecutive off days into runs
  const runs = [];
  for (let i = 0; i < cal.length; i++) {
    if (!cal[i].off) continue;
    if (runs.length && runs.at(-1).end === i - 1) runs.at(-1).end = i;
    else runs.push({ start: i, end: i });
  }

  // 3. Join nearby runs into windows (gaps = leave days)
  const windows = [];
  for (let a = 0; a < runs.length; a++) {
    for (let b = a; b < runs.length; b++) {
      const s = runs[a].start, e = runs[b].end;
      const span = cal.slice(s, e + 1);
      const leaves = span.filter((x) => !x.off).length;
      if (leaves > maxLeaveDays) break;
      if (span.some((x) => x.holiday?.skip)) break;           // never plan over Diwali etc.
      const hols = span.filter((x) => x.holiday).map((x) => x.holiday);
      if (!hols.length || span.length < 3) continue;           // must include a holiday, 3+ days
      windows.push({
        s, e, days: span.length, leaves, hols,
        leaveDates: span.filter((x) => !x.off).map((x) => toStr(x.d)),
      });
    }
  }

  // 4. Cluster overlapping windows, pick value + stretch per cluster
  windows.sort((x, y) => x.s - y.s);
  const clusters = [];
  for (const w of windows) {
    const c = clusters.at(-1);
    if (c && w.s <= c.maxE) { c.items.push(w); c.maxE = Math.max(c.maxE, w.e); }
    else clusters.push({ items: [w], maxE: w.e });
  }

  const shape = (w, label) => ({
    label,
    from: toStr(cal[w.s].d), to: toStr(cal[w.e].d),
    pretty: `${fmt(cal[w.s].d)} – ${fmt(cal[w.e].d)}`,
    days: w.days, leaves: w.leaves, leaveDates: w.leaveDates,
    holidays: w.hols.map((h) => h.name),
    tentative: w.hols.some((h) => h.tentative),
  });

  // easy = longest zero-leave trip; bridge = best trip with leave (each leave day must earn ~1.5 days)
  const score = (w) => w.days - 1.5 * w.leaves;
  return clusters.map(({ items }) => {
    const free = items.filter((w) => w.leaves === 0);
    const paid = items.filter((w) => w.leaves > 0);
    const easy = free.length ? free.reduce((b, w) => (w.days > b.days ? w : b)) : null;
    const bridge = paid.length
      ? paid.reduce((b, w) => (score(w) > score(b) || (score(w) === score(b) && w.leaves < b.leaves) ? w : b))
      : null;
    const opts = [];
    if (easy) opts.push(shape(easy, "easy"));
    if (bridge && (!easy || bridge.days > easy.days)) opts.push(shape(bridge, "bridge"));
    return opts;
  });
}

// quick test: node src/planner.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const holidays = JSON.parse(readFileSync("data/holidays.json", "utf8"));
  for (const opts of findLongWeekends({ holidays, from: new Date("2026-10-03") })) {
    for (const o of opts)
      console.log(`${o.label.padEnd(7)} ${o.pretty.padEnd(26)} ${o.days}d, ${o.leaves} leave  [${o.holidays.join(" + ")}]${o.tentative ? " *tentative" : ""}`);
    console.log("");
  }
}
