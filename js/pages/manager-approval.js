// Compatibility entry: the manager workflow now lives on its list page.
(function () {
  const query = new URLSearchParams(location.search);
  const id = query.get("id");
  query.delete("id");
  if (!query.has("role")) query.set("role", "MGR");
  if (id) query.set("request", id);
  location.replace("manager-approvals.html?" + query);
})();
