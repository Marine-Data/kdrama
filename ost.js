// ============================================================
// MODULE OST/DEEZER — extrait de index.html (Kdramatrics)
// Mini-lecteur Deezer flottant + défi OST correspondance.
// Dépend de main.js pour l'état global et quelques helpers.
// ============================================================

import { state, setState, esc, sb, showToast, currentUserId, isLoggedIn, render } from './main.js';
import { shuffleWithCorrect } from './quiz.js';

/* ============================================================
   MODULE OST CHALLENGE — TROIS MODES
   Choisissez le mode par défaut via state.ostMode.
   ============================================================ */

// ============================================================
// MODE ÉCOUTE — Lien direct vers la playlist Deezer
// ------------------------------------------------------------
// Le mode "widget intégré" (iframe avec liste masquée et minuteur)
// a été retiré : le widget.deezer.com appelle lui-même api.deezer.com
// en interne pour charger sa tracklist, et cet appel est bloqué par
// CORS (confirmé en conditions réelles, pas seulement en théorie).
// C'est une limitation du widget Deezer lui-même, hors de notre
// contrôle — pas un bug réparable côté app.
//
// À la place : un simple lien qui ouvre la playlist normalement sur
// Deezer (lecture complète, gratuite, sans jeu). Fiable à 100% car
// ça ne fait qu'ouvrir une page Deezer standard dans un nouvel onglet.
// ============================================================

export function extractDeezerPlaylistId(lien) {
  const match = lien.match(/playlist\/(\d+)/);
  return match ? match[1] : null;
}

export function ecouterPlaylistDeezer(lien) {
  const playlistId = extractDeezerPlaylistId(lien);
  if (!playlistId) {
    setState({ ostError: "Lien de playlist Deezer invalide. Format attendu : https://www.deezer.com/playlist/XXXXXXXXX" });
    return;
  }
  setState({ ostError: null });
  window.open(`https://www.deezer.com/playlist/${playlistId}`, "_blank", "noopener");
}

// Widget Deezer intégré, sans aucune option ajoutée (pas de
// tracklist=false, pas de minuteur) — version la plus simple
// possible, identique à celle que Deezer affiche sur sa propre page
// de génération de widget. Testé en conditions réelles avec le mode
// "widget + tracklist masquée + minuteur" précédent, qui a échoué par
// CORS : cette version minimale n'a pas encore été testée par nous —
// à vérifier directement dans l'app une fois ce code en place.
export function chargerWidgetSimple(lien) {
  const playlistId = extractDeezerPlaylistId(lien);
  if (!playlistId) {
    setState({ ostError: "Lien de playlist Deezer invalide. Format attendu : https://www.deezer.com/playlist/XXXXXXXXX" });
    return;
  }
  setState({ ostError: null, widgetSimplePlaylistId: playlistId });
}

// ============================================================
// MINI-LECTEUR DEEZER FLOTTANT (persistant, ne coupe jamais le son)
// ------------------------------------------------------------
// Bouton replié sur le bord droit de l'écran, visible sur tous les
// onglets. Au clic, déplie un petit panneau avec le widget Deezer
// (contrôles play/pause natifs visibles dans l'iframe elle-même) et
// un champ pour changer de playlist.
//
// IMPORTANT : ce bloc ne doit JAMAIS être mis à jour par render(),
// sinon l'iframe serait détruite et recréée à chaque setState() (donc
// à chaque frappe ou changement d'onglet n'importe où dans l'app), ce
// qui couperait le son — exactement le problème signalé. On appelle
// donc renderDeezerMiniPlayer() séparément, uniquement après les
// actions qui le concernent vraiment (ouvrir/fermer, changer de
// playlist), jamais depuis setState()/render().
// ============================================================

