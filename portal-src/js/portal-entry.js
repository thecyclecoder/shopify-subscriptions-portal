// src/portal-entry.js
// Bundler entrypoint: imports must run in-order so globals are registered.

import "./core/utils.js";
import "./core/ui.js";
import "./core/api.js";

// Cards (registered onto window.__SP.cards)
import "./cards/shipping-protection.js";
import "./cards/pause.js";
import "./cards/resume.js";
import "./cards/address.js";
import "./cards/coupon.js";
import "./cards/rewards.js";
import "./cards/frequency.js";
import "./cards/items.js";
import "./cards/addons.js";
import "./cards/reviews.js";
import "./cards/cancel.js";

// Modals (registered onto window.__SP.modals)
import "./modals/add-swap.js"

// Actions (registered onto window.__SP.actions)
import "./actions/busy.js";
import "./actions/pause.js";
import "./actions/resume.js";
import "./actions/change-shipping-address.js";
import "./actions/toggle-shipping-protection.js";
import "./actions/coupon.js";
import "./actions/frequency.js";

// Screens (registered onto window.__SP.screens)
import "./screens/home.js";
import "./screens/subscriptions.js";
import "./screens/subscription-detail.js";
import "./screens/router.js";