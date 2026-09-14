/* Compatibility entry: this view now opens in a drawer on products.html. */
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (params.get("view")) params.set("productTab", params.get("view"));
  params.delete("id");
  params.set("view", "products");
  params.set("product", id || "P-103");
  location.replace("products.html?" + params.toString());
})();
