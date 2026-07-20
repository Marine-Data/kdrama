// ============================================================
// MODULE AUTH — extrait de index.html (Kdramatrics)
// Email + mot de passe via Supabase Auth, session, notifications
// push liées à la connexion.
// Dépend de main.js pour l'état global et quelques helpers.
// ============================================================

import { state, setState, esc, showToast, sb, isLoggedIn, currentUserId, render, chargerMesVisionnages, chargerMesAVoir } from './main.js';

/* ============================================================
   MODULE AUTH
   Email + mot de passe via Supabase Auth.
   Dépend de : `sb` (client Supabase déjà initialisé).
   ============================================================ */

// ---- état additionnel (à fusionner dans l'objet `state` global) ----
// ---- initialisation : récupère la session existante au chargement ----
export async function initAuth() {
  // IMPORTANT : entouré d'un try/catch pour ne jamais bloquer le
  // démarrage de l'app. Sans ça, si getSession() échoue (session/token
  // corrompu dans le stockage de la PWA installée, souci réseau
  // ponctuel...), initAuth() rejette silencieusement, loadData() n'est
  // alors jamais appelé (voir `initAuth().then(() => loadData())` dans
  // main.js), et state.loading reste true pour toujours : l'app reste
  // bloquée sur l'écran "Ouverture du carnet…" sans aucune erreur
  // visible. C'est la cause d'un bug réel signalé sur PWA installée.
  try {
    const { data } = await sb.auth.getSession();
    state.session = data.session || null;
    if (state.session) {
      await loadProfilCourant();
    }
  } catch (e) {
    console.error("Erreur récupération session (l'app démarre quand même, en mode non connecté)", e);
    state.session = null;
  }

  // Écoute les changements (connexion, déconnexion, refresh token).
  // On recharge systématiquement la couche personnelle (visionnages,
  // à-voir) car elle dépend entièrement de qui est connecté : sans ce
  // rechargement, "Ma liste" resterait vide après une connexion tant
  // que la page n'est pas rafraîchie manuellement.
  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (session) {
      await loadProfilCourant();
    } else {
      state.profil = null;
    }
    if (!state.loading) {
      await chargerMesVisionnages();
      await chargerMesAVoir();
    }
    render();
  });
}

export async function loadProfilCourant() {
  if (!state.session) { state.profil = null; return; }
  try {
    const { data, error } = await sb
      .from("profils")
      .select("*")
      .eq("id", state.session.user.id)
      .single();
    if (error) throw error;
    state.profil = data;
  } catch (e) {
    console.error("Erreur chargement profil", e);
    state.profil = null;
  }
}

// ---- actions ----
export function updateAuthForm(patch) {
  setState({ authForm: { ...state.authForm, ...patch }, authError: null });
}

export function switchAuthScreen(screen) {
  setState({ authScreen: screen, authError: null, authForm: { email: "", password: "", pseudo: "" } });
}

export async function handleSignup() {
  const { email, password, pseudo } = state.authForm;
  if (!email.trim() || !password.trim() || !pseudo.trim()) {
    setState({ authError: "Tous les champs sont obligatoires." });
    return;
  }
  // Pas de restriction de longueur côté app. Supabase Auth impose lui
  // tout de même un minimum (6 caractères par défaut) côté serveur,
  // réglable uniquement depuis le dashboard Supabase (Authentication
  // > Providers > Email > Minimum password length).
  // Le pseudo ne doit contenir que des caractères simples pour éviter
  // les soucis d'affichage / d'URL de profil public.
  if (!/^[a-zA-Z0-9_\-]{3,20}$/.test(pseudo.trim())) {
    setState({ authError: "Le pseudo doit faire 3 à 20 caractères (lettres, chiffres, _ ou -)." });
    return;
  }

  setState({ authLoading: true, authError: null });
  try {
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { pseudo: pseudo.trim() } },
    });
    if (error) throw error;

    // Si la confirmation email est activée sur le projet Supabase,
    // `data.session` sera null ici : il faut le signaler à l'utilisateur.
    if (!data.session) {
      showToast("Compte créé ! Vérifie ta boîte mail pour confirmer ton inscription.");
      setState({ authLoading: false, authScreen: "login" });
      return;
    }

    state.session = data.session;
    await loadProfilCourant();
    showToast(`Bienvenue, ${pseudo} !`);
    setState({ authLoading: false, showAuthModal: false });
  } catch (e) {
    console.error(e);
    // On utilise error.code plutôt que la correspondance de texte sur
    // e.message : c'est la pratique recommandée par Supabase (les
    // messages peuvent changer de formulation, le code, lui, est stable).
    // Voir https://supabase.com/docs/guides/auth/debugging/error-codes
    const messagesParCode = {
      email_exists: "Cet email est déjà utilisé.",
      user_already_exists: "Un compte existe déjà avec ces informations.",
      weak_password: "Ce mot de passe est trop faible — essaie d'en choisir un autre.",
      email_address_invalid: "Cette adresse email n'est pas valide.",
      over_email_send_rate_limit: "Trop de tentatives — réessaie dans quelques minutes.",
      over_request_rate_limit: "Trop de tentatives — réessaie dans quelques minutes.",
      signup_disabled: "Les inscriptions sont temporairement désactivées.",
      validation_failed: "Certaines informations saisies ne sont pas valides.",
    };
    let msg = (e.code && messagesParCode[e.code]) || null;
    if (!msg && e.message && e.message.toLowerCase().includes("already registered")) {
      // Filet de sécurité : anciennes versions de gotrue qui ne
      // renvoient pas toujours error.code pour ce cas précis.
      msg = "Cet email est déjà utilisé.";
    }
    if (!msg) msg = "Inscription impossible pour le moment — réessaie dans un instant.";
    setState({ authLoading: false, authError: msg });
  }
}

