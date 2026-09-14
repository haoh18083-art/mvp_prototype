/* P-CMN-05 经营组合详情：已改为右侧抽屉，不再作为独立页面。
   直链 combo-detail.html?id=<组合> 重定向到对应角色的客户清单，并以 ?combo= 自动展开抽屉。 */
(function (SC) {
  "use strict";
  var B = SC.B2;
  var params = new URLSearchParams(location.search);
  var identity = B.identity(params.get("role") || B.role);
  var role = SC.DATA.ROLES[identity.role] ? identity.role : "SLS";
  var list =
    { ADM: "customers", MGR: "manager-customers", SLS: "my-customers", SOL: "solution-pool" }[
      role
    ] || "my-customers";
  var extra = { role: role };
  var id = params.get("id");
  if (id) extra.combo = id;
  if (params.get("as")) extra.as = params.get("as");
  try {
    location.replace(B.href(list, extra));
  } catch (e) {
    /* 无导航能力的环境（如测试）忽略 */
  }
})(window.SC);
