(function () {
  const STORAGE_URL_KEY = "automarket_supabase_url";
  const STORAGE_ANON_KEY = "automarket_supabase_anon_key";

  const el = {
    feedback: document.getElementById("recoverFeedback"),
    configDetails: document.getElementById("supabaseConfigDetails"),
    supabaseUrl: document.getElementById("supabaseUrl"),
    supabaseAnonKey: document.getElementById("supabaseAnonKey"),
    saveConfigButton: document.getElementById("saveSupabaseConfigButton"),
    requestForm: document.getElementById("requestRecoveryForm"),
    requestButton: document.getElementById("requestRecoveryButton"),
    recoveryEmail: document.getElementById("recoveryEmail"),
    resetForm: document.getElementById("resetPasswordForm"),
    resetButton: document.getElementById("resetPasswordButton"),
    newPassword: document.getElementById("newPassword"),
    confirmPassword: document.getElementById("confirmPassword")
  };

  let supabaseClient = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    hydrateConfigInputs();

    el.saveConfigButton.addEventListener("click", onSaveConfig);
    el.requestForm.addEventListener("submit", onRequestRecovery);
    el.resetForm.addEventListener("submit", onResetPassword);

    const ready = buildSupabaseClient();
    if (!ready) {
      setFeedback("Completa primero la configuracion de Supabase para continuar.", true);
      return;
    }

    await bootstrapRecoveryMode();
  }

  function hydrateConfigInputs() {
    el.supabaseUrl.value = localStorage.getItem(STORAGE_URL_KEY) || "";
    el.supabaseAnonKey.value = localStorage.getItem(STORAGE_ANON_KEY) || "";
  }

  function onSaveConfig() {
    const url = String(el.supabaseUrl.value || "").trim();
    const anonKey = String(el.supabaseAnonKey.value || "").trim();

    if (!url || !anonKey) {
      setFeedback("Debes completar Supabase URL y Anon Key.", true);
      return;
    }

    localStorage.setItem(STORAGE_URL_KEY, url);
    localStorage.setItem(STORAGE_ANON_KEY, anonKey);

    if (!buildSupabaseClient()) {
      setFeedback("No se pudo inicializar Supabase. Revisa URL y Anon Key.", true);
      return;
    }

    setFeedback("Configuracion guardada correctamente.", false);
    bootstrapRecoveryMode();
  }

  function buildSupabaseClient() {
    const url = String(localStorage.getItem(STORAGE_URL_KEY) || "").trim();
    const anonKey = String(localStorage.getItem(STORAGE_ANON_KEY) || "").trim();

    if (!url || !anonKey || !window.supabase || typeof window.supabase.createClient !== "function") {
      supabaseClient = null;
      return false;
    }

    supabaseClient = window.supabase.createClient(url, anonKey);
    return true;
  }

  async function bootstrapRecoveryMode() {
    const recoveryContext = await prepareRecoverySession();
    if (recoveryContext.readyForReset) {
      el.requestForm.classList.add("d-none");
      el.resetForm.classList.remove("d-none");
      setFeedback("Enlace validado. Define tu nueva contrasena.", false);
      return;
    }

    el.requestForm.classList.remove("d-none");
    el.resetForm.classList.add("d-none");
  }

  async function prepareRecoverySession() {
    if (!supabaseClient) {
      return { readyForReset: false };
    }

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = queryParams.get("code");
    const recoveryType = hashParams.get("type") || queryParams.get("type");

    try {
      if (accessToken && refreshToken) {
        const { error } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) throw error;
        return { readyForReset: true };
      }

      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return { readyForReset: true };
      }

      if (recoveryType === "recovery") {
        const { data } = await supabaseClient.auth.getSession();
        return { readyForReset: Boolean(data?.session) };
      }
    } catch (error) {
      setFeedback("No se pudo validar el enlace de recuperacion. Solicita uno nuevo.", true);
    }

    return { readyForReset: false };
  }

  async function onRequestRecovery(event) {
    event.preventDefault();
    if (!supabaseClient) {
      setFeedback("Completa y guarda la configuracion de Supabase.", true);
      return;
    }

    const email = String(el.recoveryEmail.value || "").trim();
    if (!email) {
      setFeedback("Debes ingresar un email valido.", true);
      return;
    }

    setButtonLoading(el.requestButton, true, "Enviando...");

    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setFeedback("Si el email existe, te enviamos un enlace para recuperar tu contrasena.", false);
      el.requestForm.reset();
    } catch (error) {
      setFeedback("No se pudo enviar el enlace. Verifica la configuracion o intenta mas tarde.", true);
    } finally {
      setButtonLoading(el.requestButton, false, "Enviar enlace de recuperacion");
    }
  }

  async function onResetPassword(event) {
    event.preventDefault();
    if (!supabaseClient) {
      setFeedback("Completa y guarda la configuracion de Supabase.", true);
      return;
    }

    const password = String(el.newPassword.value || "");
    const confirmPassword = String(el.confirmPassword.value || "");

    if (password.length < 6) {
      setFeedback("La nueva contrasena debe tener al menos 6 caracteres.", true);
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Las contrasenas no coinciden.", true);
      return;
    }

    setButtonLoading(el.resetButton, true, "Actualizando...");

    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;

      setFeedback("Contrasena actualizada correctamente. Ya puedes iniciar sesion.", false);
      el.resetForm.reset();
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 1200);
    } catch (error) {
      setFeedback("No se pudo actualizar la contrasena. Solicita un nuevo enlace.", true);
    } finally {
      setButtonLoading(el.resetButton, false, "Actualizar contrasena");
    }
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = loading;
    button.textContent = loading ? loadingText : button.dataset.originalText;
  }

  function setFeedback(message, isError) {
    if (!message) {
      el.feedback.classList.add("d-none");
      el.feedback.textContent = "";
      return;
    }

    el.feedback.classList.remove("d-none");
    el.feedback.classList.toggle("alert-danger", isError);
    el.feedback.classList.toggle("alert-success", !isError);
    el.feedback.textContent = message;
  }
})();
