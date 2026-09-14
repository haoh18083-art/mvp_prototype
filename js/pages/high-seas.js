/* P-ADM-17 公海与释放候选：已并入客保裁决台「管理处置」页签，本页只做重定向。 */
(function (SC) {
  "use strict";
  var B = SC.B2;
  var p = new URLSearchParams(location.search);
  var extra = { view: "manage", m: "seas" };
  if (p.get("role")) extra.role = p.get("role");
  if (p.get("as")) extra.as = p.get("as");
  try {
    location.replace(B.href("verdict", extra));
  } catch (e) {
    /* 无导航能力的环境（如测试）忽略 */
  }
})(window.SC);
