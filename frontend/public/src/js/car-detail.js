(function () {
  const state = {
    apiBaseUrl: localStorage.getItem("automarket_api_base_url") || "http://localhost:3000",
    language: localStorage.getItem("automarket_lang") || "es",
    questionsByCar: JSON.parse(localStorage.getItem("automarket_questions_by_car") || "{}")
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    const carId = new URLSearchParams(window.location.search).get("id");

    if (!carId) {
      showNotFound();
      return;
    }

    const car = await getCar(carId);
    if (!car) {
      showNotFound();
      return;
    }

    renderDetail(car);
  }

  function cacheElements() {
    el.loading = document.getElementById("detailLoading");
    el.notFound = document.getElementById("detailNotFound");
    el.content = document.getElementById("detailPageContent");
    el.backLink = document.getElementById("detailBackLink");
  }

  async function getCar(id) {
    try {
      const response = await fetch(`${state.apiBaseUrl}/cars/${id}`);
      if (response.ok) {
        const car = await response.json();
        return mapBackendCarToUi(car);
      }
    } catch (error) {
      console.warn("Could not fetch detail from backend, trying local fallback", error);
    }

    const fallback = (window.APP_CARS || []).find((item) => String(item.id) === String(id));
    return fallback ? normalizeCarForUi(fallback) : null;
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
      description: car.description || "",
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
    const images = Array.isArray(car.images) ? car.images : (car.image ? [car.image] : []);

    return {
      ...car,
      id: String(car.id),
      images,
      image: car.image || images[0] || "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
      aiStatus: car.aiStatus || "fair",
      aiDamages: car.aiDamages || "Sin análisis de IA disponible",
      aiPriceRange: car.aiPriceRange || "Sin rango estimado",
      questions: Array.isArray(car.questions) ? car.questions : []
    };
  }

  function renderDetail(car) {
    const gallery = Array.isArray(car.images) && car.images.length ? car.images : [car.image];
    const carouselId = `detailCarousel-${car.id}`;
    const statusClass = `status-${car.aiStatus}`;
    const statusLabel = mapAiStatus(car.aiStatus);
    const questions = getQuestionsForCar(car);
    const hasAiRange = hasAiEstimate(car.aiPriceRange);
    const aiRangeText = hasAiRange ? car.aiPriceRange : (state.language === "es" ? "Sin estimación IA" : "No AI estimate");

    const indicators = gallery
      .map((_, index) => {
        return `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" ${index === 0 ? "class=\"active\" aria-current=\"true\"" : ""} aria-label="Slide ${index + 1}"></button>`;
      })
      .join("");

    const items = gallery
      .map((url, index) => {
        return `
          <div class="carousel-item ${index === 0 ? "active" : ""}">
            <img src="${url}" class="d-block w-100 rounded-3" alt="${car.brand} ${car.model}" style="max-height:420px;object-fit:cover;" />
          </div>
        `;
      })
      .join("");

    const thumbs = gallery
      .map((url, index) => {
        return `
          <button
            type="button"
            class="detail-thumb ${index === 0 ? "is-active" : ""}"
            data-bs-target="#${carouselId}"
            data-bs-slide-to="${index}"
            ${index === 0 ? "aria-current=\"true\"" : ""}
          >
            <img src="${url}" alt="Miniatura ${index + 1}" />
          </button>
        `;
      })
      .join("");

    const questionItems = questions.length
      ? questions
          .map((item) => {
            const when = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString(state.language === "es" ? "es-AR" : "en-US")
              : "";
            return `
              <li class="detail-question-item">
                <p class="mb-1">${escapeHtml(item.text)}</p>
                <small class="text-muted">${when}</small>
              </li>
            `;
          })
          .join("")
      : `<p class="text-muted mb-2">Todavía no hay preguntas para este auto.</p>`;

    el.content.innerHTML = `
      <section class="vehicle-detail-page detail-single-column space-y-4">
        <article class="detail-hero-card mb-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel">
          <div class="detail-media-wrap">
            <div id="${carouselId}" class="carousel slide detail-carousel" data-bs-ride="false">
              <div class="carousel-indicators detail-indicators">${indicators}</div>
              <div class="carousel-inner">${items}</div>
              <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
              </button>
            </div>
          </div>
          <div class="detail-thumbs mt-2 border-t border-slate-200 p-3">${thumbs}</div>
        </article>

        <section class="detail-title-strip mb-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:p-6">
          <div>
            <h1 class="detail-main-title mb-1 font-display text-3xl font-extrabold text-brand-ink sm:text-4xl">${car.brand} ${car.model}</h1>
            <p class="detail-main-year mb-0 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">${car.year}</p>
          </div>
          <p class="detail-main-price mb-0 text-3xl font-black text-brand-red">USD ${Number(car.price || 0).toLocaleString()}</p>
        </section>

        <article class="detail-ai-card detail-analysis-card mb-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:p-5">
          <div class="detail-ai-icon grid h-9 w-9 place-items-center rounded-xl bg-slate-100 font-black text-brand-ink">${car.aiStatus === "repair" ? "!" : "i"}</div>
          <div class="detail-ai-content">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
              <strong class="text-base text-brand-ink">Análisis inteligente</strong>
              <span class="detail-ai-badge ${mapAiBadgeClass(car.aiStatus)}">${mapAiBadgeText(car.aiStatus)}</span>
            </div>
            <p class="mb-2 text-muted small">${car.aiDamages}</p>
            <p class="mb-0 detail-ai-range ${hasAiRange ? "" : "text-muted"}"><strong>Rango IA:</strong> ${aiRangeText}</p>
          </div>
        </article>

        <section class="detail-spec-grid mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article class="detail-spec-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="detail-spec-label mb-1">Kilometraje</p>
            <p class="detail-spec-value mb-0">${Number(car.kilometers || 0).toLocaleString()} km</p>
          </article>
          <article class="detail-spec-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="detail-spec-label mb-1">Combustible</p>
            <p class="detail-spec-value mb-0">${car.fuel}</p>
          </article>
          <article class="detail-spec-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="detail-spec-label mb-1">Transmisión</p>
            <p class="detail-spec-value mb-0">${car.transmission}</p>
          </article>
          <article class="detail-spec-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="detail-spec-label mb-1">Ubicación</p>
            <p class="detail-spec-value mb-0">${car.city ? `${car.city}, ` : ""}${car.province}</p>
          </article>
        </section>

        <article class="detail-description-card vehicle-description-card mb-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:p-5">
          <h4 class="h5 mb-2 font-display text-xl font-bold text-brand-ink">Descripción</h4>
          <p class="mb-0 text-muted">${car.description || ""}</p>
        </article>

        <article class="vehicle-questions-card rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:p-5">
          <h4 class="h6 mb-2 font-display text-xl font-bold text-brand-ink">Preguntas (${questions.length})</h4>
          <div class="detail-questions-wrap mb-2 rounded-2xl bg-slate-50 p-3">
            ${questions.length ? `<ul class="detail-question-list mb-0">${questionItems}</ul>` : questionItems}
          </div>
          <form id="detailQuestionForm" class="detail-question-form space-y-2" data-car-id="${car.id}">
            <label class="form-label mb-1 text-sm font-semibold text-slate-600" for="detailQuestionInput">${questions.length ? "Haz otra pregunta" : "Haz la primera pregunta"}</label>
            <div class="input-group">
              <input
                id="detailQuestionInput"
                class="form-control rounded-l-xl border-slate-200"
                type="text"
                minlength="5"
                maxlength="280"
                placeholder="Escribe tu pregunta para el vendedor..."
                required
              />
              <button type="submit" class="btn btn-primary-red rounded-r-xl px-4 font-semibold">Preguntar</button>
            </div>
          </form>
        </article>
      </section>
    `;

    const questionForm = document.getElementById("detailQuestionForm");
    if (questionForm) {
      questionForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("detailQuestionInput");
        const raw = input && "value" in input ? String(input.value || "") : "";
        const text = raw.trim();
        if (text.length < 5) {
          return;
        }

        addQuestionToCar(car.id, text);
        renderDetail(car);
      });
    }

    const carouselEl = document.getElementById(carouselId);
    if (carouselEl) {
      carouselEl.addEventListener("slid.bs.carousel", (event) => {
        const activeIndex = Number(event.to || 0);
        document.querySelectorAll(".detail-thumb").forEach((node, index) => {
          node.classList.toggle("is-active", index === activeIndex);
        });
      });
    }

    el.loading.classList.add("d-none");
    el.notFound.classList.add("d-none");
    el.content.classList.remove("d-none");
    el.backLink.href = "./index.html#explore";
  }

  function getQuestionsForCar(car) {
    const apiQuestions = Array.isArray(car.questions)
      ? car.questions
          .map((q) => {
            if (typeof q === "string") {
              return { text: q, createdAt: null };
            }
            return {
              text: String(q?.text || "").trim(),
              createdAt: q?.createdAt || null
            };
          })
          .filter((q) => q.text)
      : [];

    const localQuestions = Array.isArray(state.questionsByCar[car.id])
      ? state.questionsByCar[car.id]
      : [];

    return [...apiQuestions, ...localQuestions];
  }

  function addQuestionToCar(carId, text) {
    if (!carId) return;
    const key = String(carId);
    const current = Array.isArray(state.questionsByCar[key]) ? state.questionsByCar[key] : [];
    current.push({ text, createdAt: new Date().toISOString() });
    state.questionsByCar[key] = current;
    localStorage.setItem("automarket_questions_by_car", JSON.stringify(state.questionsByCar));
  }

  function showNotFound() {
    el.loading.classList.add("d-none");
    el.content.classList.add("d-none");
    el.notFound.classList.remove("d-none");
  }

  function mapAiStatus(status) {
    if (status === "excellent") return state.language === "es" ? "Excelente" : "Excellent";
    if (status === "good") return state.language === "es" ? "Bueno" : "Good";
    if (status === "fair") return state.language === "es" ? "Regular" : "Fair";
    if (status === "unknown") return state.language === "es" ? "Sin IA" : "No AI";
    return state.language === "es" ? "Requiere reparación" : "Needs repair";
  }

  function mapAiBadgeClass(status) {
    if (status === "excellent") return "badge-ai-excellent";
    if (status === "good") return "badge-ai-good";
    if (status === "fair") return "badge-ai-fair";
    if (status === "unknown") return "badge-ai-unknown";
    return "badge-ai-repair";
  }

  function mapAiBadgeText(status) {
    if (status === "excellent") return state.language === "es" ? "Excelente" : "Excellent";
    if (status === "good") return state.language === "es" ? "Bueno" : "Good";
    if (status === "fair") return state.language === "es" ? "Regular" : "Fair";
    if (status === "unknown") return state.language === "es" ? "Sin IA" : "No AI";
    return state.language === "es" ? "Malo" : "Bad";
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
