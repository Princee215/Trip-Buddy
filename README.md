# Trip Buddy

Every long weekend, someone in the group chat says "let's go somewhere," and nobody plans it.
Trip Buddy fixes that: it spots long weekends three weeks ahead, plans three different trips
with a local open-weight model, and emails each friend a one-tap vote. When most of the group
picks the same trip, it's decided.

Built for the [Hacktoberfest 2026 DEV Weekend Challenge: Build for a Friend](https://dev.to/).
Read the write-up: `[DEV post link]`

## How it works

**The model plans, the code enforces.** Gemma does the creative work; plain JavaScript does
everything that has a right answer.

1. **Find long weekends** (`planner.js`): marks each day as off or work, then joins nearby
   weekends and holidays when the gap fits within 3 leave days. Suggests the best "bridge" leave,
   e.g. *Dussehra 2026 is a Tuesday: take Monday off, get 4 days.*
2. **Build the group profile** (`group.js`): ranks interests by how many friends share them
   and counts vegetarians.
3. **Ask Gemma** (`prompt.js`, `gemma.js`): three trips with a different character each, a
   day-by-day plan, and a return time that gets everyone back to Delhi by 8 AM on the next
   working day.
4. **Check the answer** (`generate.js`): retries only if the structure is broken; small issues
   are fixed in code. Plans are saved, so each one is generated once.
5. **Email and vote** (`email.js`, `send.js`, `server.js`): a personal email per friend with
   vote buttons, and a live tally page.
6. **Run on its own** (`auto.js`): the server checks every 6 hours and emails the group 21 days
   before each long weekend.

Diwali is skipped on purpose: nobody leaves home for a trip over Diwali.

## Why a local open model

- **Free to run, forever.** No API bill for a tool that sends a few emails a year.
- **Private.** Friends' preferences never leave the machine.
- **Open license.** Gemma 4 is an open-weight model under Apache 2.0.
- **Swappable.** Change one environment variable to try another model.

## Setup

Requirements: Node.js 18+, [Ollama](https://ollama.com/download), and a Gmail account with
2-Step Verification on.

```bash
# 1. Model
ollama pull gemma4

# 2. Project
git clone https://github.com/YOUR_USERNAME/trip-buddy.git
cd trip-buddy
npm install

# 3. Your friends
cp data/friends.example.json data/friends.json   # Windows: copy data\friends.example.json data\friends.json
```

Edit `data/friends.json` with your group. Each friend has:

| Field | Values |
|---|---|
| `budget` | `low`, `mid`, `high` |
| `likes` | e.g. `mountains`, `trekking`, `cafes`, `heritage`, `food`, `nightlife`, `adventure` |
| `food` | `veg` or `non-veg` |
| `drinks` | `true` / `false` (a preference only, never limits destinations) |
| `canTakeLeave` | `true` / `false` |

Tip: while testing, use Gmail aliases like `you+friend1@gmail.com`. They all arrive in your inbox.

Create a `.env` file in the project root:

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=your16charapppassword
BASE_URL=http://localhost:3000
AUTO_SEND=1
LEAD_DAYS=21
# GEMMA_MODEL=gemma4
```

Get the App Password at https://myaccount.google.com/apppasswords.

## Usage

```bash
node src/planner.js            # list upcoming long weekends and bridge-leave options
node src/generate.js           # plan the next long weekend (cached after the first run)
node src/generate.js --fresh   # ask Gemma again
node src/email.js              # write HTML previews to previews/
node src/send.js Aarav         # send to one friend (testing)
node src/send.js               # send to everyone
node src/server.js             # vote server + auto mode
```

### Vote links on phones

`localhost` links only work on your own machine. To let friends vote from their phones, run a
free Cloudflare quick tunnel and put its URL in `BASE_URL`:

```bash
cloudflared tunnel --url http://localhost:3000
```

Keep the tunnel and server running until everyone has voted. A quick tunnel gets a new URL
each time it restarts.

## Project structure

```
data/
  holidays.json          central government holidays, 2026–2027
  friends.example.json   sample group (copy to friends.json)
src/
  planner.js   long weekends + bridge leave
  group.js     group profile
  prompt.js    the brief sent to Gemma
  gemma.js     Ollama client (streaming, JSON output)
  generate.js  checks, fixes and caches plans
  email.js     personal HTML email per friend
  send.js      sends via Gmail
  server.js    vote links, tally page, auto mode
  auto.js      emails each long weekend LEAD_DAYS ahead
```

## Limits

- Runs only while the machine and server are on.
- Travel times come from the model and are approximate.
- Holidays follow India's central government list; companies may differ.

## Next

- A preferences form instead of "reply to update"
- A final-plan email when a trip wins
- Per-friend travel to Delhi
- Travel times grounded with a search API
