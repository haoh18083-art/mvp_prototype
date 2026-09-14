const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const out = process.env.B2_QA_DIR || "/tmp/sales-batch2-qa";
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => errors.push(e.message));
  const go = async (name, params = {}) => {
    await page.goto(
      pathToFileURL(path.join(root, "pages", name + ".html")).href +
        (Object.keys(params).length ? "?" + new URLSearchParams(params) : ""),
    );
    await page.waitForSelector(".sc-crumb__cur");
  };
  const fresh = async (name, params = {}) => {
    await go(name, params);
    await page.evaluate(() => {
      SC.B2.reset();
      sessionStorage.clear();
    });
    await page.reload();
  };
  const state = () => page.evaluate(() => SC.B2.load());
  const click = (action) =>
    page.locator(`[data-action="${action}"]`).first().click();
  const confirm = (label) =>
    page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: label, exact: true })
      .click();
  const close = () =>
    page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "取消", exact: true })
      .click();
  let flowCount = 0;
  const done = (label) => {
    flowCount++;
    console.log("PASS", label);
  };

  await fresh("pools");
  await click("create");
  await page.getByLabel("客户池名称", { exact: true }).fill("验证客户池");
  await confirm("保存");
  await page.waitForFunction(() =>
    SC.B2.load().pools.some((p) => p.name === "验证客户池"),
  );
  await click("create");
  await page.getByLabel("客户池名称", { exact: true }).fill("验证客户池");
  await confirm("保存");
  assert.match(await page.getByRole("dialog").innerText(), /客户池名称已存在/);
  await close();
  const pool = (await state()).pools.find((p) => p.name === "验证客户池");
  await page.locator(`[data-action=delete][data-id="${pool.id}"]`).click();
  await close();
  assert((await state()).pools.some((p) => p.id === pool.id));
  await page.locator(`[data-action=delete][data-id="${pool.id}"]`).click();
  await confirm("确认删除");
  assert(!(await state()).pools.some((p) => p.id === pool.id));
  done("pool create, duplicate, cancel and delete");

  await fresh("pool-assign");
  const before = await state();
  await click("select-matches");
  await click("batch");
  await page.getByLabel("目标本地客户池").selectOption("POOL-04");
  await page.screenshot({
    path: path.join(out, "assignment-confirm.png"),
    fullPage: true,
    animations: "disabled",
  });
  await confirm("确认指定");
  await page.getByRole("dialog").last().waitFor();
  assert.match(
    await page.getByRole("dialog").last().innerText(),
    /人员对应缺失/,
  );
  const batch = (await state()).batches[0];
  assert(batch.rows.some((r) => r.status === "成功"));
  assert(batch.rows.some((r) => r.status === "失败"));
  assert.deepEqual(
    (await state()).opps.map((o) => o.sales),
    before.opps.map((o) => o.sales),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出明细", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "处理结果.csv");
  await close();
  await go("pool-detail", { id: "POOL-04" });
  assert.match(await page.locator("#sc-page-body").innerText(), /商机/);
  done("batch assignment, partial failure, export, cross-page state");

  await fresh("pool-detail", { id: "POOL-02", view: "people" });
  await click("people");
  await page.locator('[data-row="U-1010"]').check();
  await page.locator('[data-row="U-1030"]').check();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /当前属于 通信线路池/,
  );
  await confirm("确认分配");
  assert.equal(
    (await state()).people.find((p) => p.id === "U-1010").pool,
    "POOL-02",
  );
  assert.equal(
    (await state()).people.find((p) => p.id === "U-1030").status,
    "off",
  );
  await close();
  done("people transfer and disabled-account assignment");

  await fresh("product-detail", { id: "P-103" });
  await page.getByLabel("计费类型", { exact: true }).selectOption("定费");
  await page.getByLabel("产品说明").fill("测试产品说明");
  await click("save");
  assert.equal(
    (await state()).products.find((p) => p.id === "P-103").active,
    false,
  );
  await click("activate");
  await confirm("确认激活");
  assert.equal(
    (await state()).products.find((p) => p.id === "P-103").active,
    true,
  );
  await click("deactivate");
  await page.getByText("查看关联明细", { exact: true }).click();
  await close();
  assert.equal(
    (await state()).products.find((p) => p.id === "P-103").active,
    true,
  );
  const relations = (await state()).opps;
  await click("deactivate");
  await confirm("确认取消激活");
  assert.equal(
    (await state()).products.find((p) => p.id === "P-103").active,
    false,
  );
  assert.deepEqual((await state()).opps, relations);
  assert(await page.getByLabel("计费类型", { exact: true }).isDisabled());
  done("save vs activation, cancellation, relations retained");

  await fresh("product-new");
  await page.getByLabel("产品名称", { exact: true }).fill("独立测试产品");
  await click("save");
  await page.waitForURL(/products\.html.*product=/);
  let product = (await state()).products.find((p) => p.name === "独立测试产品");
  assert(product && !product.active && !product.billing);
  assert.equal((await state()).opps.length, 24);
  await go("product-new");
  await page.getByLabel("产品名称", { exact: true }).fill("智能短信企业版");
  await click("save");
  await page.waitForURL(/products\.html.*check=/);
  await page.getByLabel("身份判断").selectOption("same");
  await page.getByLabel("判断说明").fill("确认为现有产品");
  await click("confirm");
  await page.waitForURL(/products\.html.*product=P-101/);
  assert.equal((await state()).products.length, 8);
  done("new product and duplicate-identity resolution");

  await fresh("product-check", { id: "PC-02" });
  await page.getByLabel("身份判断").selectOption("same");
  await page.getByLabel("判断说明").fill("核对来源");
  await click("confirm");
  assert.match(await page.locator(".b2-error").innerText(), /不支持多来源归并/);
  await go("product-check", { id: "PC-01" });
  await page.getByLabel("身份判断").selectOption("same");
  await page.getByLabel("判断说明").fill("确认为同一业务产品");
  await click("confirm");
  product = (await state()).products.find((p) => p.id === "P-104");
  assert(product.active && product.crm === "CRM-P-NEW01");
  done("one-to-one identity, reject multiple CRM sources");

  await fresh("customer-detail", { id: "C-1001" });
  assert.equal(await page.locator("[data-customer-groups]").count(), 1);
  assert.match(
    await page.locator("[data-customer-groups]").innerText(),
    /华北一组/,
  );
  assert.equal(await page.locator("[data-action=edit]").count(), 0);
  await go("customer-detail", { id: "C-1001", role: "SLS" });
  assert.equal(await page.locator("[data-customer-groups]").count(), 0);
  await go("customer-detail", { id: "C-1001", role: "SOL" });
  assert.equal(await page.locator("[data-customer-groups]").count(), 0);
  assert(!(await page.locator("#sc-page-body").innerText()).includes("华东组"));
  await go("customer-detail", { id: "C-1001", role: "MGR" });
  assert.equal(await page.locator("[data-customer-groups]").count(), 0);
  await go("customer-detail", { id: "C-1002" });
  await click("edit");
  await page.getByLabel("客户全称", { exact: true }).fill("星辰科技有限公司");
  await click("save");
  assert.match(await page.locator(".b2-error").innerText(), /客户全称已存在/);
  await page.getByLabel("客户全称", { exact: true }).fill("远山物流有限公司");
  await page.getByLabel("备注", { exact: true }).fill("更新本地备注");
  await click("save");
  assert.equal(
    (await state()).customers.find((c) => c.id === "C-1002").note,
    "更新本地备注",
  );
  done("customer source/role visibility, admin-only groups, editing");

  await fresh("customers");
  assert.equal(await page.locator("#customers-table tbody>tr").count(), 8);
  await page.locator("[data-next]").click();
  assert.equal(await page.locator("#customers-table tbody>tr").count(), 4);
  await page.locator("[data-search]").fill("星辰科技");
  assert.equal(await page.locator("#customers-table tbody>tr").count(), 2);
  await page.locator("[data-search]").fill("不存在的客户");
  assert.match(await page.locator(".b2-table-empty").innerText(), /无符合条件/);
  done("working pagination and search");

  await fresh("reconcile");
  const initialOpps = (await state()).opps.length;
  await click("sync");
  assert(await page.locator("[data-action=sync]").isDisabled());
  await page.waitForFunction(() => !SC.B2.load().syncBusy);
  assert.equal((await state()).runs[0].state, "成功");
  assert.equal((await state()).opps.length, initialOpps);
  assert.equal((await state()).diffs[0].local, "付赞");
  done("manual sync, no duplicate objects or local overwrite");

  await fresh("data-issues", { id: "EX-01" });
  await page.getByLabel("对应本地销售").selectOption("U-1007");
  await click("map");
  assert.equal((await state()).issues[0].state, "已恢复");
  assert.equal(
    (await state()).people.find((p) => p.id === "U-1007").status,
    "off",
  );
  assert.equal(
    (await state()).opps.find((o) => o.id === "O-3010").sales,
    "U-1007",
  );
  done("first mapping repair preserves account state");

  await fresh("source-diffs", { id: "DF-01" });
  await page.getByLabel("处理说明").fill("本地审批结果仍有效");
  await click("keep");
  await confirm("保持本地并结案");
  assert.equal((await state()).diffs[0].state, "已处理");
  await click("recheck");
  assert.equal((await state()).diffs.length, 4);
  assert.equal((await state()).opps[0].sales, "U-1004");
  done("keep local and recheck without duplicate tasks");

  await fresh("customer-merge", { id: "MG-02" });
  assert(await page.locator("[data-action=same]").isDisabled());
  await go("customer-merge", { id: "MG-01" });
  await click("different");
  await confirm("确认不同");
  assert.match(await page.getByRole("dialog").innerText(), /客户全称完全相同/);
  await close();
  await click("same");
  await close();
  assert.equal((await state()).customers.filter((c) => !c.merged).length, 12);
  await click("same");
  await confirm("确认合并");
  const merged = (await state()).merges[0];
  assert.equal(merged.state, "已合并");
  assert.equal((await state()).customers.filter((c) => !c.merged).length, 12);
  assert.equal((await state()).opps.length, 24);
  assert((await state()).customers.find((c) => c.id === "C-1002").merged);
  assert.match(merged.outcome, /仍待审批/);
  done(
    "merge conflict, exact-name guard, confirmation and candidate isolation",
  );

  await fresh("agent-status", { view: "bind" });
  const bind = (await state()).agents.find((a) => a.state === "bindfail"),
    agentCount = (await state()).agents.length;
  await page.locator(`[data-row="${bind.id}"]`).check();
  await click("batch");
  await confirm("确认重试");
  assert.equal(
    (await state()).agents.find((a) => a.id === bind.id).state,
    "bound",
  );
  assert.equal((await state()).agents.length, agentCount);
  await close();
  await go("agent-status", { view: "read" });
  await click("select-matches");
  await click("batch");
  await confirm("确认重试");
  assert.match(
    await page.getByRole("dialog").last().innerText(),
    /问题记录尚未修正/,
  );
  let agents = (await state()).agents;
  assert(agents.some((a) => a.state === "ready" && a.problem === "system"));
  assert(agents.some((a) => a.state === "readfail" && a.bound));
  assert.equal(agents.length, agentCount);
  await close();
  done(
    "independent bind/read retries with partial results and stable identity",
  );

  const running = agents.find((a) => a.state === "reading");
  await go("agent-status", { id: running.id });
  await click("long");
  await confirm("结束旧轮次并重试");
  const retried = (await state()).agents.find((a) => a.id === running.id);
  assert(retried.bound && retried.round === running.round + 1);
  assert.equal((await state()).agents.length, agentCount);
  done("long-read recovery retains binding and advances round");

  await fresh("product-detail", { id: "P-103" });
  await page.getByLabel("计费类型", { exact: true }).selectOption("定费");
  await click("activate");
  await confirm("确认激活");
  const failed = (await state()).spaces.find((w) => w.status === "failed");
  await go("space-failures", { id: failed.id });
  await click("retry");
  await confirm("确认重试");
  await page.waitForFunction(
    (id) => SC.B2.find("spaces", id).status === "normal",
    failed.id,
  );
  assert.equal(
    (await state()).combos.find(
      (c) => c.sales === failed.sales && c.customer === failed.customer,
    ).admit,
    "已通过",
  );
  done("space retry after product conditions recover");

  await go("pools", { role: "SOL" });
  assert.match(await page.locator("#sc-page-body").innerText(), /无权访问/);
  assert.equal(await page.locator("[data-action=create]").count(), 0);
  done("admin-page role guard");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ flows: flowCount, errors, artifacts: out }));
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
