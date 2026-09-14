/* P-ADM-18 来源冲突确认：已并入客保裁决台「管理处置」页签，本页只做重定向。 */
(function (SC) {
  "use strict";
  var B = SC.B2;
  var p = new URLSearchParams(location.search);
  var extra = { view: "manage", m: "source" };
  if (p.get("role")) extra.role = p.get("role");
  if (p.get("as")) extra.as = p.get("as");
  if (p.get("id")) extra.id = p.get("id");
  if (p.get("candidate")) extra.candidate = p.get("candidate");
  try {
    location.replace(B.href("verdict", extra));
  } catch (e) {
    /* 无导航能力的环境（如测试）忽略 */
  }
})(window.SC);
