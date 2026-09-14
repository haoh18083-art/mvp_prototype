const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  out = process.env.B3_QA_DIR || "/tmp/sales-batch3-qa";
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) =>
    errors.push({ page: page.url(), message: e.message }),
  );
  let count = 0;
  const go = async (file, params = {}) => {
    if (file === "verdict" && params.id) {
      const { id, ...rest } = params;
      params = { ...rest, request: id };
    }
    await page.goto(
      pathToFileURL(path.join(root, "pages", file + ".html")).href +
        (Object.keys(params).length ? "?" + new URLSearchParams(params) : ""),
    );
    await page.waitForSelector(".sc-crumb__cur");
  };
  const fresh = async (file, params = {}) => {
    await go("verdict");
    await page.evaluate(() => {
      SC.B2.reset();
      sessionStorage.clear();
      SC.B3.ensure();
    });
    await go(file, params);
  };
  const state = () => page.evaluate(() => SC.B2.load());
  const act = (a) => page.locator(`[data-action="${a}"]`).first().click();
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
  const select = async (name, value) => {
    const boxes = page.locator(`.sls-form-drawer input[type="checkbox"][name="${name}"]`);
    if (await boxes.count()) {
      const values = Array.isArray(value) ? value : [value];
      for (const box of await boxes.all())
        if (await box.isEnabled()) await box.setChecked(values.includes(await box.getAttribute("value")));
    } else await page.locator(`[name="${name}"]`).selectOption(value);
  };
  const pass = (label) => {
    count++;
    console.log("PASS", label);
  };
  async function decideItem(file, id, opp, pool, decision = "approve") {
    await go(file, { id });
    await select(opp + "-decision", decision);
    if (pool) await select(opp + "-pool", pool);
    if (decision === "reject") await select(opp + "-reason", "申请资格不足");
    await act("process");
    await confirm("确认提交");
    await close();
  }

  await fresh("verdict", { id: "REQ-3901" });
  const before = await state();
  await act("first-approve");
  await close();
  assert.equal((await state()).opps.length, before.opps.length);
  await act("first-approve");
  await confirm("确认提交");
  await close();
  let s = await state(),
    r = s.b3.requests.find((r) => r.id === "REQ-3901");
  assert.equal(r.status, "approved");
  assert.equal(r.generated.length, 2);
  assert.equal(s.opps.length, before.opps.length + 2);
  assert.equal(s.customers.length, before.customers.length + 1);
  assert.equal(
    s.combos.find(
      (c) => !c.ended && c.customer === r.customer && c.sales === r.beneficiary,
    ).admit,
    "未提报",
  );
  assert(!s.spaces.some((w) => w.customer === r.customer));
  const again = await page.evaluate(() => {
    try {
      SC.B3.decideRequest(
        "REQ-3901",
        [{ decision: "approve", pool: "POOL-01" }],
        0,
      );
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(again, /变化|处理/);
  pass("首批整单、取消不生效、准入独立、重复审批拒绝");

  await fresh("verdict", { id: "REQ-3908" });
  const n = (await state()).opps.length;
  await act("first-approve");
  await confirm("确认提交");
  assert.match(await page.getByRole("dialog").innerText(), /未激活/);
  assert.equal((await state()).opps.length, n);
  assert.equal(
    (await state()).b3.requests.find((r) => r.id === "REQ-3908").status,
    "pending",
  );
  await close();
  pass("首批产品失效不部分创建");

  await fresh("manager-approval", { id: "REQ-3904" });
  await select("O-3903-decision", "approve");
  await act("process");
  assert.equal(await page.locator('.mask').count(), 0);
  assert.equal(await page.locator('[name="O-3903-pool"]').evaluate(el => el.validity.valueMissing), true);
  await decideItem("manager-approval", "REQ-3904", "O-3903", "POOL-03");
  s = await state();
  assert.equal(s.opps.find((o) => o.id === "O-3903").sales, "U-1004");
  assert.equal(s.opps.find((o) => o.id === "O-3903").pool, "POOL-03");
  pass("本组逐条审批和必要选池");

  await fresh("verdict", { id: "REQ-3906" });
  await decideItem("verdict", "REQ-3906", "O-3901", "POOL-01");
  s = await state();
  const converted = s.b3.requests.find((r) => r.id === "REQ-3907");
  assert.equal(converted.type, "join");
  assert.equal(converted.originalType, "sea");
  assert.equal(s.customers.find((c) => c.id === "C-1007").sea, false);
  assert.equal(s.opps.find((o) => o.id === "O-3901").result, "closed");
  await go("manager-approvals", { as: "U-1003" });
  assert.equal(await page.locator('a[href*="REQ-3907"]').count(), 0);
  await decideItem("verdict", "REQ-3907", "O-3902", "POOL-02");
  assert.equal(
    (await state()).opps.find((o) => o.id === "O-3902").sales,
    "U-1008",
  );
  pass("公海退出、剩余转类型、跨组重判、结束结果保留");

  await fresh("manager-approval", { id: "REQ-3903" });
  const original = (await state()).opps.find((o) => o.id === "O-3904"),
    records = (await state()).b3.records.length;
  assert.equal(await page.locator('[name="O-3904-pool"]').count(), 0);
  await decideItem("manager-approval", "REQ-3903", "O-3904", null);
  s = await state();
  const restored = s.opps.find((o) => o.id === original.id);
  assert.equal(restored.result, "active");
  assert.equal(restored.sales, original.sales);
  assert.equal(restored.pool, original.pool);
  assert.equal(restored.created, original.created);
  assert.equal(restored.endHistory.at(-1).result, original.result);
  assert.equal(restored.endHistory.at(-1).by, "U-1002");
  assert.equal(s.b3.records.length, records);
  assert(
    !s.spaces.some(
      (w) => w.customer === original.customer && w.sales === original.sales,
    ),
  );
  pass("恢复原商机，不改归属、不制造跟进或空间");

  await fresh("request-form", { type: "first_new" });
  await page.locator(".sls-form-drawer").getByLabel("客户全称", { exact: true }).fill("验收新客户有限公司");
  await select("channel", "销售自拓");
  await select("pool", "POOL-01");
  await select("products", ["P-101", "P-102"]);
  await act("submit");
  await confirm("提交申请");
  await page.waitForURL(/[?&]request=/);
  s = await state();
  r = s.b3.requests.find((r) => r.name === "验收新客户有限公司");
  assert(r && r.status === "pending");
  assert(!s.customers.some((c) => c.name === r.name));
  pass("销售首批表单实际提交，未审批不建客户");

  await fresh("customer-search", { name: "星辰科技有限公司" });
  assert.equal(await page.locator("[data-action=new]").count(), 0);
  await go("customer-search", { name: "星辰科技" });
  await act("new");
  assert.equal(await page.locator(".mask").count(), 0);
  await page.locator("[name=distinct]").check();
  await page.getByLabel("非同一主体说明").fill("名称相似，但属于不同业务主体");
  await act("new");
  await page.locator(".sls-form-drawer").waitFor({ state: "visible" });
  pass("精确查重与模糊声明分流");

  await fresh("combo-detail");
  let combo = (await state()).combos.find(
    (c) => c.customer === "C-3903" && c.sales === "U-1004" && !c.ended,
  );
  await go("combo-detail", { id: combo.id, role: "SLS" });
  await act("submit");
  await confirm("提交提报");
  await close();
  s = await state();
  let a = s.b3.admissions.find(
    (a) => a.combo === combo.id && a.status === "pending",
  );
  assert(a);
  await go("solution-submit");
  const duplicates = await page.evaluate(
    (id) => SC.B3.submitAdmissions([id]),
    combo.id,
  );
  assert.equal(duplicates[0].status, "未处理");
  assert.equal(
    (await state()).b3.admissions.filter(
      (x) => x.combo === combo.id && x.status === "pending",
    ).length,
    1,
  );
  await go("manager-admission", { id: a.id });
  await act("approve");
  await confirm("确认提交");
  assert.equal(
    (await state()).combos.find((c) => c.id === combo.id).admit,
    "已通过",
  );
  assert(
    (await state()).spaces.some(
      (w) =>
        w.customer === combo.customer &&
        w.sales === combo.sales &&
        w.pool === "POOL-01",
    ),
  );
  pass("销售/方案提报去重，主管终审与空间联动");

  await fresh("solution-submit");
  combo = (await state()).combos.find(
    (c) => c.customer === "C-3903" && c.sales === "U-1004" && !c.ended,
  );
  await page.evaluate((id) => SC.B3.submitAdmissions([id]), combo.id);
  s = await state();
  a = s.b3.admissions.find((a) => a.combo === combo.id);
  await page.evaluate(() =>
    SC.B2.change(
      (s) => (s.people.find((p) => p.id === "U-1010").pool = "POOL-04"),
    ),
  );
  await go("solution-submit", { view: "mine" });
  const lostText = await page.locator("#sc-page-body").innerText();
  assert.match(lostText, /本人历史提报/);
  assert(!lostText.includes("北辰数智"));
  assert.equal(
    (await state()).b3.admissions.find((x) => x.id === a.id).status,
    "pending",
  );
  pass("方案失权后只保留本人最小提报结果");

  await fresh("combo-detail");
  combo = (await state()).combos.find(
    (c) => c.customer === "C-3903" && c.sales === "U-1004" && !c.ended,
  );
  await page.evaluate((id) => SC.B3.submitAdmissions([id]), combo.id);
  a = (await state()).b3.admissions.find((a) => a.combo === combo.id);
  await page.evaluate(() =>
    SC.B2.change(
      (s) => (s.products.find((p) => p.id === "P-101").active = false),
    ),
  );
  await go("manager-admission", { id: a.id });
  await select("reason", "其他");
  await act("reject");
  await confirm("确认提交");
  assert.match(await page.getByRole("dialog").innerText(), /补充说明/);
  await close();
  await page.getByLabel("终审意见").fill("产品当前不可用，暂不安排跟进");
  await act("reject");
  await confirm("确认提交");
  assert.equal(
    (await state()).b3.admissions.find((x) => x.id === a.id).status,
    "rejected",
  );
  pass("通过条件不足仍可人工驳回，其他原因必填说明");

  await fresh("handover", { sales: "U-1007", customer: "C-3901" });
  const qBefore = (await state()).b3.admissions.find((a) => a.id === "AD-3901"),
    account = (await state()).people.find((p) => p.id === "U-1007").status;
  await select("O-3910-sales", "U-1004");
  await select("O-3911-sales", "U-1004");
  assert.equal(await page.locator('[name="U-1004-admit"]').count(), 0);
  assert.match(await page.locator("#handover-admit").innerText(), /继续原待办/);
  await page.screenshot({
    path: path.join(out, "handover-existing-admission.png"),
    fullPage: true,
    animations: "disabled",
  });
  await act("confirm-transfer");
  await close();
  assert.equal(
    (await state()).opps.find((o) => o.id === "O-3910").sales,
    "U-1007",
  );
  await act("confirm-transfer");
  await confirm("确认整组生效");
  await page.waitForURL(/result=/);
  s = await state();
  assert.equal(s.people.find((p) => p.id === "U-1007").status, account);
  assert.equal(
    s.b3.admissions.find((a) => a.id === "AD-3901").status,
    "pending",
  );
  assert.equal(
    s.b3.admissions.find((a) => a.id === "AD-3901").submitted,
    qBefore.submitted,
  );
  assert(
    !s.b3.admissions.some(
      (a) =>
        a.source === "交接承接确认" &&
        a.sales === "U-1004" &&
        a.customer === "C-3901",
    ),
  );
  assert.equal(s.spaces.find((w) => w.id === "W-3910").status, "frozen");
  assert.equal(s.spaces.find((w) => w.id === "W-3911").status, "frozen");
  assert(
    s.b3.grants.some((g) => g.person === "U-1004" && g.space === "W-3910"),
  );
  pass("A 规则：原普通待办继续，交接不另批，不自动停用");

  await go("admissions", { admission: "AD-3901" });
  await act("approve");
  await confirm("确认提交");
  s = await state();
  assert.equal(s.spaces.find((w) => w.id === "W-3910").status, "frozen");
  assert(
    s.spaces.some(
      (w) =>
        w.customer === "C-3901" &&
        w.sales === "U-1004" &&
        w.pool === "POOL-01" &&
        w.id !== "W-3910" &&
        w.status === "normal",
    ),
  );
  await go("space-history", { id: "W-3910", role: "SLS", as: "U-1004" });
  assert.match(await page.locator("#sc-page-body").innerText(), /客户级审批/);
  pass("原空间只读后准入再通过，不倒推迁移，历史授权可查");

  await fresh("handover", { sales: "U-1005", customer: "C-3902" });
  const oldAgent = (await state()).agents.find(
    (a) => a.space === "W-3920" && a.current,
  ).id;
  await select("O-3920-sales", "U-1008");
  await select("O-3921-sales", "U-1008");
  await select("U-1008-admit", "approve");
  await act("confirm-transfer");
  await confirm("确认整组生效");
  await page.waitForURL(/result=/);
  s = await state();
  assert.equal(s.spaces.find((w) => w.id === "W-3920").sales, "U-1008");
  assert(s.agents.some((a) => a.id === oldAgent && a.current));
  assert.equal(s.people.find((p) => p.id === "U-1005").status, "on");
  await go("workspace", { id: "W-3920", role: "SLS", as: "U-1005" });
  assert.match(await page.locator("#sc-page-body").innerText(), /无权访问/);
  await go("workspace", { id: "W-3920", role: "SLS", as: "U-1008" });
  assert.match(await page.locator("#sc-page-body").innerText(), /需求沟通记录/);
  pass("完整交接迁移保持空间和实例，原销售启用也失权");

  await fresh("handover", { sales: "U-1005", customer: "C-3902" });
  await select("O-3920-sales", "U-1004");
  await act("confirm-transfer");
  assert.match(await page.locator("p.b2-error").last().innerText(), /每条商机/);
  assert.equal(
    (await state()).opps.find((o) => o.id === "O-3920").sales,
    "U-1005",
  );
  await select("O-3921-sales", "U-1008");
  await act("confirm-transfer");
  await confirm("确认整组生效");
  await page.waitForURL(/result=/);
  s = await state();
  assert.equal(s.spaces.find((w) => w.id === "W-3920").status, "frozen");
  assert.deepEqual(
    s.b3.grants
      .filter((g) => g.space === "W-3920")
      .map((g) => g.person)
      .sort(),
    ["U-1004", "U-1008"],
  );
  await go("space-history", { id: "W-3920", role: "SLS", as: "U-1008" });
  assert.match(await page.locator("#sc-page-body").innerText(), /需求沟通记录/);
  pass("交接不部分生效，拆分承接者可读原空间全部历史");

  await fresh("handover", { sales: "U-1005", customer: "C-3902" });
  await page.evaluate(() =>
    SC.B2.change(
      (s) => (s.spaces.find((w) => w.id === "W-3920").status = "failed"),
    ),
  );
  await page.reload();
  await select("O-3920-sales", "U-1008");
  await select("O-3921-sales", "U-1008");
  await act("confirm-transfer");
  await confirm("确认整组生效");
  await page.waitForURL(/result=/);
  s = await state();
  assert.equal(s.opps.find((o) => o.id === "O-3920").sales, "U-1008");
  assert(!s.b3.grants.some((g) => g.space === "W-3920"));
  assert.equal(s.spaces.find((w) => w.id === "W-3920").sales, "U-1005");
  pass("非正常原空间不迁移不授新历史权，但归属可生效");

  await fresh("combo-detail", { role: "ADM" });
  let originalSpace = (await state()).spaces.find((w) => w.id === "W-2001"),
    priorAgent = (await state()).agents.find(
      (a) => a.space === originalSpace.id && a.current,
    ).id;
  await page.evaluate(() =>
    SC.B3.poolMove([{ id: "O-3001", pool: "POOL-04" }]),
  );
  await page.evaluate((id) => {
    const w = SC.B2.find("spaces", id);
    SC.B3.archive(id, w.version);
  }, originalSpace.id);
  assert.equal(
    (await state()).spaces.find((w) => w.id === originalSpace.id).status,
    "archived",
  );
  await page.evaluate(() =>
    SC.B3.poolMove([{ id: "O-3001", pool: "POOL-01" }]),
  );
  s = await state();
  assert.equal(
    s.spaces.find((w) => w.id === originalSpace.id).status,
    "normal",
  );
  assert.notEqual(
    s.agents.find((a) => a.space === originalSpace.id && a.current).id,
    priorAgent,
  );
  assert(s.agents.some((a) => a.id === priorAgent && a.state === "stopped"));
  pass("空置手动归档与回池解档，旧实例保留、新实例新建");

  await fresh("workspace", { id: "W-2001", role: "SOL" });
  assert(
    !(await page.locator("#sc-page-body").innerText()).includes("联合沟通纪要"),
  );
  assert.equal(await page.locator(".b3-state-columns").count(), 0);
  await go("workspace", { id: "W-2001", role: "SLS" });
  assert.match(await page.locator("#sc-page-body").innerText(), /联合沟通纪要/);
  await page.locator("#workspace-opps [data-search]").fill("不存在");
  assert.match(
    await page.locator("#workspace-opps .b2-table-empty").innerText(),
    /无符合条件/,
  );
  pass("方案正文/实例隔离，空间表格筛选不丢事件绑定");

  await fresh("manager-home");
  const guard = await page.evaluate(() => {
    try {
      SC.B3.decideRequest(
        "REQ-3901",
        [{ decision: "approve", pool: "POOL-01" }],
        0,
      );
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(guard, /审批权/);
  await go("handover", { role: "SLS" });
  assert.match(await page.locator("#sc-page-body").innerText(), /无权访问/);
  pass("管理权限在动作和深链接处共同校验");

  await fresh("verdict");
  const owners = (await state()).opps.map((o) => o.sales);
  await go("people-list");
  await page.locator('[data-toggle="U-1004"]').click();
  await page.getByRole("button", { name: "确认停用", exact: true }).click();
  s = await state();
  assert.equal(s.people.find((p) => p.id === "U-1004").status, "off");
  assert.deepEqual(
    s.opps.map((o) => o.sales),
    owners,
  );
  await page.getByRole("button", { name: "前往交接", exact: true }).click();
  await page.waitForURL(/handover/);
  assert.match(await page.locator("#sc-page-body").innerText(), /停用/);
  pass("批 1 停用可独立生效，归属不变并进入真实交接页");

  await fresh("manager-assign");
  await page.locator('[data-row="O-3007"]').check();
  await act("batch");
  await select("O-3007-sales", "U-1005");
  await select("O-3007-pool", "POOL-01");
  await confirm("确认分配");
  await close();
  assert.equal(
    (await state()).opps.find((o) => o.id === "O-3007").sales,
    "U-1005",
  );
  await go("approval-records");
  assert.match(await page.locator("#sc-page-body").innerText(), /管理处置/);
  assert.match(await page.locator("#sc-page-body").innerText(), /直接分配商机/);
  pass("管理直接分配与审批记录查询联动");

  await fresh("verdict", { id: "REQ-3899" });
  await decideItem("verdict", "REQ-3899", "O-3001", null);
  await go("source-review", { id: "DF-01" });
  await select("sales", "U-1008");
  await select("pool", "POOL-02");
  await page
    .getByLabel("确认原因", { exact: true })
    .fill("已核对来源归属，使用当前明确关系");
  await act("approve-source");
  await confirm("确认提交");
  s = await state();
  assert.equal(s.opps.find((o) => o.id === "O-3001").sales, "U-1008");
  assert.equal(s.diffs.find((d) => d.id === "DF-01").state, "已处理");
  await go("source-diffs", { id: "DF-01" });
  assert.match(
    await page.locator("#sc-page-body").innerText(),
    /来源冲突确认生效/,
  );
  pass("来源正式确认返回批 2 的真实处理结果与记录");

  await fresh("high-seas", { view: "candidates" });
  await page
    .locator('[data-action="release-customer"][data-id="C-1012"]')
    .click();
  await page
    .getByLabel("释放原因", { exact: true })
    .fill("当前无真实商机与销售归属，按客户释放至公海");
  await confirm("确认释放");
  assert.equal(
    (await state()).customers.find((c) => c.id === "C-1012").sea,
    true,
  );
  await go("approval-records");
  assert.match(
    await page.locator("#sc-page-body").innerText(),
    /客户释放至公海/,
  );
  pass("公海候选由人工确认，记录不伪装为销售申请");

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ flowGroups: count, errors, out }));
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
