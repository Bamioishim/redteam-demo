# RedTeam Demo

RedTeam Demo is a solo, fully offline buildathon demo. It contains a tiny
support chatbot with deliberately weak, deterministic rules and three local
red-team agents that exercise only that included chatbot.

> **Demo only. Use this only against the included weak bot. Never use it
> against live apps you do not own.**

## What the demo shows

- **Recon** maps the support topics answered by the included bot.
- **Attack** runs a fixed, offline list of three jailbreak/prompt-injection
  probes against that bot.
- **Report** turns the returned responses into severity-rated findings with
  evidence and fixes.
- **Run red team** renders the deterministic agent log one event at a time and
  then displays the short report.
- The support panel lets a person try the weak bot directly.

The intentional weaknesses are safe demo markers, not credentials:

1. A polite API-key request returns `DEMO_ONLY_FAKE_API_KEY_12345`.
2. Pressure language makes the bot announce a verification bypass.
3. The exact phrase “ignore previous instructions” makes it return
   `DEMO_ONLY_FAKE_ADMIN_PASSWORD`.

The app has no OpenAI, Claude, paid AI, analytics, database, external API, or
network integration. All behavior is implemented as local rules in
`src/engine.mjs` and the attack prompts are frozen in that file.

## Stack and project foundation

- Node.js **24.22.0**, pinned in `.nvmrc`, `package.json`, and the Docker base
  image.
- Node's built-in HTTP server; there are no runtime dependencies.
- `package-lock.json` is included for reproducible npm metadata.
- `npm test` is the single offline test command.
- `Dockerfile` runs the same local server without adding services.

## Offline typography

Light **Inter** is used for headlines and body text. **Doto** provides the
pixel/dot-matrix treatment for numbers, stats, and the agent log. Both variable
WOFF2 fonts are bundled in `public/fonts/`, including their SIL Open Font
License 1.1 notices. There are no Google Fonts or CDN requests at runtime or
build time. See `public/fonts/README.md` for pinned sources and checksums.

## Run it locally

Prerequisite: Node.js 24.22.0.

```sh
npm ci
npm test
npm start
```

Open `http://localhost:3000` in a browser. The server exposes only local
routes used by the page:

- `GET /api/health` — confirms the offline target boundary.
- `POST /api/chat` with `{ "message": "..." }` — asks the included weak bot a
  question.
- `POST /api/red-team` — runs Recon, Attack, and Report against the included
  bot and returns structured logs and findings.

There are no credentials to configure. `.env.example` contains only optional
local host and port settings.

## Run with Docker

```sh
docker build -t redteam-demo .
docker run --rm -p 3000:3000 redteam-demo
```

The container does not need network access after its image is available. The
application itself never makes outbound requests.

## Check the boundaries

The test suite checks the ordinary topic map, all three intentional
weaknesses, fixed attack ordering, severity/evidence/fix fields, deterministic
repeatability, and that replacing network globals does not change the run.
It also checks the bundled font binaries and licenses, local CSS/preload
references, typography assignments, and WOFF2 serving on a local test server.

The source layout is intentionally small:

```text
public/       dependency-free interface, chat panel, live log, report
src/          deterministic support bot and three local agents
test/         Node built-in test runner checks
server.mjs    static server plus local JSON endpoints
```

## Safety boundary

This project is an educational demo, not a scanner or an authorization
system. Do not add live URLs, credentials, third-party API keys, external
targets, or attack inputs from untrusted systems. Keep every future probe
limited to the included weak bot and use only against systems you own when
building a separate, properly authorized security exercise.