export function renderDeezerMiniPlayer() {
  const root = document.getElementById("deezer-mini-player");
  if (!root) return;
  const playlistId = state.miniPlayerPlaylistId || state.widgetSimplePlaylistId || OST_PLAYLIST_DEFAUT;
  root.innerHTML = `
    <button class="deezer-mini-tab" id="deezerMiniTabBtn" aria-label="${state.miniPlayerOpen ? "Fermer le lecteur" : "Ouvrir le lecteur de musique"}">
      <span>🎵</span>
    </button>
    <div class="deezer-mini-panel ${state.miniPlayerOpen ? "open" : ""}">
      <div class="deezer-mini-panel-header">
        <span>Écoute en fond</span>
        <button class="icon-btn" id="deezerMiniCloseBtn" aria-label="Réduire">✕</button>
      </div>
      <iframe title="deezer-mini-widget" src="https://widget.deezer.com/widget/dark/playlist/${playlistId}" width="100%" height="260" frameborder="0" allowtransparency="true" allow="encrypted-media; clipboard-write" style="border-radius:10px;"></iframe>
      <button class="text-btn" id="deezerMiniChangeBtn" style="margin-top:6px;">🔄 Changer de playlist</button>
      <div id="deezerMiniChangeBlock" style="display:${state.miniPlayerShowChange ? "block" : "none"};">
        <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500; margin-top:6px;">
          Lien playlist Deezer publique
          <input id="deezer-mini-lien-input" value="${esc(state.miniPlayerLienInput)}" placeholder="https://www.deezer.com/playlist/...">
        </label>
        <p id="deezerMiniErrorMsg" style="color:var(--seal); font-size:12px; margin-top:4px; ${state.miniPlayerError ? "" : "display:none;"}">${esc(state.miniPlayerError || "")}</p>
        <button class="primary-btn" id="deezerMiniLoadBtn" style="width:100%; margin-top:6px;">Charger cette playlist</button>
      </div>
    </div>
  `;
  attachDeezerMiniPlayerListeners();
}

export function attachDeezerMiniPlayerListeners() {
  const tabBtn = document.getElementById("deezerMiniTabBtn");
  if (tabBtn) tabBtn.addEventListener("click", () => toggleDeezerMiniPlayer(!state.miniPlayerOpen));
  const closeBtn = document.getElementById("deezerMiniCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => toggleDeezerMiniPlayer(false));
  const changeBtn = document.getElementById("deezerMiniChangeBtn");
  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      state.miniPlayerShowChange = !state.miniPlayerShowChange;
      const block = document.getElementById("deezerMiniChangeBlock");
      if (block) block.style.display = state.miniPlayerShowChange ? "block" : "none";
    });
  }
  const lienInput = document.getElementById("deezer-mini-lien-input");
  if (lienInput) lienInput.addEventListener("input", (e) => { state.miniPlayerLienInput = e.target.value; });
  const loadBtn = document.getElementById("deezerMiniLoadBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      const playlistId = extractDeezerPlaylistId(state.miniPlayerLienInput);
      const errorMsg = document.getElementById("deezerMiniErrorMsg");
      if (!playlistId) {
        state.miniPlayerError = "Lien de playlist Deezer invalide. Format attendu : https://www.deezer.com/playlist/XXXXXXXXX";
        if (errorMsg) { errorMsg.textContent = state.miniPlayerError; errorMsg.style.display = ""; }
        return;
      }
      state.miniPlayerError = null;
      state.miniPlayerPlaylistId = playlistId;
      state.miniPlayerShowChange = false;
      // Ici on change vraiment la playlist : l'iframe DOIT être
      // recréée avec la nouvelle src, donc renderDeezerMiniPlayer()
      // complet est légitime (et le seul cas où on l'appelle après
      // l'ouverture initiale).
      renderDeezerMiniPlayer();
    });
  }
}

// Ouvre/ferme le panneau SANS jamais toucher au HTML de l'iframe : on
// ne fait que basculer la classe CSS "open" sur le panneau déjà
// présent dans le DOM. Un renderDeezerMiniPlayer() complet ici
// détruirait l'iframe à chaque ouverture/fermeture et couperait le
// son — exactement ce qu'on veut éviter.
export function toggleDeezerMiniPlayer(open) {
  state.miniPlayerOpen = open;
  const panel = document.querySelector(".deezer-mini-panel");
  const tabBtn = document.getElementById("deezerMiniTabBtn");
  if (panel) panel.classList.toggle("open", open);
  if (tabBtn) tabBtn.setAttribute("aria-label", open ? "Fermer le lecteur" : "Ouvrir le lecteur de musique");
}

// ============================================================
// MODE CORRESPONDANCE — Jeu de correspondance (sans audio)
// ------------------------------------------------------------
// Fonctionne entierement avec des donnees stockees nous-memes (zero
// dependance externe, zero risque de panne tierce). L'utilisateur
// voit le nom d'une chanson d'OST et devine le drama associe.
// ============================================================

// Jeu de donnees de demonstration — a remplacer par une vraie table
// `ost_titres` (chanson, drama_id) si vous retenez ce mode.
// Playlist Deezer publique affichée par défaut dans l'onglet "Écouter
// sur Deezer", modifiable via le bouton "Changer de playlist".
export const OST_PLAYLIST_DEFAUT = "8954525442";

