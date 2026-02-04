(function () {
  window.__SP = window.__SP || {};

  // ---- helpers -------------------------------------------------------------

  function log() {
    if (window.__SP && window.__SP.debug) {
      try { console.log.apply(console, arguments); } catch (e) {}
    }
  }

  function warn() {
    if (window.__SP && window.__SP.debug) {
      try { console.warn.apply(console, arguments); } catch (e) {}
    }
  }

  function normalizeBaseEndpoint(input) {
    var s = String(input || "").trim();
    if (!s) return "/apps/portal";
    if (!s.startsWith("/")) s = "/" + s;
    return s.replace(/\/+$/, "") || "/apps/portal";
  }

  function buildUrl(base, route, params) {
    var sp = new URLSearchParams();
    sp.set("route", String(route || "").trim() || "bootstrap");

    if (params && typeof params === "object") {
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null) return;
        sp.set(k, String(v));
      });
    }

    return new URL(base + "?" + sp.toString(), window.location.origin).toString();
  }

  // ---- cache ---------------------------------------------------------------

  var HOME_CACHE_KEY = "__sp_home_cache_v1";
  var HOME_CACHE_TTL_MS = 90 * 1000; // 90 seconds

  // NEW: contractsMeta cache
  var META_CACHE_KEY = "__sp_contracts_meta_cache_v1";
  var META_CACHE_TTL_MS = 90 * 1000; // match home

  function getHomeCache() {
    try {
      var raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setHomeCache(data) {
    try {
      sessionStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: data })
      );
    } catch (e) {}
  }

  function getMetaCache() {
    try {
      var raw = sessionStorage.getItem(META_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setMetaCache(data) {
    try {
      sessionStorage.setItem(
        META_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: data })
      );
    } catch (e) {}
  }

  function isCacheFresh(entry, ttlMs) {
    var ttl = typeof ttlMs === "number" ? ttlMs : HOME_CACHE_TTL_MS;
    return entry && (Date.now() - entry.ts) < ttl;
  }

  function getFreshHomeData() {
    var entry = getHomeCache();
    if (!entry) return null;
    if (!isCacheFresh(entry, HOME_CACHE_TTL_MS)) return null;
    return entry.data || null;
  }

  function getFreshMetaData() {
    var entry = getMetaCache();
    if (!entry) return null;
    if (!isCacheFresh(entry, META_CACHE_TTL_MS)) return null;
    return entry.data || null;
  }

  async function getHomeWithMeta(baseHome, params, opts) {
  // Try cache first
  var meta = getFreshMetaData();

  // If no fresh meta, fetch it
  if (!meta) {
    try {
      meta = await fetchAndCache(params, opts, "contractsMeta");
    } catch (e) {
      warn("[Portal API] contractsMeta fetch failed:", e);
      meta = null;
    }
  }

  // Merge meta into home response
  if (meta && meta.ok && Array.isArray(meta.contractsMeta)) {
    baseHome.contractsMeta = meta.contractsMeta;
  } else if (meta && Array.isArray(meta)) {
    // safety: if endpoint returns array directly
    baseHome.contractsMeta = meta;
  } else {
    baseHome.contractsMeta = [];
  }

  return baseHome;
}

  // ---- core ---------------------------------------------------------------

  async function requestJson(route, params, opts) {
    opts = opts || {};
    route = String(route || "").toLowerCase();

    // ---- HOME CACHE SHORT-CIRCUIT -----------------------------------------
    if (route === "home") {
      var cached = getHomeCache();
      if (cached && cached.data) {
        if (isCacheFresh(cached, HOME_CACHE_TTL_MS)) {
          log("[Portal API] HOME CACHE HIT (fresh)");
          return cached.data;
        } else {
          log("[Portal API] HOME CACHE HIT (stale) — revalidating");
          // return stale immediately, refresh in background
          fetchAndCache(params, opts, "home").catch(function () {});
          return cached.data;
        }
      }
    }

    // ---- META CACHE SHORT-CIRCUIT -----------------------------------------
    if (route === "contractsmeta") {
      var cachedM = getMetaCache();
      if (cachedM && cachedM.data) {
        if (isCacheFresh(cachedM, META_CACHE_TTL_MS)) {
          log("[Portal API] META CACHE HIT (fresh)");
          return cachedM.data;
        } else {
          log("[Portal API] META CACHE HIT (stale) — revalidating");
          fetchAndCache(params, opts, "contractsMeta").catch(function () {});
          return cachedM.data;
        }
      }
    }

    // ---- NETWORK FETCH ----------------------------------------------------
    log("[Portal API] FETCH (network):", route);
    return await fetchAndCache(params, opts, route);
  }

  async function fetchAndCache(params, opts, routeOverride) {
    var endpointRaw = window.__SP && window.__SP.endpoint;
    var base = normalizeBaseEndpoint(endpointRaw);
    var route = routeOverride || "home";

    var absUrl = buildUrl(base, route, params);

    log("[Portal API] FETCH:", absUrl);

    var res;
    try {
      res = await fetch(absUrl, {
        method: opts.method || "GET",
        credentials: "include",
        headers: Object.assign({ Accept: "application/json" }, opts.headers || {}),
        body: opts.body || undefined,
      });
    } catch (e) {
      warn("[Portal API] Fetch failed:", e);
      throw e;
    }

    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var bodyText = await res.text();
    var data;

    if (ct.indexOf("application/json") >= 0) {
      data = bodyText ? JSON.parse(bodyText) : null;
    } else {
      data = bodyText;
    }

    if (!res.ok) {
      warn("[Portal API] Non-OK:", res.status, data);
      throw new Error("HTTP_" + res.status);
    }

    // Cache writes
    var routeLower = String(route || "").toLowerCase();
    if (routeLower === "home" && data && data.ok) {
      try {
        // IMPORTANT: merge contractsMeta into home
        data = await getHomeWithMeta(data, params, opts);
      } catch (e) {
        warn("[Portal API] Failed to merge contractsMeta into home:", e);
      }

      setHomeCache(data);
      log("[Portal API] HOME CACHE UPDATED (with meta)");
    }
    if (routeLower === "contractsmeta" && data && data.ok) {
      setMetaCache(data);
      log("[Portal API] META CACHE UPDATED");
    }

    return data;
  }

  function safeJsonParse(text) {
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  async function postJson(route, payload, params) {
    var headers = { "Content-Type": "application/json" };
    return await requestJson(route, params || {}, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload || {}),
    });
  }

  // Optional: generic request helper for future PUT/DELETE etc
  async function request(route, params, opts) {
    return await requestJson(route, params, opts);
  }

  // ---- exports ------------------------------------------------------------

  window.__SP.api = {
    requestJson: requestJson,
    postJson: postJson,
    request: request,

    _getHomeCache: getHomeCache,
    getFreshHomeData: getFreshHomeData,

    // NEW
    _getMetaCache: getMetaCache,
    getFreshMetaData: getFreshMetaData
  };

  log("[Portal API] Loaded. window.__SP.api is ready.");
})();