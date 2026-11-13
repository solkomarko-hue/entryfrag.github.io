(() => {
  const tabs = [...document.querySelectorAll(".admin-tab")];
  const list = document.getElementById("adminProductList");
  const categoryList = document.getElementById("adminCategoryList");
  const search = document.getElementById("productSearch");
  const filter = document.getElementById("productVisibilityFilter");
  const status = document.getElementById("productStatus");
  const refresh = document.getElementById("refreshProducts");
  const counts = document.getElementById("productCounts");
  const dialog = document.getElementById("productEditor");
  const form = document.getElementById("productEditorForm");
  const save = document.getElementById("saveProduct");
  const editorStatus = document.getElementById("productEditorStatus");
  const base = (window.ENTRYFRAG_API_URL || "").trim().replace(/\/$/, "");
  const endpoint = base + "/api/admin/products";
  let products = [];
  let categories = [];
  let loaded = false;
  let busy = false;
  let editing = null;
  const money = value => new Intl.NumberFormat("uk-UA").format(value) + " ₴";

  function message(node, text, error = false) {
    node.textContent = text;
    node.classList.toggle("is-error", error);
  }
  async function request(path = "", body) {
    const auth = sessionStorage.getItem("entryfrag-admin-auth");
    if (!auth) throw new Error("Please log in again.");
    const url = path === "/categories/update" ? base + "/api/admin/categories/update" : endpoint + path;
    const response = await fetch(url, {
      method: body ? "POST" : "GET", cache: "no-store",
      headers: { Authorization: auth, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status === 401) {
      sessionStorage.removeItem("entryfrag-admin-access");
      sessionStorage.removeItem("entryfrag-admin-auth");
      location.replace("./index.html");
      throw new Error("Please log in again.");
    }
    if (response.status === 404) throw new Error("Product management requires the updated Node backend (npm start).");
    const payload = await response.json();
    if (!response.ok) {
      if (payload.error === "product_version_conflict") throw new Error("This catalog entry changed in another session. Close the editor and refresh products before trying again.");
      if (response.status >= 500) throw new Error("Product storage is unavailable. Your changes were not saved. Try again.");
      throw new Error("Check the fields and try again. " + (payload.error || ""));
    }
    return payload;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function categoryHidden(product) {
    return categories.some(category => category.id === product.categoryId && !category.visible);
  }
  function renderCategories() {
    categoryList.replaceChildren();
    for (const category of categories) {
      const row = element("article", "admin-category-row");
      const info = element("div", "admin-product-info");
      info.append(element("h4", "", category.name), element("small", "", category.productCount + " товарів"));
      const badge = element("span", "product-badge " + (category.visible ? "is-visible" : "is-hidden"),
        category.visible ? "Видима" : "Прихована");
      const toggle = element("button", "product-toggle", category.visible ? "Приховати категорію" : "Показати категорію");
      toggle.type = "button";
      toggle.dataset.toggleCategory = category.id;
      toggle.disabled = busy;
      toggle.setAttribute("aria-label", (category.visible ? "Приховати категорію " : "Показати категорію ") + category.name);
      row.append(info, badge, toggle);
      categoryList.append(row);
    }
  }
  function render() {
    renderCategories();
    const query = search.value.trim().toLocaleLowerCase();
    const matching = products.filter(product => {
      const storefrontVisible = product.visible && !categoryHidden(product);
      const visibility = filter.value === "all" || storefrontVisible === (filter.value === "visible");
      return visibility && [product.name, product.category, product.id].some(value => value.toLocaleLowerCase().includes(query));
    });
    const visibleCount = products.filter(product => product.visible && !categoryHidden(product)).length;
    counts.textContent = products.length + " products · " + visibleCount + " visible · " + (products.length - visibleCount) + " hidden";
    list.replaceChildren();
    for (const product of matching) {
      const row = element("article", "admin-product-row");
      const image = element("img", "admin-product-image");
      image.src = new URL(product.images[0], location.href).href;
      image.alt = "";
      image.loading = "lazy";
      const info = element("div", "admin-product-info");
      info.append(element("h3", "", product.name), element("p", "", product.category + " · " + money(product.price)), element("small", "", product.id));
      const storefrontVisible = product.visible && !categoryHidden(product);
      const label = !product.visible ? "Hidden" : categoryHidden(product) ? "Категорію приховано" : "Visible";
      const badge = element("span", "product-badge " + (storefrontVisible ? "is-visible" : "is-hidden"), label);
      const actions = element("div", "product-row-actions");
      const edit = element("button", "editor-cancel", "Edit");
      edit.type = "button";
      edit.dataset.editProduct = product.id;
      edit.disabled = busy;
      const toggle = element("button", "product-toggle", product.visible ? "Hide from site" : "Show on site");
      toggle.type = "button";
      toggle.dataset.toggleProduct = product.id;
      toggle.setAttribute("aria-label", (product.visible ? "Hide " : "Show ") + product.name);
      toggle.disabled = busy;
      actions.append(edit, toggle);
      row.append(image, info, badge, actions);
      list.append(row);
    }
    if (!matching.length) list.append(element("p", "empty-state", "No products match your search."));
  }
  async function load() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    message(status, "Loading products…");
    try {
      const payload = await request();
      if (!Array.isArray(payload.products)) throw new Error("The catalog response was invalid.");
      products = payload.products;
      categories = Array.isArray(payload.categories) ? payload.categories : [];
      loaded = true;
      message(status, "Edits are shared across the storefront after saving. Hidden products can be shown again at any time.");
    } catch (error) {
      message(status, error.message, true);
    } finally {
      busy = false;
      refresh.disabled = false;
      if (loaded) render();
    }
  }
  function activateTab(tab) {
    tabs.forEach(button => {
      const selected = button === tab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById(button.getAttribute("aria-controls")).hidden = !selected;
    });
    if (tab.id === "productsTab" && !loaded) load();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      activateTab(tabs[next]);
    });
  });
  function closeEditor() {
    if (!busy) { dialog.close(); editing = null; }
  }
  refresh.addEventListener("click", load);
  categoryList.addEventListener("click", async event => {
    const toggle = event.target.closest("[data-toggle-category]");
    if (busy || !toggle) return;
    const category = categories.find(category => category.id === toggle.dataset.toggleCategory);
    if (!category) return;
    busy = true;
    render();
    message(status, "Зберігаю видимість категорії…");
    try {
      const { category: saved } = await request("/categories/update", {
        id: category.id, visible: !category.visible, expectedVersion: category.version
      });
      categories = categories.map(item => item.id === saved.id ? saved : item);
      message(status, "Категорія «" + saved.name + "» " + (saved.visible ? "видима на сайті." : "прихована разом з усіма її товарами."));
    } catch (error) {
      message(status, error.message, true);
    } finally { busy = false; render(); }
  });
  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  document.getElementById("closeProductEditor").addEventListener("click", closeEditor);
  document.getElementById("cancelProductEditor").addEventListener("click", closeEditor);
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  list.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-product]");
    const toggle = event.target.closest("[data-toggle-product]");
    if (busy || (!edit && !toggle)) return;
    const product = products.find(product => product.id === (edit?.dataset.editProduct || toggle?.dataset.toggleProduct));
    if (!product) return;
    if (edit) {
      editing = product;
      document.getElementById("productEditorTitle").textContent = product.name;
      document.getElementById("productEditorId").textContent = product.id;
      for (const [key, value] of Object.entries(product)) {
        const input = form.elements.namedItem(key);
        if (!input) continue;
        if (key === "visible") input.checked = value;
        else input.value = Array.isArray(value) ? value.join(["images", "sizeChart"].includes(key) ? "\n" : ", ") : value;
      }
      message(editorStatus, "");
      dialog.showModal();
      form.elements.namedItem("name").focus();
      return;
    }
    busy = true;
    render();
    message(status, "Saving visibility…");
    try {
      const { product: saved } = await request("/update", {
        id: product.id, expectedVersion: product.version, patch: { visible: !product.visible }
      });
      products = products.map(item => item.id === saved.id ? saved : item);
      message(status, saved.name + (saved.visible ? " is now visible on the site." : " is now hidden from the site."));
    } catch (error) {
      message(status, error.message, true);
    } finally { busy = false; render(); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !editing) return;
    const patch = {};
    for (const key of ["name", "category", "description"]) patch[key] = form.elements.namedItem(key).value.trim();
    patch.price = Number(form.elements.namedItem("price").value);
    patch.visible = form.elements.namedItem("visible").checked;
    for (const key of ["sizes", "options", "images", "sizeChart"]) {
      const separator = ["images", "sizeChart"].includes(key) ? /\r?\n/ : /,/;
      patch[key] = form.elements.namedItem(key).value.split(separator).map(value => value.trim()).filter(Boolean);
    }
    busy = true;
    save.disabled = true;
    save.textContent = "Saving…";
    message(editorStatus, "");
    try {
      const { product: saved } = await request("/update", { id: editing.id, patch, expectedVersion: editing.version });
      products = products.map(product => product.id === saved.id ? saved : product);
      dialog.close();
      editing = null;
      message(status, saved.name + " saved.");
    } catch (error) {
      message(editorStatus, error.message, true);
    } finally {
      busy = false;
      save.disabled = false;
      save.textContent = "Save product";
      render();
    }
  });
})();
