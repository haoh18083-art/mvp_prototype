/* P-ADM-14: 客保裁决台. Shared behavior is owned by the batch 3 view components. */
SC.B3.start({
  pid: "P-ADM-14",
  title: "客保裁决台",
  role: "ADM",
  menu: "verdict",
  view: "verdict",
  afterRender: SC.B3.syncApprovalDrawer,
});
