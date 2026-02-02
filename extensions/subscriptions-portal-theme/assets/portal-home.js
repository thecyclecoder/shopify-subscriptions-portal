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
    return (
      '<div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;">' +
      html +
      "</div>"
    );
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
    var base =
      "display:block;width:100%;text-align:center;text-decoration:none;font-weight:800;" +
      "padding:14px 16px;border-radius:14px;font-size:18px;line-height:1.1;";
    if (variant === "primary") {
      return (
        '<a href="' +
        href +
        '" style="' +
        base +
        "border:2px solid #111827;background:#ffffff;color:#111827;" +
        '">' +
        esc(text) +
        "</a>"
      );
    }
    return (
      '<a href="' +
      href +
      '" style="' +
      base +
      "border:1px solid #e5e7eb;background:#f9fafb;color:#111827;" +
      '">' +
      esc(text) +
      "</a>"
    );
  }

  function formatName(customer) {
    if (!customer) return "";
    var first = (customer.firstName || "").trim();
    var display = (customer.displayName || "").trim();
    if (first) return first;
    if (display) return display.split(" ")[0];
    return "";
  }

async function fetchHome() {
  if (!window.__SP.api || typeof window.__SP.api.requestJson !== "function") {
    throw new Error("API not loaded");
  }
  // route=home (handled by /subscriptions/route.ts)
  return await window.__SP.api.requestJson("home");
}

  function renderHome(data) {
    if (!data || data.ok !== true) {
      setRoot(
        card(
          "<div style='font-size:18px;font-weight:900;margin-bottom:6px;'>We hit a snag</div>" +
            "<div style='font-size:17px;color:#6b7280;font-weight:600;'>Please refresh, or contact support if this keeps happening.</div>"
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
      "<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;'>" +
        "<div>" +
          "<div style='font-size:34px;line-height:1.1;font-weight:900;margin:0;'>" + greeting + "</div>" +
          "<div style='font-size:19px;color:#6b7280;margin-top:6px;font-weight:600;'>Let’s keep your results rolling.</div>" +
        "</div>" +
        "<div>" +
          "<span style='display:inline-block;padding:8px 12px;border-radius:999px;background:#f3f4f6;font-weight:800;font-size:14px;color:#374151;'>Secure portal</span>" +
        "</div>" +
      "</div>";

    var emailLine = customer.email
      ? "<div style='margin-top:10px;font-size:15px;color:#9ca3af;font-weight:600;'>Signed in as " + esc(customer.email) + "</div>"
      : "";

    var actions =
      "<div style='display:grid;gap:12px;margin-top:16px;'>" +
        btn("/pages/portal/subscriptions?status=active", "View active subscriptions (" + activeCount + ")", "primary") +
        btn("/pages/portal/subscriptions?status=cancelled", "See cancelled (reactivate)", "secondary") +
      "</div>";

    setRoot(
      card(
        header +
        emailLine +
        "<div style='margin-top:14px;font-size:17px;color:#374151;font-weight:650;'>" +
          "This is a secure subscription portal. Updates made here apply directly to your next shipment." +
        "</div>" +
        actions
      )
    );
  }

  async function render() {
    // nice loading state
    setRoot(
      card("<div style='font-size:18px;font-weight:900;'>Loading your portal…</div>")
    );

    try {
      var data = await fetchHome();
      renderHome(data);
    } catch (err) {
      console.error("[Portal] home error:", err);
      setRoot(
        card(
          "<div style='font-size:28px;font-weight:950;margin-bottom:6px;'>Could not load portal</div>" +
          "<div style='font-size:17px;color:#6b7280;font-weight:650;'>Please refresh. If this keeps happening, contact support.</div>" +
          "<pre style='margin-top:14px;white-space:pre-wrap;font-size:14px;background:#0b1020;color:#fff;padding:12px;border-radius:14px;overflow:auto;'>" +
          esc(String(err && err.stack ? err.stack : err)) +
          "</pre>"
        )
      );
    }
  }

  window.__SP.screens.home = { render: render };
})();