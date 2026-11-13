(() => {
  const cards = [...document.querySelectorAll(".products .card")];
  window.entryfragOriginalImages = new Set(cards.flatMap(card => [...card.querySelectorAll("[data-bg]")].map(node => node.dataset.bg)));
  const baseUrl = (window.ENTRYFRAG_API_URL || "").trim().replace(/\/$/, "");
  const catalogUrl = baseUrl + "/api/products";
  window.entryfragCatalogUrl = catalogUrl;
  document.documentElement.classList.add("catalog-loading");
  window.entryfragCatalogReady = (async () => {
    if (location.protocol === "file:") return;
    try {
      const response = await fetch(catalogUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      // The legacy local PowerShell server and static previews have no catalog API.
      if (response.status === 404) return;
      if (!response.ok) throw new Error("catalog_unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.products)) throw new Error("catalog_unavailable");
      if (Array.isArray(payload.categories)) {
        const visibleCategories = new Set(payload.categories.map(category => category.id));
        for (const section of document.querySelectorAll("section[id]")) {
          if (!section.querySelector(".products") || visibleCategories.has(section.id)) continue;
          for (const link of document.querySelectorAll('a[href="#' + section.id + '"]')) link.remove();
          section.remove();
        }
      }
      const visible = new Map(payload.products.map(product => [product.id, product]));
      for (const card of cards) {
        const button = card.querySelector(".add-btn");
        const product = visible.get(button?.dataset.id);
        if (!product || product.visible !== true) {
          card.remove();
          continue;
        }
        card.querySelector(".meta h3").textContent = product.name;
        card.querySelector(".meta p").textContent = product.description;
        button.dataset.name = product.name;
        button.dataset.category = product.category;
        button.dataset.price = String(product.price);
        button.dataset.sizes = product.sizes.join(",");
        button.dataset.options = product.options.join(",");
        button.dataset.sizeChart = product.sizeChart.join(",");
        const visual = card.querySelector(".visual");
        visual.replaceChildren();
        visual.classList.remove("gallery");
        delete visual.dataset.bg;
        for (const image of product.images) {
          const shot = document.createElement("div");
          shot.className = "gallery-shot";
          shot.dataset.bg = image;
          visual.append(shot);
        }
      }
    } catch {
      cards.forEach(card => card.remove());
      const message = document.createElement("p");
      message.className = "catalog-load-error";
      message.setAttribute("role", "alert");
      message.textContent = "Не вдалося завантажити каталог. Оновіть сторінку, щоб спробувати ще раз.";
      document.querySelector(".products")?.before(message);
    } finally {
      document.documentElement.classList.remove("catalog-loading");
    }
  })().finally(() => document.documentElement.classList.remove("catalog-loading"));
})();
