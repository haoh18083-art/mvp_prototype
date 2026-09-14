/* Compatibility entry: admission details now open on the pending list. */
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  params.delete("id");
  if (id) params.set("admission", id);
  location.replace("admissions.html?" + params.toString());
})();
