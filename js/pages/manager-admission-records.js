// Compatibility entry: the manager workflow now lives on its list page.
(function () {
  const query = new URLSearchParams(location.search);
  const id = query.get("id");
  query.delete("id");
  if (!query.has("role")) query.set("role", "MGR");
  query.set("view", "records");
  location.replace("manager-admissions.html?" + query);
})();
