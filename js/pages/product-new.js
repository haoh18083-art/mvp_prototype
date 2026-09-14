/* Compatibility entry: creation now opens in the product management drawer. */
(function () {
  const params = new URLSearchParams(location.search);
  for (const key of ["product", "check", "productTab", "draft", "target"]) params.delete(key);
  params.set("create", "1");
  location.replace("products.html?" + params.toString());
})();