export const OST_DEMO_DATA = [
  { chanson: "Stay With Me", artiste: "Chanyeol, Punch", drama: "Goblin" },
  { chanson: "Always", artiste: "Yoon Mi-rae", drama: "Descendants of the Sun" },
  { chanson: "Beautiful", artiste: "Crush", drama: "Goblin" },
  { chanson: "Can't Help Falling in Love", artiste: "Haily Cho", drama: "Crash Landing on You" },
  { chanson: "I Love You", artiste: "MAMAMOO (Wheein)", drama: "Hotel del Luna" },
  { chanson: "Carmen", artiste: "Diana Lee", drama: "Hotel del Luna" },
];

export function genererQuestionsOstCorrespondance(data, n) {
  n = Math.min(n || 6, data.length);
  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, n);
  return shuffled.map((item) => {
    const autres = data.filter((x) => x.drama !== item.drama).sort(() => Math.random() - 0.5).slice(0, 3);
    const { choices, correctIndex } = shuffleWithCorrect(item.drama, autres.map((a) => a.drama));
    return { item, choices, correctIndex };
  });
}

export function startOstChallengeCorrespondance() {
  const questions = genererQuestionsOstCorrespondance(OST_DEMO_DATA, 6);
  setState({ ostQuestions: questions, ostEnCours: true, ostIndex: 0, ostScore: 0, ostTermine: false });
}

export function renderOstPlayerCorrespondance() {
  const q = state.ostQuestions[state.ostIndex];
  return `<div class="trends-wrap">
    <section class="tr-section">
      <p class="tr-note">Titre ${state.ostIndex + 1} / ${state.ostQuestions.length}</p>
      <div class="tr-card">
        <p class="tr-rk-label">Chanson</p>
        <p class="tr-rk-title" style="font-size:16px;">${esc(q.item.chanson)}</p>
        <p class="tr-rk-meta" style="margin-bottom:14px;">${esc(q.item.artiste)}</p>
        <p class="tr-rk-title" style="margin-bottom:12px;">De quel drama vient cet OST ?</p>
        <div style="display:flex; flex-direction:column; gap:9px;">
          ${q.choices.map((c, i) => `<button class="ghost-btn" data-ost-answer="${i}" style="text-align:left; padding:12px;">${esc(c)}</button>`).join("")}
        </div>
      </div>
    </section>
  </div>`;
}

// ============================================================
// LOGIQUE COMMUNE (reponse, score, leaderboard)
// ============================================================

export async function answerOstQuestion(choixIndex) {
  const q = state.ostQuestions[state.ostIndex];
  const correct = choixIndex === q.correctIndex;
  if (correct) state.ostScore += 1;

  if (state.ostIndex + 1 >= state.ostQuestions.length) {
    await finishOstChallenge();
  } else {
    setState({ ostIndex: state.ostIndex + 1 });
  }
}

export async function finishOstChallenge() {
  setState({ ostEnCours: false, ostTermine: true });
  if (!isLoggedIn()) {
    showToast(`Score : ${state.ostScore}/${state.ostQuestions.length || state.ostRoundsTotal} — connecte-toi pour l'enregistrer !`);
    return;
  }
  try {
    const { error } = await sb.from("scores_ost").insert([{
      user_id: currentUserId(),
      score: state.ostScore,
      mode: "solo",
    }]);
    if (error) throw error;
    await loadOstLeaderboard();
    render();
  } catch (e) {
    console.error(e);
    showToast("Score non enregistré.");
  }
}

export async function loadOstLeaderboard() {
  try {
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { data, error } = await sb
      .from("scores_ost")
      .select("*, profils(pseudo, avatar_url)")
      .gte("date_partie", oneWeekAgo.toISOString())
      .order("score", { ascending: false })
      .limit(20);
    if (error) throw error;
    state.ostLeaderboard = data || [];
  } catch (e) {
    console.error(e);
    state.ostLeaderboard = [];
  }
}

// ============================================================
// RENDU — onglet Deezer (widget d'écoute, séparé de l'OST Challenge)
// ============================================================
export function renderDeezerView() {
  return `<div class="trends-wrap">
    <section class="tr-section">
      <h2 class="tr-title">Deezer</h2>
      <p class="tr-note">Écoute la playlist OST en fond pendant que tu navigues sur le carnet.</p>
      <iframe title="deezer-widget" src="https://widget.deezer.com/widget/dark/playlist/${esc(state.widgetSimplePlaylistId || OST_PLAYLIST_DEFAUT)}" width="100%" height="300" frameborder="0" allowtransparency="true" allow="encrypted-media; clipboard-write" style="border-radius:10px;"></iframe>
      <button class="text-btn" id="changerPlaylistOstBtn" style="margin-top:8px;">🔄 Changer de playlist</button>
      ${state.showChangerPlaylistOst ? `
        <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500; margin-top:8px;">
          Lien playlist Deezer publique
          <input id="ost-ecoute-input" value="${esc(state.playlistLienInput)}" placeholder="https://www.deezer.com/playlist/...">
        </label>
        ${state.ostError ? `<p style="color:var(--seal); font-size:12.5px; margin-top:6px;">${esc(state.ostError)}</p>` : ""}
        <button class="primary-btn" id="chargerWidgetSimpleBtn" style="width:100%; margin-top:8px;">Charger cette playlist</button>
      ` : ""}
    </section>
  </div>`;
}

