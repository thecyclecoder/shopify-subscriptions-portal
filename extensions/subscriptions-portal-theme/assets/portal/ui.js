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

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function setRoot(contentNode) {
    var root = window.__SP.root;
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(contentNode);
  }

  function card(innerHtml) {
    return el("div", {
      class: "sp-card",
      html: innerHtml
    });
  }

  function message(text) {
    return el("p", { class: "sp-muted" }, [text]);
  }

  function loading(text) {
    return el("div", { class: "sp-loading" }, [
      el("p", { class: "sp-muted" }, [text || "Loading…"])
    ]);
  }

  // Minimal styles injected once (keeps 17px+ readable base)
  function ensureBaseStyles() {
    if (document.getElementById("sp-base-styles")) return;
    var style = el("style", { id: "sp-base-styles", html: `
      .sp-wrap { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; font-size: 17px; line-height: 1.4; }
      .sp-grid { display: grid; gap: 14px; }
      .sp-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; background: #fff; }
      .sp-title { font-size: 22px; margin: 0 0 6px; }
      .sp-muted { color: #6b7280; margin: 0; }
      .sp-row { display:flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
      .sp-btn { display:inline-block; border:1px solid #111827; border-radius: 12px; padding: 10px 14px; text-decoration:none; font-weight: 600; }
      .sp-btn--ghost { border-color:#e5e7eb; color:#111827; }
      .sp-pill { display:inline-block; padding: 6px 10px; border-radius: 999px; background:#f3f4f6; font-weight: 600; font-size: 14px; }
      .sp-loading { padding: 10px 0; }
      @media (min-width: 800px) {
        .sp-grid--2 { grid-template-columns: 1fr 1fr; }
      }
    `});
    document.head.appendChild(style);
  }

  window.__SP.ui = {
    escapeHtml: escapeHtml,
    el: el,
    setRoot: setRoot,
    card: card,
    message: message,
    loading: loading,
    ensureBaseStyles: ensureBaseStyles
  };
})();