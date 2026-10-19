import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { runRedTeam } from "../src/engine.mjs";

const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

// A minimal DOM double exercises the actual UI script without a browser or
// extra dependencies. CSS contracts below protect layout rules, not pixels.
class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.parentNode = null;
    this.classList = {
      add: (name) => { this.className = `${this.className} ${name}`.trim(); },
    };
  }

  appendChild(child) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const siblings = this.parentNode.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentNode = null;
    }
  }

  replaceChildren(...children) {
    for (const child of [...this.children]) child.remove();
    for (const child of children) this.appendChild(child);
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  querySelectorAll(selector) {
    return this.children.filter((child) => child.className.split(" ").includes(selector.slice(1)));
  }
  focus() {}
  get scrollHeight() { return this.children.length; }
}

function createUi(fetch, reducedMotion = false) {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const stages = ["recon", "attack", "report"].map((stage) => {
    const node = new Element();
    node.dataset.stage = stage;
    return node;
  });
  const delays = [];
  get("hero-visual").dataset.runState = "idle";
  get("log-list").appendChild(get("log-placeholder"));

  runInNewContext(script, {
    document: {
      getElementById: get,
      querySelector: () => get("report-card"),
      querySelectorAll: () => stages,
      createElement: () => new Element(),
    },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      setTimeout: (callback, milliseconds) => {
        delays.push(milliseconds);
        queueMicrotask(callback);
      },
      requestAnimationFrame: (callback) => callback(),
    },
    fetch,
  });

  return { get, delays, clickRun: () => get("run-button").listeners.click() };
}

function declarations(selector, source = css) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((value) => value.trim() === selector))
    .map(([, , body]) => body)
    .join("\n");
}

test("the atom is active for a run, prevents duplicate runs, and returns to idle", async () => {
  let finishRequest;
  let requestCount = 0;
  const pendingResponse = new Promise((resolve) => { finishRequest = resolve; });
  const ui = createUi((endpoint) => {
    assert.equal(endpoint, "/api/red-team");
    requestCount++;
    return pendingResponse;
  });
  const result = ui.clickRun();
  assert.equal(ui.get("hero-visual").dataset.runState, "active");
  assert.equal(ui.get("run-button").disabled, true);
  await ui.clickRun();
  assert.equal(requestCount, 1);

  finishRequest({ ok: true, json: async () => runRedTeam() });
  await result;
  assert.equal(ui.get("hero-visual").dataset.runState, "idle");
  assert.equal(ui.get("run-button").disabled, false);
  assert.equal(ui.get("run-status").textContent, "COMPLETE");
  assert.equal(ui.get("findings-list").children.length, 3);
});

for (const [name, fetch] of [
  ["request failure", async () => { throw new Error("The local run failed."); }],
  ["invalid JSON", async () => ({ ok: true, json: async () => { throw new Error("Invalid JSON"); } })],
  ["HTTP error", async () => ({ ok: false, status: 500, json: async () => ({ error: "Local error" }) })],
]) {
  test(`the atom returns to idle after ${name} and allows retry`, async () => {
    const ui = createUi(fetch);
    await ui.clickRun();
    assert.equal(ui.get("hero-visual").dataset.runState, "idle");
    assert.equal(ui.get("run-button").disabled, false);
    assert.equal(ui.get("run-status").textContent, "ERROR");
    assert.equal(ui.get("report-error").hidden, false);
    await ui.clickRun();
    assert.equal(ui.get("hero-visual").dataset.runState, "idle");
    assert.equal(ui.get("run-button-label").textContent, "Run red team");
  });
}

test("reduced motion skips log playback delays and still completes the run", async () => {
  const ui = createUi(async () => ({ ok: true, json: async () => runRedTeam() }), true);
  await ui.clickRun();
  assert.ok(ui.delays.length > 0);
  assert.ok(ui.delays.every((milliseconds) => milliseconds === 0));
  assert.equal(ui.get("hero-visual").dataset.runState, "idle");
  assert.equal(ui.get("run-status").textContent, "COMPLETE");
});

test("long and multiline log text is retained in a separate message cell", async () => {
  const message = `Long local evidence: ${"unbroken-demo-token".repeat(60)}\nSecond line of evidence.`;
  const run = runRedTeam();
  run.logs = [{ phase: "attack", message }];
  const ui = createUi(async () => ({ ok: true, json: async () => run }));
  await ui.clickRun();
  const [row] = ui.get("log-list").children;
  assert.equal(row.children.length, 3);
  assert.equal(row.children[0].textContent, "01");
  assert.equal(row.children[1].textContent, "ATTACK");
  assert.equal(row.children[2].textContent, message);
  assert.equal(row.children[2].className, "log-message");
});

test("CSS provides slow idle orbits, faster active orbits, and a subtle glow pulse", () => {
  assert.match(html, /id="hero-visual"[^>]*data-run-state="idle"/);
  const idle = declarations(".hero-visual");
  const active = declarations('.hero-visual[data-run-state="active"]');
  for (const variable of ["orbit-duration", "orbit-slow-duration", "core-ring-duration"]) {
    const duration = new RegExp(`--${variable}:\\s*([\\d.]+)s`);
    const idleSeconds = Number(idle.match(duration)?.[1]);
    const activeSeconds = Number(active.match(duration)?.[1]);
    assert.ok(idleSeconds >= 20, `${variable} is slow when idle`);
    assert.ok(activeSeconds > 0 && activeSeconds < idleSeconds, `${variable} is faster during a run`);
  }
  assert.match(declarations(".visual-orbit"), /animation:\s*target-orbit-spin/);
  assert.match(declarations(".core-ring"), /animation:\s*target-core-spin/);
  assert.match(declarations(".visual-core::before"), /animation:\s*target-core-pulse/);
  assert.match(css, /@keyframes target-core-pulse[\s\S]*?opacity:\s*0\.38[\s\S]*?opacity:\s*0\.56/);
});

test("reduced-motion CSS completely disables orbit and pulse animations", () => {
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.ok(reduced.startsWith("@media (prefers-reduced-motion: reduce)"));
  for (const selector of [
    ".hero-visual .visual-orbit",
    ".hero-visual .core-ring",
    ".hero-visual .visual-core::before",
  ]) {
    assert.match(declarations(selector, reduced), /animation:\s*none\s*!important/);
  }
});

test("log CSS preserves natural row height and wraps text within its own cells", () => {
  assert.match(declarations(".log-list"), /display:\s*flex/);
  assert.match(declarations(".log-list"), /flex-direction:\s*column/);
  assert.match(declarations(".log-list"), /overflow-y:\s*auto/);
  assert.match(declarations(".log-row"), /flex:\s*0 0 auto/);
  assert.match(declarations(".log-row"), /align-items:\s*start/);
  assert.match(declarations(".log-row"), /minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(declarations(".log-row"), /(?:^|;)\s*height\s*:/);
  for (const selector of [".log-index", ".log-stage", ".log-message"]) {
    assert.match(declarations(selector), /min-width:\s*0/);
    assert.match(declarations(selector), /overflow-wrap:\s*anywhere/);
    assert.match(declarations(selector), /white-space:\s*pre-wrap/);
  }
  assert.match(declarations(".log-message"), /grid-column:\s*2/);
  assert.match(declarations(".log-message"), /grid-row:\s*2/);
});
