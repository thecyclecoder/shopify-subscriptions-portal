(function () {
  function init(el) {
    const root = el.querySelector("#subscriptions-portal-root");
    if (!root) return;

    const endpoint = el.getAttribute("data-endpoint") || "/apps/portal";
    const debug = el.getAttribute("data-debug") === "true";

    const isDesignMode =
      document.documentElement.classList.contains("shopify-design-mode");

    if (isDesignMode) {
      // In the theme editor, app proxy signature often won't be present.
      // Avoid showing scary errors.
      root.innerHTML =
        "<p style='color:#6b7280;'>Preview mode: subscription data loads on the live storefront.</p>";
      return;
    }

    root.innerHTML = "<p>Loading your subscriptions…</p>";

    fetch(endpoint, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const body = ct.includes("application/json") ? await res.json() : await res.text();

        if (!res.ok) {
          if (debug) console.log("[Subscriptions Portal] Non-OK response:", res.status, body);
          throw new Error("HTTP " + res.status);
        }

        return body;
      })
      .then((data) => {
        if (debug) console.log("[Subscriptions Portal] Data:", data);

        // If it ever returns HTML, render it directly
        if (typeof data === "string") {
          root.innerHTML = data;
          return;
        }

        // Expecting { ok: true, shop, logged_in_customer_id }
        if (!data || data.ok !== true) {
          root.innerHTML = "<p>Could not load portal data.</p>";
          return;
        }

        const shop = escapeHtml(data.shop || "");
        const cid = escapeHtml(data.logged_in_customer_id || "");

        if (!cid) {
          root.innerHTML = `
            <div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;">
              <p><strong>Please log in</strong> to manage your subscriptions.</p>
            </div>
          `;
          return;
        }

        root.innerHTML = `
          <div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;">
            <p><strong>Shop:</strong> ${shop}</p>
            <p><strong>Customer ID:</strong> ${cid}</p>
            <p style="color:#6b7280;margin-top:10px;">
              Next: fetch active subscriptions and render the portal UI.
            </p>
          </div>
        `;
      })
      .catch((err) => {
        console.error("[Subscriptions Portal] Error:", err);
        root.innerHTML =
          "<p>Could not load subscriptions. Please refresh or contact support.</p>";
      });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return m;
      }
    });
  }

  function boot() {
    document
      .querySelectorAll('[data-app="subscriptions-portal"]')
      .forEach((el) => init(el));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", boot);
})();