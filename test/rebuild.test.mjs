import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const configurationFiles = [
  ".nvmrc", ".env.example", ".gitignore", ".dockerignore", ".gitattributes",
  "package.json", "package-lock.json", "Dockerfile", "README.md", "server.mjs",
];

test("Node pins agree across the runtime, lockfile, and Docker base", async () => {
  const version = (await read(".nvmrc")).trim();
  const manifest = JSON.parse(await read("package.json"));
  const lock = JSON.parse(await read("package-lock.json"));
  const dockerfile = await read("Dockerfile");
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.engines.node, version);
  assert.equal(lock.packages[""].engines.node, version);
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(dockerfile.split(/\r?\n/)[0], `FROM node:${version}-alpine AS base`);
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(Object.keys(lock.packages), [""]);
});

test("the clean rebuild has a canonical offline test and self-contained Docker targets", async () => {
  for (const path of configurationFiles) assert.ok((await read(path)).trim(), path);
  const manifest = JSON.parse(await read("package.json"));
  const dockerfile = await read("Dockerfile");
  assert.equal(manifest.scripts.test, "node --test test/*.test.mjs");
  assert.equal(manifest.scripts.start, "node server.mjs");
  assert.equal(Object.keys(manifest.dependencies || {}).length, 0);
  assert.equal(Object.keys(manifest.devDependencies || {}).length, 0);
  assert.match(dockerfile, /RUN npm ci --offline[^\n]*--ignore-scripts[^\n]*--no-audit/);
  assert.match(dockerfile, /FROM base AS test/);
  assert.match(dockerfile, /RUN --network=none npm test/);
  assert.match(dockerfile, /FROM base AS runtime/);
  assert.match(dockerfile, /COPY public \.\/public/);
  assert.match(await read(".gitattributes"), /^\* text=auto eol=lf$/m);
  assert.match(await read(".gitattributes"), /^\*\.woff2 binary$/m);
});

test("the environment template contains no secrets and private files stay excluded", async () => {
  const entries = (await read(".env.example"))
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("="));
  assert.deepEqual(entries, [["HOST", "0.0.0.0"], ["PORT", "3000"]]);
  for (const path of [".gitignore", ".dockerignore"]) {
    const ignore = await read(path);
    assert.match(ignore, /^\.env$/m);
    assert.match(ignore, /^\.env\.\*$/m);
    assert.match(ignore, /^!\.env\.example$/m);
    assert.match(ignore, /^\.opencode\/?$/m);
  }
});

test("the README explains the outcome, setup, agents, screenshot, and safety boundary", async () => {
  const readme = await read("README.md");
  for (const heading of [
    "Why it matters", "Screenshot", "Run it locally", "Offline tests",
    "Run with Docker", "How the three agents work", "Buildathon rebuild checklist", "Safety",
  ]) {
    assert.ok(readme.includes(`## ${heading}`), heading);
  }
  const prose = readme.replace(/\s+/g, " ");
  assert.match(prose, /Demo-only/i);
  assert.match(prose, /This demo only attacks its built-in sample app/i);
  assert.match(prose, /Only test the included weak bot/);
  assert.match(prose, /Never run attacks against live apps you don't own/);
  assert.match(prose, /Further upgrades beyond this sample are planned after the contest/i);
  assert.match(readme, /npm test/);
  assert.match(readme, /docker build -t redteam-demo \./);
});

async function textualFiles(directory) {
  const files = [];
  for (const entry of await readdir(new URL(`${directory}/`, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await textualFiles(path));
    } else if (/\.(?:mjs|js|css|html|json|md)$/.test(entry.name) || entry.name === "LICENSE") {
      files.push(path);
    }
  }
  return files;
}

test("project source, documentation, and configuration contain no machine-specific paths", async () => {
  const files = [...configurationFiles];
  for (const directory of ["public", "src", "test"]) files.push(...await textualFiles(directory));
  const machinePath = /(?:[a-z]:[\\/](?:users|documents and settings)[\\/]|\/(?:Users|home)\/[^/\s]+\/|file:\/\/\/[a-z]:)/i;
  for (const path of files) {
    assert.equal(machinePath.test(await read(path)), false, `${path} must use portable paths`);
  }
});
