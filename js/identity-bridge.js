/* Keep account changes on legacy personnel pages in the shared prototype store. */
(function (SC, B) {
  "use strict";
  SC.refreshPeople = B.refreshOrganisation;
  SC.setAccountState = function (ids, status) {
    const identity = B.identity(B.role || "ADM");
    if (!identity.valid || identity.role !== "ADM") throw Error("当前身份无权维护账号");
    const result = B.change((s) =>
      ids.map((id) => {
        const p = B.find("people", id, s);
        if (!p) return { id, ok: false, why: "人员记录不存在" };
        if (!SC.DATA.ROLES[p.role])
          return { id, ok: false, why: "尚未分配有效角色" };
        p.status = status;
        B.log(
          s,
          id,
          status === "on" ? "启用账号" : "停用账号",
          "销售归属及空间保持不变",
        );
        return { id, ok: true };
      }),
    );
    SC.refreshPeople();
    return result;
  };
  SC.refreshPeople();
})(window.SC, window.SC.B2);
