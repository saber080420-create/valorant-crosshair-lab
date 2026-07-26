import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Crosshair Lab 2.0", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>准星实验室 2\.0/);
  assert.match(html, /每一像素/);
  assert.match(html, /神经反应/);
  assert.match(html, /目标获取/);
  assert.match(html, /微操控制/);
  assert.match(html, /战场辨识/);
  assert.match(html, /动态追踪/);
  assert.match(html, /LOCAL SECURE/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("contains scoring, recommendation, and local-history logic", async () => {
  const [page, layout, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type Scores/);
  assert.match(page, /crosshair-lab-history/);
  assert.match(page, /CONFIDENCE/);
  assert.match(page, /竞技极简/);
  assert.match(page, /高辨识度/);
  assert.match(page, /PIGGY_PROFILE_CODE/);
  assert.match(page, /都说了你只适合/);
  assert.match(page, /得了，你这水平只适合用这个/);
  assert.match(page, /SCORE_LABELS/);
  assert.match(page, /scoreDelta <= 8/);
  assert.match(page, /previousShape === plans\[0\]\.shape/);
  assert.match(page, /localStorage\.removeItem\("crosshair-lab-history"\)/);
  assert.match(page, /清除测试记录/);
  assert.match(page, /WEAPON_TUNING/);
  assert.match(page, /主武器 \$\{weapon\}/);
  assert.match(page, /defaultValue=\{value\}/);
  assert.match(page, /input\.value\.trim\(\) === ""/);
  assert.match(page, /overallScore < 65/);
  assert.match(page, /crosshair-pointer/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(layout, /五项瞄准检测建立六维能力画像/);
  assert.match(styles, /@media \(max-width: 650px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /slapSwing/);
  assert.match(styles, /\.radar-label/);
});
