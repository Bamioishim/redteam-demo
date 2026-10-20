import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("the standalone demo video has the requested 54-second 16:9 loop", async () => {
  const video = await readFile(new URL("public/demo-video.html", root), "utf8");
  const mainSite = await readFile(new URL("public/index.html", root), "utf8");

  assert.match(video, /data-loop="true"/);
  assert.match(video, /data-loop-duration="54"/);
  assert.match(video, /data-composition="1920x1080"/);
  assert.equal((video.match(/<section class="scene /g) || []).length, 6);
  assert.match(video, /AI agents that attack your build before hackers do/);
  assert.match(video, /Scan your own link/);
  assert.match(video, /Run demo scan/);
  assert.match(video, /data-status="pass"/);
  assert.match(video, /data-status="fail"/);
  assert.match(video, /id="score-value"/);
  assert.match(video, /id="grade-value"/);
  assert.match(video, /data-count-target="3"/);
  assert.match(video, /requestAnimationFrame\(render\)/);
  assert.match(video, /https:\/\/github\.com\/Bamioishim\/redteam-demo/);
  assert.match(video, /This demo attacks only its built-in sample app\./);
  assert.match(video, /Further upgrades are planned after the contest\./);
  assert.match(video, /<img src="\/logo\.jpg"/);
  assert.doesNotMatch(mainSite, /demo-video\.html/);
});
