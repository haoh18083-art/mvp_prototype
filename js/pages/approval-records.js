/* P-ADM-19: 客保审批记录. Shared behavior is owned by the batch 3 view components. */
SC.B3.start({
  pid: "P-ADM-19",
  title: "客保审批记录",
  role: "ADM",
  menu: "appr-records",
  view: "records",
  afterRender: (context) => SC.B3.syncApprovalDrawer(context),
});
