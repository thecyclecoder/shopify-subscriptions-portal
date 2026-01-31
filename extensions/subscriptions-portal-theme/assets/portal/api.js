(function () {
  window.__SP = window.__SP || {};

  function getBase() {
    return (window.__SP && window.__SP.endpoint) ? window.__SP.endpoint : "/apps/portal";
  }

  function getDebug() {
    return !!(window.__SP && window.__SP.debug);
  }

  async function getJson(path) {
    var base = getBase();
    var url = base.replace(/\/$/, "") + path;

    var res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });

    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var body = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      if (getDebug()) console.log("[SP api] Non-OK:", res.status, body);
      var err = new Error("HTTP " + res.status);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  window.__SP.api = {
    getJson: getJson
  };
})();