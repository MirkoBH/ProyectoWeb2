(function () {
  const REQUEST_TIMEOUT_MS = 2500;

  const state = {
    apiBaseUrl: localStorage.getItem("automarket_api_base_url") || "http://localhost:3000",
    language: localStorage.getItem("automarket_lang") || "es",
    role: localStorage.getItem("automarket_role") || "buyer",
    authToken: localStorage.getItem("automarket_auth_token") || "",
    currentUser: JSON.parse(localStorage.getItem("automarket_user") || "null"),
    cars: [...window.APP_CARS],
    questionsByCar: JSON.parse(localStorage.getItem("automarket_questions_by_car") || "{}"),
    filteredCars: [],
    selectedForCompare: new Set(),
    wishlist: new Set((JSON.parse(localStorage.getItem("automarket_wishlist") || "[]") || []).map(String)),
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
    minAllowedYear: 1950,
    currentYear: new Date().getUTCFullYear(),
    isHydrating: false,
    hydrationRunId: 0,
    brandsCatalog: [],
    provincesCatalog: []
  };

  const el = {};
  const searchableSelects = new Map();
  let searchableRefreshHandle = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    state.cars = state.cars.map(normalizeCarForUi);

    if (state.currentUser?.role) {
      state.role = state.currentUser.role;
    }

    cacheElements();
    await loadCatalogs();
    configurePublishYearInput();
    renderFilterForms();
    hydrateQuickSearch();
    bindEvents();
    applyLanguage(state.language);
    updateRoleLabels();
    updatePublishVisibility();
    updateAuthUi();
    initSearchableSingleSelects();
    runFilters();
    el.currentYear.textContent = state.currentYear;
    el.metricCars.textContent = String(state.cars.length);

    // Keep first paint fast using local data, then hydrate remote data in background.
    startBackgroundHydration();
  }

  async function startBackgroundHydration() {
    const runId = ++state.hydrationRunId;
    state.isHydrating = true;
    updateResultCountText();

    try {
      const previousYear = state.currentYear;
      const [yearResult, carsResult] = await Promise.allSettled([
        resolveCurrentYear(),
        refreshCarsFromApi()
      ]);

      if (runId !== state.hydrationRunId) {
        return;
      }

      if (yearResult.status === "rejected") {
        state.currentYear = new Date().getUTCFullYear();
      }

      if (state.currentYear !== previousYear) {
        configurePublishYearInput();
        renderFilterForms();
      }

      el.currentYear.textContent = state.currentYear;
      if (carsResult.status === "rejected") {
        // Keep local data silently when backend is unavailable.
      }

      runFilters();
      el.metricCars.textContent = String(state.cars.length);
    } finally {
      if (runId === state.hydrationRunId) {
        state.isHydrating = false;
        updateResultCountText();
      }
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async function resolveCurrentYear() {
    const fallbackYear = new Date().getUTCFullYear();

    try {
      const response = await fetchWithTimeout("https://worldtimeapi.org/api/timezone/Etc/UTC", {}, 1800);
      if (!response.ok) {
        throw new Error(`worldtimeapi returned ${response.status}`);
      }

      const data = await response.json();
      const rawDate = data?.utc_datetime || data?.datetime || "";
      const parsedYear = Number.parseInt(String(rawDate).slice(0, 4), 10);

      if (Number.isInteger(parsedYear) && parsedYear >= state.minAllowedYear && parsedYear <= 2200) {
        state.currentYear = parsedYear;
        return;
      }
    } catch (error) {
      // Keep fallback when the time API is unavailable.
    }

    state.currentYear = fallbackYear;
  }

  function configurePublishYearInput() {
    if (!el.publishYear) {
      return;
    }

    el.publishYear.min = String(state.minAllowedYear);
    el.publishYear.max = String(state.currentYear);

    const currentValue = Number(el.publishYear.value);
    if (currentValue > state.currentYear) {
      el.publishYear.value = String(state.currentYear);
    }
  }

  async function refreshCarsFromApi() {
    try {
      const response = await fetchWithTimeout(`${state.apiBaseUrl}/cars`);
      if (!response.ok) {
        throw new Error(`Cars endpoint returned ${response.status}`);
      }

      const cars = await response.json();
      if (Array.isArray(cars) && cars.length) {
        state.cars = cars.map(mapBackendCarToUi);
        return true;
      }
    } catch (error) {
      // Keep local mock data when backend is unavailable to avoid blocking the UI.
      console.warn("Using local mock cars because backend fetch failed.", error);
    }

    return false;
  }

  function mapBackendCarToUi(car) {
    const images = Array.isArray(car.imageUrls) && car.imageUrls.length
      ? car.imageUrls
      : (car.mainImageUrl ? [car.mainImageUrl] : []);
    const aiDamageSummary = car.aiDamageSummary || "Sin análisis de IA disponible";
    const aiPriceRange = car.aiPriceRange || "Sin rango estimado";
    const aiStatus = deriveAiStatus(car.aiStatus, aiDamageSummary, aiPriceRange);

    return {
      id: String(car.id),
      brand: car.brand,
      model: car.model,
      year: Number(car.year),
      kilometers: Number(car.kilometers),
      fuel: car.fuel,
      transmission: car.transmission,
      price: Number(car.price),
      province: car.province,
      city: car.city || "",
      description: car.description,
      images,
      image:
        car.mainImageUrl ||
        images[0] ||
        "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
      aiStatus,
      aiDamages: aiDamageSummary,
      aiPriceRange,
      questions: Array.isArray(car.questions) ? car.questions : []
    };
  }

  function normalizeCarForUi(car) {
    const images = Array.isArray(car.images)
      ? car.images
      : (car.image ? [car.image] : []);

    return {
      ...car,
      id: String(car.id),
      images,
      image: car.image || images[0] || "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
      questions: Array.isArray(car.questions) ? car.questions : []
    };
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
    el.loginNavLink = document.getElementById("loginNavLink");
    el.registerNavLink = document.getElementById("registerNavLink");
    el.logoutButton = document.getElementById("logoutButton");
    el.authUserBadge = document.getElementById("authUserBadge");
    el.loginForm = document.getElementById("loginForm");
    el.registerForm = document.getElementById("registerForm");
    el.loginFeedback = document.getElementById("loginFeedback");
    el.registerFeedback = document.getElementById("registerFeedback");
    el.loginEmail = document.getElementById("loginEmail");
    el.loginPassword = document.getElementById("loginPassword");
    el.registerName = document.getElementById("registerName");
    el.registerEmail = document.getElementById("registerEmail");
    el.registerPassword = document.getElementById("registerPassword");
    el.registerRole = document.getElementById("registerRole");
    el.publishForm = document.getElementById("publishForm");
    el.publishFeedback = document.getElementById("publishFeedback");
    el.publishBrand = document.getElementById("publishBrand");
    el.publishModel = document.getElementById("publishModel");
    el.publishYear = document.getElementById("publishYear");
    el.publishKilometers = document.getElementById("publishKilometers");
    el.publishPrice = document.getElementById("publishPrice");
    el.publishFuel = document.getElementById("publishFuel");
    el.publishTransmission = document.getElementById("publishTransmission");
    el.publishProvince = document.getElementById("publishProvince");
    el.publishCity = document.getElementById("publishCity");
    el.publishImageFiles = document.getElementById("publishImageFiles");
    el.publishDescription = document.getElementById("publishDescription");
  }

  async function loadCatalogs() {
    try {
      const [brandsResponse, provincesResponse] = await Promise.all([
        fetchWithTimeout("./src/data/car-brands.json", {}, 1800),
        fetchWithTimeout("./src/data/provinces.json", {}, 1800)
      ]);

      const brandsData = brandsResponse.ok ? await brandsResponse.json() : { marcas: [] };
      const provincesData = provincesResponse.ok ? await provincesResponse.json() : { provincias: [] };

      state.brandsCatalog = Array.isArray(brandsData.marcas) ? brandsData.marcas : [];
      state.provincesCatalog = Array.isArray(provincesData.provincias) ? provincesData.provincias : [];
    } catch (error) {
      // Keep filters available even when local catalog files fail to load.
      state.brandsCatalog = [];
      state.provincesCatalog = [];
    }

    hydratePublishFormCatalogs();
  }

  function hydratePublishFormCatalogs() {
    if (!el.publishBrand || !el.publishProvince) {
      return;
    }

    const brandOptions = state.brandsCatalog
      .map((item) => `<option value="${item.marca}">${item.marca}</option>`)
      .join("");
    const provinceOptions = state.provincesCatalog
      .map((item) => `<option value="${item}">${item}</option>`)
      .join("");

    el.publishBrand.innerHTML = brandOptions;
    el.publishProvince.innerHTML = provinceOptions;
    updatePublishModels();
    scheduleSearchableSingleSelectsRefresh();
  }

  function updatePublishModels() {
    const selectedBrand = el.publishBrand.value;
    const matching = state.brandsCatalog.find((item) => item.marca === selectedBrand);
    const models = matching ? matching.modelos : [];
    el.publishModel.innerHTML = models.map((model) => `<option value="${model}">${model}</option>`).join("");
    scheduleSearchableSingleSelectsRefresh();
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
      updateAuthUi();
      scheduleSearchableSingleSelectsRefresh();
    });

    el.loginNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      new bootstrap.Modal(document.getElementById("loginModal")).show();
    });

    el.registerNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      new bootstrap.Modal(document.getElementById("registerModal")).show();
    });

    el.logoutButton.addEventListener("click", handleLogout);
    el.loginForm.addEventListener("submit", handleLoginSubmit);
    el.registerForm.addEventListener("submit", handleRegisterSubmit);
    el.publishForm.addEventListener("submit", handlePublishSubmit);
    el.publishBrand.addEventListener("change", updatePublishModels);

    el.applyFiltersButton.addEventListener("click", applyFiltersFromDesktop);
    el.clearFiltersButton.addEventListener("click", clearAllFilters);
    el.applyFiltersMobileButton.addEventListener("click", applyFiltersFromMobile);
    el.clearFiltersMobileButton.addEventListener("click", clearAllFilters);

    el.compareSelectedButton.addEventListener("click", () => openCompareModal([...state.selectedForCompare]));
    if (el.compareWishlistButton) {
      el.compareWishlistButton.addEventListener("click", compareFromWishlistSelection);
    }
    if (el.wishlistCompareButton) {
      el.wishlistCompareButton.addEventListener("click", compareFromWishlistSelection);
    }

    if (el.heroSearchForm && el.quickBrand && el.quickModel && el.quickMinPrice && el.quickMaxPrice) {
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
    }

    el.heroPublishButton.addEventListener("click", onPublishClick);
    el.publishNavItem.addEventListener("click", onPublishClick);

    window.addEventListener("scroll", syncNavbarGlassState, { passive: true });
    syncNavbarGlassState();
  }

  function syncNavbarGlassState() {
    const navbar = document.querySelector(".glass-nav");
    if (!navbar) {
      return;
    }

    const hostHeader = navbar.closest("header");
    if (hostHeader) {
      hostHeader.style.minHeight = `${Math.ceil(navbar.offsetHeight)}px`;
    }

    const isScrolled = window.scrollY > 8;
    const shouldFollow = navbar.classList.contains("nav-follow") && window.scrollY > 24;
    navbar.classList.toggle("is-scrolled", isScrolled);
    navbar.classList.toggle("nav-follow-active", shouldFollow);
  }

  function onPublishClick(event) {
    event.preventDefault();
    if (!state.authToken) {
      alert(t("msg.loginRequired"));
      new bootstrap.Modal(document.getElementById("loginModal")).show();
      return;
    }

    if (state.role !== "seller") {
      alert(t("msg.publishOnlySeller"));
      return;
    }

    setAuthFeedback(el.publishFeedback, "", false);
    new bootstrap.Modal(document.getElementById("publishModal")).show();
  }

  function applyLanguage(lang) {
    const dictionary = window.I18N[lang] || window.I18N.es;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (dictionary[key]) {
        node.textContent = dictionary[key];
      }
    });

    if (el.quickMinPrice) {
      el.quickMinPrice.placeholder = t("label.priceMin");
    }
    if (el.quickMaxPrice) {
      el.quickMaxPrice.placeholder = t("label.priceMax");
    }
  }

  function updatePublishVisibility() {
    el.publishNavItem.style.display = state.role === "seller" ? "list-item" : "none";
    el.heroPublishButton.style.display = state.role === "seller" ? "inline-block" : "none";
  }

  function updateAuthUi() {
    const loginNavItem = el.loginNavLink?.parentElement;
    const registerNavItem = el.registerNavLink?.parentElement;

    if (state.currentUser) {
      el.authUserBadge.classList.remove("d-none");
      el.logoutButton.classList.remove("d-none");
      el.authUserBadge.textContent = `${state.currentUser.fullName} (${t(`role.${state.currentUser.role}`)})`;
      if (loginNavItem) {
        loginNavItem.classList.remove("d-none");
      }
      if (registerNavItem) {
        registerNavItem.classList.add("d-none");
      }
      el.registerNavLink.classList.add("d-none");
      el.roleSelect.disabled = true;
      return;
    }

    el.authUserBadge.classList.add("d-none");
    el.logoutButton.classList.add("d-none");
    if (loginNavItem) {
      loginNavItem.classList.remove("d-none");
    }
    if (registerNavItem) {
      registerNavItem.classList.remove("d-none");
    }
    el.registerNavLink.classList.remove("d-none");
    el.roleSelect.disabled = false;
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setAuthFeedback(el.loginFeedback, "", false);

    try {
      const response = await fetch(`${state.apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: el.loginEmail.value.trim(),
          password: el.loginPassword.value
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthFeedback(el.loginFeedback, data.message || "Login error", true);
        return;
      }

      applyAuthSuccess(data);
      bootstrap.Modal.getOrCreateInstance(document.getElementById("loginModal")).hide();
      el.loginForm.reset();
      setAuthFeedback(el.loginFeedback, "", false);
      alert(t("msg.authSuccess"));
    } catch (error) {
      setAuthFeedback(el.loginFeedback, t("msg.authNetwork"), true);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setAuthFeedback(el.registerFeedback, "", false);
    const email = el.registerEmail.value.trim();

    try {
      const response = await fetch(`${state.apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: el.registerName.value.trim(),
          email,
          password: el.registerPassword.value,
          role: el.registerRole.value
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthFeedback(el.registerFeedback, data.message || "Register error", true);
        return;
      }

      el.registerForm.reset();
      setAuthFeedback(el.registerFeedback, t("msg.registerVerifyEmail"), false);

      setTimeout(() => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("registerModal")).hide();
        if (el.loginEmail) {
          el.loginEmail.value = email;
        }
        if (el.loginPassword) {
          el.loginPassword.value = "";
        }
        setAuthFeedback(el.loginFeedback, t("msg.registerVerifyEmail"), false);
        bootstrap.Modal.getOrCreateInstance(document.getElementById("loginModal")).show();
      }, 900);
    } catch (error) {
      setAuthFeedback(el.registerFeedback, t("msg.authNetwork"), true);
    }
  }

  function applyAuthSuccess(data) {
    state.authToken = data.accessToken;
    state.currentUser = data.user;
    state.role = data.user.role;

    localStorage.setItem("automarket_auth_token", state.authToken);
    localStorage.setItem("automarket_user", JSON.stringify(state.currentUser));
    localStorage.setItem("automarket_role", state.role);

    el.roleSelect.value = state.role;
    updatePublishVisibility();
    updateRoleLabels();
    updateAuthUi();
  }

  function handleLogout() {
    state.authToken = "";
    state.currentUser = null;
    state.role = "buyer";

    localStorage.removeItem("automarket_auth_token");
    localStorage.removeItem("automarket_user");
    localStorage.setItem("automarket_role", state.role);

    el.roleSelect.value = "buyer";
    updatePublishVisibility();
    updateRoleLabels();
    updateAuthUi();
  }

  async function handlePublishSubmit(event) {
    event.preventDefault();
    setAuthFeedback(el.publishFeedback, "", false);

    const publishYear = Number(el.publishYear.value);
    if (!Number.isFinite(publishYear) || publishYear < state.minAllowedYear || publishYear > state.currentYear) {
      const invalidYearMessage = t("publish.invalidYear")
        .replace("{min}", String(state.minAllowedYear))
        .replace("{max}", String(state.currentYear));
      setAuthFeedback(el.publishFeedback, invalidYearMessage, true);
      return;
    }

    const selectedFiles = [...(el.publishImageFiles?.files || [])];
    if (!selectedFiles.length) {
      setAuthFeedback(el.publishFeedback, t("publish.fileRequired"), true);
      return;
    }

    for (const file of selectedFiles) {
      const isJpg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
      if (!isJpg) {
        setAuthFeedback(el.publishFeedback, t("publish.fileType"), true);
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setAuthFeedback(el.publishFeedback, t("publish.fileSize"), true);
        return;
      }
    }

    let uploadedUrls = [];

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("images", file);
      }

      const uploadResponse = await fetch(`${state.apiBaseUrl}/cars/upload-images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.authToken}`
        },
        body: formData
      });

      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        const message = Array.isArray(uploadData.message)
          ? uploadData.message.join(" | ")
          : (uploadData.message || "Upload error");
        setAuthFeedback(el.publishFeedback, message, true);
        return;
      }

      uploadedUrls = uploadData.urls || [];
    } catch (error) {
      setAuthFeedback(el.publishFeedback, t("msg.authNetwork"), true);
      return;
    }

    const payload = {
      brand: el.publishBrand.value,
      model: el.publishModel.value,
      year: publishYear,
      kilometers: Number(el.publishKilometers.value),
      fuel: el.publishFuel.value,
      transmission: el.publishTransmission.value,
      price: Number(el.publishPrice.value),
      province: el.publishProvince.value,
      city: el.publishCity.value.trim() || undefined,
      description: el.publishDescription.value.trim(),
      mainImageUrl: uploadedUrls[0] || undefined,
      imageUrls: uploadedUrls
    };

    try {
      const response = await fetch(`${state.apiBaseUrl}/cars`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(" | ") : (data.message || "Publish error");
        setAuthFeedback(el.publishFeedback, message, true);
        return;
      }

      await refreshCarsFromApi();
      runFilters();
      el.metricCars.textContent = String(state.cars.length);

      bootstrap.Modal.getOrCreateInstance(document.getElementById("publishModal")).hide();
      el.publishForm.reset();
      hydratePublishFormCatalogs();
      alert(t("publish.success"));
    } catch (error) {
      setAuthFeedback(el.publishFeedback, t("msg.authNetwork"), true);
    }
  }

  function setAuthFeedback(node, message, isError) {
    if (!message) {
      node.classList.add("d-none");
      node.textContent = "";
      return;
    }

    node.classList.remove("d-none");
    node.classList.toggle("alert-danger", isError);
    node.classList.toggle("alert-success", !isError);
    node.textContent = message;
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
    setupYearRangeOptions("desktop");
    setupYearRangeOptions("mobile");
    syncFilterInputs("desktop");
    syncFilterInputs("mobile");
    initSearchableSingleSelects();
  }

  function buildFiltersMarkup() {
    const yearOptions = buildYearOptions();
    const brandOptions = [`<option value="">${t("placeholder.any")}</option>`]
      .concat(state.brandsCatalog.map((item) => `<option value="${item.marca}">${item.marca}</option>`))
      .join("");

    const provinceOptions = [`<option value="">${t("placeholder.any")}</option>`]
      .concat(state.provincesCatalog.map((item) => `<option value="${item}">${item}</option>`))
      .join("");

    return `
      <div class="filter-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.brand")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="brand" data-filter-scope="generic">${brandOptions}</select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.model")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="model" data-filter-scope="model">
            <option value="">${t("placeholder.any")}</option>
          </select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.priceMin")}</label>
          <input class="form-control rounded-xl border-slate-200 py-2.5" type="number" min="0" data-filter-key="priceMin" />
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.priceMax")}</label>
          <input class="form-control rounded-xl border-slate-200 py-2.5" type="number" min="0" data-filter-key="priceMax" />
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.yearMin")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="yearMin">${yearOptions}</select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.yearMax")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="yearMax">${yearOptions}</select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.fuel")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="fuel">
            <option value="">${t("placeholder.any")}</option>
            <option value="Nafta">Nafta</option>
            <option value="Diesel">Diesel</option>
            <option value="Hibrido">Hibrido</option>
            <option value="Electrico">Electrico</option>
          </select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.transmission")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="transmission">
            <option value="">${t("placeholder.any")}</option>
            <option value="Manual">Manual</option>
            <option value="Automatica">Automatica</option>
          </select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.province")}</label>
          <select class="form-select rounded-xl border-slate-200 bg-white py-2.5" data-filter-key="province">${provinceOptions}</select>
        </div>
        <div class="filter-field space-y-1.5">
          <label class="form-label small text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">${t("label.kmMax")}</label>
          <input class="form-control rounded-xl border-slate-200 py-2.5" type="number" min="0" data-filter-key="kmMax" />
        </div>
      </div>
    `;
  }

  function buildYearOptions() {
    const options = [`<option value="">${t("placeholder.any")}</option>`];

    for (let year = state.currentYear; year >= state.minAllowedYear; year -= 1) {
      options.push(`<option value="${year}">${year}</option>`);
    }

    return options.join("");
  }

  function setupDynamicModelOptions(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    const brandSelect = container.querySelector('[data-filter-key="brand"]');
    const modelSelect = container.querySelector('[data-filter-key="model"]');

    brandSelect.addEventListener("change", () => {
      fillModelOptions(modelSelect, brandSelect.value);
      scheduleSearchableSingleSelectsRefresh();
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

    scheduleSearchableSingleSelectsRefresh();
  }

  function setupYearRangeOptions(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    if (!container) {
      return;
    }

    const yearMinNode = container.querySelector('[data-filter-key="yearMin"]');
    const yearMaxNode = container.querySelector('[data-filter-key="yearMax"]');

    if (!yearMinNode || !yearMaxNode) {
      return;
    }

    yearMinNode.addEventListener("change", () => {
      const min = Number(yearMinNode.value || 0);
      const max = Number(yearMaxNode.value || 0);

      if (min && max && min > max) {
        yearMaxNode.value = yearMinNode.value;
      }

      state.filters.yearMin = yearMinNode.value.trim();
      state.filters.yearMax = yearMaxNode.value.trim();
      enforceYearRangeForScope(scope);
      syncFilterInputs(scope === "desktop" ? "mobile" : "desktop");
      scheduleSearchableSingleSelectsRefresh();
    });

    yearMaxNode.addEventListener("change", () => {
      const min = Number(yearMinNode.value || 0);
      const max = Number(yearMaxNode.value || 0);

      if (min && max && max < min) {
        yearMinNode.value = yearMaxNode.value;
      }

      state.filters.yearMin = yearMinNode.value.trim();
      state.filters.yearMax = yearMaxNode.value.trim();
      enforceYearRangeForScope(scope);
      syncFilterInputs(scope === "desktop" ? "mobile" : "desktop");
      scheduleSearchableSingleSelectsRefresh();
    });

    enforceYearRangeForScope(scope);
  }

  function enforceYearRangeForScope(scope) {
    const container = scope === "desktop" ? el.filtersContainer : el.filtersContainerMobile;
    if (!container) {
      return;
    }

    const yearMinNode = container.querySelector('[data-filter-key="yearMin"]');
    const yearMaxNode = container.querySelector('[data-filter-key="yearMax"]');
    if (!yearMinNode || !yearMaxNode) {
      return;
    }

    const minValue = Number(yearMinNode.value || 0);
    const maxValue = Number(yearMaxNode.value || 0);

    [...yearMinNode.options].forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }

      const optionYear = Number(option.value);
      option.disabled = Boolean(maxValue) && optionYear > maxValue;
    });

    [...yearMaxNode.options].forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }

      const optionYear = Number(option.value);
      option.disabled = Boolean(minValue) && optionYear < minValue;
    });
  }

  function hydrateQuickSearch() {
    if (!el.quickBrand || !el.quickModel) {
      return;
    }

    const options = [`<option value="">${t("placeholder.selectBrand")}</option>`]
      .concat(state.brandsCatalog.map((item) => `<option value="${item.marca}">${item.marca}</option>`))
      .join("");
    el.quickBrand.innerHTML = options;
    updateQuickModels("");
    scheduleSearchableSingleSelectsRefresh();
  }

  function updateQuickModels(brandValue) {
    if (!el.quickModel) {
      return;
    }

    const matching = state.brandsCatalog.find((item) => item.marca === brandValue);
    const models = matching ? matching.modelos : [];
    el.quickModel.innerHTML = [`<option value="">${t("placeholder.selectModel")}</option>`]
      .concat(models.map((model) => `<option value="${model}">${model}</option>`))
      .join("");

    scheduleSearchableSingleSelectsRefresh();
  }

  function scheduleSearchableSingleSelectsRefresh() {
    if (searchableRefreshHandle) {
      clearTimeout(searchableRefreshHandle);
    }

    searchableRefreshHandle = setTimeout(() => {
      searchableRefreshHandle = null;
      initSearchableSingleSelects();
    }, 0);
  }

  function initSearchableSingleSelects() {
    if (typeof window.Choices !== "function") {
      return;
    }

    destroySearchableSingleSelects();

    const targets = document.querySelectorAll(
      [
        "#heroSearchForm select.form-select",
        "#filtersContainer select.form-select",
        "#filtersContainerMobile select.form-select",
        "#publishForm select.form-select"
      ].join(",")
    );

    targets.forEach((selectNode) => {
      if (!selectNode || selectNode.multiple) {
        return;
      }

      const key = buildSearchableSelectKey(selectNode);
      try {
        const instance = new window.Choices(selectNode, {
          allowHTML: false,
          shouldSort: false,
          position: "bottom",
          searchEnabled: true,
          searchPlaceholderValue: state.language === "es" ? "Buscar opción..." : "Search option...",
          noResultsText: state.language === "es" ? "Sin resultados" : "No results",
          noChoicesText: state.language === "es" ? "Sin opciones" : "No options",
          itemSelectText: ""
        });

        if (instance?.containerOuter?.element) {
          instance.containerOuter.element.classList.add("am-choices");
        }

        searchableSelects.set(key, instance);
      } catch (error) {
        // If plugin init fails for a node, keep the native select working.
      }
    });
  }

  function destroySearchableSingleSelects() {
    searchableSelects.forEach((instance) => {
      try {
        instance.destroy();
      } catch (error) {
        // Ignore destroy errors when nodes were re-rendered.
      }
    });
    searchableSelects.clear();
  }

  function buildSearchableSelectKey(selectNode) {
    const parentForm = selectNode.closest("#heroSearchForm, #filtersContainer, #filtersContainerMobile, #publishForm");
    const scope = parentForm ? parentForm.id : "global";
    const identity = selectNode.id || selectNode.dataset.filterKey || selectNode.name || "select";
    return `${scope}:${identity}`;
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

    enforceYearRangeForScope(scope);
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

    if (el.quickBrand) {
      el.quickBrand.value = "";
      updateQuickModels("");
    }
    if (el.quickMinPrice) {
      el.quickMinPrice.value = "";
    }
    if (el.quickMaxPrice) {
      el.quickMaxPrice.value = "";
    }

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
    updateResultCountText();
    el.emptyState.classList.toggle("d-none", state.filteredCars.length !== 0);
  }

  function updateResultCountText() {
    const base = `${state.filteredCars.length} ${state.language === "es" ? "resultados" : "results"}`;
    if (state.isHydrating) {
      el.resultCount.textContent = state.language === "es"
        ? `${base} · actualizando...`
        : `${base} · updating...`;
      return;
    }

    el.resultCount.textContent = base;
  }

  function renderCars() {
    el.carsGrid.innerHTML = "";

    state.filteredCars.forEach((car, index) => {
      const col = document.createElement("article");
      col.className = "min-w-0";

      const selected = state.selectedForCompare.has(car.id) ? "checked" : "";
      const inWishlist = state.wishlist.has(car.id);
      const statusClass = `status-${car.aiStatus}`;
      const statusLabel = mapAiStatus(car.aiStatus);
      const hasAiRange = hasAiEstimate(car.aiPriceRange);
      const aiRangeText = hasAiRange ? car.aiPriceRange : t("detail.noAiEstimate");

      col.innerHTML = `
        <article class="car-card vehicle-listing-card h-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" style="animation-delay:${index * 60}ms">
          <div class="car-image-wrap vehicle-listing-media">
            <span class="vehicle-status-badge badge ${statusClass}">${statusLabel}</span>
            <img src="${car.image}" alt="${car.brand} ${car.model}" class="car-image vehicle-listing-image" />
          </div>
          <div class="vehicle-listing-content p-4">
            <div class="vehicle-listing-header">
              <div class="vehicle-listing-title-wrap">
                <h3 class="vehicle-listing-title mb-1 text-xl font-extrabold text-slate-900">${car.brand} ${car.model}</h3>
                <p class="vehicle-listing-location mb-2 text-sm text-slate-500">${car.city ? `${car.city}, ` : ""}${car.province}</p>
              </div>
            </div>

            <p class="vehicle-listing-price mb-2 text-2xl font-black text-brand-red">USD ${car.price.toLocaleString()}</p>

            <div class="car-meta-row vehicle-listing-meta mb-2 text-sm font-semibold text-slate-700">
              <span>${car.year}</span>
              <span>${car.kilometers.toLocaleString()} km</span>
            </div>

            <div class="d-flex flex-wrap gap-2 mb-2 vehicle-listing-tags">
              <span class="vehicle-chip rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">${car.fuel}</span>
              <span class="vehicle-chip rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">${car.transmission}</span>
            </div>

            <div class="vehicle-ai-summary vehicle-listing-ai mb-4 rounded-2xl bg-slate-50 p-3">
              <p class="small text-muted mb-1">${car.aiDamages}</p>
              <p class="small mb-0 ${hasAiRange ? "" : "text-muted"}">${aiRangeText}</p>
            </div>

            <div class="card-action-row vehicle-listing-actions flex flex-wrap items-center gap-2">
              <button class="btn btn-sm btn-dark detail-open-btn rounded-xl px-3 py-2 font-semibold" data-action="detail" data-id="${car.id}">${t("cta.ask")}</button>
              <button class="btn btn-sm btn-outline-secondary rounded-xl px-3 py-2 font-semibold" data-action="wishlist" data-id="${car.id}">
                ${inWishlist ? t("cta.removeWishlist") : t("cta.addWishlist")}
              </button>
              <label class="form-check-label small d-flex align-items-center gap-2 ms-auto">
                <input class="form-check-input compare-checkbox" type="checkbox" ${selected} data-action="compare" data-id="${car.id}" />
                ${t("cta.selectCompare")}
              </label>
            </div>
          </div>
        </article>
      `;

      el.carsGrid.appendChild(col);
      requestAnimationFrame(() => {
        const card = col.querySelector(".car-card");
        card.classList.add("show", "fade-up");
      });
    });

    el.carsGrid.querySelectorAll("[data-action]").forEach((node) => {
      const action = node.dataset.action;
      const id = node.dataset.id;
      if (action === "compare") {
        node.addEventListener("change", (event) => toggleCompare(id, event.target.checked));
      }
      if (action === "wishlist") {
        node.addEventListener("click", () => toggleWishlist(id));
      }
      if (action === "detail") {
        node.addEventListener("click", () => {
          navigateToDetailPage(id);
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
    const selectedIds = [...document.querySelectorAll("[data-wishlist-compare-id]:checked")].map((node) => node.dataset.wishlistCompareId);
    openCompareModal(selectedIds);
  }

  function navigateToDetailPage(id) {
    if (!id) return;
    window.location.href = `./car-detail.html?id=${encodeURIComponent(id)}`;
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
      {
        key: "table.aiRange",
        render: (car) => (hasAiEstimate(car.aiPriceRange) ? car.aiPriceRange : t("detail.noAiEstimate"))
      }
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
    if (status === "unknown") return state.language === "es" ? "Sin IA" : "No AI";
    return state.language === "es" ? "Requiere reparacion" : "Needs repair";
  }

  function hasAiEstimate(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return false;
    return !(
      raw.includes("sin rango estimado") ||
      raw.includes("sin estimacion") ||
      raw.includes("no estimated") ||
      raw.includes("no estimate")
    );
  }

  function hasAiDamageSummary(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return false;
    return !(
      raw.includes("sin analisis") ||
      raw.includes("sin análisis") ||
      raw.includes("no ai") ||
      raw.includes("no analysis")
    );
  }

  function deriveAiStatus(status, aiDamageSummary, aiPriceRange) {
    const rawStatus = String(status || "").trim().toLowerCase();
    if (["excellent", "good", "fair", "repair"].includes(rawStatus)) {
      return rawStatus;
    }

    if (hasAiEstimate(aiPriceRange) || hasAiDamageSummary(aiDamageSummary)) {
      return "fair";
    }

    return "unknown";
  }

  function normalize(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
})();
