    const cart = new Map();
    const products = new Map();
    const body = document.body;
    try {
      localStorage.removeItem("entryfrag-current-account");
      localStorage.removeItem("entryfrag-users");
      Object.keys(localStorage)
        .filter((key) => key.startsWith("entryfrag-orders-"))
        .forEach((key) => localStorage.removeItem(key));
    } catch {}
    const cartBtn = document.getElementById("cartBtn");
    const menuToggle = document.getElementById("menuToggle");
    const headerPanel = document.getElementById("headerPanel");
    const siteNav = headerPanel.querySelector(".site-nav");
    const headerPanelTop = document.createElement("div");
    headerPanelTop.className = "header-panel-top";
    const menuSearch = document.createElement("form");
    menuSearch.className = "menu-search";
    menuSearch.id = "menuSearch";
    menuSearch.setAttribute("role", "search");
    const menuSearchLabel = document.createElement("label");
    menuSearchLabel.className = "visually-hidden";
    menuSearchLabel.htmlFor = "menuSearchInput";
    menuSearchLabel.textContent = "Search products";
    const menuSearchInput = document.createElement("input");
    menuSearchInput.id = "menuSearchInput";
    menuSearchInput.type = "search";
    menuSearchInput.placeholder = "Search jerseys, zip-ups, teams";
    menuSearchInput.autocomplete = "off";
    const menuSearchClear = document.createElement("button");
    menuSearchClear.className = "menu-search-clear";
    menuSearchClear.id = "menuSearchClear";
    menuSearchClear.type = "button";
    menuSearchClear.hidden = true;
    menuSearchClear.textContent = "Clear";
    const menuSearchStatus = document.createElement("p");
    menuSearchStatus.className = "menu-search-status";
    menuSearchStatus.id = "menuSearchStatus";
    menuSearchStatus.setAttribute("aria-live", "polite");
    const menuSearchResults = document.createElement("div");
    menuSearchResults.className = "menu-search-results";
    menuSearchResults.id = "menuSearchResults";
    menuSearchResults.hidden = true;
    menuSearch.append(menuSearchLabel, menuSearchInput, menuSearchClear);
    headerPanelTop.append(menuSearch, menuSearchResults, menuSearchStatus);
    if (siteNav) headerPanel.insertBefore(headerPanelTop, siteNav);
    else headerPanel.append(headerPanelTop);
    const headerLinks = [...document.querySelectorAll(".site-nav a")];
    const desktopHeaderMedia = window.matchMedia("(min-width: 1024px)");
    const phoneHeroMedia = window.matchMedia("(max-width: 767px)");
    const closeCart = document.getElementById("closeCart");
    const overlay = document.getElementById("overlay");
    const drawer = document.getElementById("drawer");
    const cartItemsWrap = document.getElementById("cartItems");
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");
    const cartCount = document.getElementById("cartCount");
    const clearCart = document.getElementById("clearCart");
    const checkout = document.getElementById("checkout");
    const promoInput = document.getElementById("promoInput");
    const applyPromo = document.getElementById("applyPromo");
    const promoNote = document.getElementById("promoNote");
    const cartSummaryDetails = document.getElementById("cartSummaryDetails");
    const toast = document.getElementById("toast");
    const productOverlay = document.getElementById("productOverlay");
    const productModal = document.getElementById("productModal");
    const productBody = productModal.querySelector(".product-body");
    const closeProduct = document.getElementById("closeProduct");
    const productBack = document.getElementById("productBack");
    const productAddToCart = document.getElementById("productAddToCart");
    const productCategory = document.getElementById("productCategory");
    const productTitle = document.getElementById("productTitle");
    const productPrice = document.getElementById("productPrice");
    const productDescription = document.getElementById("productDescription");
    const productSizeChart = document.getElementById("productSizeChart");
    const productMainShot = document.getElementById("productMainShot");
    const productThumbs = document.getElementById("productThumbs");
    const productSizes = document.getElementById("productSizes");
    const productOptionsWrap = document.getElementById("productOptionsWrap");
    const productOptions = document.getElementById("productOptions");
    const heroLatest = document.getElementById("heroLatest");
    const heroProductCount = document.getElementById("heroProductCount");
    const teamsGrid = document.getElementById("teamsGrid");
    const sizeChartModal = document.getElementById("sizeChartModal");
    const sizeChartTitle = document.getElementById("sizeChartTitle");
    const sizeChartShot = document.getElementById("sizeChartShot");
    const closeSizeChart = document.getElementById("closeSizeChart");
    const teamModal = document.getElementById("teamModal");
    const teamModalTitle = document.getElementById("teamModalTitle");
    const teamProducts = document.getElementById("teamProducts");
    const teamModalBody = teamModal.querySelector(".team-products");
    const closeTeamModal = document.getElementById("closeTeamModal");
    const checkoutModal = document.getElementById("checkoutModal");
    const closeCheckoutModal = document.getElementById("closeCheckoutModal");
    const adminOpenButton = document.getElementById("adminOpenButton");
    const adminModal = document.getElementById("adminModal");
    const closeAdminModal = document.getElementById("closeAdminModal");
    const successModal = document.getElementById("successModal");
    const closeSuccessModal = document.getElementById("closeSuccessModal");
    const successMessage = document.getElementById("successMessage");
    const adminLoginForm = document.getElementById("adminLoginForm");
    const adminUsernameInput = document.getElementById("adminUsername");
    const adminPasswordInput = document.getElementById("adminPassword");
    const adminPasswordToggle = document.getElementById("adminPasswordToggle");
    const adminLoginButton = document.getElementById("adminLoginButton");
    const adminLoginMessage = document.getElementById("adminLoginMessage");
    const adminPanel = document.getElementById("adminPanel");
    const adminProfileName = document.getElementById("adminProfileName");
    const adminProfileStatus = document.getElementById("adminProfileStatus");
    const adminLogout = document.getElementById("adminLogout");
    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutScroll = checkoutForm.querySelector(".checkout-scroll");
    const checkoutOrderNumber = document.getElementById("checkoutOrderNumber");
    const checkoutBack = document.getElementById("checkoutBack");
    const customerName = document.getElementById("customerName");
    const customerPhone = document.getElementById("customerPhone");
    const customerTelegram = document.getElementById("customerTelegram");
    const novaPoshtaCity = document.getElementById("novaPoshtaCity");
    const novaPoshtaCityList = document.getElementById("novaPoshtaCityList");
    const novaPoshtaCityRef = document.getElementById("novaPoshtaCityRef");
    const novaPoshtaBranch = document.getElementById("novaPoshtaBranch");
    const paymentOptions = [...document.querySelectorAll('input[name="paymentOption"]')];
    const prepaymentNote = document.getElementById("prepaymentNote");
    const confirmOrderDetails = document.getElementById("confirmOrderDetails");

    const defaultSizes = ["S", "M", "L"];
    const promoDiscountPercent = 0.05;
    const optionPriceDelta = 100;
    const featuredLatestProductIds = [
      "fut-black-jersey",
      "fut-black-grey-jersey",
      "g2-red-jersey",
      "g2-green-jersey",
      "furia-black-blue-jersey",
      "furia-black-white-jersey",
      "vitality-black-white-jersey",
      "vitality-yellow-jersey",
      "team-vitality-jersey"
    ];
    let activeProductId = null;
    let activeProductImage = 0;
    let previousHash = "#home";
    let promoApplied = false;
    let currentOrderNumber = "";
    let cachedCities = [];
    const sortableSectionIds = new Set(["jerseys", "zipups", "pants"]);
    const surfaceRootIds = new Set(["overlay", "drawer", "productOverlay", "productModal", "sizeChartModal", "teamModal", "checkoutModal", "adminModal", "successModal", "toast"]);
    const backgroundRoots = [...body.children].filter((node) => node instanceof HTMLElement && !surfaceRootIds.has(node.id) && node.tagName !== "SCRIPT");
    const surfaceReturnFocus = new Map();
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lockedScrollY = 0;
    const catalogSections = new Map();
    const sortableSections = new Map();

    const isVisibleElement = (element) => element instanceof HTMLElement
      && !element.hidden
      && window.getComputedStyle(element).display !== "none"
      && window.getComputedStyle(element).visibility !== "hidden";
    const getFocusableElements = (root) => root ? [...root.querySelectorAll(focusableSelector)].filter(isVisibleElement) : [];
    const rememberSurfaceFocus = (name, fallback = document.activeElement) => {
      if (fallback instanceof HTMLElement) surfaceReturnFocus.set(name, fallback);
      else surfaceReturnFocus.delete(name);
    };
    const focusSurface = (root, preferred) => {
      requestAnimationFrame(() => {
        const candidates = [preferred, ...getFocusableElements(root), root];
        const target = candidates.find((candidate) => candidate instanceof HTMLElement && (candidate === root || isVisibleElement(candidate)));
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
      });
    };
    const lockBodyScroll = () => {
      if (body.classList.contains("scroll-locked")) return;
      lockedScrollY = window.scrollY;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.top = `-${lockedScrollY}px`;
      body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
      body.classList.add("scroll-locked");
    };
    const unlockBodyScroll = () => {
      if (!body.classList.contains("scroll-locked")) return;
      body.classList.remove("scroll-locked");
      body.style.top = "";
      body.style.paddingRight = "";
      window.scrollTo(0, lockedScrollY);
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    };
    const setBackgroundInteractivity = (isBlocked) => {
      backgroundRoots.forEach((node) => {
        if ("inert" in node) node.inert = isBlocked;
        if (isBlocked) node.setAttribute("aria-hidden", "true");
        else node.removeAttribute("aria-hidden");
      });
    };
    const getActiveSurface = () => {
      if (body.classList.contains("success-open")) return { key: "success", root: successModal, focusTarget: closeSuccessModal };
      if (body.classList.contains("admin-open")) return { key: "admin", root: adminModal, focusTarget: closeAdminModal };
      if (body.classList.contains("sizechart-open")) return { key: "sizechart", root: sizeChartModal, focusTarget: closeSizeChart };
      if (body.classList.contains("checkout-open")) return { key: "checkout", root: checkoutModal, focusTarget: closeCheckoutModal };
      if (body.classList.contains("team-open")) return { key: "team", root: teamModal, focusTarget: closeTeamModal };
      if (body.classList.contains("product-open")) return { key: "product", root: productModal, focusTarget: closeProduct };
      if (body.classList.contains("cart-open")) return { key: "cart", root: drawer, focusTarget: closeCart };
      return null;
    };
    const restoreSurfaceFocus = (name) => {
      const target = surfaceReturnFocus.get(name);
      surfaceReturnFocus.delete(name);
      if (target instanceof HTMLElement && target.isConnected && !target.hasAttribute("disabled") && isVisibleElement(target)) {
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
        return;
      }
      const activeSurface = getActiveSurface();
      if (activeSurface) focusSurface(activeSurface.root, activeSurface.focusTarget);
    };
    const syncSurfaceState = () => {
      const cartOpen = body.classList.contains("cart-open");
      const productSurfaceOpen = ["product-open", "sizechart-open", "team-open", "checkout-open", "admin-open", "success-open"].some((surfaceClass) => body.classList.contains(surfaceClass));
      overlay.setAttribute("aria-hidden", String(!cartOpen));
      productOverlay.setAttribute("aria-hidden", String(!productSurfaceOpen));
      drawer.setAttribute("aria-hidden", String(!cartOpen));
      productModal.setAttribute("aria-hidden", String(!body.classList.contains("product-open")));
      sizeChartModal.setAttribute("aria-hidden", String(!body.classList.contains("sizechart-open")));
      teamModal.setAttribute("aria-hidden", String(!body.classList.contains("team-open")));
      checkoutModal.setAttribute("aria-hidden", String(!body.classList.contains("checkout-open")));
      adminModal.setAttribute("aria-hidden", String(!body.classList.contains("admin-open")));
      successModal.setAttribute("aria-hidden", String(!body.classList.contains("success-open")));
      const hasActiveSurface = cartOpen || productSurfaceOpen;
      if (hasActiveSurface) lockBodyScroll();
      else unlockBodyScroll();
      setBackgroundInteractivity(hasActiveSurface);
    };
    const returnToCartFromCheckout = () => {
      hideCheckoutModal(false);
      surfaceReturnFocus.delete("checkout");
      openCart(cartBtn);
    };
    const closeActiveSurface = () => {
      const activeSurface = getActiveSurface();
      if (!activeSurface) {
        closeHeaderMenu();
        return;
      }
      if (activeSurface.key === "success") hideSuccessModal();
      else if (activeSurface.key === "admin") hideAdminModal();
      else if (activeSurface.key === "sizechart") hideSizeChart();
      else if (activeSurface.key === "checkout") {
        if (desktopHeaderMedia.matches) hideCheckoutModal();
        else returnToCartFromCheckout();
      }
      else if (activeSurface.key === "team") hideTeamModal();
      else if (activeSurface.key === "product") hideProduct();
      else if (activeSurface.key === "cart") hideCart();
    };

    [
      [drawer, "Shopping cart"],
      [productModal, "Product details"],
      [sizeChartModal, "Size chart"],
      [teamModal, "Team products"],
      [checkoutModal, "Checkout"],
      [adminModal, "Admin login"],
      [successModal, "Order status"]
    ].forEach(([root, label]) => {
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", label);
      root.tabIndex = -1;
    });

    const money = (value) => new Intl.NumberFormat("uk-UA").format(value) + " \u20B4";
    const syncHeaderMenu = () => {
      const isDesktop = desktopHeaderMedia.matches;
      const isMenuOpen = body.classList.contains("menu-open");
      headerPanel.setAttribute("aria-hidden", String(!isDesktop && !isMenuOpen));
      menuToggle.setAttribute("aria-expanded", String(!isDesktop && isMenuOpen));
      menuToggle.setAttribute("aria-label", isMenuOpen && !isDesktop ? "Close menu" : "Open menu");
    };

    const openHeaderMenu = () => {
      if (desktopHeaderMedia.matches) return;
      body.classList.add("menu-open");
      syncHeaderMenu();
    };

    const closeHeaderMenu = () => {
      body.classList.remove("menu-open");
      syncHeaderMenu();
    };

    const toggleHeaderMenu = () => {
      if (body.classList.contains("menu-open")) closeHeaderMenu();
      else openHeaderMenu();
    };

    const showToast = (text) => {
      toast.textContent = text;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
    };
    const createOrderNumber = () => {
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const random = Math.floor(1000 + Math.random() * 9000);
      return `EF-${stamp}-${random}`;
    };
    const apiBaseUrl = (window.ENTRYFRAG_API_URL || "").trim().replace(/\/$/, "");
    const isHostedSite = location.protocol.startsWith("http") && !["localhost", "127.0.0.1"].includes(location.hostname);
    const orderLoggerUrl = apiBaseUrl ? `${apiBaseUrl}/api/orders` : "/api/orders";
    const adminAccessKey = "entryfrag-admin-access";
    const adminCredentials = {
      username: "ENTRYFRAGADMIN",
      password: "efs1mpleg0at@"
    };
    const setAdminMessage = (text, tone = "") => {
      if (!adminLoginMessage) return;
      adminLoginMessage.textContent = text;
      adminLoginMessage.classList.remove("is-error", "is-success");
      if (tone === "error") adminLoginMessage.classList.add("is-error");
      if (tone === "success") adminLoginMessage.classList.add("is-success");
    };
    const setAdminLoggedIn = (loggedIn) => {
      adminLoginForm.hidden = loggedIn;
      adminPanel.hidden = !loggedIn;
    };
    const setAdminBusy = (busy) => {
      adminLoginButton.disabled = busy;
      adminUsernameInput.disabled = busy;
      adminPasswordInput.disabled = busy;
      adminLogout.disabled = busy;
      adminLoginButton.textContent = busy ? "Checking..." : "Open admin profile";
    };
    const resetAdminAccess = () => {
      try {
        sessionStorage.removeItem(adminAccessKey);
      } catch {}
      setAdminLoggedIn(false);
      adminLoginForm.reset();
      adminUsernameInput.value = "";
      adminPasswordInput.value = "";
      adminPasswordInput.type = "password";
      adminPasswordToggle.setAttribute("aria-label", "Show password");
      adminPasswordToggle.setAttribute("aria-pressed", "false");
      adminPasswordToggle.innerHTML = "&#128065;";
    };
    const tryAdminLogin = async (username, password) => {
      setAdminBusy(true);
      try {
        if (username !== adminCredentials.username || password !== adminCredentials.password) {
          resetAdminAccess();
          setAdminMessage("Wrong admin name or password.", "error");
          return false;
        }
        try {
          sessionStorage.setItem(adminAccessKey, "granted");
        } catch {}
        setAdminMessage("Opening admin page...", "success");
        window.location.assign("./admin.html");
        return true;
      } finally {
        setAdminBusy(false);
      }
    };
    const handleAdminLogin = async () => {
      const username = adminUsernameInput.value.trim();
      const password = adminPasswordInput.value;
      if (!username || !password) {
        setAdminMessage("Enter admin name and password.", "error");
        return;
      }
      setAdminMessage("Checking admin access...");
      await tryAdminLogin(username, password);
    };
    const submitOrderToServer = async (orderPayload, telegramPayload) => {
      if (isHostedSite && !apiBaseUrl) {
        throw new Error("backend_not_configured");
      }
      const response = await fetch(orderLoggerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderPayload,
          telegram: telegramPayload
        })
      });
      let result = {};
      try {
        result = await response.json();
      } catch {}
      if (!response.ok) {
        let message = "Failed to submit order";
        if (result?.error) message = result.error;
        throw new Error(message);
      }
      return result;
    };
    const novaPoshtaRequest = async (calledMethod, methodProperties = {}) => {
      const response = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "",
          modelName: "Address",
          calledMethod,
          methodProperties
        })
      });
      if (!response.ok) throw new Error("Nova Poshta request failed");
      const result = await response.json();
      if (!result.success) throw new Error("Nova Poshta API returned error");
      return result.data || [];
    };
    const fillCityOptions = (cities) => {
      novaPoshtaCityList.innerHTML = cities.map((city) => `<option value="${city.Description}"></option>`).join("");
    };
    const fillBranchOptions = (branches) => {
      novaPoshtaBranch.disabled = false;
      novaPoshtaBranch.innerHTML = `<option value="">\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0432\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u043D\u044F</option>${branches.map((branch) => `<option value="${branch.Description}">${branch.Description}</option>`).join("")}`;
    };
    const resetBranches = (placeholder = "\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u043E\u0431\u0435\u0440\u0456\u0442\u044C \u043C\u0456\u0441\u0442\u043E") => {
      novaPoshtaBranch.disabled = true;
      novaPoshtaBranch.innerHTML = `<option value="">${placeholder}</option>`;
    };
    const loadNovaPoshtaCities = async () => {
      if (cachedCities.length) return;
      novaPoshtaCity.placeholder = "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F \u043C\u0456\u0441\u0442...";
      try {
        const cities = await novaPoshtaRequest("getCities");
        cachedCities = cities
          .map((city) => ({ Ref: city.Ref, Description: city.Description }))
          .filter((city) => city.Ref && city.Description)
          .sort((a, b) => a.Description.localeCompare(b.Description, "uk"));
        fillCityOptions(cachedCities);
        novaPoshtaCity.placeholder = "\u041F\u043E\u0447\u043D\u0456\u0442\u044C \u0432\u0432\u043E\u0434\u0438\u0442\u0438 \u043C\u0456\u0441\u0442\u043E";
      } catch (error) {
        novaPoshtaCity.placeholder = "\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u043C\u0456\u0441\u0442\u0430";
        showToast("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u043C\u0456\u0441\u0442\u0430 \u041D\u043E\u0432\u043E\u0457 \u043F\u043E\u0448\u0442\u0438");
      }
    };
    const loadNovaPoshtaBranches = async (cityRef) => {
      if (!cityRef) {
        resetBranches();
        return;
      }
      resetBranches("\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F \u0432\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u044C...");
      try {
        const branches = await novaPoshtaRequest("getWarehouses", { CityRef: cityRef });
        const validBranches = branches.filter((branch) => branch.Description);
        if (!validBranches.length) {
          resetBranches("\u0412\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u043D\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0456");
          return;
        }
        fillBranchOptions(validBranches);
      } catch (error) {
        resetBranches("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0432\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u043D\u044F");
        showToast("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0432\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u043D\u044F \u041D\u043E\u0432\u043E\u0457 \u043F\u043E\u0448\u0442\u0438");
      }
    };

    const lastOrderKey = "entryfrag-last-order";
    const saveLastOrder = () => {
      const payload = {
        customerName: customerName.value,
        customerPhone: customerPhone.value,
        customerTelegram: customerTelegram.value,
        city: novaPoshtaCity.value,
        branch: novaPoshtaBranch.value
      };
      localStorage.setItem(lastOrderKey, JSON.stringify(payload));
    };
    const loadLastOrder = () => {
      try {
        const raw = localStorage.getItem(lastOrderKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.customerName) customerName.value = saved.customerName;
        if (saved.customerPhone) customerPhone.value = saved.customerPhone;
        if (saved.customerTelegram) customerTelegram.value = saved.customerTelegram;
        if (saved.city) {
          novaPoshtaCity.value = saved.city;
          novaPoshtaCityRef.value = "";
          loadNovaPoshtaBranches("");
        }
        if (saved.branch) {
          novaPoshtaBranch.value = saved.branch;
        }
      } catch {
        localStorage.removeItem(lastOrderKey);
      }
    };

    const extractUrls = (text) => [...text.matchAll(/url\((['"]?)(.*?)\1\)/g)].map((match) => match[2]);
    const previewImageKey = (src) => ((src || "").split("?")[0].split("/").pop() || "").replace(/(\.(png|jpe?g|webp|gif))+$/i, "");
    const previewImageExt = (src) => ((((src || "").split("?")[0].split("/").pop() || "").match(/\.(png|jpe?g|webp|gif)$/i) || [])[1] || "jpg").toLowerCase();
    const isSizeChartAsset = (src) => /rozmir/i.test(src || "");
    const isLogoAsset = (src) => /logo/i.test(src || "");
    const normalizeSearchText = (value) => (value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const updateSearchClearVisibility = () => {
      menuSearchClear.hidden = !menuSearchInput.value.trim();
    };
    const updateSearchStatus = (query, matchCount) => {
      if (!query) {
        menuSearchStatus.textContent = "";
        delete menuSearchStatus.dataset.state;
        return;
      }
      if (!matchCount) {
        menuSearchStatus.textContent = `No matches for "${menuSearchInput.value.trim()}"`;
        menuSearchStatus.dataset.state = "empty";
        return;
      }
      menuSearchStatus.textContent = `${matchCount} result${matchCount === 1 ? "" : "s"} for "${menuSearchInput.value.trim()}"`;
      delete menuSearchStatus.dataset.state;
    };
    const isNoNameOption = (option) => {
      const normalized = normalizeSearchText(option);
      return normalized.includes("без імені")
        || normalized.includes("без имени")
        || normalized.includes("no name");
    };
    const isVisualOption = (option) => {
      const normalized = normalizeSearchText(option);
      if (!normalized) return false;
      const colorWords = [
        "чорна",
        "біла",
        "біла-чорна",
        "біло-чорна",
        "чорно-біла",
        "black",
        "white",
        "grey",
        "gray",
        "blue",
        "red",
        "green",
        "yellow"
      ];
      return colorWords.includes(normalized)
        || normalized.startsWith("фото ")
        || normalized.startsWith("photo ");
    };
    const getOptionSurcharge = (option = "") => {
      if (!option || isNoNameOption(option) || isVisualOption(option)) return 0;
      return optionPriceDelta;
    };
    const getProductPrice = (product, option = "") => (product?.price || 0) + getOptionSurcharge(option);
    const renderSearchResults = (query, matches) => {
      if (!query) {
        menuSearchResults.hidden = true;
        menuSearchResults.innerHTML = "";
        return;
      }

      if (!matches.length) {
        menuSearchResults.hidden = false;
        menuSearchResults.innerHTML = `<div class="menu-search-empty">No matching items found.</div>`;
        return;
      }

      menuSearchResults.hidden = false;
      menuSearchResults.innerHTML = matches.slice(0, 6).map((entry) => {
        const product = products.get(entry.productId);
        if (!product) return "";
        const previewImage = resolveCatalogImage(product.images[0] || "image.png.png");
        return `
          <button class="menu-search-result" data-product-id="${product.id}" type="button">
            <img class="menu-search-thumb" src="${previewImage}" alt="" loading="lazy" decoding="async">
            <span class="menu-search-copy">
              <strong>${product.name}</strong>
              <span>${product.category} вЂў ${money(product.price)}</span>
            </span>
          </button>
        `;
      }).join("");
    };
    const toPreviewSrc = (src) => {
      const key = previewImageKey(src);
      const ext = previewImageExt(src);
      return key ? `mobile-previews/${key}.${ext}` : src;
    };
    const resolveCatalogImage = (src) => {
      if (!src || isSizeChartAsset(src) || isLogoAsset(src)) return src;
      return toPreviewSrc(src);
    };
    const resolveDetailImage = (src) => {
      if (!src || isSizeChartAsset(src)) return src;
      return phoneHeroMedia.matches ? resolveCatalogImage(src) : src;
    };
    const applyVisualPreview = (element, src) => {
      if (!element || !src) return;
      element.style.backgroundColor = "#f4f0ea";
      element.style.backgroundImage = `linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.08)),url('${src}')`;
      element.style.backgroundPosition = "center";
      element.style.backgroundSize = "contain";
      element.style.backgroundRepeat = "no-repeat";
    };
    const applyContainedPreview = (element, src) => {
      if (!element || !src) return;
      element.style.backgroundColor = "#fbf7f2";
      element.style.backgroundImage = `url('${src}')`;
      element.style.backgroundPosition = "center";
      element.style.backgroundSize = "contain";
      element.style.backgroundRepeat = "no-repeat";
    };
    const applyCoverPreview = (element, src) => {
      if (!element || !src) return;
      element.style.backgroundImage = `url('${src}')`;
      element.style.backgroundPosition = "center";
      element.style.backgroundSize = "cover";
      element.style.backgroundRepeat = "no-repeat";
    };
    const lazyImageObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const source = element.dataset.lazyBg;
        const mode = element.dataset.lazyMode || "cover";
        if (source) {
          if (mode === "visual") applyVisualPreview(element, source);
          else if (mode === "contain") applyContainedPreview(element, source);
          else applyCoverPreview(element, source);
        }
        element.removeAttribute("data-lazy-bg");
        element.removeAttribute("data-lazy-mode");
        observer.unobserve(element);
      });
    }, { rootMargin: "320px 0px" }) : null;
    const queueDeferredBackground = (element, src, mode = "cover", eager = false) => {
      if (!element || !src) return;
      const rect = element.getBoundingClientRect();
      const isNearViewport = rect.top < (window.innerHeight + 320) && rect.bottom > -320;
      if (eager || !lazyImageObserver || isNearViewport) {
        if (mode === "visual") applyVisualPreview(element, src);
        else if (mode === "contain") applyContainedPreview(element, src);
        else applyCoverPreview(element, src);
        return;
      }
      element.dataset.lazyBg = src;
      element.dataset.lazyMode = mode;
      lazyImageObserver.observe(element);
    };
    const productCards = [];
    const clearDeferredBackground = (element) => {
      if (!element) return;
      element.style.backgroundImage = "";
      element.style.backgroundColor = "";
      element.removeAttribute("data-lazy-bg");
      element.removeAttribute("data-lazy-mode");
      if (lazyImageObserver) lazyImageObserver.unobserve(element);
    };
    const renderCardVisual = (visual, product, cardIndex = 0) => {
      if (!visual || !product?.images?.length) return;
      const eagerCardLimit = phoneHeroMedia.matches ? 2 : desktopHeaderMedia.matches ? 6 : 4;
      const useGalleryLayout = false;

      clearDeferredBackground(visual);
      visual.classList.toggle("gallery", useGalleryLayout);

      if (useGalleryLayout) {
        visual.dataset.shotCount = String(product.images.length);
        visual.innerHTML = `${product.images.map(() => '<div class="gallery-shot" aria-hidden="true"></div>').join("")}<span class="tag">${product.category}</span>`;
        [...visual.querySelectorAll(".gallery-shot")].forEach((shot, index) => {
          clearDeferredBackground(shot);
          queueDeferredBackground(shot, resolveCatalogImage(product.images[index]), "contain", cardIndex < eagerCardLimit && index < 2);
        });
        return;
      }

      delete visual.dataset.shotCount;
      visual.innerHTML = `<span class="tag">${product.category}</span>`;
      queueDeferredBackground(visual, resolveCatalogImage(product.images[0]), "visual", cardIndex < eagerCardLimit);
    };
    const rerenderProductCards = () => {
      productCards.forEach(({ visual, productId, cardIndex }) => {
        const product = products.get(productId);
        if (product) renderCardVisual(visual, product, cardIndex);
      });
    };
    const parseSizes = (button, description) => button.dataset.sizes ? button.dataset.sizes.split(",").map((size) => size.trim()).filter(Boolean) : description.includes("S-M-L") ? [...defaultSizes] : [...defaultSizes];
    const parseOptions = (button) => button.dataset.options ? button.dataset.options.split(",").map((option) => option.trim()).filter(Boolean) : [];
    const getActiveSize = () => productSizes.querySelector(".size-chip.active")?.dataset.size || "";
    const getActiveOption = () => productOptions.querySelector(".option-chip.active")?.dataset.option || "";
    const inferTeam = (name) => {
      const normalized = name.toLowerCase();
      if (normalized.includes("natus vincere") || normalized.includes("navi")) return "NaVi";
      if (normalized.includes("falcons")) return "Falcons";
      if (normalized.includes("faze")) return "Faze Clan";
      if (normalized.includes("liquid")) return "Team Liquid";
      if (normalized.includes("mongolz")) return "The MongolZ";
      if (normalized.includes("furia")) return "Furia";
      if (normalized.includes("vitality")) return "Vitality";
      if (normalized.includes("spirit")) return "Team Spirit";
      if (normalized.includes("g2")) return "G2";
      if (normalized.includes("eternal fire")) return "Eternal Fire";
      if (normalized.includes("aurora")) return "Aurora";
      if (normalized.includes("astralis")) return "Astralis";
      if (normalized.includes("virtus")) return "Virtus Pro";
      if (normalized.includes("cloud9")) return "Cloud9";
      if (normalized.includes("fut")) return "FUT";
      return "\u0406\u043D\u0448\u0435";
    };
    const teamLogos = new Map([
      ["Astralis", "astralislogo.jpg"],
      ["Aurora", "auroralogo.png"],
      ["Cloud9", "cloud9logo.jpg"],
      ["Eternal Fire", "eternalfirelogo.png"],
      ["Falcons", "falconslogo.jpg"],
      ["Faze Clan", "fazeclanlogo.jpg"],
      ["Furia", "furialogo.png"],
      ["FUT", "futlogo.png"],
      ["G2", "g2logo.jpg"],
      ["NaVi", "navilogo.jpg"],
      ["Team Liquid", "teamliquidlogo.png"],
      ["Team Spirit", "teamspiritlogo.png"],
      ["The MongolZ", "themongolzlogo.jpg"],
      ["Virtus Pro", "virtusprologo.png"],
      ["Vitality", "vitalitylogo.webp"]
    ]);
    const getTeamLogo = (team) => teamLogos.get(team) || "";
    const getSelectedPaymentOption = () => paymentOptions.find((input) => input.checked)?.value || "full_card";
    const paymentOptionLabel = (value) => value === "predoplata" ? "\u041F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430" : "\u041F\u043E\u0432\u043D\u0430 \u043E\u043F\u043B\u0430\u0442\u0430 \u043D\u0430 \u043A\u0430\u0440\u0442\u043A\u0443";
    const syncPaymentOption = () => {
      prepaymentNote.hidden = getSelectedPaymentOption() !== "predoplata";
    };
    const syncProductPrice = () => {
      const product = products.get(activeProductId);
      if (!product) return;
      productPrice.textContent = money(getProductPrice(product, getActiveOption()));
    };
    const getSortedSectionEntries = (entries, sortValue) => [...entries].sort((a, b) => {
      if (sortValue === "expensive") return b.product.price - a.product.price || a.originalIndex - b.originalIndex;
      if (sortValue === "cheap") return a.product.price - b.product.price || a.originalIndex - b.originalIndex;
      return a.originalIndex - b.originalIndex;
    });
    const applySectionSort = (sectionId, sortValue = "none") => {
      const group = sortableSections.get(sectionId);
      if (!group) return;
      const sortedEntries = getSortedSectionEntries(group.entries, sortValue);
      sortedEntries.forEach((entry) => group.container.append(entry.card));
      group.sortValue = sortValue;
      if (group.select) group.select.value = sortValue;
    };
    const initSectionFilters = () => {
      sortableSections.forEach((group, sectionId) => {
        if (!group.head || !group.container || group.select) return;
        group.head.classList.add("section-head-has-filter");

        const filterWrap = document.createElement("label");
        filterWrap.className = "catalog-filter";
        const filterLabel = document.createElement("span");
        filterLabel.className = "catalog-filter-label";
        filterLabel.textContent = "Фільтр";
        const filterSelect = document.createElement("select");
        filterSelect.className = "catalog-filter-select";
        filterSelect.setAttribute("aria-label", `Фільтр ${sectionId}`);
        filterSelect.innerHTML = `
          <option value="none">Без фільтра</option>
          <option value="expensive">Від дорогих</option>
          <option value="cheap">Від дешевих</option>
          <option value="popular">Популярні</option>
        `;
        filterSelect.addEventListener("change", () => applySectionSort(sectionId, filterSelect.value));
        filterWrap.append(filterLabel, filterSelect);
        group.head.append(filterWrap);
        group.select = filterSelect;
      });
    };
    const buildProductSearchText = (product) => normalizeSearchText([
      product.name,
      product.category,
      product.description,
      inferTeam(product.name),
      product.options.join(" "),
      product.sizes.join(" ")
    ].join(" "));
    const focusSearchMatch = (entry) => {
      const target = entry?.card || document.getElementById("jerseys");
      if (target instanceof HTMLElement) target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    };
    const applyCatalogSearch = (rawQuery, { scrollIntoView = false } = {}) => {
      const query = normalizeSearchText(rawQuery);
      const tokens = query ? query.split(" ") : [];
      let matchCount = 0;
      let firstMatch = null;
      const matchedEntries = [];

      catalogSections.forEach((entries, section) => {
        let visibleCount = 0;
        entries.forEach((entry) => {
          const matches = !tokens.length || tokens.every((token) => entry.searchText.includes(token));
          entry.card.hidden = !matches;
          if (!matches) return;
          visibleCount += 1;
          matchCount += 1;
          matchedEntries.push(entry);
          if (!firstMatch) firstMatch = entry;
        });
        if (section instanceof HTMLElement) section.hidden = Boolean(tokens.length) && !visibleCount;
      });

      updateSearchClearVisibility();
      updateSearchStatus(query, matchCount);
      renderSearchResults(query, matchedEntries);

      if (scrollIntoView && tokens.length) {
        closeHeaderMenu();
        menuSearchResults.hidden = true;
        focusSearchMatch(firstMatch);
      }
      return matchCount;
    };

    const openCart = (returnFocus = document.activeElement) => {
      rememberSurfaceFocus("cart", returnFocus);
      drawer.scrollTop = 0;
      cartItemsWrap.scrollTop = 0;
      closeHeaderMenu();
      if (body.classList.contains("product-open")) hideProduct(false, false);
      body.classList.add("cart-open");
      syncSurfaceState();
      focusSurface(drawer, closeCart);
    };

    const hideCart = (restoreFocus = true) => {
      body.classList.remove("cart-open");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("cart");
    };

    const openSizeChart = (product, returnFocus = document.activeElement) => {
      if (!product?.sizeChart) return;
      rememberSurfaceFocus("sizechart", returnFocus);
      sizeChartTitle.textContent = `${product.name} \u2014 \u0440\u043E\u0437\u043C\u0456\u0440\u043D\u0430 \u0441\u0456\u0442\u043A\u0430`;
      sizeChartShot.style.backgroundImage = `url('${product.sizeChart}')`;
      sizeChartModal.scrollTop = 0;
      body.classList.add("sizechart-open");
      syncSurfaceState();
      focusSurface(sizeChartModal, closeSizeChart);
    };

    const hideSizeChart = (restoreFocus = true) => {
      body.classList.remove("sizechart-open");
      syncSurfaceState();
      if (body.classList.contains("product-open")) setTimeout(() => snapProductViewport(), 340);
      if (restoreFocus) restoreSurfaceFocus("sizechart");
    };

    const openTeamModal = (team, returnFocus = document.activeElement) => {
      rememberSurfaceFocus("team", returnFocus);
      closeHeaderMenu();
      const items = [...products.values()].filter((product) => inferTeam(product.name) === team);
      if (!items.length) return;
      teamModalTitle.textContent = team;
      teamProducts.innerHTML = `
        <div class="products">
          ${items.map((item) => `
            <article class="card">
              <div class="visual">
                <img class="visual-preview" src="${resolveCatalogImage(item.images[0] || "image.png.png")}" alt="" loading="eager" decoding="sync">
                <span class="tag">${item.category}</span>
              </div>
              <div class="meta">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="row">
                  <div class="price-block"><span class="old-price">${money(item.price + 200)}</span><span class="price">${money(item.price)}</span></div>
                  <div class="actions-group">
                    <button class="detail-btn" data-product-id="${item.id}" type="button">\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438</button>
                  </div>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      `;
      teamModal.scrollTop = 0;
      teamModalBody.scrollTop = 0;
      body.classList.add("team-open");
      syncSurfaceState();
      focusSurface(teamModal, closeTeamModal);
    };

    const hideTeamModal = (restoreFocus = true) => {
      body.classList.remove("team-open");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("team");
    };

    const openCheckoutModal = (returnFocus = document.activeElement) => {
      closeHeaderMenu();
      if (!cart.size) {
        showToast("\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0434\u043E\u0434\u0430\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u0438 \u0432 \u043A\u043E\u0448\u0438\u043A");
        return;
      }
      rememberSurfaceFocus("checkout", returnFocus);
      hideCart(false);
      hideSuccessModal(false);
      currentOrderNumber = createOrderNumber();
      checkoutOrderNumber.textContent = currentOrderNumber;
      checkoutModal.scrollTop = 0;
      checkoutScroll.scrollTop = 0;
      if (!cachedCities.length) loadNovaPoshtaCities();
      body.classList.add("checkout-open");
      syncSurfaceState();
      focusSurface(checkoutModal, closeCheckoutModal);
    };

    const hideCheckoutModal = (restoreFocus = true) => {
      body.classList.remove("checkout-open");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("checkout");
    };

    const openAdminModal = (returnFocus = document.activeElement) => {
      rememberSurfaceFocus("admin", returnFocus);
      closeHeaderMenu();
      resetAdminAccess();
      setAdminMessage("Admin access is locked.");
      body.classList.add("admin-open");
      syncSurfaceState();
      focusSurface(adminModal, adminUsernameInput);
    };

    const hideAdminModal = (restoreFocus = true) => {
      body.classList.remove("admin-open");
      resetAdminAccess();
      setAdminMessage("Admin access is locked.");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("admin");
    };

    const showSuccessModal = (message, returnFocus = document.activeElement) => {
      rememberSurfaceFocus("success", returnFocus);
      successMessage.textContent = message;
      body.classList.add("success-open");
      syncSurfaceState();
      focusSurface(successModal, closeSuccessModal);
      requestAnimationFrame(() => {
        const style = window.getComputedStyle(successModal);
        if (style.visibility === "hidden" || style.opacity === "0") {
          window.alert(message);
        }
      });
    };

    const hideSuccessModal = (restoreFocus = true) => {
      body.classList.remove("success-open");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("success");
    };

    const finalizeOrderSuccess = (message) => {
      cart.clear();
      renderCart();
      checkoutForm.reset();
      currentOrderNumber = "";
      loadLastOrder();
      novaPoshtaCityRef.value = "";
      resetBranches();
      hideSizeChart(false);
      hideSuccessModal(false);
      hideCheckoutModal(false);
      hideCart(false);
      hideProduct(false, false);
      hideTeamModal(false);
      showSuccessModal(message, cartBtn);
    };
    const setFrameImage = (frame, src, alt = "") => {
      if (!frame) return;
      frame.style.backgroundImage = "";
      const frameImage = frame.querySelector("img");
      if (!frameImage) return;
      frameImage.src = src || "";
      frameImage.alt = alt;
      const imageKey = previewImageKey(src);
      if (imageKey) frame.dataset.imageKey = imageKey;
      else delete frame.dataset.imageKey;
    };
    const setProductImage = (index) => {
      const product = products.get(activeProductId);
      if (!product || !product.images.length) return;
      activeProductImage = index;
      const source = resolveDetailImage(product.images[index]);
      setFrameImage(productMainShot, source, product.name);
      productThumbs.querySelectorAll(".product-thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("active", thumbIndex === index);
      });
    };

    function renderProduct(productId) {
      const product = products.get(productId);
      if (!product) return;
      activeProductId = productId;
      productCategory.textContent = product.category;
      productTitle.textContent = product.name;
      productPrice.textContent = money(product.price);
      productDescription.textContent = product.description;
      productSizeChart.hidden = !product.sizeChart;
      productMainShot.innerHTML = `<img src="" alt="" decoding="async" loading="eager">`;
      productMainShot.style.backgroundImage = "";
      productThumbs.innerHTML = product.images.map((image, index) => {
        const resolvedImage = resolveDetailImage(image);
        return `
        <button class="product-thumb${index === 0 ? " active" : ""}" data-image-index="${index}" data-image-src="${resolvedImage}" type="button" aria-label="Image ${index + 1}">
          <img src="${resolvedImage}" alt="" decoding="async" loading="eager">
        </button>
      `;
      }).join("");
      productSizes.innerHTML = product.sizes.map((size) => `
        <button class="size-chip" data-size="${size}" type="button">${size}</button>
      `).join("");
      productOptionsWrap.hidden = !product.options.length;
      productOptions.innerHTML = product.options.map((option) => `
        <button class="option-chip" data-option="${option}" type="button">${option}</button>
      `).join("");
      syncProductPrice();
      setProductImage(0);
    }

    const snapProductViewport = () => {
      productModal.scrollTop = 0;
      productBody.scrollTop = 0;
      productMainShot.scrollIntoView({ block: "start", inline: "nearest" });
      requestAnimationFrame(() => {
        productModal.scrollTop = 0;
        productBody.scrollTop = 0;
        productMainShot.scrollIntoView({ block: "start", inline: "nearest" });
      });
      setTimeout(() => {
        productModal.scrollTop = 0;
        productBody.scrollTop = 0;
        productMainShot.scrollIntoView({ block: "start", inline: "nearest" });
      }, 80);
      setTimeout(() => {
        productModal.scrollTop = 0;
        productBody.scrollTop = 0;
        productMainShot.scrollIntoView({ block: "start", inline: "nearest" });
      }, 360);
    };

    function openProduct(productId, pushHash = true, returnFocus = document.activeElement) {
      if (!products.has(productId)) return;
      rememberSurfaceFocus("product", returnFocus);
      closeHeaderMenu();
      hideCart(false);
      hideSizeChart(false);
      hideTeamModal(false);
      hideCheckoutModal(false);
      hideSuccessModal(false);
      if (!location.hash.startsWith("#product-")) previousHash = location.hash || "#home";
      renderProduct(productId);
      snapProductViewport();
      body.classList.add("product-open");
      syncSurfaceState();
      focusSurface(productModal, closeProduct);
      if (pushHash) history.pushState(null, "", `#product-${productId}`);
    }
    function hideProduct(restoreHash = true, restoreFocus = true) {
      body.classList.remove("product-open");
      activeProductId = null;
      if (restoreHash && location.hash.startsWith("#product-")) history.pushState(null, "", previousHash || "#home");
      syncSurfaceState();
      if (restoreFocus) restoreSurfaceFocus("product");
    }
    function addToCart(product, size, option = "") {
      const optionSuffix = option ? `::${option}` : "";
      const cartId = `${product.id}::${size}${optionSuffix}`;
      const optionLabel = option ? ` \u2022 ${option}` : "";
      const unitPrice = getProductPrice(product, option);
      const item = cart.get(cartId);
      if (item) item.qty += 1;
      else cart.set(cartId, {
        id: cartId,
        productId: product.id,
        name: product.name,
        category: product.category,
        size,
        option,
        price: unitPrice,
        qty: 1
      });
      renderCart();
      showToast(`${product.name} (${size}${optionLabel}) \u0434\u043E\u0434\u0430\u043D\u043E \u0432 \u043A\u043E\u0448\u0438\u043A`);
    }

    function renderCart() {
      const items = [...cart.values()];
      const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
      const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const discount = promoApplied ? Math.round(subtotal * promoDiscountPercent) : 0;
      const totalPrice = subtotal - discount;
      cartCount.textContent = totalCount;
      cartTotal.textContent = money(totalPrice);
      cartSummaryDetails.innerHTML = subtotal ? `
        <small><span>\u0421\u0443\u043C\u0430 \u0442\u043E\u0432\u0430\u0440\u0456\u0432</span><span>${money(subtotal)}</span></small>
        <small><span>\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434</span><span>${promoApplied ? "SIGNA (-5%)" : "\u041D\u0435 \u0437\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0430\u043D\u043E"}</span></small>
        ${promoApplied ? `<small><span>\u0417\u043D\u0438\u0436\u043A\u0430</span><span>-${money(discount)}</span></small>` : ""}
      ` : "";
      promoNote.textContent = promoApplied ? "\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 SIGNA \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439. \u0417\u043D\u0438\u0436\u043A\u0430 -5% \u0432\u0436\u0435 \u0437\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0430\u043D\u0430." : "";

      if (!items.length) {
        cartItems.innerHTML = "<div class='empty'>\u041A\u043E\u0448\u0438\u043A \u043F\u043E\u043A\u0438 \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439. \u0414\u043E\u0434\u0430\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440 \u0456 \u0432\u0456\u043D \u0437'\u044F\u0432\u0438\u0442\u044C\u0441\u044F \u0442\u0443\u0442.</div>";
        return;
      }

      cartItems.innerHTML = items.map((item) => `
        <article class="item">
          <div class="top">
            <div><small>${item.category} \u2022 \u0420\u043E\u0437\u043C\u0456\u0440 ${item.size}${item.option ? ` \u2022 ${item.option}` : ""}</small><strong>${item.name}</strong></div>
            <span>${money(item.price)}</span>
          </div>
          <div class="bottom">
            <div class="qty">
              <button type="button" data-id="${item.id}" data-step="-1">\u2212</button>
              <span>${item.qty}</span>
              <button type="button" data-id="${item.id}" data-step="1">+</button>
            </div>
            <strong>${money(item.qty * item.price)}</strong>
          </div>
        </article>
      `).join("");
    }

    function renderHeroLatest() {
      const allProducts = [...products.values()];
      const latestLimit = phoneHeroMedia.matches ? 2 : 3;
      const featuredProducts = featuredLatestProductIds
        .map((id) => products.get(id))
        .filter(Boolean);
      const fallbackProducts = allProducts
        .slice()
        .reverse()
        .filter((product) => !featuredLatestProductIds.includes(product.id));
      const latestProducts = [...featuredProducts, ...fallbackProducts].slice(0, latestLimit);
      heroProductCount.textContent = String(allProducts.length);
      heroLatest.innerHTML = latestProducts.map((product) => `
        <button class="hero-latest-item" data-product-id="${product.id}" type="button">
          <div class="hero-latest-shot" data-bg="${resolveCatalogImage(product.images[0] || "image.png.png")}"></div>
          <div class="hero-latest-copy">
            <strong>${product.name}</strong>
            <span>${product.category} \u2022 ${money(product.price)}</span>
          </div>
        </button>
      `).join("");
      heroLatest.querySelectorAll(".hero-latest-shot").forEach((shot) => {
        applyCoverPreview(shot, shot.dataset.bg || "");
      });
    }

    function renderTeams() {
      const grouped = new Map();
      [...products.values()].forEach((product) => {
        const team = inferTeam(product.name);
        if (!grouped.has(team)) grouped.set(team, []);
        grouped.get(team).push(product);
      });

      teamsGrid.innerHTML = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk")).map(([team, items]) => `
        <button class="team-card" data-team="${team}" type="button">
          <div class="team-card-main">
            ${getTeamLogo(team) ? `
              <span class="team-logo-badge">
                <img class="team-logo" src="${resolveCatalogImage(getTeamLogo(team))}" alt="${team} logo" loading="lazy" decoding="async">
              </span>
            ` : `
              <span class="team-logo-badge team-logo-fallback" aria-hidden="true">${team.slice(0, 1)}</span>
            `}
            <div class="team-card-copy">
              <h3>${team}</h3>
              <div class="team-count">${items.length} \u0442\u043E\u0432\u0430\u0440(\u0456\u0432)</div>
            </div>
          </div>
          <div class="team-open">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438</div>
        </button>
      `).join("");
    }

    document.querySelectorAll(".products .card").forEach((card, cardIndex) => {
      const button = card.querySelector(".add-btn");
      const title = card.querySelector(".meta h3");
      const description = card.querySelector(".meta p")?.textContent?.trim() || "";
      const visual = card.querySelector(".visual");
      const row = card.querySelector(".row");
      const price = card.querySelector(".price");
      if (!button || !title || !visual || !row) return;

      const galleryImages = [...card.querySelectorAll(".gallery-shot")].map((shot) => shot.dataset.bg || extractUrls(shot.getAttribute("style") || "")[0]).filter(Boolean);
      const visualImages = galleryImages.length ? galleryImages : [visual.dataset.bg || extractUrls(visual.getAttribute("style") || "").slice(-1)[0]].filter(Boolean);
      const product = {
        id: button.dataset.id,
        name: button.dataset.name,
        category: button.dataset.category,
        price: Number(button.dataset.price),
        description,
        images: visualImages,
        sizes: parseSizes(button, description),
        sizeChart: button.dataset.sizeChart || "",
        options: parseOptions(button)
      };

      products.set(product.id, product);
      card.dataset.productId = product.id;
      productCards.push({ visual, productId: product.id, cardIndex });
      const section = card.closest("section");
      const catalogEntry = { card, productId: product.id, section, searchText: buildProductSearchText(product) };
      if (section instanceof HTMLElement) {
        if (!catalogSections.has(section)) catalogSections.set(section, []);
        catalogSections.get(section).push(catalogEntry);
        if (sortableSectionIds.has(section.id)) {
          if (!sortableSections.has(section.id)) {
            sortableSections.set(section.id, {
              section,
              head: section.querySelector(".section-head"),
              container: card.parentElement,
              entries: []
            });
          }
          const group = sortableSections.get(section.id);
          group.entries.push({
            card,
            product,
            originalIndex: group.entries.length
          });
        }
      }
      if (price && !row.querySelector(".price-block")) {
        const priceBlock = document.createElement("div");
        priceBlock.className = "price-block";
        const oldPrice = document.createElement("span");
        oldPrice.className = "old-price";
        oldPrice.textContent = money(product.price + 200);
        price.before(priceBlock);
        priceBlock.append(oldPrice, price);
      }
      if (product.images.length) {
        renderCardVisual(visual, product, cardIndex);
      }
      visual.classList.add("is-clickable");
      title.classList.add("is-link");
      visual.tabIndex = 0;
      title.tabIndex = 0;
      visual.setAttribute("role", "button");
      title.setAttribute("role", "button");
      visual.setAttribute("aria-label", `\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0442\u043E\u0432\u0430\u0440 ${product.name}`);
      title.setAttribute("aria-label", `\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0442\u043E\u0432\u0430\u0440 ${product.name}`);

      const openProductFromCard = () => openProduct(product.id);
      [visual, title].forEach((node) => {
        node.addEventListener("click", openProductFromCard);
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProductFromCard();
          }
        });
      });

      const actionsGroup = document.createElement("div");
      actionsGroup.className = "actions-group";
      const detailButton = document.createElement("button");
      detailButton.className = "detail-btn";
      detailButton.type = "button";
      detailButton.textContent = "\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438";
      detailButton.addEventListener("click", () => openProduct(product.id));
      row.append(actionsGroup);
      actionsGroup.append(detailButton, button);

      button.addEventListener("click", () => openProduct(product.id));
    });

    initSectionFilters();

    heroLatest.addEventListener("click", (event) => {
      const item = event.target.closest("[data-product-id]");
      if (!item) return;
      openProduct(item.dataset.productId);
    });
    teamsGrid.addEventListener("click", (event) => {
      const item = event.target.closest("[data-team]");
      if (!item) return;
      openTeamModal(item.dataset.team);
    });
    teamProducts.addEventListener("click", (event) => {
      const item = event.target.closest("[data-product-id]");
      if (!item) return;
      hideTeamModal();
      openProduct(item.dataset.productId);
    });

    productThumbs.addEventListener("click", (event) => {
      const thumb = event.target.closest(".product-thumb");
      if (!thumb) return;
      setProductImage(Number(thumb.dataset.imageIndex));
    });

    productSizes.addEventListener("click", (event) => {
      const sizeButton = event.target.closest(".size-chip");
      if (!sizeButton) return;
      productSizes.querySelectorAll(".size-chip").forEach((button) => button.classList.remove("active"));
      sizeButton.classList.add("active");
      sizeButton.blur();
    });
    productOptions.addEventListener("click", (event) => {
      const optionButton = event.target.closest(".option-chip");
      if (!optionButton) return;
      productOptions.querySelectorAll(".option-chip").forEach((button) => button.classList.remove("active"));
      optionButton.classList.add("active");
      syncProductPrice();
      optionButton.blur();
    });

    productAddToCart.addEventListener("click", () => {
      const product = products.get(activeProductId);
      if (!product) return;
      const selectedSize = getActiveSize();
      const selectedOption = getActiveOption();
      if (!selectedSize) {
        showToast("\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u0440\u043E\u0437\u043C\u0456\u0440");
        return;
      }
      if (product.options.length && !selectedOption) {
        showToast("\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u043E\u043F\u0446\u0456\u044E");
        return;
      }
      addToCart(product, selectedSize, selectedOption);
    });
    productSizeChart.addEventListener("click", () => {
      const product = products.get(activeProductId);
      productSizeChart.blur();
      openSizeChart(product);
    });

    cartItems.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-id]");
      if (!target) return;
      const item = cart.get(target.dataset.id);
      if (!item) return;
      item.qty += Number(target.dataset.step);
      if (item.qty <= 0) cart.delete(target.dataset.id);
      renderCart();
    });

    cartBtn.addEventListener("click", () => openCart(cartBtn));
    closeCart.addEventListener("click", () => hideCart());
    overlay.addEventListener("click", closeActiveSurface);
    closeProduct.addEventListener("click", () => hideProduct());
    closeSizeChart.addEventListener("click", () => hideSizeChart());
    closeTeamModal.addEventListener("click", () => hideTeamModal());
    productBack.addEventListener("click", () => hideProduct());
    productOverlay.addEventListener("click", closeActiveSurface);
    closeCheckoutModal.addEventListener("click", () => {
      if (desktopHeaderMedia.matches) hideCheckoutModal();
      else returnToCartFromCheckout();
    });
    adminOpenButton.addEventListener("click", () => openAdminModal(adminOpenButton));
    closeAdminModal.addEventListener("click", () => hideAdminModal());
    closeSuccessModal.addEventListener("click", () => hideSuccessModal());
    checkoutBack.addEventListener("click", returnToCartFromCheckout);
    checkout.addEventListener("click", () => openCheckoutModal(checkout));
    menuToggle.addEventListener("click", toggleHeaderMenu);
    headerLinks.forEach((link) => link.addEventListener("click", closeHeaderMenu));
    menuSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      const matchCount = applyCatalogSearch(menuSearchInput.value, { scrollIntoView: true });
      if (normalizeSearchText(menuSearchInput.value) && !matchCount) {
        showToast(`No products found for "${menuSearchInput.value.trim()}"`);
      }
    });
    menuSearchInput.addEventListener("input", () => {
      applyCatalogSearch(menuSearchInput.value);
    });
    menuSearchInput.addEventListener("focus", () => {
      if (menuSearchInput.value.trim()) applyCatalogSearch(menuSearchInput.value);
    });
    menuSearchClear.addEventListener("click", () => {
      menuSearchInput.value = "";
      applyCatalogSearch("");
      menuSearchInput.focus({ preventScroll: true });
    });
    menuSearchResults.addEventListener("click", (event) => {
      const item = event.target.closest("[data-product-id]");
      if (!item) return;
      menuSearchResults.hidden = true;
      openProduct(item.dataset.productId, true, menuSearchInput);
    });
    adminLoginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    adminLoginButton.addEventListener("click", () => {
      handleAdminLogin();
    });
    [adminUsernameInput, adminPasswordInput].forEach((input) => input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleAdminLogin();
    }));
    adminPasswordToggle.addEventListener("click", () => {
      const isVisible = adminPasswordInput.type === "text";
      adminPasswordInput.type = isVisible ? "password" : "text";
      adminPasswordToggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
      adminPasswordToggle.setAttribute("aria-pressed", String(!isVisible));
      adminPasswordToggle.innerHTML = isVisible ? "&#128065;" : "Hide";
      adminPasswordInput.focus({ preventScroll: true });
    });
    adminLogout.addEventListener("click", () => {
      hideAdminModal();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-panel-top")) {
        menuSearchResults.hidden = true;
      }
      if (!body.classList.contains("menu-open")) return;
      if (event.target.closest(".header")) return;
      closeHeaderMenu();
    });
    desktopHeaderMedia.addEventListener("change", syncHeaderMenu);
    desktopHeaderMedia.addEventListener("change", rerenderProductCards);
    paymentOptions.forEach((input) => input.addEventListener("change", syncPaymentOption));
    phoneHeroMedia.addEventListener("change", () => {
      renderHeroLatest();
      rerenderProductCards();
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      const product = activeProductId ? products.get(activeProductId) : null;
      if (!product) return;
      productThumbs.querySelectorAll(".product-thumb").forEach((thumb, index) => {
        const thumbImage = thumb.querySelector("img");
        if (thumbImage) thumbImage.src = resolveDetailImage(product.images[index]);
        thumb.style.backgroundImage = `url("${resolveDetailImage(product.images[index])}")`;
      });
      setProductImage(activeProductImage);
    });
    clearCart.addEventListener("click", () => { cart.clear(); renderCart(); showToast("\u041A\u043E\u0448\u0438\u043A \u043E\u0447\u0438\u0449\u0435\u043D\u043E"); });
    applyPromo.addEventListener("click", () => {
      promoApplied = promoInput.value.trim().toUpperCase() === "SIGNA";
      renderCart();
      showToast(promoApplied ? "\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 SIGNA \u0437\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0430\u043D\u043E" : "\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E");
    });
    promoInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyPromo.click();
    });
    const persistInputs = [customerName, customerPhone, customerTelegram, novaPoshtaCity, novaPoshtaBranch];
    persistInputs.forEach((input) => input?.addEventListener("input", saveLastOrder));
    novaPoshtaBranch.addEventListener("change", saveLastOrder);
    loadLastOrder();

    novaPoshtaCity.addEventListener("input", () => {
      const selectedCity = cachedCities.find((city) => city.Description.toLowerCase() === novaPoshtaCity.value.trim().toLowerCase());
      novaPoshtaCityRef.value = selectedCity?.Ref || "";
      novaPoshtaBranch.value = "";
      loadNovaPoshtaBranches(novaPoshtaCityRef.value);
      saveLastOrder();
    });
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(checkoutForm);
      if (!form.get("customerName") || !form.get("customerPhone") || !form.get("customerTelegram") || !form.get("novaPoshtaCity") || !form.get("novaPoshtaBranch")) {
        showToast("\u0417\u0430\u043F\u043E\u0432\u043D\u0456\u0442\u044C \u0443\u0441\u0456 \u043F\u043E\u043B\u044F \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F");
        return;
      }
      const subtotal = [...cart.values()].reduce((sum, item) => sum + item.qty * item.price, 0);
      const discount = promoApplied ? Math.round(subtotal * promoDiscountPercent) : 0;
      const total = subtotal - discount;
      const paymentOption = String(form.get("paymentOption") || getSelectedPaymentOption());
      if (!confirmOrderDetails.checked) {
        showToast("\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0456\u0442\u044C \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456\u0441\u0442\u044C \u0434\u0430\u043D\u0438\u0445 \u043F\u0435\u0440\u0435\u0434 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u043D\u044F\u043C \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F");
        return;
      }
      const confirmMessage = `\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F ${currentOrderNumber || "ENTRYFRAG"} \u043D\u0430 \u0441\u0443\u043C\u0443 ${money(total)}?`;
      if (!window.confirm(confirmMessage)) {
        showToast("\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u043E");
        return;
      }
      const completedOrder = currentOrderNumber || createOrderNumber();
      const orderItems = [...cart.values()].map((item, index) => `${index + 1}. ${item.name} | \u0420\u043E\u0437\u043C\u0456\u0440: ${item.size}${item.option ? ` | \u041E\u043F\u0446\u0456\u044F: ${item.option}` : ""} | \u041A-\u0441\u0442\u044C: ${item.qty} | \u0421\u0443\u043C\u0430: ${money(item.qty * item.price)}`).join("\n");
      const telegramMessage = [
        `\u041D\u043E\u0432\u0435 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F ${completedOrder}`,
        ``,
        `\u041F\u0406\u0411: ${form.get("customerName")}`,
        `\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${form.get("customerPhone")}`,
        `Telegram: ${form.get("customerTelegram")}`,
        `\u041C\u0456\u0441\u0442\u043E: ${novaPoshtaCity.value}`,
        `\u0412\u0456\u0434\u0434\u0456\u043B\u0435\u043D\u043D\u044F \u041D\u041F: ${form.get("novaPoshtaBranch")}`,
        `\u041E\u043F\u043B\u0430\u0442\u0430: ${paymentOptionLabel(paymentOption)}`,
        ...(paymentOption === "predoplata" ? ["\u041F\u0435\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430: 200 \u0433\u0440\u043D \u0437\u0430 \u0434\u0436\u0435\u0440\u0441\u0456, 400 \u0433\u0440\u043D \u0437\u0430 \u0448\u0442\u0430\u043D\u0438 \u0442\u0430 \u0437\u0456\u043F\u043A\u0438"] : []),
        ``,
        `\u0422\u043E\u0432\u0430\u0440\u0438:`,
        `${orderItems}`,
        ``,
        `\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434: ${promoApplied ? "SIGNA (-5%)" : "\u043D\u0435\u043C\u0430\u0454"}`,
        `\u0420\u0430\u0437\u043E\u043C: ${money(total)}`
      ].join("\n");
      saveLastOrder();
      const payload = {
        orderNumber: completedOrder,
        customerName: form.get("customerName"),
        phone: form.get("customerPhone"),
        city: novaPoshtaCity.value,
        branch: form.get("novaPoshtaBranch"),
        telegramNick: form.get("customerTelegram"),
        items: [...cart.values()].map((item) => ({
          name: item.name,
          size: item.size,
          option: item.option || null,
          qty: item.qty,
          unitPrice: item.price
        })),
        subtotal,
        discount,
        total,
        paymentOption,
        paymentOptionLabel: paymentOptionLabel(paymentOption),
        promo: promoApplied ? "SIGNA (-5%)" : "none",
        status: "sent"
      };
      const telegramPayload = {
        message: telegramMessage,
        orderNumber: completedOrder,
        replyMarkup: {
          inline_keyboard: [[
            {
              text: "\u0412\u0456\u0434\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
              callback_data: `done:${completedOrder}`
            }
          ]]
        }
      };
      try {
        const result = await submitOrderToServer(payload, telegramPayload);
        if (result?.warning === "telegram_unreachable") {
          finalizeOrderSuccess("\u0417\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E, \u0430\u043B\u0435 Telegram \u0437\u0430\u0440\u0430\u0437 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0439");
          return;
        }
      } catch (error) {
        console.error("order submit failed", error);
        if (String(error.message).includes("backend_not_configured")) {
          showToast("Backend \u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439. \u0417\u0430\u043F\u043E\u0432\u043D\u0438 ENTRYFRAG_API_URL \u0443 config")
        } else if (String(error.message).includes("telegram_send_failed") || String(error.message).includes("telegram_not_configured")) {
          showToast("\u0411\u043E\u0442 \u043D\u0435 \u043F\u0440\u0438\u0432'\u044F\u0437\u0430\u043D\u0438\u0439 \u0434\u043E Telegram. \u041D\u0430\u043F\u0438\u0448\u0456\u0442\u044C /start \u0430\u0431\u043E /bindmanager \u0443 \u0431\u043E\u0442")
        } else if (String(error.message).includes("missing_bot_token") || String(error.message).includes("missing_chat_id")) {
          showToast("\u041D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0456 \u043D\u0435 \u0437\u0430\u043F\u043E\u0432\u043D\u0435\u043D\u0438\u0439 Telegram token \u0430\u0431\u043E chat id")
        } else {
          showToast("\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043D\u0430\u0434\u0456\u0441\u043B\u0430\u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F")
        }
        return;
      }
      finalizeOrderSuccess(`\u0417\u0430\u043C\u043E\u0432\u043B\u0435\u043D\u043D\u044F ${completedOrder} \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u043E`);
    });
    document.addEventListener("focusin", (event) => {
      const activeSurface = getActiveSurface();
      if (!activeSurface) return;
      if (activeSurface.root.contains(event.target)) return;
      focusSurface(activeSurface.root, activeSurface.focusTarget);
    });
    window.addEventListener("keydown", (event) => {
      const activeSurface = getActiveSurface();
      if (event.key === "Tab" && activeSurface) {
        const focusable = getFocusableElements(activeSurface.root);
        if (!focusable.length) {
          event.preventDefault();
          focusSurface(activeSurface.root, activeSurface.focusTarget);
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!activeSurface.root.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== "Escape") return;
      closeActiveSurface();
    });
    window.addEventListener("hashchange", () => {
      if (!location.hash.startsWith("#product-")) {
        if (body.classList.contains("sizechart-open")) hideSizeChart(false);
        if (body.classList.contains("product-open")) hideProduct(false, false);
        return;
      }
      openProduct(location.hash.replace("#product-", ""), false);
    });

    syncSurfaceState();
    syncHeaderMenu();
    syncPaymentOption();
    updateSearchClearVisibility();
    resetAdminAccess();
    body.classList.remove("admin-open");
    syncSurfaceState();
    setAdminMessage("Admin access is locked.");
    window.addEventListener("pageshow", () => {
      body.classList.remove("admin-open");
      resetAdminAccess();
      syncSurfaceState();
      setAdminMessage("Admin access is locked.");
    });

    renderHeroLatest();
    renderTeams();
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    if (location.hash.startsWith("#product-")) openProduct(location.hash.replace("#product-", ""), false);
    renderCart();

