// assets/portal-home.js
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

  function setRoot(htmlOrEl) {
    if (window.__SP.ui && typeof window.__SP.ui.setRoot === "function") {
      window.__SP.ui.setRoot(htmlOrEl);
      return;
    }
    var root = window.__SP.root;
    if (!root) return;

    if (typeof htmlOrEl === "string") root.innerHTML = htmlOrEl;
    else {
      root.innerHTML = "";
      root.appendChild(htmlOrEl);
    }
  }

  function getPortalBase() {
    var p = (window.__SP && window.__SP.portalPage) ? String(window.__SP.portalPage) : "/pages/portal";
    return p.replace(/\/+$/, "");
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
    // Home is a lightweight health check now
    return await window.__SP.api.requestJson("home", {}, { force: true });
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

    var base = getPortalBase();
    var appName = data.appName ? String(data.appName) : "Subscription Portal";

    // Shopify Liquid already knows the customer name; we’ll read from the extension DOM if present.
    var firstName = "";
    try {
      if (window.__SP.el && window.__SP.el.getAttribute) {
        firstName = String(window.__SP.el.getAttribute("data-first-name") || "");
      }
    } catch (e) {}

    var greeting = firstName ? ("Welcome back, " + esc(firstName)) : "Welcome back";

    var header =
      "<div class='sp-home-header'>" +
        "<div class='sp-home-header-left'>" +
          "<div class='sp-home-title'>" + greeting + "</div>" +
          "<div class='sp-home-subtitle'>" + esc(appName) + "</div>" +
        "</div>" +
      "</div>";

    var actions =
      "<div class='sp-home-actions'>" +
        btn(base + "/subscriptions?status=active", "View subscriptions", "primary") +
      "</div>";

    var homeCard =
      card(
        header +
        "<div class='sp-home-description'>" +
          "Manage your upcoming orders, shipping details, and subscription status." +
        "</div>" +
        actions
      );

    // Optional: keep Rewards placeholder card (no API dependency)
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

    setRoot(
      "<div class='sp-wrap sp-grid'>" +
        homeCard +
        rewardsCard +
      "</div>"
    );
  }

  async function render() {
    setRoot(card("<div class='sp-loading'>Loading your portal…</div>"));

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