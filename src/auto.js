import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { pathToFileURL } from "url";
import { findLongWeekends } from "./planner.js";
import { buildGroup } from "./group.js";
import { generatePlan } from "./generate.js";
import { sendPlan } from "./send.js";

const LEAD_DAYS = Number(process.env.LEAD_DAYS || 21);   // email this many days before the trip
const SENT = "data/sent.json";
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
let running = false;

export async function autoCheck(today = new Date()) {
  if (running) return;                                    // Gemma is slow; never overlap runs
  running = true;
  try {
    const friends = read("data/friends.json", []);
    const group = buildGroup(friends);
    const sent = read(SENT, {});
    const horizon = new Date(today.getTime() + LEAD_DAYS * 86400000).toISOString().slice(0, 10);

    const due = findLongWeekends({ holidays: read("data/holidays.json", []), from: today, days: LEAD_DAYS + 10 })
      .map((opts) => opts.find((o) => o.label === "bridge") || opts[0])
      .filter((w) => w.from <= horizon && !sent[w.from]);

    if (!due.length) return console.log(`[auto] ${today.toISOString().slice(0, 10)}: nothing due in the next ${LEAD_DAYS} days`);

    for (const win of due) {
      console.log(`[auto] ${win.holidays.join(" + ")} (${win.pretty}) is due`);
      mkdirSync("data/plans", { recursive: true });
      const file = `data/plans/${win.from}.json`;
      let plan = read(file, null);
      if (!plan) {
        plan = await generatePlan(group, win);
        writeFileSync(file, JSON.stringify(plan, null, 2));
      }
      await sendPlan(plan, friends);
      sent[win.from] = new Date().toISOString();
      writeFileSync(SENT, JSON.stringify(sent, null, 2));
      console.log(`[auto] emails sent for ${win.pretty}`);
    }
  } catch (e) {
    console.log(`[auto] failed, will retry next check: ${e.message}`);
  } finally {
    running = false;
  }
}

// node src/auto.js  -> run one check now
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("dotenv/config");
  await autoCheck();
}
