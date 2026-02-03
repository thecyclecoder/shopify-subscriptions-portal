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

  function btn(href, text, variant) {
    var cls = "sp-btn";
    if (variant === "primary") cls += " sp-btn--primary";
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

    var customer = data.customer || {};
    var name = window.__SP.el.getAttribute("data-first-name");
    var greeting = name ? "Welcome back, " + esc(name) : "Welcome back";

    var summary = data.summary || {};
    var activeCount = summary.active_count || 0;

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

    var actions =
      "<div class='sp-home-actions'>" +
        btn("/pages/portal/subscriptions?status=active", "View active subscriptions (" + activeCount + ")", "primary") +
        btn("/pages/portal/subscriptions?status=cancelled", "See cancelled (reactivate)", "secondary") +
      "</div>";

    setRoot(
      card(
        header +
        emailLine +
        "<div class='sp-home-description'>" +
          "This is a secure subscription portal. Updates made here apply directly to your next shipment." +
        "</div>" +
        actions
      )
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