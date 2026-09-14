/* Legacy bookmarks now open the request drawer on the decision desk. */
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  params.delete("id");
  if (id) params.set("request", id);
  params.set("view", "requests");
  location.replace("verdict.html?" + params.toString());
})();