export function attachDeezerListeners() {
  const ostEcouteInput = document.getElementById("ost-ecoute-input");
  if (ostEcouteInput) ostEcouteInput.addEventListener("input", (e) => { state.playlistLienInput = e.target.value; });
  const changerPlaylistOstBtn = document.getElementById("changerPlaylistOstBtn");
  if (changerPlaylistOstBtn) changerPlaylistOstBtn.addEventListener("click", () => setState({ showChangerPlaylistOst: !state.showChangerPlaylistOst }));
  const chargerWidgetSimpleBtn = document.getElementById("chargerWidgetSimpleBtn");
  if (chargerWidgetSimpleBtn) {
    chargerWidgetSimpleBtn.addEventListener("click", () => {
      chargerWidgetSimple(state.playlistLienInput);
      setState({ showChangerPlaylistOst: false });
    });
  }
}

export function renderOstView() {
  if (state.ostEnCours) {
    return renderOstPlayerCorrespondance();
  }
  if (state.ostTermine) {
    return `<div class="trends-wrap"><section class="tr-section">
      <div class="tr-highlight">
        <p class="tr-hc-names">Partie terminée !</p>
        <p class="tr-hc-detail">Score : <b>${state.ostScore} / ${state.ostQuestions.length || state.ostRoundsTotal}</b></p>
      </div>
      <button class="ghost-btn" id="backToOstHomeBtn" style="width:100%; margin-top:14px;">Retour</button>
    </section></div>`;
  }

  return `<div class="trends-wrap">
    <section class="tr-section">
      <h2 class="tr-title">OST Challenge</h2>
      <p class="tr-note">Pas d'audio : tu vois le nom d'une chanson d'OST et devines le drama associé. Fonctionne sans dépendance externe.</p>
      <button class="primary-btn" id="startOstCorrespondanceBtn" style="width:100%; margin-top:10px;">Lancer le défi (${OST_DEMO_DATA.length} titres de démo)</button>
    </section>

    <section class="tr-section">
      <h2 class="tr-title">Classement (7 derniers jours)</h2>
      ${state.ostLeaderboard.length === 0 ? `<p class="tr-note">Personne n'a encore joué.</p>` : state.ostLeaderboard.map((s, i) => `
        <div class="tr-eff-row">
          <span class="tr-rank">${i + 1}</span>
          <div class="tr-person-info"><p class="tr-person-name">${esc(s.profils ? s.profils.pseudo : "?")}</p></div>
          <span class="tr-eff-score">${s.score}</span>
        </div>`).join("")}
    </section>
  </div>`;
}

export function attachOstListeners() {
  // Mode correspondance
  const startCorrespondanceBtn = document.getElementById("startOstCorrespondanceBtn");
  if (startCorrespondanceBtn) startCorrespondanceBtn.addEventListener("click", startOstChallengeCorrespondance);
  document.querySelectorAll("[data-ost-answer]").forEach((btn) => {
    btn.addEventListener("click", () => answerOstQuestion(Number(btn.dataset.ostAnswer)));
  });

  const backBtn = document.getElementById("backToOstHomeBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      setState({ ostTermine: false });
    });
  }
}

/* ============================================================
   NOTES SUR LES DEUX MODES
   ============================================================
   MODE ÉCOUTE (lien direct vers la playlist Deezer)
   + Fiable à 100% : ouvre une page Deezer standard, rien à intégrer
   + Gratuit, aucune limite de durée d'écoute
   - Pas de jeu, pas de score, juste la musique

   MODE CORRESPONDANCE (sans audio)
   + Zéro dépendance externe, zéro risque de panne tierce
   + Score vérifiable automatiquement par notre app
   - Pas d'écoute, expérience moins immersive

   Note : le mode "widget Deezer intégré" (iframe avec liste masquée)
   a été testé en conditions réelles et abandonné : le widget appelle
   lui-même api.deezer.com en interne pour charger sa tracklist, et
   cet appel est bloqué par CORS — confirmé par erreur navigateur,
   pas seulement en théorie. C'est une limitation du widget Deezer
   lui-même, pas un bug réparable côté app.
   ============================================================ */
