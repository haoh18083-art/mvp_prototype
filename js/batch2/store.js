/* Local, fictional prototype data. No CRM connection or production writes. */
(function (SC) {
  "use strict";
  const B = (SC.B2 = {}),
    KEY = "sc-prototype-batch2-v1";
  B.key = KEY;
  B.now = () => new Date().toLocaleString("sv-SE");
  B.uid = (prefix) =>
    prefix +
    "-" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);
  const peopleSeed = JSON.parse(JSON.stringify(SC.DATA.PEOPLE));
  const stages = [
    "待触达",
    "初步接触",
    "需求探索",
    "方案推进",
    "商务推进",
    "结果确认",
    "无效客户",
  ];
  B.stages = stages;
  B.industries = [
    "教育",
    "金融（消金/网贷）",
    "保险",
    "银行",
    "本地出行快递",
    "催收",
    "网服电商",
    "医疗健康",
    "通讯",
  ];
  function seed() {
    const names = [
      "星辰科技有限公司",
      "远山物流有限公司",
      "启明教育科技有限公司",
      "云桥数字科技有限公司",
      "海川保险服务有限公司",
      "和光医疗科技有限公司",
      "百川商业银行",
      "青禾网络科技有限公司",
      "晨曦出行科技有限公司",
      "众信电子商务有限公司",
      "明远通信技术有限公司",
      "星辰科技（华东）有限公司",
    ];
    const customers = names.map((name, i) => ({
      id: "C-" + (1001 + i),
      name,
      source: [1, 3, 7, 11].includes(i) ? "本地新建" : "CRM",
      owner: ["付赞", "杨锐", "张云飞"][i % 3],
      industry: [
        "通讯",
        "本地出行快递",
        "教育",
        "网服电商",
        "保险",
        "医疗健康",
        "银行",
      ][i % 7],
      stage: stages[i % 6],
      grade: ["A", "S", "B", "C"][i % 4],
      channel: ["官网留资", "销售自拓", "线下展会"][i % 3],
      acquired: "2026-08-" + String(10 + i).padStart(2, "0"),
      creator: "陈可",
      legal: ["李明", "张文", "赵远"][i % 3],
      capital: "1,000 万元",
      address: [
        "北京市海淀区中关村东路 18 号",
        "上海市徐汇区宜山路 700 号",
        "杭州市滨江区江南大道 88 号",
      ][i % 3],
      note:
        i === 1
          ? "本地补充：关注华东区域配送通知业务。"
          : "已完成基础资料核对。",
      sea: i === 6,
      seaAt: i === 6 ? "2026-09-04 10:20" : "",
      merged: "",
      lead: "否",
      intents: ["P-101"],
      contacts:
        i === 8
          ? []
          : [
              {
                name: ["李女士", "周先生", "林女士"][i % 3],
                job: "信息技术负责人",
                phone: "138****" + (4100 + i),
                email: "contact@example.com",
                main: true,
              },
            ],
      extras: {
        "CRM 客户编号": "CRM-C-" + (1200 + i),
        来源登记时间: "2026-08-10 09:00",
        来源地区: "中国大陆",
      },
    }));
    const products = [
      [
        "P-101",
        "智能短信",
        "CRM",
        "定费",
        true,
        true,
        "CRM-P-001",
        "验证码、通知与营销短信服务。",
      ],
      [
        "P-102",
        "号码认证",
        "CRM",
        "流水型",
        true,
        true,
        "CRM-P-002",
        "移动应用号码校验及一键登录。",
      ],
      [
        "P-103",
        "企业通信线路",
        "CRM",
        "",
        false,
        false,
        "CRM-P-003",
        "企业语音线路接入与通信服务。",
      ],
      [
        "P-104",
        "智能风控",
        "本地新建",
        "定费",
        true,
        true,
        "",
        "风险识别与策略服务。",
      ],
      [
        "P-105",
        "消息触达平台",
        "本地新建",
        "定费",
        false,
        true,
        "",
        "多渠道客户消息触达。",
      ],
      ["P-106", "数据核验", "CRM", "", false, false, "CRM-P-006", ""],
      [
        "P-107",
        "客户洞察",
        "本地新建",
        "流水型",
        false,
        false,
        "",
        "客户分层与业务洞察。",
      ],
    ].map((p) => ({
      id: p[0],
      name: p[1],
      source: p[2],
      billing: p[3],
      active: p[4],
      ever: p[5],
      crm: p[6],
      desc: p[7],
      version: 0,
      created: "2026-08-18 10:00",
    }));
    const pools = [
      {
        id: "POOL-01",
        name: "通信线路池",
        created: "2026-08-12 09:20",
        by: "陈可",
      },
      {
        id: "POOL-02",
        name: "号码认证池",
        created: "2026-08-12 09:25",
        by: "陈可",
      },
      {
        id: "POOL-03",
        name: "智能风控池",
        created: "2026-08-13 14:10",
        by: "陈可",
      },
      {
        id: "POOL-04",
        name: "新业务协作池",
        created: "2026-09-02 10:30",
        by: "陈可",
      },
    ];
    const people = peopleSeed.map((p) => ({
      ...p,
      pool: p.id === "U-1010" ? "POOL-01" : p.id === "U-1011" ? "POOL-02" : "",
      tasks: p.id === "U-1010" ? 2 : 0,
    }));
    people.push({
      id: "U-1030",
      name: "许知夏",
      role: "SOL",
      status: "off",
      group: "",
      pool: "POOL-03",
      tasks: 1,
    });
    const sales = ["U-1004", "U-1005", "U-1008", "U-1006", "U-1009", "U-1013"];
    const opps = [];
    for (let i = 0; i < 24; i++) {
      const c = customers[i % 10],
        p = products[i % 7];
      opps.push({
        id: "O-" + (3001 + i),
        customer: c.id,
        product: p.id,
        name: c.name.replace("有限公司", "") + " · " + p.name,
        sales: i === 6 ? "" : i === 9 ? "" : sales[i % sales.length],
        sourceSales: i === 9 ? "顾启明" : "",
        pool: i % 4 === 3 ? "" : ["POOL-01", "POOL-02", "POOL-03"][i % 3],
        crmPool: i % 4 === 0 ? "" : ["北区业务", "认证服务", "重点客户"][i % 3],
        origin: i % 5 === 3 ? "本地" : "CRM",
        result: i % 8 === 7 ? "closed" : i % 9 === 8 ? "lost" : "active",
        pending: i === 0 ? "release" : "none",
        tasks: i % 6 === 0 ? 1 : 0,
        method: "存量批量指定",
        version: 0,
      });
    }
    opps.forEach((o) => {
      if (o.customer === "C-1007") {
        o.sales = "";
        o.sourceSales = "";
      }
    });
    opps[0].sales = "U-1004";
    opps[0].pool = "POOL-01";
    opps[10].sales = "U-1008";
    opps[10].pool = "POOL-03";
    opps[11].sales = "U-1004";
    opps[11].pool = "POOL-01";
    opps[11].product = "P-101";
    const combos = [];
    opps
      .filter((o) => o.sales)
      .forEach((o) => {
        if (
          !combos.some((c) => c.customer === o.customer && c.sales === o.sales)
        )
          combos.push({
            id: B.uid("K"),
            customer: o.customer,
            sales: o.sales,
            admit: combos.length < 14 ? "已通过" : "未提报",
          });
      });
    const spaces = [];
    opps
      .filter(
        (o) =>
          o.sales &&
          o.pool &&
          combos.find((c) => c.customer === o.customer && c.sales === o.sales)
            ?.admit === "已通过",
      )
      .forEach((o) => {
        if (
          !spaces.some(
            (w) =>
              w.customer === o.customer &&
              w.sales === o.sales &&
              w.pool === o.pool,
          )
        )
          spaces.push({
            id: "W-" + (2001 + spaces.length),
            customer: o.customer,
            sales: o.sales,
            pool: o.pool,
            status:
              spaces.length === 2 || spaces.length === 5 ? "failed" : "normal",
            why:
              spaces.length === 2
                ? "客户档案装载暂未完成"
                : spaces.length === 5
                  ? "空间创建服务暂不可用"
                  : "",
            created: "2026-09-08 09:15",
            history: 3,
            version: 0,
          });
      });
    const states = [
      "ready",
      "bindfail",
      "readfail",
      "bound",
      "reading",
      "binding",
      "pending",
    ];
    const agents = spaces
      .filter((w) => w.status === "normal")
      .map((w, i) => ({
        id: "A-" + (5001 + i),
        space: w.id,
        state: states[i % states.length],
        bound: !["bindfail", "binding", "pending"].includes(
          states[i % states.length],
        ),
        at: "2026-09-08 09:18",
        start: "2026-09-08 08:00",
        tries: 3,
        round: 1,
        version: 0,
        problem: i === 2 ? "context" : "system",
        record: i === 2 ? "R-7102" : "",
        why:
          states[i % states.length] === "bindfail"
            ? "实例绑定服务暂不可用"
            : states[i % states.length] === "readfail"
              ? "录音记录缺少发生时间"
              : "",
        current: true,
      }));
    if (agents[2]) agents[2].problem = "context";
    if (agents[4]) agents[4].state = "reading";
    if (agents[8])
      Object.assign(agents[8], {
        state: "readfail",
        bound: true,
        problem: "system",
        why: "上下文服务读取超时",
      });
    spaces.push({
      id: "W-2099",
      customer: "C-1002",
      sales: "U-1004",
      pool: "POOL-04",
      status: "archived",
      why: "局部空置手动归档",
      created: "2026-08-20 10:00",
      history: 6,
      version: 0,
    });
    agents.push({
      id: "A-5099",
      space: "W-2099",
      state: "stopped",
      bound: true,
      current: false,
      why: "空间已归档",
      at: "2026-09-07 17:20",
      tries: 0,
      round: 1,
      version: 0,
    });
    return {
      schema: 1,
      people,
      pools,
      deletedPools: [],
      customers,
      products,
      opps,
      combos,
      spaces,
      agents,
      logs: [],
      batches: [],
      productChecks: [
        {
          id: "PC-01",
          name: "智能风险控制",
          crm: "CRM-P-NEW01",
          target: "P-104",
          state: "待核对",
          reason: "",
        },
        {
          id: "PC-02",
          name: "智能短信服务",
          crm: "CRM-P-NEW02",
          target: "P-101",
          state: "待核对",
          reason: "",
        },
      ],
      issues: [
        {
          id: "EX-01",
          type: "人员对应缺失",
          customer: "C-1010",
          opp: "O-3010",
          source: "顾启明",
          why: "来源销售尚未对应本地人员",
          state: "待处理",
          at: "2026-09-08 09:20",
        },
        {
          id: "EX-02",
          type: "关联产品缺失",
          customer: "C-1004",
          source: "CRM-O-0802",
          why: "来源未返回明确产品关系",
          state: "待处理",
          at: "2026-09-08 09:15",
        },
        {
          id: "EX-03",
          type: "关联客户缺失",
          customer: "",
          source: "CRM-O-0803",
          why: "商机先于客户资料到达",
          state: "待处理",
          at: "2026-09-08 09:10",
        },
        {
          id: "EX-04",
          type: "人员对应缺失",
          customer: "C-1005",
          source: "CRM-U-102",
          why: "首次人员对应已验证",
          state: "已恢复",
          at: "2026-09-07 17:40",
        },
      ],
      diffs: [
        {
          id: "DF-01",
          customer: "C-1001",
          opp: "O-3001",
          field: "归属销售",
          before: "付赞",
          source: "杨锐",
          local: "付赞",
          state: "待处理",
          kind: "关系变更",
          why: "CRM 来源负责人变化，本地有效归属保持",
          at: "2026-09-08 09:20",
          history: [],
        },
        {
          id: "DF-02",
          customer: "C-1002",
          field: "备注",
          before: "华东配送通知",
          source: "",
          local: "本地补充：关注华东区域配送通知业务。",
          state: "待处理",
          kind: "明确清空",
          why: "本地补充信息受保护",
          at: "2026-09-08 09:15",
          history: [],
        },
        {
          id: "DF-03",
          customer: "C-1005",
          field: "来源记录",
          before: "存在",
          source: "来源确认删除",
          local: "客户及商机关系保留",
          state: "处理中",
          kind: "确认删除",
          why: "已移交客保裁决，业务结果尚未生效",
          at: "2026-09-08 09:10",
          history: [],
        },
        {
          id: "DF-04",
          customer: "C-1003",
          field: "客户地址",
          before: "旧来源地址",
          source: "已与本地一致",
          local: "已与本地一致",
          state: "差异已消失",
          kind: "普通资料",
          why: "来源自然一致，无未完成办理事项",
          at: "2026-09-07 17:15",
          history: [],
        },
      ],
      merges: [
        {
          id: "MG-01",
          customer: "C-1002",
          name: "远山物流有限公司",
          match: "精确",
          state: "待处理",
          conflict: false,
          sourceOpps: 2,
          at: "2026-09-08 09:20",
        },
        {
          id: "MG-02",
          customer: "C-1004",
          name: "云桥数字科技",
          match: "模糊",
          state: "待处理",
          conflict: true,
          sourceOpps: 1,
          at: "2026-09-08 09:15",
        },
        {
          id: "MG-03",
          customer: "C-1008",
          name: "青禾网络技术有限公司",
          match: "模糊",
          state: "待处理",
          conflict: false,
          sourceOpps: 0,
          at: "2026-09-07 16:00",
        },
      ],
      runs: [
        {
          id: "SY-0908-03",
          trigger: "周期同步",
          start: "2026-09-08 09:20:00",
          end: "2026-09-08 09:20:18",
          state: "部分成功",
          why: "联系人来源读取超时",
          newCount: 2,
          kept: 3,
        },
        {
          id: "SY-0908-02",
          trigger: "周期同步",
          start: "2026-09-08 09:15:00",
          end: "2026-09-08 09:15:12",
          state: "成功",
          why: "",
          newCount: 0,
          kept: 2,
        },
        {
          id: "SY-0908-01",
          trigger: "首次完整同步",
          start: "2026-09-08 09:00:00",
          end: "2026-09-08 09:02:15",
          state: "成功",
          why: "",
          newCount: 24,
          kept: 0,
        },
      ],
      lastSuccess: "2026-09-08 09:15:12",
      syncBusy: false,
      syncStarted: 0,
    };
  }
  let memory;
  B.load = function () {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s?.schema === 1) return (memory = s);
    } catch (e) {
      B.storageWarning = true;
    }
    return memory || (memory = seed());
  };
  B.save = function (s) {
    memory = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      B.storageWarning = true;
    }
    return s;
  };
  B.log = function (s, object, action, detail = "") {
    s.logs.unshift({
      id: B.uid("EV"),
      object,
      action,
      detail,
      at: B.now(),
      by: SC.DATA.CURRENT[B.role || "ADM"].name,
    });
  };
  B.change = function (fn) {
    const s = B.load();
    const r = fn(s);
    B.save(s);
    return r;
  };
  B.reset = () => {
    memory = seed();
    B.save(memory);
  };
  B.find = (type, id, s = B.load()) => s[type].find((x) => x.id === id);
  B.name = (type, id, s = B.load()) =>
    B.find(type, id, s)?.name ||
    (type === "pools" ? s.deletedPools.find((p) => p.id === id)?.name : "") ||
    (id ? "未对应" : "未指定");
  B.owned = (customer, s = B.load()) =>
    s.opps.filter((o) => o.customer === customer && o.sales);
  B.groups = (customer, s = B.load()) => [
    ...new Set(
      B.owned(customer, s).map((o) => {
        const g = B.find("people", o.sales, s)?.group;
        return !g || g === "—" ? "待分组" : g;
      }),
    ),
  ];
  B.poolsFor = (customer, s = B.load()) => [
    ...new Set(
      s.opps.filter((o) => o.customer === customer).map((o) => o.pool),
    ),
  ];
  B.poolOpps = (id, s = B.load()) => s.opps.filter((o) => o.pool === id);
  B.combo = (o, s = B.load()) =>
    s.combos.find((c) => c.sales === o.sales && c.customer === o.customer && !c.ended);
  B.spaceFor = (o, s = B.load()) =>
    s.spaces.find(
      (w) =>
        w.sales === o.sales &&
        w.customer === o.customer &&
        w.pool === o.pool &&
        w.status !== "frozen",
    );
  B.assignmentError = (o, s) =>
    !o
      ? "商机不存在"
      : !o.sales
        ? o.sourceSales
          ? "人员对应缺失"
          : "商机为空余，需先确定归属"
        : !B.find("people", o.sales, s)
          ? "人员对应缺失"
          : !B.find("products", o.product, s)
            ? "关联产品缺失"
            : "";
  B.assign = function (ids, target, versions) {
    return B.change((s) => {
      if (!B.find("pools", target, s))
        throw Error("目标客户池不存在，请重新选择");
      const rows = ids.map((id) => {
        const o = B.find("opps", id, s),
          err = B.assignmentError(o, s);
        if (err) return { id, status: "失败", reason: err };
        if (versions && versions[id] !== o.version)
          return {
            id,
            status: "未处理",
            reason: "商机承接关系已变化，请重新核对",
          };
        if (o.pool === target)
          return { id, status: "未变化", reason: "已在该客户池" };
        const from = o.pool;
        o.pool = target;
        o.version++;
        o.method = "事后调整";
        if (
          B.combo(o, s)?.admit === "已通过" &&
          B.find("products", o.product, s)?.active
        ) {
          let w = B.spaceFor(o, s);
          if (!w) {
            w = {
              id: B.uid("W"),
              sales: o.sales,
              customer: o.customer,
              pool: target,
              status: "creating",
              created: B.now(),
              why: "空间建立处理中",
              history: 0,
              version: 0,
            };
            s.spaces.push(w);
          } else if (w.status === "archived") {
            w.status = "creating";
            w.why = "解档处理中";
            w.version++;
          }
        }
        B.log(
          s,
          id,
          "指定客户池",
          (from ? B.name("pools", from, s) : "未指定") +
            " → " +
            B.name("pools", target, s),
        );
        return {
          id,
          status: "成功",
          reason: from ? "已转入目标池" : "已指定目标池",
        };
      });
      const batch = { id: B.uid("BATCH"), at: B.now(), target, rows };
      s.batches.unshift(batch);
      return batch;
    });
  };
  B.settleSpaces = function () {
    B.change((s) =>
      s.spaces
        .filter((w) => w.status === "creating")
        .forEach((w) => {
          const current = s.opps.some(
            (o) =>
              o.sales === w.sales &&
              o.customer === w.customer &&
              o.pool === w.pool &&
              B.find("products", o.product, s)?.active,
          );
          const c = s.combos.find(
            (c) => c.customer === w.customer && c.sales === w.sales && !c.ended,
          );
          const sales = B.find("people", w.sales, s);
          if (
            !current ||
            c?.admit !== "已通过" ||
            !B.find("pools", w.pool, s) ||
            sales?.role !== "SLS" ||
            sales.status !== "on" ||
            !sales.group ||
            sales.group === "—"
          ) {
            w.status = "failed";
            w.why = "当前装载条件不满足";
            return;
          }
          w.status = "normal";
          w.why = "";
          w.version++;
          if (!s.agents.some((a) => a.space === w.id && a.current))
            s.agents.push({
              id: B.uid("A"),
              space: w.id,
              state: "bound",
              bound: true,
              current: true,
              at: B.now(),
              start: B.now(),
              round: 1,
              tries: 0,
              version: 0,
            });
          B.log(s, w.id, "空间已可用");
        }),
    );
  };
  B.retryAgent = function (ids, kind, versions) {
    return B.change((s) =>
      ids.map((id) => {
        const a = B.find("agents", id, s),
          w = a && B.find("spaces", a.space, s);
        if (!a || !a.current || w?.status !== "normal")
          return { id, status: "未处理", reason: "实例或空间已不可恢复" };
        if (versions && versions[id] !== a.version)
          return { id, status: "未处理", reason: "实例状态已变化" };
        if (a.state !== (kind === "bind" ? "bindfail" : "readfail"))
          return { id, status: "未处理", reason: "不属于当前失败类型" };
        if (kind === "read" && !a.bound)
          return { id, status: "未处理", reason: "尚无有效绑定" };
        if (kind === "read" && a.problem === "context") {
          B.log(s, id, "读取重试失败", "问题记录尚未修正");
          return {
            id,
            status: "失败",
            reason: "问题记录尚未修正，需由有权维护者处理",
          };
        }
        a.state = kind === "bind" ? "bound" : "ready";
        a.bound = true;
        a.round += kind === "read" ? 1 : 0;
        a.at = B.now();
        a.why = "";
        a.version++;
        B.log(s, id, kind === "bind" ? "绑定重试成功" : "读取重试成功");
        return {
          id,
          status: "成功",
          reason:
            kind === "bind" ? "已绑定，首次读取待完成" : "已就绪，原绑定保留",
        };
      }),
    );
  };
  B.save(B.load());
})(window.SC);
