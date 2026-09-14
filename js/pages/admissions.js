/* P-ADM-20: 跟进准入终审. Shared behavior is owned by the batch 3 view components. */
SC.B3.start({
  pid: "P-ADM-20",
  title: "跟进准入终审",
  role: "ADM",
  menu: "admit",
  view: "admissions",
  afterRender: SC.B3.syncAdmissionDrawer,
});
