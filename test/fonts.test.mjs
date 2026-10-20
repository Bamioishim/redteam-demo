import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const fonts = [
  {
    family: "Inter",
    path: "fonts/inter/files/inter-latin-wght-normal.woff2",
    license: "fonts/inter/LICENSE",
    sha256: "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
  },
  {
    family: "Doto",
    path: "fonts/doto/files/doto-latin-wght-normal.woff2",
    license: "fonts/doto/LICENSE",
    sha256: "0e1a84240f323bafc2db7540d303ba17ace1daa8bde2936a76be82d24a7a271b",
  },
];

test("the supplied RedTeam logo is bundled and used by the page", async () => {
  const logo = await readFile(new URL("public/logo.jpg", root));
  const html = await readFile(new URL("public/index.html", root), "utf8");
  const css = await readFile(new URL("public/styles.css", root), "utf8");

  assert.equal(logo.subarray(0, 3).toString("hex"), "ffd8ff");
  assert.equal(createHash("sha256").update(logo).digest("hex"), "403b05f0a066fb4f67b6e2fdfe57df6c6c9e2e81f0cc60c9e0a99699ef2e13b9");
  assert.match(html, /<link rel="icon" href="\/logo\.jpg" type="image\/jpeg" \/>/);
  assert.match(html, /<span class="brand-mark" aria-hidden="true">\s*<img src="\/logo\.jpg" alt=""/);
  assert.match(css, /\.brand-mark img\s*\{/);
});

for (const font of fonts) {
  test(`${font.family} is bundled as a complete, licensed WOFF2 binary`, async () => {
    const bytes = await readFile(new URL(`public/${font.path}`, root));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2");
    assert.equal(bytes.readUInt32BE(8), bytes.length, "WOFF2 length matches its header");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);

    const license = await readFile(new URL(`public/${font.license}`, root), "utf8");
    assert.match(license, /Copyright/);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  });
}

test("font faces and preloads use only the bundled, same-origin files", async () => {
  const css = await readFile(new URL("public/styles.css", root), "utf8");
  const html = await readFile(new URL("public/index.html", root), "utf8");
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1]);
  const preloads = (html.match(/<link\b[^>]*>/g) || [])
    .filter((link) => link.includes('as="font"'));
  assert.equal(faces.length, fonts.length);
  assert.equal(preloads.length, fonts.length);

  for (const font of fonts) {
    const face = faces.find((rule) => rule.includes(`font-family: "${font.family}"`));
    assert.ok(face, `${font.family} has a font face`);
    assert.ok(face.includes(`url("/${font.path}")`));
    assert.match(face, /font-weight:\s*100 900/);
    assert.match(face, /font-display:\s*swap/);
    assert.doesNotMatch(face, /https?:|local\(/);
    const preload = preloads.find((link) => link.includes(`href="/${font.path}"`));
    assert.ok(preload, `${font.family} has a same-origin preload`);
    assert.ok(preload.includes('type="font/woff2"'));
    assert.ok(preload.includes('crossorigin="anonymous"'));
  }

  assert.doesNotMatch(css, /@import|https?:\/\/|url\(\s*["']?\/\//);
});

test("headlines and body are light sans-serif; stats and logs use the dot font", async () => {
  const css = await readFile(new URL("public/styles.css", root), "utf8");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const declarations = (selector) => rules
    .filter(([, selectors]) => selectors.split(",").some((value) => value.trim() === selector))
    .map(([, , body]) => body)
    .join("\n");

  assert.match(declarations("body"), /font-family:\s*var\(--sans\)/);
  for (const selector of [".hero h1", ".section-heading h2"]) {
    assert.match(declarations(selector), /font-family:\s*var\(--sans\)/);
    assert.match(declarations(selector), /font-weight:\s*300/);
    assert.doesNotMatch(declarations(selector), /text-transform:\s*uppercase/);
  }
  for (const selector of [
    ".eyebrow span", ".visual-readout strong", ".stage-marker",
    ".finding-number", ".finding-count", ".summary-text", ".log-row",
  ]) {
    assert.match(declarations(selector), /font-family:\s*var\(--dot\)/, selector);
  }
});

test("the local app serves both fonts with the correct MIME type and CSP", { timeout: 15_000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: fileURLToPath(root),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore",
  });
  let launchError;
  server.on("error", (error) => { launchError = error; });
  const stopped = new Promise((resolve) => server.once("close", resolve));
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await stopped;
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError;
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(250) });
      const health = await response.json();
      if (response.ok && health.target === "supportBot") {
        ready = true;
        break;
      }
    } catch {
      // The child may still be starting; only loopback requests are made.
    }
    await wait(50);
  }
  assert.ok(ready, "the isolated local test server started");

  for (const font of fonts) {
    const response = await fetch(`${base}/${font.path}`, { signal: AbortSignal.timeout(2_000) });
    assert.equal(response.status, 200, `${font.family} is served`);
    assert.equal(response.headers.get("content-type"), "font/woff2");
    assert.match(response.headers.get("content-security-policy"), /font-src 'self'/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
    const head = await fetch(`${base}/${font.path}`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-type"), "font/woff2");
  }

  const logoResponse = await fetch(`${base}/logo.jpg`, { signal: AbortSignal.timeout(2_000) });
  assert.equal(logoResponse.status, 200, "the supplied logo is served");
  assert.equal(logoResponse.headers.get("content-type"), "image/jpeg");
  assert.match(logoResponse.headers.get("content-security-policy"), /img-src 'self'/);
  const logoBytes = Buffer.from(await logoResponse.arrayBuffer());
  assert.equal(createHash("sha256").update(logoBytes).digest("hex"), "403b05f0a066fb4f67b6e2fdfe57df6c6c9e2e81f0cc60c9e0a99699ef2e13b9");
});
