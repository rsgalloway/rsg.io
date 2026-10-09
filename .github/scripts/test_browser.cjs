/* Optional browser checks. Requires Playwright; no JavaScript runtime is needed by the site build. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const base = process.env.CASTLE_PREVIEW_URL || "http://127.0.0.1:4000";
const output = process.env.CASTLE_SCREENSHOT_DIR;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CASTLE_BROWSER || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    if (output) await mkdir(output, { recursive: true });
    const screenshot = async (target, name) => {
      if (output)
        await target.screenshot({
          path: `${output}/${name}.png`,
          fullPage: true,
        });
    };
    await page.goto(base + "/");
    await page.evaluate(() => document.fonts.ready);
    await screenshot(page, "exterior");
    await page.locator(".enter-prompt").click();
    await page.waitForURL("**/castle/hall/");
    await screenshot(page, "hall");
    await page.locator('[data-hotspot="journal"]').click();
    await page.waitForURL("**/captainslog/");
    assert.equal(await page.locator("h3").count(), 5);
    await screenshot(page, "log");
    await page.getByRole("link", { name: "Older entries →" }).click();
    await page.waitForURL("**/page/2/");
    assert.equal(await page.locator("h3").count(), 5);
    await page.getByRole("link", { name: "Older entries →" }).click();
    await page.waitForURL("**/page/3/");
    assert.equal(await page.locator("h3").count(), 1);
    await page.goBack();
    await page.reload();
    assert.equal(await page.locator("h3").count(), 5);
    await page.goto(base + "/castle/hall/");
    await page.locator('[data-hotspot="library"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/blog/");
    await page.goBack();
    assert.equal(await page.locator(".travel-status").isVisible(), false);
    await page.locator('[data-hotspot="journal"]').click();
    await page.keyboard.press("Escape");
    await page.waitForURL("**/captainslog/");
    await page.locator(".castle-map summary").click();
    await page
      .getByRole("navigation", { name: "Castle map" })
      .getByRole("link", { name: "Workshop Projects" })
      .click();
    await page.waitForURL("**/projects/");

    const reduced = await browser.newPage({ reducedMotion: "reduce" });
    await reduced.goto(base + "/");
    await reduced.locator(".enter-prompt").click();
    await reduced.waitForURL("**/castle/hall/");
    assert.equal(await reduced.locator(".travel-status").isVisible(), false);

    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base + "/");
    await nojs.locator(".enter-prompt").click();
    await nojs.waitForURL("**/castle/hall/");
    await nojs.locator('[data-hotspot="journal"]').click();
    await nojs.waitForURL("**/captainslog/");
    await nojs.getByRole("link", { name: "Older entries →" }).click();
    await nojs.waitForURL("**/page/2/");

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    for (const [route, name] of [
      ["/", "mobile"],
      ["/castle/hall/", "mobile-hall"],
      ["/captainslog/", "mobile-log"],
      ["/castle/directory/", "mobile-directory"],
    ]) {
      await mobile.goto(base + route);
      await screenshot(mobile, name);
      assert.equal(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Horizontal overflow on " + route,
      );
    }
    await mobile.getByRole("link", { name: "← Great Hall" }).tap();
    await mobile.waitForURL("**/castle/hall/");
    await mobile.locator('[data-hotspot="journal"]').tap();
    await mobile.waitForURL("**/captainslog/");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: navigation, pagination, keyboard, skip, map, back/reload, reduced motion, no-JS, mobile and touch.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