export async function handleLogin() {
  const { email, password } = state.authForm;
  if (!email.trim() || !password.trim()) {
    setState({ authError: "Indique ton email et ton mot de passe." });
    return;
  }
  setState({ authLoading: true, authError: null });
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    state.session = data.session;
    await loadProfilCourant();
    setState({ authLoading: false, showAuthModal: false });
    showToast(`Content de te revoir${state.profil ? ", " + state.profil.pseudo : ""} !`);
  } catch (e) {
    console.error(e);
    const messagesParCode = {
      invalid_credentials: "Email ou mot de passe incorrect.",
      email_not_confirmed: "Confirme ton email avant de te connecter (vérifie ta boîte mail).",
      user_banned: "Ce compte est temporairement suspendu.",
      over_request_rate_limit: "Trop de tentatives — réessaie dans quelques minutes.",
    };
    let msg = (e.code && messagesParCode[e.code])
      || (e.message && e.message.toLowerCase().includes("invalid") ? "Email ou mot de passe incorrect." : null)
      || "Connexion impossible pour le moment — réessaie dans un instant.";
    setState({ authLoading: false, authError: msg });
  }
}

export async function handleLogout() {
  await sb.auth.signOut();
  setState({ session: null, profil: null, activeTab: "tendances" });
  showToast("À bientôt !");
}

// ---- notifications push (sur le téléphone, même app fermée) ----
// Clé publique VAPID : sans danger à exposer côté client (c'est tout
// son rôle — seule la clé PRIVÉE, côté Edge Function, doit rester
// secrète). Voir l'Edge Function "send-push" et les triggers DB
// associés pour la partie envoi.
const VAPID_PUBLIC_KEY = "BAO4cgcv8VL1tm6fKUjmq3g2saho_h5lMdj6tvmatvBF7WAZctesCVaUNZGfpOI9258QeyW3PhFE-EOWPyyLooI";

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function activerNotificationsPush() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour activer les notifications."); return; }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Les notifications ne sont pas prises en charge sur cet appareil ou ce navigateur.");
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    setState({ pushPermissionStatus: permission });
    if (permission !== "granted") {
      showToast("Permission refusée. Tu peux la réactiver dans les réglages du navigateur.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const keys = subscription.toJSON().keys;
    const { error } = await sb.from("push_subscriptions").upsert([{
      user_id: currentUserId(),
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
    }], { onConflict: "endpoint" });
    if (error) throw error;
    showToast("Notifications activées sur cet appareil !");
    render();
  } catch (e) {
    console.error(e);
    showToast("Impossible d'activer les notifications.");
  }
}

