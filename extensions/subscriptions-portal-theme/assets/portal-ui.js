(function () {
  window.__SP = window.__SP || {};

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
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

  function ensureStyles() {
    if (document.getElementById("sp-ui-styles")) return;

    var css = ""
      + ".sp-card{border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fff;}"
      + ".sp-stack{display:flex;flex-direction:column;gap:16px;}"
      + ".sp-wrap{font-size:17px;line-height:1.4;}"
      + ".sp-title{font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px;}"
      + ".sp-title2{font-size:20px;font-weight:800;margin:0 0 4px;}"
      + ".sp-muted{color:#6b7280;margin:0;}"
      + ".sp-hero{border:1px solid #e5e7eb;border-radius:18px;padding:18px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px;}"
      + ".sp-pill{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;background:#f3f4f6;color:#444;font-weight:700;font-size:14px;white-space:nowrap;}"
      + ".sp-row{display:flex;gap:12px;align-items:flex-start;}"
      + ".sp-icon{font-size:20px;line-height:1;}"
      + ".sp-actions{display:flex;flex-direction:column;gap:12px;}"
      + ".sp-btn{display:block;text-align:center;padding:14px 14px;border-radius:14px;border:1px solid #e5e7eb;background:#fff;font-size:18px;font-weight:800;text-decoration:none;color:#111;}"
      + ".sp-btn:hover{opacity:0.96;}"
      + ".sp-btn-primary{border-color:#111;}"
      + ".sp-pre{white-space:pre-wrap;background:#0b1020;color:#e5e7eb;padding:12px;border-radius:12px;font-size:13px;overflow:auto;margin-top:12px;}"
      ;

    var style = document.createElement("style");
    style.id = "sp-ui-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setRoot(htmlOrEl) {
    ensureStyles();
    var root = window.__SP && window.__SP.root;
    if (!root) return;

    if (typeof htmlOrEl === "string") {
      root.innerHTML = htmlOrEl;
      return;
    }

    // DOM node
    root.innerHTML = "";
    root.appendChild(htmlOrEl);
  }

  function card(innerHtml) {
    return "<div class='sp-card'><div class='sp-wrap'>" + innerHtml + "</div></div>";
  }

  function hero(title, subtitle, pillText) {
    return ""
      + "<div class='sp-hero'>"
      + "  <div class='sp-wrap'>"
      + "    <h2 class='sp-title'>" + escapeHtml(title || "") + "</h2>"
      + "    <p class='sp-muted'>" + escapeHtml(subtitle || "") + "</p>"
      + "  </div>"
      + "  " + (pillText ? "<div class='sp-pill'>" + escapeHtml(pillText) + "</div>" : "")
      + "</div>";
  }

  function stack(parts) {
    parts = Array.isArray(parts) ? parts : [];
    return "<div class='sp-stack'>" + parts.join("") + "</div>";
  }

  window.__SP.ui = {
    escapeHtml: escapeHtml,
    setRoot: setRoot,
    card: card,
    hero: hero,
    stack: stack
  };

  if (window.__SP && window.__SP.debug) {
    try { console.log("[Portal UI] Loaded. hero/card/stack/setRoot ready."); } catch (e) {}
  }
})();