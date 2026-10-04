import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const RANK = ["low", "mid", "high"];

export function buildGroup(friends) {
  // Budget = lowest band in the group: a plan one friend can't afford isn't a plan
  const budget = RANK[Math.min(...friends.map((f) => RANK.indexOf(f.budget)))];

  // Interests ranked by how many friends share them
  const counts = {};
  for (const f of friends) for (const l of f.likes) counts[l] = (counts[l] || 0) + 1;
  const interests = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, n, who: friends.filter((f) => f.likes.includes(name)).map((f) => f.name) }));

  return {
    size: friends.length,
    names: friends.map((f) => f.name),
    budget,
    interests,
    veg: friends.filter((f) => f.food === "veg").length,
    drinkers: friends.filter((f) => f.drinks).length,
    leaveOk: friends.filter((f) => f.canTakeLeave).length,
  };
}

// Longer trips can go further
export const maxTravelHours = (days) => (days <= 4 ? 14 : days <= 6 ? 18 : 24);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = buildGroup(JSON.parse(readFileSync("data/friends.json", "utf8")));
  console.log(JSON.stringify(g, null, 2));
}
