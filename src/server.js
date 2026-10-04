import "dotenv/config";
import express from "express";
import { autoCheck } from "./auto.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const VOTES = "data/votes.json";
const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const page = (title, body) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:30px auto;padding:0 16px;color:#222">${body}</body></html>`;

function tally(trip) {
  const plan = read(`data/plans/${trip}.json`, null);
  const friends = read("data/friends.json", []);
  const votes = read(VOTES, {})[trip] || {};
  if (!plan) return null;
  const rows = plan.options.map((o, i) => {
    const who = friends.filter((f) => votes[slug(f.name)] === i + 1).map((f) => f.name);
    return { name: o.destination, who };
  });
  const waiting = friends.filter((f) => !votes[slug(f.name)]).map((f) => f.name);
  const top = Math.max(...rows.map((r) => r.who.length));
  const majority = Math.floor(friends.length / 2) + 1;
  const winner = top >= majority ? rows.find((r) => r.who.length === top) : null;
  return { plan, rows, waiting, winner, majority };
}

function tallyHtml(trip, msg = "") {
  const t = tally(trip);
  if (!t) return page("Not found", "<p>No plan found for this trip.</p>");
  const bars = t.rows.map((r) => `
    <div style="margin:14px 0">
      <div style="font-weight:bold">${esc(r.name)} <span style="color:#888;font-weight:normal">(${r.who.length})</span></div>
      <div style="background:#eee;border-radius:6px;height:12px;margin:6px 0">
        <div style="background:#2f6b2a;height:12px;border-radius:6px;width:${(r.who.length / 6) * 100}%"></div></div>
      <div style="font-size:13px;color:#555">${r.who.join(", ") || "&nbsp;"}</div>
    </div>`).join("");
  return page("Trip vote", `
    ${msg ? `<p style="background:#eef6ec;padding:12px;border-radius:8px">${msg}</p>` : ""}
    <h2 style="margin-bottom:4px">${esc(t.plan.window.holidays.join(" + "))}</h2>
    <div style="color:#666">${esc(t.plan.window.pretty)}</div>
    ${bars}
    ${t.winner ? `<p style="font-size:18px">🎉 <b>It's decided: ${esc(t.winner.name)}!</b></p>`
               : `<p style="color:#666">Needs ${t.majority} votes to decide.</p>`}
    ${t.waiting.length ? `<p style="color:#888;font-size:13px">Still waiting on: ${t.waiting.join(", ")}</p>` : ""}`);
}

app.get("/vote", (req, res) => {
  const { trip, friend, option } = req.query;
  const n = Number(option);
  const t = tally(trip);
  if (!t || !(n >= 1 && n <= t.plan.options.length)) return res.status(400).send(page("Oops", "<p>Invalid vote link.</p>"));
  const all = read(VOTES, {});
  all[trip] = { ...(all[trip] || {}), [friend]: n };          // re-voting just changes your vote
  writeFileSync(VOTES, JSON.stringify(all, null, 2));
  console.log(`vote: ${friend} -> option ${n} (${t.plan.options[n - 1].destination})`);
  res.send(tallyHtml(trip, `✅ Got it! You're in for <b>${esc(t.plan.options[n - 1].destination)}</b>. Tap another option in the email to change.`));
});

app.get("/results", (req, res) => res.send(tallyHtml(req.query.trip)));

app.get("/prefs", (req, res) =>
  res.send(page("Preferences", `<h2>Update your preferences</h2>
    <p>Just reply to the trip email with what to change (budget, what you like, veg/non-veg) and Prince will update it.</p>`)));

app.listen(PORT, () => {
  console.log(`Trip Buddy votes on http://localhost:${PORT}`);
  if (process.env.AUTO_SEND === "1") {
    console.log("[auto] on: checking now and every 6 hours");
    autoCheck();
    setInterval(autoCheck, 6 * 60 * 60 * 1000);
  } else {
    console.log("[auto] off (set AUTO_SEND=1 in .env to turn on)");
  }
});
