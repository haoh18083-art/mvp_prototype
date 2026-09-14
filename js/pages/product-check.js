/* Compatibility entry: this view now opens in a drawer on products.html. */
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  params.delete("id");
  params.set("view", "checks");
  params.set("check", id || (params.get("draft") === "1" ? "draft" : "PC-01"));
  location.replace("products.html?" + params.toString());
})();
