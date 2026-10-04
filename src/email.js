import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { pathToFileURL } from "url";

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const fmtDay = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function buildSubject(win) {
  const hol = win.holidays.join(" + ");
  if (win.leaves === 0) return `🎒 ${hol}: ${win.days} days off, no leave needed (${win.pretty})`;
  return `🏔️ ${hol}: take ${win.leaves} day${win.leaves > 1 ? "s" : ""} off, get ${win.days} days (${win.pretty})`;
}

export function renderEmail(plan, friend, baseUrl = process.env.BASE_URL || "http://localhost:3000") {
  const win = plan.window;
  const leaveLine = win.leaves
    ? `Take <b>${win.leaveDates.map(fmtDay).join(", ")}</b> off and you get <b>${win.days} days</b> in a row.`
    : `No leave needed: <b>${win.days} days</b> off in a row.`;

  const cards = plan.options.map((o, i) => {
    const forYou = (o.whyItFits || "").includes(friend.name);
    const vote = `${baseUrl}/vote?trip=${win.from}&friend=${slug(friend.name)}&option=${i + 1}`;
    const days = (o.plan || []).map((p) =>
      `<tr><td style="padding:3px 10px 3px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap">Day ${p.day}</td>
           <td style="padding:3px 0;font-size:14px;color:#333">${esc(p.summary)}</td></tr>`).join("");
    return `
    <tr><td style="padding:0 0 18px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <tr><td style="background:#f6f8f5;padding:16px 18px">
          <div style="font-size:12px;color:#5b7a52;font-weight:bold;letter-spacing:.5px">OPTION ${i + 1}${forYou ? " · 🎯 PICKED WITH YOU IN MIND" : ""}</div>
          <div style="font-size:20px;font-weight:bold;color:#1d2b1a;margin-top:4px">${esc(o.destination)}</div>
          <div style="font-size:13px;color:#666;margin-top:2px">${esc(o.state || "")}</div>
        </td></tr>
        <tr><td style="padding:14px 18px">
          <div style="font-size:14px;color:#444;margin-bottom:10px">
            🚌 ${esc(o.travel?.mode || "")} · ~${esc(o.travel?.hoursOneWay || "?")}h one-way (approx.)<br>
            💰 ~₹${esc(o.budgetPerPerson || "?")} per person at the destination (excl. travel)
          </div>
          <div style="font-size:14px;color:#333;margin-bottom:12px;font-style:italic">${esc(o.whyItFits)}</div>
          <table cellpadding="0" cellspacing="0">${days}</table>
          ${o.foodNote ? `<div style="font-size:13px;color:#555;margin-top:10px">🍽️ ${esc(o.foodNote)}</div>` : ""}
          ${o.heads_up ? `<div style="font-size:13px;color:#8a5a00;margin-top:6px">⚠️ ${esc(o.heads_up)}</div>` : ""}
          <div style="margin-top:16px">
            <a href="${vote}" style="display:inline-block;background:#2f6b2a;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:bold;font-size:14px">👍 I'm in for ${esc(o.destination.split(/[\/,(&]/)[0].trim())}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>`;
  }).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;padding:24px">
    <tr><td style="padding:0 0 18px">
      <div style="font-size:15px;color:#333">Hey ${esc(friend.name)} 👋</div>
      <div style="font-size:22px;font-weight:bold;color:#1d2b1a;margin:10px 0 6px">${esc(win.holidays.join(" + "))} is coming up: ${esc(win.pretty)}</div>
      <div style="font-size:15px;color:#444">${leaveLine} Nobody has to plan this time, here are 3 trips picked for all 6 of us. Tap the one you're in for.</div>
      ${win.tentative ? `<div style="font-size:13px;color:#8a5a00;margin-top:8px">Holiday date depends on moon sighting and may shift by a day.</div>` : ""}
    </td></tr>
    ${cards}
    <tr><td style="font-size:12px;color:#999;padding-top:6px;line-height:1.6">
      Planned by Trip Buddy, running Gemma (open-weight AI) on Prince's laptop. Your preferences never leave it.<br>
      Travel times are rough estimates; check before booking.<br>
      <a href="${baseUrl}/prefs?friend=${slug(friend.name)}" style="color:#999">Not right? Update my preferences</a>
    </td></tr>
  </table></td></tr></table></body></html>`;

  const text = [
    `Hey ${friend.name},`, "",
    `${win.holidays.join(" + ")}: ${win.pretty}. ${leaveLine.replace(/<[^>]+>/g, "")}`, "",
    ...plan.options.flatMap((o, i) => [
      `OPTION ${i + 1}: ${o.destination} (${o.state}), ~${o.travel?.hoursOneWay}h, ~INR ${o.budgetPerPerson}`,
      `  ${o.whyItFits}`,
      `  Vote: ${baseUrl}/vote?trip=${win.from}&friend=${slug(friend.name)}&option=${i + 1}`, "",
    ]),
  ].join("\n");

  return { subject: buildSubject(win), html, text };
}

// node src/email.js  -> writes previews/<friend>.html for the latest saved plan
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plans = readdirSync("data/plans").filter((f) => f.endsWith(".json")).sort();
  const plan = JSON.parse(readFileSync(`data/plans/${plans[0]}`, "utf8"));
  const friends = JSON.parse(readFileSync("data/friends.json", "utf8"));
  mkdirSync("previews", { recursive: true });
  for (const f of friends) writeFileSync(`previews/${slug(f.name)}.html`, renderEmail(plan, f).html);
  console.log("Subject:", buildSubject(plan.window));
  console.log(`Wrote ${friends.length} previews to previews/. Open previews/rahul.html in your browser.`);
}
