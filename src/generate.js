import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { pathToFileURL } from "url";
import { findLongWeekends } from "./planner.js";
import { buildGroup, maxTravelHours } from "./group.js";
import { buildPrompt } from "./prompt.js";
import { askGemma } from "./gemma.js";

const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
const maxNum = (s) => Math.max(...String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g)?.map(Number) ?? [NaN]);

// Light checks: only structure must be right. Budget/travel are notes, never retries.
export function validate(out, group, win) {
  const errors = [], notes = [];
  const opts = out?.options;
  if (!Array.isArray(opts) || opts.length < 3) return { errors: ["Return 3 options in an 'options' array."], notes };

  const hours = maxTravelHours(win.days);
  opts.slice(0, 3).forEach((o, i) => {
    const tag = o.destination || `Option ${i + 1}`;
    if (!o.destination) errors.push(`Option ${i + 1}: missing destination.`);
    if (!Array.isArray(o.plan) || !o.plan.length) errors.push(`${tag}: missing day plan.`);
    if (maxNum(o.travel?.hoursOneWay) > hours + 2) notes.push(`${tag}: travel well above ${hours}h one-way`);
  });
  return { errors, notes };
}

// Code fixes small things instead of asking the model again
function normalize(out, win) {
  out.options = out.options.slice(0, 3).map((o) => {
    let plan = o.plan.slice(0, win.days);
    while (plan.length < win.days) plan.push({ day: plan.length + 1, summary: "Travel back to Delhi" });
    plan = plan.map((p, i) => ({ ...p, day: i + 1 }));
    return { ...o, plan };
  });
  return out;
}

export async function generatePlan(group, win, { retries = 2 } = {}) {
  const base = buildPrompt(group, win);
  let prompt = base;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t = Date.now();
    console.log(`  Gemma attempt ${attempt}...`);
    let out;
    try { out = await askGemma(prompt); }
    catch (e) { console.log(`  bad response: ${e.message}`); continue; }
    const { errors, notes } = validate(out, group, win);
    console.log(`  done in ${((Date.now() - t) / 1000).toFixed(0)}s, ${errors.length} issue(s), ${notes.length} note(s)`);
    notes.forEach((n) => console.log(`   (note) ${n}`));
    if (!errors.length) return { ...normalize(out, win), notes, window: win, attempts: attempt };
    errors.forEach((e) => console.log(`   - ${e}`));
    prompt = `${base}\n\nYour previous answer had these problems. Fix ALL of them:\n${errors.map((e) => "- " + e).join("\n")}`;
  }
  throw new Error("Gemma could not produce a valid plan; try again.");
}

// node src/generate.js            -> next long weekend (uses cache)
// node src/generate.js --fresh    -> ignore cache, ask Gemma again
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const group = buildGroup(readJSON("data/friends.json"));
  const [first] = findLongWeekends({ holidays: readJSON("data/holidays.json") });
  const win = first.find((o) => o.label === "bridge") || first[0];

  mkdirSync("data/plans", { recursive: true });
  const file = `data/plans/${win.from}.json`;
  if (existsSync(file) && !process.argv.includes("--fresh")) {
    console.log(`Cached plan for ${win.pretty}: ${file}`);
  } else {
    console.log(`Planning ${win.pretty} (${win.days}d, ${win.leaves} leave) for ${win.holidays.join(" + ")}`);
    const plan = await generatePlan(group, win);
    writeFileSync(file, JSON.stringify(plan, null, 2));
    console.log(`Saved ${file}`);
  }
  const plan = readJSON(file);
  for (const o of plan.options)
    console.log(`\n${o.destination}, ${o.state} | ${o.travel?.mode} ${o.travel?.hoursOneWay}h | INR ${o.budgetPerPerson}\n  ${o.whyItFits}`);
}
