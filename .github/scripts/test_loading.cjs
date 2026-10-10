/* Optional Playwright checks for cold loads and decoded scene navigation. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.CASTLE_PREVIEW_URL || "http://127.0.0.1:4000";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CASTLE_BROWSER,
    args: ["--no-sandbox"],
  });
  const ready = (page) =>
    page.waitForFunction(
      () => !document.documentElement.hasAttribute("data-art-loading"),
    );
  try {
    const cold = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const requested = [];
    cold.on("request", (r) => {
      if (r.resourceType() === "image") requested.push(r.url());
    });
    let release;
    await cold.route(
      "**/scenes/library.png",
      (route) =>
        new Promise((resolve) => {
          release = () => route.continue().then(resolve);
        }),
    );
    await cold.goto(base + "/blog/", { waitUntil: "domcontentloaded" });
    assert.equal(
      await cold
        .locator("body")
        .evaluate((el) => getComputedStyle(el).visibility),
      "hidden",
    );
    const bounds = () =>
      cold.locator(".finder-window").evaluate((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      });
    const before = await bounds();
    assert.equal(
      requested.some((url) => /hall\.png|workshop\.png/.test(url)),
      false,
      "Other scenes wait for current artwork",
    );
    assert.equal(
      await cold
        .locator('link[rel="preload"][as="image"]')
        .getAttribute("href"),
      "/assets/darkcastle/scenes/library.png",
    );
    await release();
    await ready(cold);
    assert.equal(
      await cold
        .locator("body")
        .evaluate((el) => getComputedStyle(el).visibility),
      "visible",
    );
    assert.deepEqual(
      await bounds(),
      before,
      "No geometry changes when artwork decodes",
    );
    await cold.waitForRequest("**/scenes/workshop.png");
    assert.equal(
      requested.some((url) => /exterior-v|clouds-hatched/.test(url)),
      false,
      "Unused historical assets are not warmed",
    );
    await cold.close();

    const navigation = await browser.newPage();
    let releaseTarget;
    let targetReleased = false;
    await navigation.route("**/scenes/library.png", (route) => {
      if (targetReleased) return route.continue();
      return new Promise((resolve) => {
        releaseTarget = () => {
          targetReleased = true;
          return route.continue().then(resolve);
        };
      });
    });
    await navigation.goto(base + "/castle/hall/", {
      waitUntil: "domcontentloaded",
    });
    await ready(navigation);
    await navigation.locator('[data-hotspot="library"]').click();
    assert.ok(
      navigation.url().endsWith("/castle/hall/"),
      "Keep current room visible while destination decodes",
    );
    assert.equal(
      await navigation
        .locator('[data-hotspot="library"]')
        .getAttribute("aria-busy"),
      "true",
    );
    await releaseTarget();
    await navigation.waitForURL("**/blog/");
    await ready(navigation);
    await navigation.goBack();
    await ready(navigation);
    assert.equal(await navigation.locator('[aria-busy="true"]').count(), 0);
    await navigation.close();

    const broken = await browser.newPage();
    await broken.route("**/scenes/library.png", (route) => route.abort());
    await broken.goto(base + "/blog/", { waitUntil: "domcontentloaded" });
    await ready(broken);
    assert.equal(
      await broken.locator(".finder-window").isVisible(),
      true,
      "Failed artwork does not hide content",
    );
    await broken.close();

    const missingScript = await browser.newPage();
    await missingScript.route("**/scripts/assets.js", (route) => route.abort());
    await missingScript.goto(base + "/blog/", {
      waitUntil: "domcontentloaded",
    });
    await ready(missingScript);
    assert.equal(
      await missingScript.locator(".finder-window").isVisible(),
      true,
      "Head watchdog reveals content when controller fails",
    );
    await missingScript.close();
    console.log(
      "PASS: cold image decoding, stable geometry, background warming, held navigation, history, failed artwork and script fallback.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
