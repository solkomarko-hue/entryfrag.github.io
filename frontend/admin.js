(() => {
  const adminAccessKey = "entryfrag-admin-access";
  const adminAuthKey = "entryfrag-admin-auth";
  const logoutButton = document.getElementById("adminLogoutPage");
  const statusNode = document.getElementById("adminStatus");
  const viewSwitch = document.getElementById("viewSwitch");
  const syncOrdersButton = document.getElementById("syncOrdersButton");
  const selectedPeriodLabel = document.getElementById("selectedPeriodLabel");
  const selectedRevenueValue = document.getElementById("selectedRevenueValue");
  const selectedRevenueCopy = document.getElementById("selectedRevenueCopy");
  const selectedOrderCount = document.getElementById("selectedOrderCount");
  const selectedAverageValue = document.getElementById("selectedAverageValue");
  const totalRevenueValue = document.getElementById("totalRevenueValue");
  const earningsGraph = document.getElementById("earningsGraph");
  const earningsGraphNote = document.getElementById("earningsGraphNote");
  const revenueBreakdown = document.getElementById("revenueBreakdown");
  const revenueBreakdownNote = document.getElementById("revenueBreakdownNote");
  const topItemsList = document.getElementById("topItemsList");
  const ordersRecord = document.getElementById("ordersRecord");
  const viewButtons = [...document.querySelectorAll("[data-view]")];

  const apiBaseUrl = (window.ENTRYFRAG_API_URL || "").trim().replace(/\/$/, "");
  const orderHistoryUrl = apiBaseUrl ? `${apiBaseUrl}/api/orders` : "/api/orders";
  const locale = "uk-UA";
  let currentView = "day";
  let allOrders = [];
  let isSyncing = false;

  const clearAdminAccess = () => {
    try {
      sessionStorage.removeItem(adminAccessKey);
      sessionStorage.removeItem(adminAuthKey);
    } catch {}
  };

  const redirectHome = () => {
    window.location.replace("./index.html");
  };

  const setStatus = (text, tone = "") => {
    statusNode.textContent = text;
    statusNode.classList.remove("is-error", "is-success");
    if (tone) statusNode.classList.add(`is-${tone}`);
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

  const readSession = () => {
    try {
      return {
        hasAccess: sessionStorage.getItem(adminAccessKey) === "granted",
        authHeader: sessionStorage.getItem(adminAuthKey) || ""
      };
    } catch {
      return { hasAccess: false, authHeader: "" };
    }
  };

  const money = (value) => new Intl.NumberFormat(locale).format(Math.round(value || 0)) + " ₴";
  const formatOrderDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  const getPeriodKey = (date, view) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (view === "year") return String(year);
    if (view === "month") return `${year}-${month}`;
    return `${year}-${month}-${day}`;
  };

  const getPeriodStart = (date, view) => {
    if (view === "year") return new Date(date.getFullYear(), 0, 1).getTime();
    if (view === "month") return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };

  const formatPeriodLabel = (date, view) => {
    if (view === "year") return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
    if (view === "month") return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
  };

  const getSelectedPeriodHeading = (view) => {
    if (view === "year") return "This year";
    if (view === "month") return "This month";
    return "Today";
  };

  const getSelectedPeriodCopy = (view, count) => {
    if (view === "year") return `Revenue for the current year from ${count} order${count === 1 ? "" : "s"}.`;
    if (view === "month") return `Revenue for the current month from ${count} order${count === 1 ? "" : "s"}.`;
    return `Revenue for today from ${count} order${count === 1 ? "" : "s"}.`;
  };
  const getGraphNote = (view) => {
    if (view === "year") return "Year-by-year revenue trend";
    if (view === "month") return "Month-by-month revenue trend";
    return "Day-by-day revenue trend";
  };

  const buildRevenueGroups = (orders, view) => {
    const groups = new Map();

    orders.forEach((order) => {
      const date = new Date(order.receivedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = getPeriodKey(date, view);
      const existing = groups.get(key) || {
        key,
        label: formatPeriodLabel(date, view),
        total: 0,
        count: 0,
        start: getPeriodStart(date, view)
      };
      existing.total += Number(order.total || 0);
      existing.count += 1;
      groups.set(key, existing);
    });

    return [...groups.values()].sort((a, b) => b.start - a.start);
  };

  const renderRevenueSummary = (orders, view) => {
    const now = new Date();
    const currentKey = getPeriodKey(now, view);
    const currentOrders = orders.filter((order) => {
      const date = new Date(order.receivedAt);
      return !Number.isNaN(date.getTime()) && getPeriodKey(date, view) === currentKey;
    });

    const currentRevenue = currentOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrder = currentOrders.length ? currentRevenue / currentOrders.length : 0;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    selectedPeriodLabel.textContent = getSelectedPeriodHeading(view);
    selectedRevenueValue.textContent = money(currentRevenue);
    selectedRevenueCopy.textContent = getSelectedPeriodCopy(view, currentOrders.length);
    selectedOrderCount.textContent = String(currentOrders.length);
    selectedAverageValue.textContent = money(averageOrder);
    totalRevenueValue.textContent = money(totalRevenue);
  };

  const renderRevenueBreakdown = (orders, view) => {
    const groups = buildRevenueGroups(orders, view);
    revenueBreakdownNote.textContent = groups.length ? "Latest periods first" : "No saved order data yet";

    if (!groups.length) {
      revenueBreakdown.innerHTML = '<div class="empty-state">No revenue data yet. Orders will appear here after customers place them.</div>';
      return;
    }

    const maxValue = Math.max(...groups.map((group) => group.total), 1);
    revenueBreakdown.innerHTML = groups.slice(0, 12).map((group) => `
      <article class="breakdown-item">
        <div class="breakdown-item-head">
          <div>
            <strong>${group.label}</strong>
            <span>${group.count} order${group.count === 1 ? "" : "s"}</span>
          </div>
          <strong>${money(group.total)}</strong>
        </div>
        <div class="breakdown-bar" aria-hidden="true">
          <div class="breakdown-bar-fill" style="width:${Math.max((group.total / maxValue) * 100, 6)}%"></div>
        </div>
      </article>
    `).join("");
  };

  const renderEarningsGraph = (orders, view) => {
    const groups = buildRevenueGroups(orders, view).slice(0, 8).reverse();
    earningsGraphNote.textContent = groups.length ? getGraphNote(view) : "No saved order data yet";

    if (!groups.length) {
      earningsGraph.innerHTML = '<div class="graph-empty">No earnings graph yet. Once orders exist, the revenue trend will appear here.</div>';
      return;
    }

    const width = 760;
    const height = 260;
    const padding = { top: 24, right: 16, bottom: 54, left: 24 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...groups.map((group) => group.total), 1);
    const stepX = groups.length > 1 ? innerWidth / (groups.length - 1) : 0;

    const points = groups.map((group, index) => {
      const x = padding.left + (groups.length === 1 ? innerWidth / 2 : stepX * index);
      const y = padding.top + innerHeight - ((group.total / maxValue) * innerHeight);
      return { ...group, x, y };
    });

    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} L ${points[0].x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} Z`;

    earningsGraph.innerHTML = `
      <svg class="graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Earnings graph">
        <line class="graph-axis" x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}"></line>
        <path class="graph-area" d="${areaPath}"></path>
        <path class="graph-line" d="${linePath}"></path>
        ${points.map((point) => `
          <circle class="graph-point" cx="${point.x}" cy="${point.y}" r="5"></circle>
          <text class="graph-value" x="${point.x}" y="${Math.max(point.y - 12, 14)}" text-anchor="middle">${escapeHtml(money(point.total))}</text>
          <text class="graph-label" x="${point.x}" y="${height - 18}" text-anchor="middle">${escapeHtml(point.label)}</text>
        `).join("")}
      </svg>
    `;
  };

  const renderTopItems = (orders) => {
    const itemMap = new Map();

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = String(item.name || "Unknown item");
        const existing = itemMap.get(key) || { name: key, qty: 0, revenue: 0 };
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        existing.qty += qty;
        existing.revenue += qty * unitPrice;
        itemMap.set(key, existing);
      });
    });

    const items = [...itemMap.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name));
    if (!items.length) {
      topItemsList.innerHTML = '<div class="empty-state">No sold items yet. The best-sellers list will fill automatically from saved orders.</div>';
      return;
    }

    topItemsList.innerHTML = items.slice(0, 8).map((item, index) => `
      <article class="top-item">
        <div class="top-item-head">
          <div>
            <strong>#${index + 1} ${escapeHtml(item.name)}</strong>
            <span>Most sold item ranking</span>
          </div>
          <strong>${item.qty}</strong>
        </div>
        <div class="top-item-stats">
          <span>Units sold: ${item.qty}</span>
          <span>Revenue: ${money(item.revenue)}</span>
        </div>
      </article>
    `).join("");
  };

  const renderOrders = (orders) => {
    if (!orders.length) {
      ordersRecord.innerHTML = '<div class="empty-state">No orders saved yet. Once customers place orders, every record will appear here.</div>';
      return;
    }

    ordersRecord.innerHTML = orders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsMarkup = items.length
        ? `<ul>${items.map((item) => `<li>${escapeHtml(item.name || "Item")} | Size: ${escapeHtml(item.size || "-")}${item.option ? ` | ${escapeHtml(item.option)}` : ""} | Qty: ${Number(item.qty || 0)} | ${money(Number(item.unitPrice || 0) * Number(item.qty || 0))}</li>`).join("")}</ul>`
        : "<div class=\"empty-state\">No item details saved for this order.</div>";

      return `
        <article class="order-card">
          <div class="order-card-head">
            <div>
              <strong>${escapeHtml(order.orderNumber || "ENTRYFRAG")}</strong>
              <small>${formatOrderDate(order.receivedAt)}</small>
            </div>
            <div class="order-card-head-actions">
              <strong>${money(Number(order.total || 0))}</strong>
              <button class="order-delete" type="button" data-delete-order="${escapeHtml(order.orderNumber || "")}">Delete</button>
            </div>
          </div>
          <div class="order-card-meta">
            <span class="order-chip">${escapeHtml(order.customerName || "Customer")}</span>
            <span class="order-chip">${escapeHtml(order.phone || "No phone")}</span>
            <span class="order-chip">${escapeHtml(order.city || "No city")}</span>
            <span class="order-chip">${escapeHtml(order.branch || "No branch")}</span>
            <span class="order-chip">${escapeHtml(order.paymentOptionLabel || order.paymentOption || "Payment not set")}</span>
            <span class="order-chip">Promo: ${escapeHtml(order.promo || "none")}</span>
          </div>
          <div class="order-card-items">
            <strong>Items</strong>
            ${itemsMarkup}
          </div>
        </article>
      `;
    }).join("");
  };

  const renderDashboard = () => {
    renderRevenueSummary(allOrders, currentView);
    renderEarningsGraph(allOrders, currentView);
    renderRevenueBreakdown(allOrders, currentView);
    renderTopItems(allOrders);
    renderOrders(allOrders);
  };

  const setActiveView = (view) => {
    currentView = view;
    viewButtons.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderRevenueSummary(allOrders, currentView);
    renderEarningsGraph(allOrders, currentView);
    renderRevenueBreakdown(allOrders, currentView);
  };

  const fetchOrders = async (authHeader) => {
    const response = await fetch(orderHistoryUrl, {
      headers: { Authorization: authHeader }
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      if (response.status === 401) throw new Error("admin_auth_required");
      throw new Error(payload?.error || "admin_orders_failed");
    }

    return Array.isArray(payload.orders) ? payload.orders : [];
  };

  const deleteOrder = async (authHeader, orderNumber) => {
    const response = await fetch(`${orderHistoryUrl}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify({ orderNumber })
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      if (response.status === 401) throw new Error("admin_auth_required");
      throw new Error(payload?.error || "admin_delete_failed");
    }

    return payload;
  };

  const initializeDashboard = async ({ manual = false } = {}) => {
    if (isSyncing) return;
    const session = readSession();
    if (!session.hasAccess || !session.authHeader) {
      redirectHome();
      return;
    }

    isSyncing = true;
    if (syncOrdersButton) {
      syncOrdersButton.disabled = true;
      syncOrdersButton.textContent = manual ? "Syncing..." : "Sync orders";
    }
    setStatus(manual ? "Synchronizing all saved orders..." : "Loading admin dashboard...");

    try {
      const orders = await fetchOrders(session.authHeader);
      allOrders = orders.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      renderDashboard();
      setStatus(`Dashboard synchronized from ${allOrders.length} saved order${allOrders.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      clearAdminAccess();
      if (String(error.message).includes("admin_auth_required")) {
        redirectHome();
        return;
      }
      setStatus("Could not load order data for the admin dashboard.", "error");
    } finally {
      isSyncing = false;
      if (syncOrdersButton) {
        syncOrdersButton.disabled = false;
        syncOrdersButton.textContent = "Sync orders";
      }
    }
  };

  logoutButton?.addEventListener("click", () => {
    clearAdminAccess();
    redirectHome();
  });

  viewSwitch?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    setActiveView(button.dataset.view);
  });

  syncOrdersButton?.addEventListener("click", () => {
    initializeDashboard({ manual: true });
  });

  ordersRecord?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-order]");
    if (!button) return;

    const orderNumber = button.dataset.deleteOrder;
    if (!orderNumber) return;

    const session = readSession();
    if (!session.hasAccess || !session.authHeader) {
      redirectHome();
      return;
    }

    const confirmed = window.confirm(`Delete order ${orderNumber}? This cannot be undone.`);
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting...";
    setStatus(`Deleting order ${orderNumber}...`);

    try {
      await deleteOrder(session.authHeader, orderNumber);
      allOrders = allOrders.filter((order) => String(order.orderNumber || "") !== String(orderNumber));
      renderDashboard();
      setStatus(`Order ${orderNumber} deleted.`, "success");
    } catch (error) {
      if (String(error.message).includes("admin_auth_required")) {
        clearAdminAccess();
        redirectHome();
        return;
      }
      setStatus(`Could not delete order ${orderNumber}.`, "error");
      button.disabled = false;
      button.textContent = "Delete";
    }
  });

  window.addEventListener("pageshow", () => {
    const session = readSession();
    if (!session.hasAccess || !session.authHeader) redirectHome();
  });

  initializeDashboard();
})();
