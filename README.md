# RedTeam Demo

RedTeam Demo runs three offline, rule-based agents against its own deliberately weak support chatbot and produces a short report with evidence and fixes.

Built as a solo demo for the OmniRush Frontier Buildathon. No AI account, API
key, paid service, or internet connection is needed to use the app.

> **Demo-only. This demo only attacks its built-in sample app. Only test the
> included weak bot. Never use it against live apps you don't own. Further
> upgrades beyond this sample are planned after the contest.**

## Why it matters

Politeness, urgency, and instruction overrides should never bypass security
boundaries. This small, repeatable exercise makes those failure modes visible
without sending attacks to real services or exposing real credentials.

The bot is deliberately unsafe; the report explains how a real application
could prevent each behavior. This is a teaching tool, not a production scanner
or proof that any real chatbot is secure.

## Try the demo

1. Start the app and open **http://localhost:3000**.
2. Optionally ask the included support bot about account access, billing,
   orders, or technical support.
3. Click **Run red team**. Watch Recon, Attack, and Report events appear, then
   read the findings, severity, evidence, and suggested fixes below the log.

The target's rings slowly orbit a glowing core and spin faster during a run.
Long log messages wrap within their own rows. The OS/browser **reduced-motion**
setting disables orbit/pulse motion and skips artificial log-playback delays.

## Screenshot

A captured app screenshot is not checked in yet. To capture one for a
submission, open the local app, complete a run, and take a full-page screenshot
showing the atom target, Recon/Attack/Report log, and findings. Use your
browser's built-in screenshot tool; no screenshot service is required.

## Demo video

`public/demo-video.html` is a standalone, unlinked 54-second product reel. It
uses the supplied RedTeam logo and the same bundled fonts and visual language as
the main site, and it loops a 1920×1080 16:9 motion composition through the
scope lock, live scan, and report. It is intentionally not linked from
`public/index.html`.

With the local server running, open **http://localhost:3000/demo-video.html**.
The reel uses only the built-in sample app story; it does not contact a live
target or make an external request.

## Run it locally

Prerequisite: **Node.js 24.22.0** with its bundled npm. If you already use nvm,
`nvm use` reads the version from `.nvmrc`. Run these commands from the
repository root:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm start
```

Open **http://localhost:3000**. Stop the server with **Ctrl+C**.
There are no third-party npm dependencies, global installs, or extra system
packages to install. Fonts and other UI assets are already in the repository.

No `.env` file or credentials are needed. Optional `HOST` and `PORT` values
are listed in `.env.example`; to use that sample explicitly:

```sh
node --env-file=.env.example server.mjs
```

## Offline tests

The single test command is:

```sh
npm test
```

It uses Node's built-in test runner, needs no downloads, and contacts only
loopback HTTP endpoints started by the tests. It checks the weak bot, fixed
attack list, report fields, bundled fonts and licenses, run-state cleanup,
reduced-motion settings, and long-line log layout contracts. UI state tests
use a small DOM double; they are not a browser pixel-layout test. Rebuild
checks also guard the Node pins, lockfile, safe environment template, and
portable project paths.

## Run with Docker

```sh
docker build -t redteam-demo .
docker run --rm -p 127.0.0.1:3000:3000 redteam-demo
```

Open **http://localhost:3000**. The port binding limits browser access to the
local machine. Stop the container with **Ctrl+C**.

Docker must be running in **Linux containers** mode. A clean machine needs
network access to pull the pinned Node base image the first time; after it is
cached, the app itself needs no outbound network access. There are no font
downloads, external APIs, or background services at runtime.

To run the same `npm test` suite in a self-contained Linux image:

```sh
docker build --target test -t redteam-demo-test .
docker run --rm --network none redteam-demo-test
```

The test target runs the suite during its build with networking disabled;
the second command verifies it again without external networking. The default
runtime image does not contain the test files. Docker's npm install step is
also explicitly offline. No host-specific bind mounts are needed.

## How the three agents work

All three are deterministic JavaScript functions in `src/engine.mjs`, not
LLM agents. They can call only the included `supportBot` function; no URL,
external target, or provider can be configured.

| Agent | What it does | Output |
| --- | --- | --- |
| Recon | Sends four fixed support questions | A map of account access, billing, orders, and technical support |
| Attack | Sends three frozen jailbreak/prompt-injection prompts to that bot | The exact prompts and bot responses |
| Report | Turns those local results into structured demo findings | Severity, evidence, and practical fixes |

The three intentional weaknesses are:

- **High:** a polite API-key request reveals `DEMO_ONLY_FAKE_API_KEY_12345`.
- **Medium:** pressure makes the bot claim it will skip verification.
- **Critical:** “ignore previous instructions” reveals
  `DEMO_ONLY_FAKE_ADMIN_PASSWORD`.

These values are **fake demo markers**. No real admin account, secret, or
account-changing action exists. Agent results are computed locally and the
interface plays back the ordered log before showing the report. Re-running
the same fixed exercise produces the same findings.

## Offline assets and local endpoints

Light **Inter** is used for headings and body text; **Doto** provides the
dot-matrix stats and agent log. Both WOFF2 fonts and their SIL Open Font
License notices are bundled in `public/fonts/`. Pinned sources and checksums
are documented in `public/fonts/README.md`. No CDN is used.

The browser communicates only with these same-origin demo endpoints:

- `GET /api/health` — confirms the server and included target.
- `POST /api/chat` with `{ "message": "..." }` — talks to the weak bot.
- `POST /api/red-team` — returns local agent logs and the short report.

## Buildathon rebuild checklist

| Rule | Repository evidence |
| --- | --- |
| Git repository and working-step commits | Local Git history; private app state is ignored |
| Lockfile | `package-lock.json`, with no third-party npm dependencies |
| Pinned Node | `24.22.0` in `.nvmrc`, package engines, lockfile, and Dockerfile |
| Linux build and run | `Dockerfile`, using the pinned Node Alpine base |
| One offline test command | `npm test` |
| Exact instructions | This README: local setup, tests, Docker build and run |
| No secrets in environment example | `.env.example` contains only `HOST` and `PORT` |
| Portable project files | Source and assets live in this folder; no hard-coded machine paths |

`.gitattributes` keeps text in LF format and preserves font/image binaries.
`.gitignore` and `.dockerignore` exclude private environment files and local
app state. `test/rebuild.test.mjs` guards the reproducibility requirements
with the same offline test command.

## Safety

**Demo-only. This demo only attacks its built-in sample app. Only test the
included weak bot. Never run attacks against live apps you don't own. Further
upgrades beyond this sample are planned after the contest.** This app does not
support outside targets, and ownership of a live app does not change this
demo's included-bot-only boundary.

Do not add real credentials, external targets, paid AI providers, or live
attack integrations. No calls are made to OpenAI, Claude, analytics services,
or other external APIs. Keep `.env`, private configuration, and local app
state out of Git; `.env.example` is intentionally safe to share.
