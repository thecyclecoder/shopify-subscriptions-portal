// assets/portal-actions-change-shipping-address.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function requiredTrim(v) {
    return String(v == null ? "" : v).trim();
  }

  // ---------------------------------------------------------------------------
  // Session “recent change” storage (so detail screen can show “Updated” note)
  // ---------------------------------------------------------------------------

  var RECENT_SHIP_KEY_PREFIX = "__sp_recent_shipaddr__";

  function recentShipKey(contractGid) {
    return RECENT_SHIP_KEY_PREFIX + String(shortId(contractGid) || "");
  }

  function formatAddressLine(payload) {
    var first = requiredTrim(payload.firstName);
    var last = requiredTrim(payload.lastName);

    var a1 = requiredTrim(payload.address1);
    var a2 = requiredTrim(payload.address2);
    var city = requiredTrim(payload.city);
    var st = requiredTrim(payload.provinceCode);
    var zip = requiredTrim(payload.zip);

    var name = [first, last].filter(Boolean).join(" ");
    var line1 = a1 + (a2 ? (", " + a2) : "");
    var line2 = [city, st, zip].filter(Boolean).join(" ");

    // Example: "Dylan Ralston • 295 Palmas Inn Way, STE 104 PMB 425 • Humacao PR 00791"
    return [name, line1, line2].filter(Boolean).join(" • ");
  }

  function saveRecentAddress(contractGid, payload) {
    try {
      var clean = {
        firstName: requiredTrim(payload.firstName),
        lastName: requiredTrim(payload.lastName),
        address1: requiredTrim(payload.address1),
        address2: requiredTrim(payload.address2),
        city: requiredTrim(payload.city),
        provinceCode: requiredTrim(payload.provinceCode),
        zip: requiredTrim(payload.zip),
        countryCode: requiredTrim(payload.countryCode),
        country: requiredTrim(payload.country),
      };

      sessionStorage.setItem(
        recentShipKey(contractGid),
        JSON.stringify({
          ts: Date.now(),
          text: formatAddressLine(clean),
          payload: clean,
        })
      );
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Pull logged-in customer name from the root div data attributes
  // ---------------------------------------------------------------------------

  function getCustomerFromRoot() {
    var root = document.querySelector(".subscriptions-portal");
    if (!root) return {};

    return {
      firstName: root.getAttribute("data-first-name") || "",
      lastName: root.getAttribute("data-last-name") || "",
    };
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function stateSelect(ui, label, value, required) {
    var select = ui.el("select", { class: "sp-select" }, []);

    if (required) {
      select.setAttribute("required", "required");
      select.setAttribute("aria-required", "true");
    }

    var states = [
      ["AL", "Alabama"],
      ["AK", "Alaska"],
      ["AZ", "Arizona"],
      ["AR", "Arkansas"],
      ["CA", "California"],
      ["CO", "Colorado"],
      ["CT", "Connecticut"],
      ["DE", "Delaware"],
      ["FL", "Florida"],
      ["GA", "Georgia"],
      ["HI", "Hawaii"],
      ["ID", "Idaho"],
      ["IL", "Illinois"],
      ["IN", "Indiana"],
      ["IA", "Iowa"],
      ["KS", "Kansas"],
      ["KY", "Kentucky"],
      ["LA", "Louisiana"],
      ["ME", "Maine"],
      ["MD", "Maryland"],
      ["MA", "Massachusetts"],
      ["MI", "Michigan"],
      ["MN", "Minnesota"],
      ["MS", "Mississippi"],
      ["MO", "Missouri"],
      ["MT", "Montana"],
      ["NE", "Nebraska"],
      ["NV", "Nevada"],
      ["NH", "New Hampshire"],
      ["NJ", "New Jersey"],
      ["NM", "New Mexico"],
      ["NY", "New York"],
      ["NC", "North Carolina"],
      ["ND", "North Dakota"],
      ["OH", "Ohio"],
      ["OK", "Oklahoma"],
      ["OR", "Oregon"],
      ["PA", "Pennsylvania"],
      ["PR", "Puerto Rico"],
      ["RI", "Rhode Island"],
      ["SC", "South Carolina"],
      ["SD", "South Dakota"],
      ["TN", "Tennessee"],
      ["TX", "Texas"],
      ["UT", "Utah"],
      ["VT", "Vermont"],
      ["VA", "Virginia"],
      ["WA", "Washington"],
      ["WV", "West Virginia"],
      ["WI", "Wisconsin"],
      ["WY", "Wyoming"],
    ];

    // Placeholder option
    select.appendChild(ui.el("option", { value: "" }, ["Select a state"]));

    for (var i = 0; i < states.length; i++) {
      var code = states[i][0];
      var name = states[i][1];
      select.appendChild(ui.el("option", { value: code }, [name]));
    }

    var v = String(value || "").trim().toUpperCase();
    if (v) select.value = v;

    var wrap = ui.el("label", { class: "sp-field" }, [
      ui.el("div", { class: "sp-field__label" }, [label + (required ? " *" : "")]),
      select,
    ]);

    return { wrap: wrap, input: select };
  }

  function openModal(ui, opts) {
    opts = opts || {};
    var onClose = typeof opts.onClose === "function" ? opts.onClose : function () {};

    var overlay = ui.el("div", { class: "sp-modal" }, []);
    var card = ui.el("div", { class: "sp-modal__card" }, []);
    overlay.appendChild(card);

    var title = ui.el("div", { class: "sp-modal__title" }, ["Change shipping address"]);
    var body = ui.el("div", { class: "sp-modal__body" }, []);
    var footer = ui.el("div", { class: "sp-modal__footer" }, []);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(footer);

    function close() {
      try {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch (e) {}

      // remove body class
      try {
        document.body.classList.remove("sp-modal-open");
      } catch (e) {}

      onClose();
    }

    overlay.addEventListener("click", function (e) {
      if (e && e.target === overlay) close();
    });

    // add body class
    try {
      document.body.classList.add("sp-modal-open");
    } catch (e) {}

    document.body.appendChild(overlay);

    return { overlay: overlay, card: card, body: body, footer: footer, close: close };
  }

  function field(ui, label, placeholder, value, required, autocomplete) {
    var attrs = {
      class: "sp-input",
      type: "text",
      placeholder: placeholder || "",
      value: value || "",
    };

    if (autocomplete) {
      attrs.autocomplete = autocomplete;
    }

    if (required) {
      attrs.required = true;
      attrs["aria-required"] = "true";
    }

    var input = ui.el("input", attrs);

    var wrap = ui.el("label", { class: "sp-field" }, [
      ui.el("div", { class: "sp-field__label" }, [label + (required ? " *" : "")]),
      input,
    ]);

    return { wrap: wrap, input: input };
  }

  // ---------------------------------------------------------------------------
  // Action: Change Shipping Address
  // - Opens modal
  // - Validates required fields
  // - POSTs to portal route "address"
  // - Saves recent address in sessionStorage
  // - Shows toast feedback
  // ---------------------------------------------------------------------------

  window.__SP.actions.changeShippingAddress = async function changeShippingAddress(ui, contractGid, initial, defaults) {
    var busy = window.__SP.actions && window.__SP.actions.busy;
    if (!busy) throw new Error("busy_not_loaded");

    initial = initial || {};
    defaults = defaults || {};

    var modal = openModal(ui, {});
    var errBox = ui.el("div", { class: "sp-alert sp-alert--error", style: "display:none;" }, [
      ui.el("div", { class: "sp-alert__title" }, ["Check your address"]),
      ui.el("div", { class: "sp-alert__body sp-muted" }, [""]),
    ]);
    modal.body.appendChild(errBox);

    var customer = getCustomerFromRoot();

    var fFirst = field(ui, "First name", "John", customer.firstName || "", true, "given-name");
    var fLast = field(ui, "Last name", "Doe", customer.lastName || "", true, "family-name");

    var f1 = field(ui, "Street address", "123 Main St", initial.address1 || "", true, "address-line1");
    var f2 = field(ui, "Apt / Ste (optional)", "Apt 4B", initial.address2 || "", false, "address-line2");

    var fCity = field(ui, "City", "Austin", initial.city || "", true, "address-level2");

    var fState = stateSelect(ui, "State", initial.provinceCode || "", true);
    try {
      fState.input.autocomplete = "address-level1";
    } catch (e) {}

    var fZip = field(ui, "Zip", "78701", initial.zip || "", true, "postal-code");

    modal.body.appendChild(fFirst.wrap);
    modal.body.appendChild(fLast.wrap);
    modal.body.appendChild(f1.wrap);
    modal.body.appendChild(f2.wrap);
    modal.body.appendChild(fCity.wrap);
    modal.body.appendChild(fState.wrap);
    modal.body.appendChild(fZip.wrap);

    var btnCancel = ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost" }, ["Cancel"]);
    var btnSave = ui.el("button", { type: "button", class: "sp-btn" }, ["Save"]);

    // Save on left, cancel on right
    modal.footer.appendChild(btnSave);
    modal.footer.appendChild(btnCancel);

    btnCancel.addEventListener("click", modal.close);

    function showError(msg) {
      try {
        errBox.style.display = "";
        errBox.querySelector(".sp-alert__body").textContent =
          msg || "Please check the fields and try again.";
      } catch (e) {}
    }

    btnSave.addEventListener("click", function () {
      var address1 = requiredTrim(f1.input.value);
      var address2 = requiredTrim(f2.input.value);
      var city = requiredTrim(fCity.input.value);
      var provinceCode = requiredTrim(fState.input.value);
      var zip = requiredTrim(fZip.input.value);
      var firstName = requiredTrim(fFirst.input.value);
      var lastName = requiredTrim(fLast.input.value);

      if (!firstName) return showError("First name is required.");
      if (!lastName) return showError("Last name is required.");
      if (!address1) return showError("Street address is required.");
      if (!city) return showError("City is required.");
      if (!provinceCode) return showError("State is required.");
      if (!zip) return showError("Zip is required.");

      // IMPORTANT: return the promise so errors/success are not swallowed
      return busy.withBusy(
        ui,
        async function () {
          try {
            console.log("[changeShippingAddress] starting save");

            // sanity toast before network (you can remove later)
            try {
              busy.showToast(ui, "Saving address…", "info");
            } catch (e) {}

            var contractId = Number(shortId(contractGid));

            var payload = {
              contractId: contractId,
              firstName: firstName,
              lastName: lastName,
              address1: address1,
              address2: address2,
              city: city,
              provinceCode: provinceCode,
              zip: zip,
              countryCode: defaults.countryCode || "US",
              country: defaults.country || "United States",
              methodType: defaults.methodType || "Economy",
            };

            console.log("[changeShippingAddress] payload", payload);

            var resp = await window.__SP.api.postJson("address", payload);

            console.log("[changeShippingAddress] resp", resp);

            if (!resp || resp.ok === false) {
              throw new Error((resp && resp.error) ? resp.error : "address_update_failed");
            }

            try {
              if (window.__SP.api && typeof window.__SP.api.clearCaches === "function") {
                window.__SP.api.clearCaches();
              }
            } catch (e) {}

            // Persist + toast
            saveRecentAddress(contractGid, payload);

            var nice = formatAddressLine(payload);
            console.log("[changeShippingAddress] success, toast next");
            busy.showToast(ui, "Shipping address updated to: " + nice, "success");

            modal.close();

            try {
              window.__SP.screens.subscriptionDetail.render();
            } catch (e) {}

            return { ok: true, payload: payload, resp: resp };
          } catch (e) {
            console.warn("[changeShippingAddress] failed", e);
            showError("We couldn’t update that address. Please double-check it and try again.");
            try {
              busy.showToast(ui, "Sorry — we couldn’t update that address.", "error");
            } catch (_) {}
            return { ok: false, error: String(e && e.message ? e.message : e) };
          }
        },
        "Updating your shipping address…"
      );
    });

    try {
      f1.input.focus();
    } catch (e) {}
  };
})();