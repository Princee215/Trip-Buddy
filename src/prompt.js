import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import { maxTravelHours } from "./group.js";

export function buildPrompt(group, win) {
  const hours = maxTravelHours(win.days);
  const interests = group.interests
    .map((i) => `- ${i.name}: ${i.n}/${group.size} (${i.who.join(", ")})`)
    .join("\n");

  const next = new Date(new Date(win.to + "T00:00:00Z").getTime() + 86400000);
  const returnBy = next.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const month = new Date(win.from + "T00:00:00Z").toLocaleString("en-IN", { month: "long", timeZone: "UTC" });

  return `You are a trip planner for a group of ${group.size} friends: ${group.names.join(", ")}.
They all start and end in Delhi.

TRIP WINDOW: ${win.pretty} (${win.days} days, holiday: ${win.holidays.join(" + ")}). Month: ${month}.
They can leave Delhi the EVENING BEFORE day 1 (after work), so long journeys can happen overnight.
RETURN: they must reach Delhi by about 8 AM on ${returnBy} (a working day). Work backwards from the
travel time: on the last day, leave the destination early enough to make it. The last day's plan
must say roughly what time to leave.

GUIDELINES (aim for these, small deviations are okay):
- Places up to roughly ${hours} hours from Delhi are acceptable, but closer places are equally good.
- Keep the itinerary budget-friendly: hostels/homestays, local food, skip costly activities.
- Food (firm need, not a preference): ${group.veg} of ${group.size} are vegetarian, so every place must have good veg options.

GROUP INTERESTS (ranked by how many share them; these are PREFERENCES to weigh, not requirements):
${interests}

OTHER:
- Some friends drink, but this must NOT limit the choice of destination. If a place is alcohol-restricted (e.g. Rishikesh, Haridwar, Mathura, Vrindavan), just mention it in "heads_up".
- Balance the split interests in each plan, so every friend gets something they like.
- ${win.days <= 5 ? "Pick ONE main base per option (day trips from it are fine). Nearby twin towns (about 1-2 hours apart) count as one base. Do not combine far-apart cities." : "Up to two bases per option is fine for this longer trip."}
- Overnight trains or buses are fine for longer distances (they sleep through the travel).
- Consider ${month} weather: avoid places that are too hot, too cold or unsafe in that month.

VARIETY (important):
- The 3 options must feel clearly DIFFERENT in character (e.g. nature/hills, heritage/city, spiritual/food, adventure, relaxed).
- Popular interests should show up across the options, but no single interest is mandatory.

RULES FOR ACCURACY:
- Do NOT invent hotel names, train numbers, phone numbers or exact prices.
- Give the REALISTIC typical travel time from Delhi for that place. Never stretch it to match the
  guideline or to make an overnight journey fit (e.g. Rishikesh is ~5-6h, not 10h).
- Give travel time and cost as rough ranges.
- If unsure about a detail, say it generally rather than make it up.

Suggest exactly 3 DIFFERENT destinations. Respond ONLY with JSON in this shape:
{
  "options": [
    {
      "destination": "place name",
      "state": "state name",
      "travel": { "mode": "train | bus | car", "hoursOneWay": "e.g. 6-7" },
      "budgetPerPerson": "approx spend AT the destination per person (stay, food, local travel), excluding travel from Delhi, e.g. 4000-6000",
      "whyItFits": "1-2 sentences naming which friends will love what",
      "plan": [ { "day": 1, "summary": "one line" } ],
      "foodNote": "one line on veg and non-veg options",
      "heads_up": "one practical warning (weather, crowds, permits)"
    }
  ]
}
The "plan" array should have one entry per day (${win.days} days).`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildGroup } = await import("./group.js");
  const { findLongWeekends } = await import("./planner.js");
  const group = buildGroup(JSON.parse(readFileSync("data/friends.json", "utf8")));
  const holidays = JSON.parse(readFileSync("data/holidays.json", "utf8"));
  const first = findLongWeekends({ holidays, from: new Date("2026-10-03") })[0];
  const win = first.find((o) => o.label === "bridge") || first[0];
  console.log(buildPrompt(group, win));
}
