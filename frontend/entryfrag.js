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
    const headerLinks = [...document.querySelectorAll(".site-nav a")];
    const desktopHeaderMedia = window.matchMedia("(min-width: 1024px)");
    const closeCart = document.getElementById("closeCart");
    const overlay = document.getElementById("overlay");
    const drawer = document.getElementById("drawer");
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
    const closeTeamModal = document.getElementById("closeTeamModal");
    const checkoutModal = document.getElementById("checkoutModal");
    const closeCheckoutModal = document.getElementById("closeCheckoutModal");
    const successModal = document.getElementById("successModal");
    const closeSuccessModal = document.getElementById("closeSuccessModal");
    const successMessage = document.getElementById("successMessage");
    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutOrderNumber = document.getElementById("checkoutOrderNumber");
    const checkoutBack = document.getElementById("checkoutBack");
    const customerName = document.getElementById("customerName");
    const customerPhone = document.getElementById("customerPhone");
    const customerTelegram = document.getElementById("customerTelegram");
    const novaPoshtaCity = document.getElementById("novaPoshtaCity");
    const novaPoshtaCityList = document.getElementById("novaPoshtaCityList");
    const novaPoshtaCityRef = document.getElementById("novaPoshtaCityRef");
    const novaPoshtaBranch = document.getElementById("novaPoshtaBranch");
    const confirmOrderDetails = document.getElementById("confirmOrderDetails");

    const defaultSizes = ["S", "M", "L"];
    const promoDiscountPercent = 0.05;
    let activeProductId = null;
    let activeProductImage = 0;
    let previousHash = "#home";
    let promoApplied = false;
    let currentOrderNumber = "";
    let cachedCities = [];

    const money = (value) => new Intl.NumberFormat("uk-UA").format(value) + " ₴";
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
      novaPoshtaBranch.innerHTML = `<option value="">Оберіть відділення</option>${branches.map((branch) => `<option value="${branch.Description}">${branch.Description}</option>`).join("")}`;
    };
    const resetBranches = (placeholder = "Спочатку оберіть місто") => {
      novaPoshtaBranch.disabled = true;
      novaPoshtaBranch.innerHTML = `<option value="">${placeholder}</option>`;
    };
    const loadNovaPoshtaCities = async () => {
      if (cachedCities.length) return;
      novaPoshtaCity.placeholder = "Завантаження міст...";
      try {
        const cities = await novaPoshtaRequest("getCities");
        cachedCities = cities
          .map((city) => ({ Ref: city.Ref, Description: city.Description }))
          .filter((city) => city.Ref && city.Description)
          .sort((a, b) => a.Description.localeCompare(b.Description, "uk"));
        fillCityOptions(cachedCities);
        novaPoshtaCity.placeholder = "Почніть вводити місто";
      } catch (error) {
        novaPoshtaCity.placeholder = "Не вдалося завантажити міста";
        showToast("Не вдалося завантажити міста Нової пошти");
      }
    };
    const loadNovaPoshtaBranches = async (cityRef) => {
      if (!cityRef) {
        resetBranches();
        return;
      }
      resetBranches("Завантаження відділень...");
      try {
        const branches = await novaPoshtaRequest("getWarehouses", { CityRef: cityRef });
        const validBranches = branches.filter((branch) => branch.Description);
        if (!validBranches.length) {
          resetBranches("Відділення недоступні");
          return;
        }
        fillBranchOptions(validBranches);
      } catch (error) {
        resetBranches("Не вдалося завантажити відділення");
        showToast("Не вдалося завантажити відділення Нової пошти");
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
    const parseSizes = (button, description) => button.dataset.sizes ? button.dataset.sizes.split(",").map((size) => size.trim()).filter(Boolean) : description.includes("S-M-L") || description.includes("S-М-L") ? [...defaultSizes] : [...defaultSizes];
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
      return "Інше";
    };

    const openCart = () => {
      closeHeaderMenu();
      body.classList.remove("product-open");
      productModal.setAttribute("aria-hidden", "true");
      body.classList.add("cart-open");
      drawer.setAttribute("aria-hidden", "false");
    };

    const hideCart = () => {
      body.classList.remove("cart-open");
      drawer.setAttribute("aria-hidden", "true");
    };

    const openSizeChart = (product) => {
      if (!product?.sizeChart) return;
      sizeChartTitle.textContent = `${product.name} — розмірна сітка`;
      sizeChartShot.style.backgroundImage = `url('${product.sizeChart}')`;
      body.classList.add("sizechart-open");
      sizeChartModal.setAttribute("aria-hidden", "false");
    };

    const hideSizeChart = () => {
      body.classList.remove("sizechart-open");
      sizeChartModal.setAttribute("aria-hidden", "true");
    };

    const openTeamModal = (team) => {
      closeHeaderMenu();
      const items = [...products.values()].filter((product) => inferTeam(product.name) === team);
      if (!items.length) return;
      teamModalTitle.textContent = team;
      teamProducts.innerHTML = `
        <div class="products">
          ${items.map((item) => `
            <article class="card">
              <div class="visual" style="background-color:#f4f0ea;background-image:linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.08)),url('${item.images[0] || "image.png.png"}');background-position:center;background-size:contain;background-repeat:no-repeat"><span class="tag">${item.category}</span></div>
              <div class="meta">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="row">
                  <div class="price-block"><span class="old-price">${money(item.price + 200)}</span><span class="price">${money(item.price)}</span></div>
                  <div class="actions-group">
                    <button class="detail-btn" data-product-id="${item.id}" type="button">Переглянути</button>
                  </div>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      `;
      body.classList.add("team-open");
      teamModal.setAttribute("aria-hidden", "false");
    };

    const hideTeamModal = () => {
      body.classList.remove("team-open");
      teamModal.setAttribute("aria-hidden", "true");
    };

    const openCheckoutModal = () => {
      closeHeaderMenu();
      if (!cart.size) {
        showToast("Спочатку додайте товари в кошик");
        return;
      }
      hideCart();
      hideSuccessModal();
      currentOrderNumber = createOrderNumber();
      checkoutOrderNumber.textContent = currentOrderNumber;
      if (!cachedCities.length) loadNovaPoshtaCities();
      body.classList.add("checkout-open");
      checkoutModal.setAttribute("aria-hidden", "false");
    };

    const hideCheckoutModal = () => {
      body.classList.remove("checkout-open");
      checkoutModal.setAttribute("aria-hidden", "true");
    };

    const showSuccessModal = (message) => {
      successMessage.textContent = message;
      body.classList.add("success-open");
      successModal.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        const style = window.getComputedStyle(successModal);
        if (style.visibility === "hidden" || style.opacity === "0") {
          window.alert(message);
        }
      });
    };

    const hideSuccessModal = () => {
      body.classList.remove("success-open");
      successModal.setAttribute("aria-hidden", "true");
    };

    const finalizeOrderSuccess = (message) => {
      cart.clear();
      renderCart();
      checkoutForm.reset();
      currentOrderNumber = "";
      loadLastOrder();
      novaPoshtaCityRef.value = "";
      resetBranches();
      hideSizeChart();
      hideSuccessModal();
      hideCheckoutModal();
      hideCart();
      hideProduct(false);
      hideTeamModal();
      overlay.setAttribute("aria-hidden", "true");
      productOverlay.setAttribute("aria-hidden", "true");
      showSuccessModal(message);
    };

    const setProductImage = (index) => {
      const product = products.get(activeProductId);
      if (!product || !product.images.length) return;
      activeProductImage = index;
      productMainShot.style.backgroundImage = `url('${product.images[index]}')`;
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
      productThumbs.innerHTML = product.images.map((image, index) => `
        <button class="product-thumb${index === 0 ? " active" : ""}" data-image-index="${index}" style="background-image:url('${image}')" type="button" aria-label="Фото ${index + 1}"></button>
      `).join("");
      productSizes.innerHTML = product.sizes.map((size) => `
        <button class="size-chip" data-size="${size}" type="button">${size}</button>
      `).join("");
      productOptionsWrap.hidden = !product.options.length;
      productOptions.innerHTML = product.options.map((option) => `
        <button class="option-chip" data-option="${option}" type="button">${option}</button>
      `).join("");
      setProductImage(0);
    }

    function openProduct(productId, pushHash = true) {
      if (!products.has(productId)) return;
      closeHeaderMenu();
      hideCart();
      if (!location.hash.startsWith("#product-")) previousHash = location.hash || "#home";
      renderProduct(productId);
      body.classList.add("product-open");
      productModal.setAttribute("aria-hidden", "false");
      if (pushHash) history.pushState(null, "", `#product-${productId}`);
    }

    function hideProduct(restoreHash = true) {
      body.classList.remove("product-open");
      productModal.setAttribute("aria-hidden", "true");
      activeProductId = null;
      if (restoreHash && location.hash.startsWith("#product-")) history.pushState(null, "", previousHash || "#home");
    }

    function addToCart(product, size, option = "") {
      const optionSuffix = option ? `::${option}` : "";
      const cartId = `${product.id}::${size}${optionSuffix}`;
      const optionLabel = option ? ` • ${option}` : "";
      const item = cart.get(cartId);
      if (item) item.qty += 1;
      else cart.set(cartId, {
        id: cartId,
        productId: product.id,
        name: product.name,
        category: product.category,
        size,
        option,
        price: product.price,
        qty: 1
      });
      renderCart();
      showToast(`${product.name} (${size}${optionLabel}) додано в кошик`);
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
        <small><span>Сума товарів</span><span>${money(subtotal)}</span></small>
        <small><span>Промокод</span><span>${promoApplied ? "SIGNA (-5%)" : "Не застосовано"}</span></small>
        ${promoApplied ? `<small><span>Знижка</span><span>-${money(discount)}</span></small>` : ""}
      ` : "";
      promoNote.textContent = promoApplied ? "Промокод SIGNA активний. Знижка -5% уже застосована." : "";

      if (!items.length) {
        cartItems.innerHTML = "<div class='empty'>Кошик поки порожній. Додайте товар і він з'явиться тут.</div>";
        return;
      }

      cartItems.innerHTML = items.map((item) => `
        <article class="item">
          <div class="top">
            <div><small>${item.category} • Розмір ${item.size}${item.option ? ` • ${item.option}` : ""}</small><strong>${item.name}</strong></div>
            <span>${money(item.price)}</span>
          </div>
          <div class="bottom">
            <div class="qty">
              <button type="button" data-id="${item.id}" data-step="-1">−</button>
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
      const featured = allProducts.find((product) => product.id === "navi-2025-jersey");
      const latestProducts = [
        ...(featured ? [featured] : []),
        ...allProducts.slice().reverse().filter((product) => product.id !== "navi-2025-jersey").slice(0, featured ? 2 : 3)
      ];
      heroProductCount.textContent = String(allProducts.length);
      heroLatest.innerHTML = latestProducts.map((product) => `
        <button class="hero-latest-item" data-product-id="${product.id}" type="button">
          <div class="hero-latest-shot" style="background-image:url('${product.images[0] || "image.png.png"}')"></div>
          <div class="hero-latest-copy">
            <strong>${product.name}</strong>
            <span>${product.category} • ${money(product.price)}</span>
          </div>
        </button>
      `).join("");
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
          <div>
            <h3>${team}</h3>
            <div class="team-count">${items.length} товар(ів)</div>
          </div>
          <div class="team-open">Відкрити</div>
        </button>
      `).join("");
    }

    document.querySelectorAll(".products .card").forEach((card) => {
      const button = card.querySelector(".add-btn");
      const title = card.querySelector(".meta h3");
      const description = card.querySelector(".meta p")?.textContent?.trim() || "";
      const visual = card.querySelector(".visual");
      const row = card.querySelector(".row");
      const price = card.querySelector(".price");
      if (!button || !title || !visual || !row) return;

      const galleryImages = [...card.querySelectorAll(".gallery-shot")].map((shot) => extractUrls(shot.getAttribute("style") || "")[0]).filter(Boolean);
      const visualImages = galleryImages.length ? galleryImages : extractUrls(visual.getAttribute("style") || "").slice(-1);
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
        visual.classList.remove("gallery");
        visual.innerHTML = `<span class="tag">${product.category}</span>`;
        visual.style.backgroundColor = "#f4f0ea";
        visual.style.backgroundImage = `linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.08)),url('${product.images[0]}')`;
        visual.style.backgroundPosition = "center";
        visual.style.backgroundSize = "contain";
        visual.style.backgroundRepeat = "no-repeat";
      }
      visual.classList.add("is-clickable");
      title.classList.add("is-link");
      visual.tabIndex = 0;
      title.tabIndex = 0;
      visual.setAttribute("role", "button");
      title.setAttribute("role", "button");
      visual.setAttribute("aria-label", `Відкрити товар ${product.name}`);
      title.setAttribute("aria-label", `Відкрити товар ${product.name}`);

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
      detailButton.textContent = "Переглянути";
      detailButton.addEventListener("click", () => openProduct(product.id));
      row.append(actionsGroup);
      actionsGroup.append(detailButton, button);

      button.addEventListener("click", () => openProduct(product.id));
    });

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
    });
    productOptions.addEventListener("click", (event) => {
      const optionButton = event.target.closest(".option-chip");
      if (!optionButton) return;
      productOptions.querySelectorAll(".option-chip").forEach((button) => button.classList.remove("active"));
      optionButton.classList.add("active");
    });

    productAddToCart.addEventListener("click", () => {
      const product = products.get(activeProductId);
      if (!product) return;
      const selectedSize = getActiveSize();
      const selectedOption = getActiveOption();
      if (!selectedSize) {
        showToast("Спочатку виберіть розмір");
        return;
      }
      if (product.options.length && !selectedOption) {
        showToast("Спочатку виберіть опцію");
        return;
      }
      addToCart(product, selectedSize, selectedOption);
    });
    productSizeChart.addEventListener("click", () => {
      const product = products.get(activeProductId);
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

    cartBtn.addEventListener("click", openCart);
    closeCart.addEventListener("click", hideCart);
    overlay.addEventListener("click", hideCart);
    closeProduct.addEventListener("click", () => hideProduct());
    closeSizeChart.addEventListener("click", hideSizeChart);
    closeTeamModal.addEventListener("click", hideTeamModal);
    productBack.addEventListener("click", () => hideProduct());
    productOverlay.addEventListener("click", () => {
      hideSizeChart();
      hideSuccessModal();
      hideCheckoutModal();
      hideTeamModal();
      hideProduct();
    });
    menuToggle.addEventListener("click", toggleHeaderMenu);
    headerLinks.forEach((link) => link.addEventListener("click", closeHeaderMenu));
    document.addEventListener("click", (event) => {
      if (!body.classList.contains("menu-open")) return;
      if (event.target.closest(".header")) return;
      closeHeaderMenu();
    });
    desktopHeaderMedia.addEventListener("change", syncHeaderMenu);
    clearCart.addEventListener("click", () => { cart.clear(); renderCart(); showToast("Кошик очищено"); });
    applyPromo.addEventListener("click", () => {
      promoApplied = promoInput.value.trim().toUpperCase() === "SIGNA";
      renderCart();
      showToast(promoApplied ? "Промокод SIGNA застосовано" : "Промокод не знайдено");
    });
    promoInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyPromo.click();
    });
    checkout.addEventListener("click", openCheckoutModal);
    closeCheckoutModal.addEventListener("click", hideCheckoutModal);
    closeSuccessModal.addEventListener("click", hideSuccessModal);
    checkoutBack.addEventListener("click", () => {
      hideCheckoutModal();
      openCart();
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
        showToast("Заповніть усі поля замовлення");
        return;
      }
      const subtotal = [...cart.values()].reduce((sum, item) => sum + item.qty * item.price, 0);
      const discount = promoApplied ? Math.round(subtotal * promoDiscountPercent) : 0;
      const total = subtotal - discount;
      if (!confirmOrderDetails.checked) {
        showToast("Підтвердіть замовлення галочкою");
        return;
      }
      const confirmMessage = `Підтвердити замовлення ${currentOrderNumber || "ENTRYFRAG"} на суму ${money(total)}?`;
      if (!window.confirm(confirmMessage)) {
        showToast("Підтвердження замовлення скасовано");
        return;
      }
      const completedOrder = currentOrderNumber || createOrderNumber();
      const orderItems = [...cart.values()].map((item, index) => `${index + 1}. ${item.name} | Розмір: ${item.size}${item.option ? ` | Опція: ${item.option}` : ""} | К-сть: ${item.qty} | Сума: ${money(item.qty * item.price)}`).join("\n");
      const telegramMessage = [
        `Нове замовлення ${completedOrder}`,
        ``,
        `ПІБ: ${form.get("customerName")}`,
        `Телефон: ${form.get("customerPhone")}`,
        `Telegram: ${form.get("customerTelegram")}`,
        `Місто: ${novaPoshtaCity.value}`,
        `Відділення НП: ${form.get("novaPoshtaBranch")}`,
        ``,
        `Товари:`,
        `${orderItems}`,
        ``,
        `Промокод: ${promoApplied ? "SIGNA (-5%)" : "немає"}`,
        `Разом: ${money(total)}`
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
        promo: promoApplied ? "SIGNA (-5%)" : "none",
        status: "sent"
      };
      const telegramPayload = {
        message: telegramMessage,
        orderNumber: completedOrder,
        replyMarkup: {
          inline_keyboard: [[
            {
              text: "Відправлено",
              callback_data: `done:${completedOrder}`
            }
          ]]
        }
      };
      try {
        const result = await submitOrderToServer(payload, telegramPayload);
        if (result?.warning === "telegram_unreachable") {
          finalizeOrderSuccess("Замовлення збережено, але Telegram зараз недоступний");
          return;
        }
      } catch (error) {
        console.error("order submit failed", error);
        if (String(error.message).includes("backend_not_configured")) {
          showToast("Backend не підключений. Заповни ENTRYFRAG_API_URL у config")
        } else if (String(error.message).includes("telegram_send_failed") || String(error.message).includes("telegram_not_configured")) {
          showToast("Бот не прив'язаний до Telegram. Напишіть /start або /bindmanager у бот")
        } else if (String(error.message).includes("missing_bot_token") || String(error.message).includes("missing_chat_id")) {
          showToast("На сервері не заповнений Telegram token або chat id")
        } else {
          showToast("Не вдалося надіслати замовлення")
        }
        return;
      }
      finalizeOrderSuccess(`Замовлення ${completedOrder} оформлено`);
    });
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (body.classList.contains("sizechart-open")) hideSizeChart();
      else if (body.classList.contains("success-open")) hideSuccessModal();
      else if (body.classList.contains("checkout-open")) hideCheckoutModal();
      else if (body.classList.contains("team-open")) hideTeamModal();
      else if (body.classList.contains("product-open")) hideProduct();
      else if (body.classList.contains("cart-open")) hideCart();
      else closeHeaderMenu();
    });
    window.addEventListener("hashchange", () => {
      if (!location.hash.startsWith("#product-") && body.classList.contains("product-open")) {
        hideProduct(false);
        return;
      }
      if (location.hash.startsWith("#product-")) openProduct(location.hash.replace("#product-", ""), false);
    });

    syncHeaderMenu();

    renderHeroLatest();
    renderTeams();
    if (location.hash.startsWith("#product-")) openProduct(location.hash.replace("#product-", ""), false);
    renderCart();
  
