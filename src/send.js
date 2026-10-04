import "dotenv/config";
import nodemailer from "nodemailer";
import { readFileSync, readdirSync } from "fs";
import { pathToFileURL } from "url";
import { renderEmail } from "./email.js";

const transport = () => process.env.DRY_RUN
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

export async function sendPlan(plan, friends) {
  const t = transport();
  for (const f of friends) {
    const { subject, html, text } = renderEmail(plan, f);
    await t.sendMail({ from: `"Trip Buddy" <${process.env.GMAIL_USER}>`, to: f.email, subject, html, text });
    console.log(`  sent to ${f.name} <${f.email}>`);
  }
}

// Manual mode:
// node src/send.js                    -> latest plan, everyone
// node src/send.js Prince             -> latest plan, only Prince
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const only = process.argv[2]?.toLowerCase();
  const plans = readdirSync("data/plans").filter((f) => f.endsWith(".json")).sort();
  const today = new Date().toISOString().slice(0, 10);
  const file = plans.find((f) => f.slice(0, 10) >= today) || plans.at(-1);   // next upcoming plan
  const plan = JSON.parse(readFileSync(`data/plans/${file}`, "utf8"));
  const friends = JSON.parse(readFileSync("data/friends.json", "utf8")).filter((f) => !only || f.name.toLowerCase() === only);
  await sendPlan(plan, friends);
  console.log(`\nTally: ${process.env.BASE_URL || "http://localhost:3000"}/results?trip=${plan.window.from}`);
}
