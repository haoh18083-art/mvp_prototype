(function () {
  const pages = [
    {
      file: "verdict",
      pid: "P-ADM-14",
      title: "客保裁决台",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "direct-assign",
      pid: "P-ADM-16",
      title: "空余商机分配",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "high-seas",
      pid: "P-ADM-17",
      title: "公海客户管理",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "source-review",
      pid: "P-ADM-18",
      title: "来源冲突确认",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "approval-records",
      pid: "P-ADM-19",
      title: "客保审批记录",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "admissions",
      pid: "P-ADM-20",
      title: "跟进准入终审",
      role: "ADM",
      group: "超级管理员",
    },
    {
      file: "manager-home",
      pid: "P-MGR-01",
      title: "工作台",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-approvals",
      pid: "P-MGR-02",
      title: "客保审批",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-sales",
      pid: "P-MGR-05",
      title: "本组销售",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-customers",
      pid: "P-MGR-06",
      title: "本组客户",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-admissions",
      pid: "P-MGR-07",
      title: "跟进准入终审",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-opportunities",
      pid: "P-MGR-10",
      title: "商机管理",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "manager-exceptions",
      pid: "P-MGR-11",
      title: "异常处理",
      role: "MGR",
      group: "销售主管",
    },
    {
      file: "sales-home",
      pid: "P-SLS-01",
      title: "工作台",
      role: "SLS",
      group: "销售",
    },
    {
      file: "my-customers",
      pid: "P-SLS-02",
      title: "我的客户",
      role: "SLS",
      group: "销售",
    },
    {
      file: "market",
      pid: "P-SLS-03",
      title: "商机市场",
      role: "SLS",
      group: "销售",
    },
    {
      file: "my-requests",
      pid: "P-SLS-07",
      title: "我的申请",
      role: "SLS",
      group: "销售",
    },
    {
      file: "solution-pool",
      pid: "P-SOL-01",
      title: "我的客户池",
      role: "SOL",
      group: "解决方案人员",
    },
    {
      file: "solution-submit",
      pid: "P-SOL-02",
      title: "客户提报",
      role: "SOL",
      group: "解决方案人员",
    },
    {
      file: "opportunity",
      pid: "P-CMN-04",
      title: "商机详情",
      role: "SLS",
      group: "共享业务页",
    },
    {
      file: "combo-detail",
      pid: "P-CMN-05",
      title: "经营组合详情",
      role: "SLS",
      group: "共享业务页",
    },
    {
      file: "workspace",
      pid: "P-CMN-06",
      title: "客户工作空间",
      role: "SLS",
      group: "共享业务页",
    },
    {
      file: "space-history",
      pid: "P-CMN-07",
      title: "空间历史",
      role: "SLS",
      group: "共享业务页",
    },
    {
      file: "handover",
      pid: "P-CMN-08",
      title: "离职交接",
      role: "ADM",
      group: "共享业务页",
    },
  ];
  const host = document.getElementById("batch3-index");
  const roles = [
    ["verdict", "超级管理员"],
    ["manager-home", "销售主管"],
    ["sales-home", "销售"],
    ["solution-pool", "解决方案人员"],
  ];
  host.innerHTML =
    '<div class="hub__group-head"><span class="hub__group-t">批 3 · 业务闭环</span></div><div class="hub__grid">' +
    roles
      .map(
        ([file, title]) =>
          '<a class="hubcard" href="pages/' +
          file +
          '.html"><div class="hubcard__t">' +
          title +
          '</div><div class="hubcard__id">进入工作界面</div></a>',
      )
      .join("") +
    "</div>" +
    ["超级管理员", "销售主管", "销售", "解决方案人员", "共享业务页"]
      .map(
        (group) =>
          '<h3 style="margin:24px 0 12px">' +
          group +
          '</h3><div class="hub__grid">' +
          pages
            .filter((p) => p.group === group)
            .map(
              (p) =>
                '<a class="hubcard" href="pages/' +
                p.file +
                ".html?role=" +
                p.role +
                '"><div class="hubcard__top"><span class="badge badge--green badge--sm">批 3</span><span class="hubcard__id">' +
                p.pid +
                '</span></div><div class="hubcard__t">' +
                p.title +
                "</div></a>",
            )
            .join("") +
          "</div>",
      )
      .join("");
})();
