const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const out = process.env.B2_QA_DIR || "/tmp/sales-batch2-qa";
const routes = [
  "pools",
  "pool-detail",
  "pool-assign",
  "products",
  "product-detail",
  "product-new",
  "product-check",
  "customers",
  "customer-detail",
  "reconcile",
  "sync-detail",
  "data-issues",
  "source-diffs",
  "customer-merge",
  "space-failures",
  "agent-status",
];
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const name of routes) {
    await page.goto(
      pathToFileURL(path.join(root, "pages", name + ".html")).href,
    );
    await page.waitForSelector(".sc-crumb__cur");
    assert.equal(await page.locator(".sc-content .sc-page-title").count(), 0);
    assert(await page.locator("#sc-page-body").innerText(), name + " blank");
    assert.equal(
      await page
        .locator("link[rel=stylesheet]")
        .evaluateAll((links) => links.filter((l) => !l.sheet).length),
      0,
      name + " stylesheet",
    );
    assert.equal(
      await page.locator(".sc-nav__item.is-active").count(),
      1,
      name + " nav",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      name + " overflow",
    );
    await page.screenshot({
      path: path.join(out, name + "-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    // Resize handlers and the navigation transition settle after the viewport command.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 2000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      name + " narrow desktop overflow",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    // Resize handlers and the navigation transition settle after the viewport command.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 2000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      name + " compact overflow",
    );
    await page.screenshot({
      path: path.join(out, name + "-compact.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Resize handlers and the navigation transition settle after the viewport command.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 2000 });
    console.log("PASS", name);
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      pages: routes.length,
      viewports: 3,
      screenshots: out,
      errors,
    }),
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
