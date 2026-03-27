(function () {
  const state = {
    language: localStorage.getItem("automarket_lang") || "es",
    role: localStorage.getItem("automarket_role") || "buyer",
    cars: [...window.APP_CARS],
    filteredCars: [],
    selectedForCompare: new Set(),
    wishlist: new Set(JSON.parse(localStorage.getItem("automarket_wishlist") || "[]")),
    filters: {
      brand: "",
      model: "",
      yearMin: "",
      yearMax: "",
      priceMin: "",
      priceMax: "",
      kmMax: "",
      province: "",
      fuel: "",
      transmission: ""
    },
    brandsCatalog: [],
    provincesCatalog: []
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    await loadCatalogs();
    renderFilterForms();
    hydrateQuickSearch();
    bindEvents();
    applyLanguage(state.language);
    updateRoleLabels();
    updatePublishVisibility();
    runFilters();
    el.currentYear.textContent = new Date().getFullYear();
    el.metricCars.textContent = String(state.cars.length);
  }

  function cacheElements() {
    el.languageSelect = document.getElementById("languageSelect");
    el.roleSelect = document.getElementById("roleSelect");
    el.metricCars = document.getElementById("metricCars");
    el.currentYear = document.getElementById("currentYear");
    el.filtersContainer = document.getElementById("filtersContainer");
    el.filtersContainerMobile = document.getElementById("filtersContainerMobile");
    el.applyFiltersButton = document.getElementById("applyFiltersButton");
    el.clearFiltersButton = document.getElementById("clearFiltersButton");
    el.applyFiltersMobileButton = document.getElementById("applyFiltersMobileButton");
    el.clearFiltersMobileButton = document.getElementById("clearFiltersMobileButton");
    el.carsGrid = document.getElementById("carsGrid");
    el.emptyState = document.getElementById("emptyState");
    el.resultCount = document.getElementById("resultCount");
    el.compareSelectedButton = document.getElementById("compareSelectedButton");
    el.compareWishlistButton = document.getElementById("compareWishlistButton");
    el.wishlistCompareButton = document.getElementById("wishlistCompareButton");
    el.compareTableContainer = document.getElementById("compareTableContainer");
    el.wishlistItems = document.getElementById("wishlistItems");
    el.quickBrand = document.getElementById("quickBrand");
    el.quickModel = document.getElementById("quickModel");
    el.quickMinPrice = document.getElementById("quickMinPrice");
    el.quickMaxPrice = document.getElementById("quickMaxPrice");
    el.heroSearchForm = document.getElementById("heroSearchForm");
    el.publishNavItem = document.getElementById("publishNavItem");
    el.heroPublishButton = document.getElementById("heroPublishButton");
  }

  async function loadCatalogs() {
    const [brandsResponse, provincesResponse] = await Promise.all([
      fetch("./src/data/car-brands.json"),
      fetch("./src/data/provinces.json")
    ]);

    const brandsData = await brandsResponse.json();
    const provincesData = await provincesResponse.json();

    state.brandsCatalog = brandsData.marcas;
    state.provincesCatalog = provincesData.provincias;
  }

  function bindEvents() {
    el.languageSelect.value = state.language;
    el.roleSelect.value = state.role;

    el.roleSelect.addEventListener("change", (event) => {
      state.role = event.target.value;
      localStorage.setItem("automarket_role", state.role);
      updatePublishVisibility();
      updateRoleLabels();
    });

    el.languageSelect.addEventListener("change", (event) => {
      state.language = event.target.value;
      localStorage.setItem("automarket_lang", state.language);
      applyLanguage(state.language);
      updateRoleLabels();
      renderFilterForms();
      hydrateQuickSearch();
      renderCars();
      renderWishlist();
    });

    el.applyFiltersButton.addEventListener("click", applyFiltersFromDesktop);
    el.clearFiltersButton.addEventListener("click", clearAllFilters);
    el.applyFiltersMobileButton.addEventListener("click", applyFiltersFromMobile);
    el.clearFiltersMobileButton.addEventListener("click", clearAllFilters);

    el.compareSelectedButton.addEventListener("click", () => openCompareModal([...state.selectedForCompare]));
    el.compareWishlistButton.addEventListener("click", compareFromWishlistSelection);
    el.wishlistCompareButton.addEventListener("click", compareFromWishlistSelection);

    el.heroSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.filters.brand = el.quickBrand.value;
      state.filters.model = el.quickModel.value;
      state.filters.priceMin = el.quickMinPrice.value;
      state.filters.priceMax = el.quickMaxPrice.value;
      syncFilterInputs("desktop");
      syncFilterInputs("mobile");
      runFilters();
      document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
    });

    el.quickBrand.addEventListener("change", (event) => {
      updateQuickModels(event.target.value);
    });

    el.heroPublishButton.addEventListener("click", onPublishClick);
    el.publishNavItem.addEventListener("click", onPublishClick);
  }

  function onPublishClick(event) {
    event.preventDefault();
    if (state.role !== "seller") {
      alert(t("msg.publishOnlySeller"));
      return;
    }
    alert(t("msg.publishNextPart"));
  }

  function applyLanguage(lang) {
    const dictionary = window.I18N[lang] || window.I18N.es;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (dictionary[key]) {
        node.textContent = dictionary[key];
      }
    });

    document.getElementById("quickMinPrice").placeholder = t("label.priceMin");
    document.getElementById("quickMaxPrice").placeholder = t("label.priceMax");
  }

  function updatePublishVisibility() {
    el.publishNavItem.style.display = state.role === "seller" ? "list-item" : "none";
    el.heroPublishButton.style.display = state.role === "seller" ? "inline-block" : "none";
  }

  function updateRoleLabels() {
    const buyerOption = el.roleSelect.querySelector('option[value="buyer"]');
    const sellerOption = el.roleSelect.querySelector('option[value="seller"]');
    buyerOption.textContent = t("role.buyer");
    sellerOption.textContent = t("role.seller");
  }

  function t(key) {
    return (window.I18N[state.language] && window.I18N[state.language][key]) || key;
  }

  function renderFilterForms() {
    const formMarkup = buildFiltersMarkup();
    el.filtersContainer.innerHTML = formMarkup;
    el.filtersContainerMobile.innerHTML = formMarkup;
    setupDynamicModelOptions("desktop");
    setupDynamicModelOptions("mobile");
    syncFilterInputs("desktop");
    syncFilterInputs("mobile");
  }

  function buildFiltersMarkup() {
    const brandOptions = [`<option value="">${t("placeholder.any")}</option>`]
      .concat(state.brandsCatalog.map((item) => `<option value="${item.marca}">${item.marca}</option>`))
      .join("");

    const provinceOptions = [`<option value="">${t("placeholder.any")}</option>`]
      .concat(state.provincesCatalog.map((item) => `<option value="${item}">${item}</option>`))
      .join("");

    return `
      <div class="mb-2">
        <label class="form-label small">${t("label.brand")}</label>
        <select class="form-select" data-filter-key="brand" data-filter-scope="generic">${brandOptions}</select>
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.model")}</label>
        <select class="form-select" data-filter-key="model" data-filter-scope="model">
          <option value="">${t("placeholder.any")}</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.yearMin")}</label>
        <input class="form-control" type="number" min="1960" max="2030" data-filter-key="yearMin" />
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.yearMax")}</label>
        <input class="form-control" type="number" min="1960" max="2030" data-filter-key="yearMax" />
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.priceMin")}</label>
        <input class="form-control" type="number" min="0" data-filter-key="priceMin" />
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.priceMax")}</label>
        <input class="form-control" type="number" min="0" data-filter-key="priceMax" />
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.kmMax")}</label>
        <input class="form-control" type="number" min="0" data-filter-key="kmMax" />
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.province")}</label>
        <select class="form-select" data-filter-key="province">${provinceOptions}</select>
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.fuel")}</label>
        <select class="form-select" data-filter-key="fuel">
          <option value="">${t("placeholder.any")}</option>
          <option value="Nafta">Nafta</option>
          <option value="Diesel">Diesel</option>
          <option value="Hibrido">Hibrido</option>
          <option value="Electrico">Electrico</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="form-label small">${t("label.transmission")}</label>
        <select class="form-select" data-filter-key="transmission">
          <option value="">${t("placeholder.any")}</option>
          <option value="Manual">Manual</option>
          <option value="Automatica">Automatica</option>
        </select>
      </div>
    `;
  }

  function setupDynamicModelOptions(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    const brandSelect = container.querySelector('[data-filter-key="brand"]');
    const modelSelect = container.querySelector('[data-filter-key="model"]');

    brandSelect.addEventListener("change", () => {
      fillModelOptions(modelSelect, brandSelect.value);
    });

    fillModelOptions(modelSelect, state.filters.brand);
  }

  function fillModelOptions(targetSelect, brandValue) {
    const matching = state.brandsCatalog.find((item) => item.marca === brandValue);
    const models = matching ? matching.modelos : [];
    targetSelect.innerHTML = [`<option value="">${t("placeholder.any")}</option>`]
      .concat(models.map((model) => `<option value="${model}">${model}</option>`))
      .join("");

    if (models.includes(state.filters.model)) {
      targetSelect.value = state.filters.model;
    } else {
      targetSelect.value = "";
    }
  }

  function hydrateQuickSearch() {
    const options = [`<option value="">${t("placeholder.selectBrand")}</option>`]
      .concat(state.brandsCatalog.map((item) => `<option value="${item.marca}">${item.marca}</option>`))
      .join("");
    el.quickBrand.innerHTML = options;
    updateQuickModels("");
  }

  function updateQuickModels(brandValue) {
    const matching = state.brandsCatalog.find((item) => item.marca === brandValue);
    const models = matching ? matching.modelos : [];
    el.quickModel.innerHTML = [`<option value="">${t("placeholder.selectModel")}</option>`]
      .concat(models.map((model) => `<option value="${model}">${model}</option>`))
      .join("");
  }

  function applyFiltersFromDesktop() {
    pullFilterValues("desktop");
    runFilters();
  }

  function applyFiltersFromMobile() {
    pullFilterValues("mobile");
    runFilters();
  }

  function pullFilterValues(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    container.querySelectorAll("[data-filter-key]").forEach((node) => {
      state.filters[node.dataset.filterKey] = node.value.trim();
    });
    syncFilterInputs(scope === "desktop" ? "mobile" : "desktop");
  }

  function syncFilterInputs(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    if (!container) return;

    const brandNode = container.querySelector('[data-filter-key="brand"]');
    const modelNode = container.querySelector('[data-filter-key="model"]');

    if (brandNode && brandNode.value !== state.filters.brand) {
      brandNode.value = state.filters.brand;
      fillModelOptions(modelNode, state.filters.brand);
    }

    container.querySelectorAll("[data-filter-key]").forEach((node) => {
      const key = node.dataset.filterKey;
      if (key === "model") {
        fillModelOptions(modelNode, state.filters.brand);
      }
      node.value = state.filters[key];
    });
  }

  function clearAllFilters() {
    state.filters = {
      brand: "",
      model: "",
      yearMin: "",
      yearMax: "",
      priceMin: "",
      priceMax: "",
      kmMax: "",
      province: "",
      fuel: "",
      transmission: ""
    };

    el.quickBrand.value = "";
    updateQuickModels("");
    el.quickMinPrice.value = "";
    el.quickMaxPrice.value = "";

    syncFilterInputs("desktop");
    syncFilterInputs("mobile");
    runFilters();
  }

  function runFilters() {
    state.filteredCars = state.cars.filter((car) => {
      const checks = [
        !state.filters.brand || normalize(car.brand) === normalize(state.filters.brand),
        !state.filters.model || normalize(car.model) === normalize(state.filters.model),
        !state.filters.yearMin || car.year >= Number(state.filters.yearMin),
        !state.filters.yearMax || car.year <= Number(state.filters.yearMax),
        !state.filters.priceMin || car.price >= Number(state.filters.priceMin),
        !state.filters.priceMax || car.price <= Number(state.filters.priceMax),
        !state.filters.kmMax || car.kilometers <= Number(state.filters.kmMax),
        !state.filters.province || normalize(car.province) === normalize(state.filters.province),
        !state.filters.fuel || normalize(car.fuel) === normalize(state.filters.fuel),
        !state.filters.transmission || normalize(car.transmission) === normalize(state.filters.transmission)
      ];
      return checks.every(Boolean);
    });

    renderCars();
    renderWishlist();
    el.resultCount.textContent = `${state.filteredCars.length} ${state.language === "es" ? "resultados" : "results"}`;
    el.emptyState.classList.toggle("d-none", state.filteredCars.length !== 0);
  }

  function renderCars() {
    el.carsGrid.innerHTML = "";

    state.filteredCars.forEach((car, index) => {
      const col = document.createElement("article");
      col.className = "col-md-6";

      const selected = state.selectedForCompare.has(car.id) ? "checked" : "";
      const inWishlist = state.wishlist.has(car.id);
      const statusClass = `status-${car.aiStatus}`;
      const statusLabel = mapAiStatus(car.aiStatus);

      col.innerHTML = `
        <div class="car-card h-100" style="animation-delay:${index * 60}ms">
          <div class="car-image-wrap">
            <img src="${car.image}" alt="${car.brand} ${car.model}" class="car-image" />
            <span class="badge-ai position-absolute top-0 end-0 m-2">IA</span>
          </div>
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <h3 class="h6 mb-1">${car.brand} ${car.model}</h3>
                <p class="text-muted small mb-2">${car.year} | ${car.kilometers.toLocaleString()} km | ${car.province}</p>
              </div>
              <span class="badge ${statusClass}">${statusLabel}</span>
            </div>
            <p class="fw-bold h5 mb-2">USD ${car.price.toLocaleString()}</p>
            <p class="small text-muted mb-3">${car.aiDamages}</p>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary-red" data-action="detail" data-id="${car.id}">${t("cta.ask")}</button>
              <button class="btn btn-sm btn-outline-dark" data-action="wishlist" data-id="${car.id}">
                ${inWishlist ? t("cta.removeWishlist") : t("cta.addWishlist")}
              </button>
              <label class="form-check-label small d-flex align-items-center gap-2 ms-auto">
                <input class="form-check-input compare-checkbox" type="checkbox" ${selected} data-action="compare" data-id="${car.id}" />
                ${t("cta.selectCompare")}
              </label>
            </div>
          </div>
        </div>
      `;

      el.carsGrid.appendChild(col);
      requestAnimationFrame(() => {
        const card = col.querySelector(".car-card");
        card.classList.add("show", "fade-up");
      });
    });

    el.carsGrid.querySelectorAll("[data-action]").forEach((node) => {
      const action = node.dataset.action;
      const id = Number(node.dataset.id);
      if (action === "compare") {
        node.addEventListener("change", (event) => toggleCompare(id, event.target.checked));
      }
      if (action === "wishlist") {
        node.addEventListener("click", () => toggleWishlist(id));
      }
      if (action === "detail") {
        node.addEventListener("click", () => {
          alert("En la Parte 2 conectamos esta accion con la pagina de detalle real del vehiculo.");
        });
      }
    });

    updateCompareButtonState();
  }

  function toggleCompare(id, shouldSelect) {
    if (shouldSelect && state.selectedForCompare.size >= 4) {
      alert(t("msg.maxCompare"));
      renderCars();
      return;
    }

    if (shouldSelect) {
      state.selectedForCompare.add(id);
    } else {
      state.selectedForCompare.delete(id);
    }

    updateCompareButtonState();
  }

  function updateCompareButtonState() {
    el.compareSelectedButton.disabled = state.selectedForCompare.size < 2;
  }

  function toggleWishlist(id) {
    if (state.wishlist.has(id)) {
      state.wishlist.delete(id);
    } else {
      state.wishlist.add(id);
    }

    localStorage.setItem("automarket_wishlist", JSON.stringify([...state.wishlist]));
    renderCars();
    renderWishlist();
  }

  function renderWishlist() {
    const wishlistCars = state.cars.filter((car) => state.wishlist.has(car.id));
    if (!wishlistCars.length) {
      el.wishlistItems.innerHTML = `<p class="text-muted small mb-0">${state.language === "es" ? "No hay autos en deseados aun." : "No saved cars yet."}</p>`;
      return;
    }

    el.wishlistItems.innerHTML = wishlistCars
      .map((car) => {
        return `
          <div class="border rounded-3 p-2 mb-2">
            <label class="d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input" data-wishlist-compare-id="${car.id}" />
              <span class="small"><strong>${car.brand} ${car.model}</strong><br/>USD ${car.price.toLocaleString()}</span>
            </label>
          </div>
        `;
      })
      .join("");
  }

  function compareFromWishlistSelection() {
    const selectedIds = [...document.querySelectorAll("[data-wishlist-compare-id]:checked")].map((node) => Number(node.dataset.wishlistCompareId));
    openCompareModal(selectedIds);
  }

  function openCompareModal(ids) {
    const uniqueIds = [...new Set(ids)].slice(0, 4);
    if (uniqueIds.length < 2) {
      alert(t("msg.minCompare"));
      return;
    }

    const cars = uniqueIds
      .map((id) => state.cars.find((item) => item.id === id))
      .filter(Boolean);

    el.compareTableContainer.innerHTML = buildCompareTable(cars);
    const modal = new bootstrap.Modal(document.getElementById("compareModal"));
    modal.show();
  }

  function buildCompareTable(cars) {
    const rows = [
      { key: "table.photo", render: (car) => `<img src="${car.image}" alt="${car.brand} ${car.model}" class="img-fluid rounded-3" style="min-width:180px; max-height:120px; object-fit:cover;"/>` },
      { key: "table.price", render: (car) => `USD ${car.price.toLocaleString()}` },
      { key: "table.year", render: (car) => car.year },
      { key: "table.km", render: (car) => `${car.kilometers.toLocaleString()} km` },
      { key: "table.province", render: (car) => `${car.city}, ${car.province}` },
      { key: "table.fuel", render: (car) => car.fuel },
      { key: "table.transmission", render: (car) => car.transmission },
      { key: "table.ai", render: (car) => mapAiStatus(car.aiStatus) },
      { key: "table.aiRange", render: (car) => car.aiPriceRange }
    ];

    const head = cars.map((car) => `<th class="text-center">${car.brand} ${car.model}</th>`).join("");

    const body = rows
      .map((row) => {
        const values = cars.map((car) => `<td class="text-center align-middle">${row.render(car)}</td>`).join("");
        return `<tr><th>${t(row.key)}</th>${values}</tr>`;
      })
      .join("");

    return `
      <div class="table-responsive">
        <table class="table align-middle">
          <thead class="table-light sticky-top">
            <tr>
              <th>Campo</th>
              ${head}
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function mapAiStatus(status) {
    if (status === "excellent") return state.language === "es" ? "Excelente" : "Excellent";
    if (status === "good") return state.language === "es" ? "Bueno" : "Good";
    if (status === "fair") return state.language === "es" ? "Regular" : "Fair";
    return state.language === "es" ? "Requiere reparacion" : "Needs repair";
  }

  function normalize(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
})();
