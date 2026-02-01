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
    // Prefer UI helper if you already have it
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

  function pill(text) {
    return (
      '<div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;font-size:16px;font-weight:800;color:#111827;">' +
      esc(text) +
      "</div>"
    );
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
    var base = (window.__SP && window.__SP.endpoint) || "/apps/portal";
    var url = base.replace(/\/$/, "") + "/home";

    var res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var body = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) throw new Error("HTTP " + res.status);
    return body;
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
    var name = formatName(customer);
    var greeting = name ? "Welcome back, " + esc(name) : "Welcome back";

    var summary = data.summary || {};
    var activeCount = summary.active_count || 0;
    var cancelledCount = summary.cancelled_count || 0;
    var isEarly = !!summary.is_early_journey;

    var header =
      "<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;'>" +
      "<div>" +
      "<div style='font-size:34px;line-height:1.1;font-weight:900;margin:0;'>" +
      greeting +
      "</div>" +
      "<div style='font-size:19px;color:#6b7280;margin-top:6px;font-weight:600;'>Let’s keep your results rolling.</div>" +
      "</div>" +
      "<div>" +
      "<span style='display:inline-block;padding:8px 12px;border-radius:999px;background:#f3f4f6;font-weight:700;font-size:14px;color:#374151;'>Secure portal</span>" +
      "</div>" +
      "</div>";

    var emailLine = customer.email
      ? "<div style='margin-top:10px;font-size:15px;color:#9ca3af;font-weight:600;'>Signed in as " +
        esc(customer.email) +
        "</div>"
      : "";

    var trust = card(
      "<div style='display:flex;gap:12px;align-items:flex-start;'>" +
        "<div style='font-size:22px;line-height:1;'>🔒</div>" +
        "<div>" +
        "<div style='font-size:18px;font-weight:900;margin:0 0 4px;'>Your subscription info is protected</div>" +
        "<div style='font-size:17px;color:#6b7280;font-weight:600;'>We only show and update subscriptions for the account you’re logged into.</div>" +
        "</div>" +
        "</div>"
    );

    var counts = card(
      "<div style='display:flex;gap:12px;flex-wrap:wrap;'>" +
        pill(activeCount + " active") +
        pill(cancelledCount + " cancelled") +
        "</div>"
    );

    var stayTheCourse = "";
    if (isEarly) {
      stayTheCourse = card(
        "<div style='font-size:18px;font-weight:900;margin-bottom:6px;'>Before you make changes…</div>" +
          "<div style='font-size:17px;color:#6b7280;font-weight:600;'>Most customers see the best results when they stay consistent. If you’re early in your journey, consider pausing instead of canceling.</div>"
      );
    }

    var actions = card(
      "<div style='display:grid;gap:12px;'>" +
        btn("/portal/subscriptions?status=active", "View active subscriptions", "primary") +
        btn("/portal/subscriptions?status=cancelled", "See cancelled (reactivate)", "secondary") +
        "</div>"
    );

    setRoot(
      "<div style='display:grid;gap:16px;'>" +
        card(header + emailLine) +
        trust +
        counts +
        stayTheCourse +
        actions +
      "</div>"
    );
  }

  function render() {
    // Design mode safety
    if (window.__SP && window.__SP.isDesignMode) {
      setRoot(
        "<p style='color:#6b7280;font-weight:600;font-size:16px;'>Preview mode: portal data loads on the live storefront.</p>"
      );
      return;
    }

    setRoot(
      card(
        "<div style='font-size:18px;font-weight:800;margin-bottom:6px;'>Loading…</div>" +
          "<div style='font-size:17px;color:#6b7280;font-weight:600;'>Getting your subscription details.</div>"
      )
    );

    fetchHome()
      .then(renderHome)
      .catch(function () {
        setRoot(
          card(
            "<div style='font-size:18px;font-weight:900;margin-bottom:6px;'>Could not load portal</div>" +
              "<div style='font-size:17px;color:#6b7280;font-weight:600;'>Please refresh. If this keeps happening, contact support.</div>"
          )
        );
      });
  }

  // ✅ This is what your router expects
  window.__SP.screens.home = { render: render };
})();