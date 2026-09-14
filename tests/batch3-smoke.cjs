const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  out = process.env.B3_QA_DIR || "/tmp/sales-batch3-qa";
function inventory() {
  return fs.readdirSync(path.join(root, "js/pages")).flatMap((file) => {
    const source = fs.readFileSync(path.join(root, "js/pages", file), "utf8");
    if (!source.includes("SC.B3.start")) return [];
    let meta;
    vm.runInNewContext(source, { SC: { B3: { start: (m) => (meta = m) } } });
    return [{ file: file.replace(".js", ""), ...meta }];
  });
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const routes = inventory();
  assert.equal(routes.length, 20);
  assert.equal(new Set(routes.map((r) => r.pid)).size, 20);
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) =>
    errors.push({ page: page.url(), error: e.message }),
  );
  for (const r of routes) {
    await page.goto(
      pathToFileURL(path.join(root, "pages", r.file + ".html")).href,
    );
    await page.waitForSelector(".sc-crumb__cur");
    assert.equal(await page.locator(".sc-crumb__cur").innerText(), r.title, r.file);
    assert.equal(await page.locator(".sc-content .sc-page-title").count(), 0);
    assert(
      (await page.locator("#sc-page-body").innerText()).trim().length > 10,
      r.file + " blank",
    );
    assert.equal(
      await page.locator(".sc-nav__item.is-active").count(),
      1,
      r.file + " nav",
    );
    assert.equal(
      await page
        .locator("link[rel=stylesheet]")
        .evaluateAll((links) => links.filter((l) => !l.sheet).length),
      0,
      r.file + " css",
    );
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      // Resize handlers and the navigation transition settle after the viewport command.
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 2000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        r.file + " overflow " + viewport.width,
      );
      if (viewport.width !== 1280)
        await page.screenshot({
          path: path.join(out, r.file + "-" + viewport.width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
    }
    console.log("PASS", r.pid, r.file);
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ pages: routes.length, viewports: 3, errors, out }),
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
