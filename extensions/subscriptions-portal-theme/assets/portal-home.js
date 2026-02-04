(function () {
  window.__SP = window.__SP || {};
  window.__SP.screens = window.__SP.screens || {};

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (m) {
      switch (m) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#039;";
        default: return m;
      }
    });
  }

  function card(html) {
    if (window.__SP.ui && typeof window.__SP.ui.card === "function") {
      return window.__SP.ui.card(html);
    }
    return "<div class='sp-card sp-wrap'>" + html + "</div>";
  }

  function setRoot(html) {
    if (window.__SP.ui && typeof window.__SP.ui.setRoot === "function") {
      window.__SP.ui.setRoot(html);
      return;
    }
    var root = window.__SP.root;
    if (root) root.innerHTML = html;
  }

  function getBasePrefix() {
    return String(window.location.pathname || "").startsWith("/pages/") ? "/pages" : "";
  }

  function btn(href, text, variant) {
    var cls = "sp-btn";
    if (variant === "primary") cls += " sp-btn--primary";
    if (variant === "secondary") cls += " sp-btn--secondary";
    if (variant === "ghost") cls += " sp-btn--ghost";
    return (
      "<a href='" + href + "' class='" + cls + "'>" +
      esc(text) +
      "</a>"
    );
  }

  async function fetchHome() {
    if (!window.__SP.api || typeof window.__SP.api.requestJson !== "function") {
      throw new Error("API not loaded");
    }
    return await window.__SP.api.requestJson("home");
  }

  function countSubscriptions(homeData) {
    // Prefer meta-aware contracts via portal-utils if available
    try {
      var utils = window.__SP.utils;
      if (utils && typeof utils.pickContracts === "function") {
        var list = utils.pickContracts(homeData);
        return Array.isArray(list) ? list.length : 0;
      }
    } catch (e) {}

    // Fallback: summary.active_count if present
    var summary = (homeData && homeData.summary) || {};
    var activeCount = Number(summary.active_count || 0);
    return isFinite(activeCount) ? activeCount : 0;
  }

  function renderHome(data) {
    if (!data || data.ok !== true) {
      setRoot(
        card(
          "<div class='sp-error-title'>We hit a snag</div>" +
          "<div class='sp-error-text'>Please refresh, or contact support if this keeps happening.</div>"
        )
      );
      return;
    }

    var basePrefix = getBasePrefix();

    var customer = data.customer || {};
    var name = window.__SP.el && window.__SP.el.getAttribute
      ? window.__SP.el.getAttribute("data-first-name")
      : "";
    var greeting = name ? "Welcome back, " + esc(name) : "Welcome back";

    var subCount = countSubscriptions(data);

    var header =
      "<div class='sp-home-header'>" +
        "<div class='sp-home-header-left'>" +
          "<div class='sp-home-title'>" + greeting + "</div>" +
          "<div class='sp-home-subtitle'>Let’s keep your results rolling.</div>" +
        "</div>" +
      "</div>";

    var emailLine = customer.email
      ? "<div class='sp-home-email'>Signed in as " + esc(customer.email) + "</div>"
      : "";

    // Single CTA
    var actions =
      "<div class='sp-home-actions'>" +
        btn(basePrefix + "/portal/subscriptions?status=active", "View subscriptions", "primary") +
      "</div>";

    // Rewards card placeholder (drop widget into #sp-rewards-widget later)
    var rewardsCard =
      card(
        "<div class='sp-home-rewards'>" +
          "<div class='sp-home-rewards__head'>" +
            "<div class='sp-title'>Rewards</div>" +
            "<div class='sp-muted'>Your points and perks will show here.</div>" +
          "</div>" +
          "<div id='sp-rewards-widget' class='sp-rewards-widget'>" +
            "<div class='sp-muted'>Rewards widget placeholder</div>" +
          "</div>" +
        "</div>"
      );

    // Main home card
    var homeCard =
      card(
        header +
        emailLine +
        "<div class='sp-home-description'>" +
          "This is a secure subscription portal. Updates made here apply directly to your next shipment." +
        "</div>" +
        actions
      );

    // Stack cards
    setRoot(
      "<div class='sp-wrap sp-grid'>" +
        homeCard +
        rewardsCard +
      "</div>"
    );
  }

  async function render() {
    setRoot(
      card("<div class='sp-loading'>Loading your portal…</div>")
    );

    try {
      var data = await fetchHome();
      renderHome(data);
    } catch (err) {
      console.error("[Portal] home error:", err);
      setRoot(
        card(
          "<div class='sp-error-title'>Could not load portal</div>" +
          "<div class='sp-error-text'>Please refresh. If this keeps happening, contact support.</div>"
        )
      );
    }
  }

  window.__SP.screens.home = { render: render };
})();