export async function desactiverNotificationsPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await sb.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    showToast("Notifications désactivées sur cet appareil.");
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- bannière d'incitation à activer les notifications ----
// Affichée tant que la personne n'a ni accepté ni refusé la permission
// (state.pushPermissionStatus === "default"), sur toutes les pages —
// sinon le bouton d'activation, enterré dans la fiche profil, ne
// serait jamais découvert. "Plus tard" la masque pendant 7 jours
// (localStorage, pas de compte nécessaire côté serveur pour ça).
export function shouldShowPushPrompt() {
  if (!isLoggedIn()) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (state.pushPermissionStatus !== "default") return false;
  try {
    const dismissedAt = localStorage.getItem("push_prompt_dismissed_at");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return false;
  } catch (e) {
    // localStorage indisponible (navigation privée stricte...) : on
    // affiche par défaut plutôt que de bloquer la fonctionnalité.
  }
  return true;
}
export function renderPushPromptBanner() {
  if (!shouldShowPushPrompt()) return "";
  return `<div class="push-prompt-banner">
    <span class="push-prompt-icon">🔔</span>
    <p class="push-prompt-text">Active les notifications pour savoir quand quelqu'un aime ou commente tes activités — même quand l'app est fermée.</p>
    <div class="push-prompt-actions">
      <button class="primary-btn" id="pushPromptActiverBtn" style="padding:8px 14px; font-size:12.5px;">Activer</button>
      <button class="text-btn" id="pushPromptPlusTardBtn">Plus tard</button>
    </div>
  </div>`;
}
export function dismissPushPrompt() {
  try { localStorage.setItem("push_prompt_dismissed_at", String(Date.now())); } catch (e) { /* ignoré */ }
  render();
}

// ---- rendu : modal de connexion / inscription (accessible depuis tout onglet) ----
export function renderAuthModal() {
  const f = state.authForm;
  const isSignup = state.authScreen === "signup";
  return `<div class="modal-overlay" id="authModalOverlay">
    <div class="modal-sheet" id="authModalSheet">
      <div class="modal-handle"></div>
      <div class="modal-header" style="padding:0 18px;">
        <div style="flex:1;">
          <h3 style="font-family:'Press Start 2P',cursive; font-size:13px; margin:0; color:var(--blue-deep);">${isSignup ? "Inscription" : "Connexion"}</h3>
        </div>
        <button class="icon-btn" id="authModalClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="tabbar" style="padding:10px 0 16px;">
          <button class="tab-btn ${!isSignup ? "active" : ""}" id="authTabLogin">Connexion</button>
          <button class="tab-btn ${isSignup ? "active" : ""}" id="authTabSignup">Inscription</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:11px;">
          ${isSignup ? `<label class="auth-label">Pseudo
            <input id="auth-pseudo" value="${esc(f.pseudo)}" placeholder="ex. dramaqueen92" autocomplete="username">
          </label>` : ""}
          <label class="auth-label">Email
            <input id="auth-email" type="email" value="${esc(f.email)}" placeholder="toi@exemple.com" autocomplete="email">
          </label>
          <label class="auth-label">Mot de passe
            <input id="auth-password" type="password" value="${esc(f.password)}" placeholder="Ton mot de passe" autocomplete="${isSignup ? "new-password" : "current-password"}">
          </label>
          ${state.authError ? `<p style="color:var(--seal); font-size:12.5px; margin:0;">${esc(state.authError)}</p>` : ""}
        </div>
      </div>
      <div class="modal-footer">
        <button class="primary-btn" id="authSubmitBtn" ${state.authLoading ? "disabled" : ""}>
          ${state.authLoading ? "Patience…" : isSignup ? "Créer mon compte" : "Se connecter"}
        </button>
      </div>
    </div>
  </div>`;
}

export function attachAuthModalListeners() {
  const overlay = document.getElementById("authModalOverlay");
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) setState({ showAuthModal: false }); });
  const closeBtn = document.getElementById("authModalClose");
  if (closeBtn) closeBtn.addEventListener("click", () => setState({ showAuthModal: false }));

  const tabLogin = document.getElementById("authTabLogin");
  if (tabLogin) tabLogin.addEventListener("click", () => switchAuthScreen("login"));
  const tabSignup = document.getElementById("authTabSignup");
  if (tabSignup) tabSignup.addEventListener("click", () => switchAuthScreen("signup"));

  const emailInput = document.getElementById("auth-email");
  if (emailInput) emailInput.addEventListener("input", (e) => { state.authForm.email = e.target.value; });
  const passwordInput = document.getElementById("auth-password");
  if (passwordInput) passwordInput.addEventListener("input", (e) => { state.authForm.password = e.target.value; });
  const pseudoInput = document.getElementById("auth-pseudo");
  if (pseudoInput) pseudoInput.addEventListener("input", (e) => { state.authForm.pseudo = e.target.value; });

  const submitBtn = document.getElementById("authSubmitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      state.authScreen === "signup" ? handleSignup() : handleLogin();
    });
  }
}
