// ============================================================
// MODULE CATALOGUE — extrait de index.html (Kdramatrics)
// Formulaire de création/édition de drama, casting, import TMDB,
// liste/grille du catalogue, vue tendances, wishlist "à voir",
// modale fiche personne.
// Dépend de main.js pour l'état global et les helpers partagés,
// et de social.js/auth.js pour quelques actions croisées.
// ============================================================

import { state, setState, esc, showToast, sb, isLoggedIn, currentUserId, render, findPersonPhoto, splitPeople, formatDateFr, castingLinksHtml, computeTrends, enrichirDramasAvecPersonnes, fmtNote, chargerMesVisionnages, chargerDramaPersonnes, emptyAVoirDraft, emptyDraft, entriesPourFichesPersonnes, findCollabsFor, findPersonneId, findProfile, getNombreVus, getNoteReference, loadData, personLinkHtml, uploadImage, roleLabel, reliabilityBadge, FLOWER_MOTIF_SVG } from './main.js';
import { getValeurSureCommentCount, getValeurSureLikeCount, hasLikedValeurSure, openProfilPublic } from './social.js';
import { loadProfilCourant } from './auth.js';

// ============== STAMP / AVATAR HELPERS ==============
export function stampHtml(note, mini) {
  const has = note !== null && note !== undefined && note !== "";
  return `<div class="stamp ${has ? "" : "empty"} ${mini ? "mini" : ""}">
    <svg viewBox="0 0 60 60" width="100%" height="100%"><circle cx="30" cy="30" r="27"/><circle cx="30" cy="30" r="22"/></svg>
    <span class="stamp-text">${has ? esc(note) : "–"}</span>
  </div>`;
}

// ============== CRUD ==============
export function openNew() {
  setState({ draft: emptyDraft(), editingId: null, showForm: true, confirmDuplicateAdd: false, castingSearchQuery: { acteur: "", actrice: "", scenariste: "", realisateur: "" } });
}
// Construit castingSelection à partir de personnes_liees (ajouté par
// enrichirDramasAvecPersonnes en étape 1), trié par ordre de saisie.
export function castingSelectionDepuisDrama(d) {
  const liens = (d.personnes_liees || []).slice().sort((a, b) => a.ordre - b.ordre);
  const parRole = (role) => liens.filter((l) => l.role === role).map((l) => ({ id: l.id, nom: l.nom }));
  return {
    acteur: parRole("acteur"),
    actrice: parRole("actrice"),
    scenariste: parRole("scenariste"),
    realisateur: parRole("realisateur"),
  };
}
// Convertit le casting texte renvoyé par TMDB (chargerDetailsTmdb,
// un nom pour acteur/actrice, plusieurs noms séparés par virgule pour
// scenariste/realisateur) en castingSelection structuré, en
// retrouvant l'id existant dans state.people si le nom correspond
// déjà à une personne connue (id null sinon, créée à l'enregistrement
// du drama — voir synchroniserCastingDrama).
export function castingSelectionDepuisTexteTmdb(details) {
  const resoudre = (nom, role) => {
    const existante = state.people.find((p) => p.role === role && p.nom.toLowerCase() === nom.toLowerCase());
    // Si une correspondance existe déjà en base, on garde SON nom
    // (casse/orthographe potentiellement déjà corrigée via la fiche
    // personne) plutôt que la graphie brute renvoyée par TMDB.
    return existante ? { id: existante.id, nom: existante.nom } : { id: null, nom };
  };
  return {
    acteur: details.acteur ? [resoudre(details.acteur, "acteur")] : [],
    actrice: details.actrice ? [resoudre(details.actrice, "actrice")] : [],
    scenariste: splitPeople(details.scenariste).map((n) => resoudre(n, "scenariste")),
    realisateur: splitPeople(details.realisateur).map((n) => resoudre(n, "realisateur")),
  };
}
export function openEdit(d) {
  setState({
    draft: {
      id: d.id, visionnage_id: d.visionnage_id || null, titre: d.titre || "", titre_kr: d.titre_kr || "", annee: d.annee ?? "",
      scenariste: d.scenariste || "", realisateur: d.realisateur || "", acteur: d.acteur || "", actrice: d.actrice || "",
      note: d.note ?? "", episodes: d.episodes ?? "", duree: d.duree ?? "", poster_url: d.poster_url || "",
      date_visionnage: d.date_visionnage || "",
      castingSelection: castingSelectionDepuisDrama(d),
    },
    editingId: d.id, showForm: true, confirmDuplicateAdd: false, castingSearchQuery: { acteur: "", actrice: "", scenariste: "", realisateur: "" },
  });
}
export function closeForm() {
  setState({ showForm: false, editingId: null, confirmDuplicateAdd: false });
}
export function updateDraft(patch) {
  setState({ draft: { ...state.draft, ...patch } });
}

// ---- sélecteur de casting (personnes liées à un drama, par rôle) ----

// Ajoute une personne (existante : {id, nom}, ou nouvelle : {id: null,
// nom}) au rôle donné dans le brouillon en cours, et vide la recherche
// de ce rôle. Empêche les doublons dans la même sélection.
export function ajouterPersonneAuCasting(role, personne) {
  const liste = state.draft.castingSelection[role] || [];
  const dejaPresent = personne.id
    ? liste.some((p) => p.id === personne.id)
    : liste.some((p) => p.nom.toLowerCase() === personne.nom.toLowerCase());
  if (dejaPresent) {
    setState({ castingSearchQuery: { ...state.castingSearchQuery, [role]: "" } });
    return;
  }
  setState({
    draft: { ...state.draft, castingSelection: { ...state.draft.castingSelection, [role]: [...liste, personne] } },
    castingSearchQuery: { ...state.castingSearchQuery, [role]: "" },
  });
}

export function retirerPersonneDuCasting(role, index) {
  const liste = state.draft.castingSelection[role] || [];
  setState({
    draft: { ...state.draft, castingSelection: { ...state.draft.castingSelection, [role]: liste.filter((_, i) => i !== index) } },
  });
}

// Attache les listeners click sur les boutons de résultats/création
// d'un sélecteur de casting donné, après une mise à jour en DOM direct
// (sans passer par render()/attachListeners() global, pour ne pas
// perdre le focus du champ de recherche en cours de frappe — voir
// l'appel dans attachListeners()).
export function attachCastingResultListeners(wrapper) {
  wrapper.querySelectorAll("[data-casting-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ajouterPersonneAuCasting(btn.dataset.castingPick, { id: btn.dataset.castingPickId, nom: btn.dataset.castingPickNom });
    });
  });
  wrapper.querySelectorAll("[data-casting-create]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nom = (btn.dataset.castingCreateNom || "").trim();
      if (!nom) return;
      ajouterPersonneAuCasting(btn.dataset.castingCreate, { id: null, nom });
    });
  });
}

// Rend un sélecteur de casting pour un rôle donné : puces déjà
// sélectionnées + champ de recherche parmi les personnes existantes de
// CE rôle uniquement (voir le choix fait pour l'étape 3 : pas de
// recherche cross-rôle, plus simple, au prix d'un risque mineur de
// doublon si la même personne réelle a plusieurs rôles).
export function renderCastingSelector(role, label) {
  const selection = state.draft.castingSelection[role] || [];
  const q = (state.castingSearchQuery[role] || "").trim().toLowerCase();
  const selectedIds = new Set(selection.filter((p) => p.id).map((p) => p.id));
  const resultats = q.length === 0
    ? []
    : state.people
        .filter((p) => p.role === role && !selectedIds.has(p.id) && p.nom.toLowerCase().includes(q))
        .slice(0, 6);
  const existeDejaExact = state.people.some((p) => p.role === role && p.nom.toLowerCase() === q);

  return `<div class="field-label-wrap casting-selector" data-casting-role="${role}" data-casting-label="${esc(label)}">
    <span class="field-label">${esc(label)}</span>
    ${selection.length > 0 ? `<div class="casting-chips">
      ${selection.map((p, i) => `<span class="casting-chip">${esc(p.nom)}${!p.id ? ` <em>(nouveau)</em>` : ""}<button type="button" data-casting-remove="${role}:${i}" aria-label="Retirer">✕</button></span>`).join("")}
    </div>` : ""}
    <input class="casting-search-input" data-casting-search="${role}" value="${esc(state.castingSearchQuery[role] || "")}" placeholder="Chercher ou ajouter ${esc(label.toLowerCase())}...">
    ${q.length > 0 ? `<div class="casting-results">
      ${resultats.map((p) => `<button type="button" class="casting-result" data-casting-pick="${role}" data-casting-pick-id="${esc(p.id)}" data-casting-pick-nom="${esc(p.nom)}">${esc(p.nom)}</button>`).join("")}
      ${!existeDejaExact ? `<button type="button" class="casting-result casting-result-create" data-casting-create="${role}" data-casting-create-nom="${esc(state.castingSearchQuery[role])}">+ Créer "${esc(state.castingSearchQuery[role])}"</button>` : ""}
    </div>` : ""}
  </div>`;
}
export async function handlePosterUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Choisis un fichier image."); return; }
  setState({ imageProcessing: true });
  try {
    const url = await uploadImage(file, "posters");
    updateDraft({ poster_url: url });
  } catch (e) {
    console.error(e);
    showToast("Échec de l'upload de l'image.");
  } finally {
    setState({ imageProcessing: false });
  }
}
export function removePoster() { updateDraft({ poster_url: "" }); }

// Synchronise drama_personnes avec castingSelection du brouillon en
// cours : crée les personnes nouvelles (id null) si besoin, puis
// remplace entièrement les liens existants de ce drama par la
// sélection actuelle (plus simple et plus sûr qu'un diff incrémental).
export async function synchroniserCastingDrama(dramaId, castingSelection) {
  const roles = ["acteur", "actrice", "scenariste", "realisateur"];

  // 1) Créer les personnes qui n'ont pas encore d'id (nouvelles,
  // ajoutées via "+ Créer ..."). onConflict: "nom,role" couvre le cas
  // rare où la même personne aurait été créée entre-temps ailleurs.
  for (const role of roles) {
    const liste = castingSelection[role] || [];
    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      if (p.id) continue;
      const { data: créée, error } = await sb
        .from("personnes")
        .upsert({ nom: p.nom.trim(), role }, { onConflict: "nom,role" })
        .select()
        .single();
      if (error) throw error;
      liste[i] = { id: créée.id, nom: créée.nom };
    }
  }

  // 2) Remplace tous les liens existants de ce drama par la sélection
  // actuelle (suppression puis insertion, dans une suite d'appels
  // séquentiels — pas de transaction multi-requêtes possible via le
  // client JS Supabase, mais l'ordre delete-puis-insert limite le
  // risque d'incohérence visible).
  const { error: errDelete } = await sb.from("drama_personnes").delete().eq("drama_id", dramaId);
  if (errDelete) throw errDelete;

  const lignes = [];
  roles.forEach((role) => {
    (castingSelection[role] || []).forEach((p, ordre) => {
      if (p.id) lignes.push({ drama_id: dramaId, personne_id: p.id, role, ordre });
    });
  });
  if (lignes.length > 0) {
    const { error: errInsert } = await sb.from("drama_personnes").insert(lignes);
    if (errInsert) throw errInsert;
  }
}

export async function saveDraft() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour ajouter un drama à ta liste."); return; }
  const d = state.draft;
  if (!d.titre.trim()) { showToast("Le titre est obligatoire."); return; }

  if (!state.editingId && !state.confirmDuplicateAdd) {
    const normalized = d.titre.trim().toLowerCase();
    const duplicate = state.entries.find((e) => e.titre.trim().toLowerCase() === normalized);
    if (duplicate) {
      state.confirmDuplicateAdd = true;
      showToast(`"${duplicate.titre}" existe déjà dans le catalogue — touche "Ajouter" à nouveau pour confirmer et l'ajouter à ta liste quand même.`);
      return;
    }
  }

  // Métadonnées factuelles : vivent dans le catalogue commun `dramas`.
  // Les colonnes texte acteur/actrice/scenariste/realisateur ne sont
  // PLUS écrites ici : le casting est désormais géré exclusivement via
  // castingSelection -> drama_personnes (synchroniserCastingDrama, ci-
  // dessous). Ces colonnes restent en base, gelées à leur dernière
  // valeur connue, comme filet de sécurité temporaire.
  const metadonnees = {
    titre: d.titre.trim(),
    titre_kr: d.titre_kr.trim() || null,
    annee: d.annee === "" ? null : Number(d.annee),
    episodes: d.episodes === "" ? null : Number(d.episodes),
    duree: d.duree === "" ? null : Number(d.duree),
    poster_url: d.poster_url || null,
  };
  // Données personnelles : vivent dans `mes_visionnages`.
  const noteValue = d.note === "" ? null : Number(d.note);
  const dateValue = d.date_visionnage || null;

  try {
    let dramaId = state.editingId;

    if (dramaId) {
      // Le drama existe déjà dans le catalogue : on met à jour ses métadonnées.
      const { error } = await sb.from("dramas").update(metadonnees).eq("id", dramaId);
      if (error) throw error;
    } else {
      // Nouveau titre : on l'ajoute au catalogue commun.
      const { data: inserted, error } = await sb.from("dramas").insert([metadonnees]).select().single();
      if (error) throw error;
      dramaId = inserted.id;
    }

    await synchroniserCastingDrama(dramaId, d.castingSelection);

    // Mon visionnage personnel : upsert sur (user_id, drama_id).
    const { error: errVisionnage } = await sb.from("mes_visionnages").upsert({
      user_id: currentUserId(),
      drama_id: dramaId,
      note: noteValue,
      date_visionnage: dateValue,
    }, { onConflict: "user_id,drama_id" });
    if (errVisionnage) throw errVisionnage;

    showToast(state.editingId ? "Modifications enregistrées." : "Drama ajouté à ta liste.");
    await loadData();
    closeForm();
  } catch (e) {
    console.error(e);
    showToast("Sauvegarde impossible.");
  }
}

export function searchPosterOnline(titre) {
  if (!titre || !titre.trim()) {
    showToast("Indique d'abord un titre.");
    return;
  }
  const query = encodeURIComponent(`${titre} kdrama poster`);
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank", "noopener");
}

export function searchPersonPhotoOnline(nom) {
  if (!nom || !nom.trim()) return;
  const query = encodeURIComponent(`${nom} actor korean`);
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank", "noopener");
}

/* ============================================================
   MODULE TMDB — recherche de casting + import en masse de k-dramas
   ------------------------------------------------------------
   TMDB (The Movie Database) a une API gratuite avec clé personnelle.
   Contrairement à Deezer, le preflight CORS de TMDB renvoie
   Access-Control-Allow-Origin: * pour les requêtes simples — vérifié
   via la documentation publique, mais PAS testé directement par moi
   en conditions réelles (mon environnement de développement n'a pas
   accès à api.themoviedb.org). Si vous rencontrez une erreur CORS au
   premier essai, ce point précis est à vérifier en priorité.

   La clé API TMDB est personnelle et gratuite : créez un compte sur
   themoviedb.org puis Paramètres → API → demander une clé (v3).
   Elle est stockée uniquement dans le navigateur (localStorage), pas
   en base de données — elle n'est donc jamais partagée entre
   utilisateurs ni exposée publiquement.
   ============================================================ */

const TMDB_KEY_STORAGE = "kdrama_tmdb_api_key";

export function getTmdbApiKey() {
  return localStorage.getItem(TMDB_KEY_STORAGE) || "";
}
export function setTmdbApiKey(key) {
  if (key) localStorage.setItem(TMDB_KEY_STORAGE, key);
  else localStorage.removeItem(TMDB_KEY_STORAGE);
}

export function demanderCleTmdbSiAbsente() {
  if (getTmdbApiKey()) return true;
  setState({ showTmdbKeyModal: true });
  return false;
}

// ---- recherche TMDB pour pré-remplir le formulaire d'un drama ----
export async function rechercherSurTmdb(titre) {
  if (!titre || !titre.trim()) { showToast("Indique d'abord un titre."); return; }
  if (!demanderCleTmdbSiAbsente()) return;
  const apiKey = getTmdbApiKey();

  setState({ tmdbSearchLoading: true });
  try {
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(titre.trim())}&language=fr-FR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      showToast("Aucun résultat TMDB pour ce titre.");
      setState({ tmdbSearchLoading: false });
      return;
    }
    setState({ tmdbSearchResults: data.results.slice(0, 5), tmdbSearchLoading: false });
  } catch (e) {
    console.error(e);
    showToast("Recherche TMDB impossible (clé invalide, ou problème CORS — voir commentaire dans le code).");
    setState({ tmdbSearchLoading: false });
  }
}

// ---- récupère casting + réalisateur pour une série TMDB précise ----
export async function chargerDetailsTmdb(tvId) {
  const apiKey = getTmdbApiKey();
  try {
    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${apiKey}&language=fr-FR&append_to_response=aggregate_credits`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const credits = data.aggregate_credits || { cast: [], crew: [] };
    // Le champ `gender` de TMDB (1 = femme, 2 = homme, 0 = inconnu) est
    // fiable pour la grande majorité des fiches et évite le bug où deux
    // rôles principaux du même genre se retrouvaient répartis à tort
    // dans les champs acteur/actrice. On prend l'homme et la femme les
    // mieux crédités ; si le genre est inconnu pour l'un des deux rôles
    // principaux, on complète avec l'ordre de billing (ancien
    // comportement) plutôt que de laisser un champ vide.
    const cast = credits.cast || [];
    let acteurPick = cast.find((c) => c.gender === 2);
    let actricePick = cast.find((c) => c.gender === 1 && c !== acteurPick);
    if (!acteurPick) acteurPick = cast.find((c) => c !== actricePick);
    if (!actricePick) actricePick = cast.find((c) => c !== acteurPick);
    const realisateurs = (credits.crew || []).filter((c) => (c.jobs || []).some((j) => j.job === "Director" || j.job === "Series Directing"));
    const scenaristes = (credits.crew || []).filter((c) => (c.jobs || []).some((j) => j.job === "Writer" || j.job === "Screenplay" || j.job === "Story"));

    return {
      titre: data.name,
      titre_kr: data.original_name !== data.name ? data.original_name : "",
      annee: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) : "",
      acteur: acteurPick ? acteurPick.name : "",
      actrice: actricePick ? actricePick.name : "",
      realisateur: realisateurs.map((r) => r.name).join(", "),
      scenariste: scenaristes.map((s) => s.name).join(", "),
      episodes: data.number_of_episodes || "",
      poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
    };
  } catch (e) {
    console.error(e);
    showToast("Détails TMDB impossibles à charger.");
    return null;
  }
}

export async function appliquerResultatTmdb(tvId, cible) {
  showToast("Récupération du casting…");
  const details = await chargerDetailsTmdb(tvId);
  if (!details) return;

  if (cible === "drama") {
    // Le formulaire drama n'utilise plus les champs texte
    // acteur/actrice/scenariste/realisateur (remplacés par
    // castingSelection, voir l'étape 3 de la refonte personnes) — on
    // alimente donc castingSelection, en plus des autres champs
    // (titre, année, poster...) qui restent du texte simple.
    const { acteur, actrice, scenariste, realisateur, ...autresChamps } = details;
    updateDraft({ ...autresChamps, castingSelection: castingSelectionDepuisTexteTmdb(details) });
  } else if (cible === "avoir") {
    updateAVoirDraft({ ...details, resume: state.aVoirDraft.resume });
  }
  setState({ tmdbSearchResults: [] });
  showToast("Casting récupéré depuis TMDB — vérifie et corrige si besoin.");
}

// ---- import en masse depuis TMDB (catalogue de départ) ----
// S'exécute dans VOTRE navigateur (pas depuis mon environnement de
// développement, qui n'a pas accès à api.themoviedb.org) : vous voyez
// directement si la clé et le réseau fonctionnent.
export async function importerCatalogueTmdb(nombrePages) {
  if (!demanderCleTmdbSiAbsente()) return;
  if (!isLoggedIn()) { showToast("Connecte-toi pour importer dans le catalogue."); return; }
  const apiKey = getTmdbApiKey();
  nombrePages = nombrePages || 2;

  setState({ tmdbImportEnCours: true, tmdbImportProgress: 0, tmdbImportTotal: 0 });
  try {
    let tousLesResultats = [];
    for (let page = 1; page <= nombrePages; page++) {
      const url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&with_origin_country=KR&with_original_language=ko&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      tousLesResultats = tousLesResultats.concat(data.results || []);
    }

    // Évite de réimporter un titre déjà présent dans le catalogue.
    const titresExistants = new Set(state.entries.map((d) => d.titre.trim().toLowerCase()));
    const nouveaux = tousLesResultats.filter((r) => !titresExistants.has((r.name || "").trim().toLowerCase()));

    setState({ tmdbImportTotal: nouveaux.length });
    let importes = 0;
    for (const serie of nouveaux) {
      const details = await chargerDetailsTmdb(serie.id);
      if (details && details.titre) {
        try {
          // Métadonnées factuelles seules dans "dramas" — le casting
          // est désormais géré via drama_personnes (synchroniserCastingDrama),
          // pas via les colonnes texte acteur/actrice/scenariste/realisateur
          // (gelées, voir l'étape 3 de la refonte personnes).
          const { data: inserted, error } = await sb.from("dramas").insert([{
            titre: details.titre,
            titre_kr: details.titre_kr || null,
            annee: details.annee || null,
            episodes: details.episodes || null,
            poster_url: details.poster_url || null,
          }]).select().single();
          if (error) throw error;
          await synchroniserCastingDrama(inserted.id, castingSelectionDepuisTexteTmdb(details));
          importes++;
        } catch (e) {
          console.error("Erreur import", serie.name, e);
        }
      }
      setState({ tmdbImportProgress: importes });
    }
    showToast(`${importes} dramas importés depuis TMDB.`);
    await loadData();
  } catch (e) {
    console.error(e);
    showToast("Import TMDB impossible (clé invalide, ou problème réseau/CORS).");
  } finally {
    setState({ tmdbImportEnCours: false });
  }
}

export function renderTmdbKeyModal() {
  if (!state.showTmdbKeyModal) return "";
  return `<div class="modal-overlay" id="tmdbKeyModalOverlay">
    <div class="modal-sheet" id="tmdbKeyModalSheet">
      <div class="modal-handle"></div>
      <div class="modal-header" style="padding:0 18px;">
        <div style="flex:1;"><h3 style="font-family:'Press Start 2P',cursive; font-size:13px; margin:0; color:var(--blue-deep);">Clé API TMDB</h3></div>
        <button class="icon-btn" id="tmdbKeyModalClose">✕</button>
      </div>
      <div class="modal-body">
        <p class="tr-note">Pour récupérer le casting automatiquement, il faut une clé API TMDB gratuite et personnelle.</p>
        <p class="tr-note">Crée un compte sur <b>themoviedb.org</b>, puis Paramètres → API → demander une clé (v3). Colle-la ici, elle reste uniquement dans ce navigateur.</p>
        <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500; margin-top:10px;">
          Clé API TMDB (v3)
          <input id="tmdb-key-input" value="${esc(getTmdbApiKey())}" placeholder="ex. 0123456789abcdef0123456789abcdef">
        </label>
      </div>
      <div class="modal-footer">
        <button class="primary-btn" id="tmdbKeySaveBtn">Enregistrer</button>
      </div>
    </div>
  </div>`;
}

export function renderTmdbSearchResults(cible) {
  if (state.tmdbSearchLoading) return `<p class="tr-note">Recherche TMDB…</p>`;
  if (!state.tmdbSearchResults || state.tmdbSearchResults.length === 0) return "";
  return `<div class="field-label-wrap">
    <span class="field-label">Résultats TMDB — choisis le bon titre</span>
    ${state.tmdbSearchResults.map((r) => `
      <div class="tr-person-row" data-tmdb-pick="${r.id}" data-tmdb-cible="${cible}">
        ${r.poster_path ? `<img src="https://image.tmdb.org/t/p/w92${r.poster_path}" class="tr-person-avatar" style="width:38px;height:54px;border-radius:2px;object-fit:cover;">` : `<span class="tr-rank">🎬</span>`}
        <div class="tr-person-info"><p class="tr-person-name">${esc(r.name)}</p><p class="tr-person-sub">${esc(r.first_air_date ? r.first_air_date.slice(0, 4) : "")}</p></div>
      </div>`).join("")}
  </div>`;
}

export function shareDrama(d) {
  const lines = [
    `🎬 ${d.titre}${d.annee ? ` (${d.annee})` : ""}`,
    d.titre_kr ? d.titre_kr : null,
    d.note !== null && d.note !== undefined ? `Note : ${fmtNote(d.note)}/10` : null,
    [d.acteur, d.actrice].filter(Boolean).length ? `Avec ${[d.acteur, d.actrice].filter(Boolean).join(" et ")}` : null,
    d.episodes ? `${d.episodes} épisodes${d.duree ? ` · ${d.duree} min` : ""}` : null,
  ].filter(Boolean);
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast("Copié dans le presse-papier !"),
      () => showToast(text)
    );
  } else {
    showToast(text);
  }
}

export async function deleteEntry(id) {
  // `id` est l'id du DRAMA (catalogue). On retire seulement MON
  // visionnage personnel — le titre reste dans le catalogue commun
  // pour les autres utilisateurs qui l'auraient aussi vu.
  if (!isLoggedIn()) return;
  try {
    const { error } = await sb.from("mes_visionnages").delete().eq("user_id", currentUserId()).eq("drama_id", id);
    if (error) throw error;
    setState({ confirmDeleteId: null, expandedId: state.expandedId === id ? null : state.expandedId });
    await loadData();
    showToast("Retiré de ta liste.");
  } catch (e) {
    console.error(e);
    showToast("Suppression impossible.");
  }
}

// ============== A VOIR (WISHLIST) CRUD ==============
export function openNewAVoir() {
  setState({ aVoirDraft: emptyAVoirDraft(), editingAVoirId: null, showAVoirForm: true });
}
export function openEditAVoir(d) {
  setState({
    aVoirDraft: {
      id: d.id, mes_a_voir_id: d.mes_a_voir_id || null, titre: d.titre || "", titre_kr: d.titre_kr || "", annee: d.annee ?? "",
      scenariste: d.scenariste || "", realisateur: d.realisateur || "", acteur: d.acteur || "", actrice: d.actrice || "",
      resume: d.resume || "", poster_url: d.poster_url || "",
    },
    editingAVoirId: d.id, showAVoirForm: true,
  });
}
export function closeAVoirForm() {
  setState({ showAVoirForm: false, editingAVoirId: null });
}
export function updateAVoirDraft(patch) {
  setState({ aVoirDraft: { ...state.aVoirDraft, ...patch } });
}
export async function handleAVoirPosterUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Choisis un fichier image."); return; }
  setState({ imageProcessing: true });
  try {
    const url = await uploadImage(file, "posters");
    updateAVoirDraft({ poster_url: url });
  } catch (e) {
    console.error(e);
    showToast("Échec de l'upload de l'image.");
  } finally {
    setState({ imageProcessing: false });
  }
}
export function removeAVoirPoster() { updateAVoirDraft({ poster_url: "" }); }

export async function saveAVoirDraft() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour ajouter un drama à ta liste à voir."); return; }
  const d = state.aVoirDraft;
  if (!d.titre.trim()) { showToast("Le titre est obligatoire."); return; }
  const metadonnees = {
    titre: d.titre.trim(),
    titre_kr: d.titre_kr.trim() || null,
    annee: d.annee === "" ? null : Number(d.annee),
    scenariste: d.scenariste.trim() || null,
    realisateur: d.realisateur.trim() || null,
    acteur: d.acteur.trim() || null,
    actrice: d.actrice.trim() || null,
    resume: d.resume.trim() || null,
    poster_url: d.poster_url || null,
  };
  try {
    let aVoirId = state.editingAVoirId;

    if (aVoirId) {
      const { error } = await sb.from("a_voir").update(metadonnees).eq("id", aVoirId);
      if (error) throw error;
    } else {
      // Évite de dupliquer une suggestion déjà présente dans le
      // catalogue commun sous le même titre.
      const normalized = d.titre.trim().toLowerCase();
      const existant = state.aVoirCatalogue.find((a) => a.titre.trim().toLowerCase() === normalized);
      if (existant) {
        aVoirId = existant.id;
      } else {
        const { data: inserted, error } = await sb.from("a_voir").insert([metadonnees]).select().single();
        if (error) throw error;
        aVoirId = inserted.id;
      }
    }

    // Lien personnel : upsert sur (user_id, a_voir_id).
    const { error: errLien } = await sb.from("mes_a_voir").upsert({
      user_id: currentUserId(),
      a_voir_id: aVoirId,
    }, { onConflict: "user_id,a_voir_id" });
    if (errLien) throw errLien;

    showToast(state.editingAVoirId ? "Modifications enregistrées." : "Ajouté à ta liste à voir.");
    await loadData();
    closeAVoirForm();
  } catch (e) {
    console.error(e);
    showToast("Sauvegarde impossible.");
  }
}

export async function deleteAVoirEntry(id) {
  // `id` est l'id de l'entrée `a_voir` (catalogue). On retire
  // seulement MON lien personnel — la suggestion reste dans le
  // catalogue commun pour les autres utilisateurs.
  if (!isLoggedIn()) return;
  try {
    const { error } = await sb.from("mes_a_voir").delete().eq("user_id", currentUserId()).eq("a_voir_id", id);
    if (error) throw error;
    setState({ confirmDeleteAVoirId: null, expandedAVoirId: state.expandedAVoirId === id ? null : state.expandedAVoirId });
    await loadData();
    showToast("Retiré de ta liste à voir.");
  } catch (e) {
    console.error(e);
    showToast("Suppression impossible.");
  }
}

export function exportData() {
  const payload = {
    exported_at: new Date().toISOString(),
    mes_dramas_vus: state.mesEntries,
    ma_liste_a_voir: state.aVoir,
    personnes: state.people,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mon-carnet-kdramas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Export téléchargé.");
}

export function surpriseMe() {
  if (state.aVoir.length === 0) return;
  const pick = state.aVoir[Math.floor(Math.random() * state.aVoir.length)];
  showToast(`🎲 Ce soir : ${pick.titre} !`);
  setState({ expandedAVoirId: pick.id });
  // setState() restaure la position de scroll précédente par défaut
  // (voir son commentaire) pour éviter les sauts intempestifs ailleurs
  // dans l'app — mais ici, on VEUT justement amener la personne vers
  // la suggestion, surtout si elle est plus bas dans une longue liste.
  // On scrolle donc explicitement vers la carte juste après.
  const card = document.querySelector(`[data-avoir-card-id="${pick.id}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

export async function markAsWatched(d) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour marquer un drama comme vu."); return; }
  try {
    let dramaId = null;
    // Le titre existe-t-il déjà dans le catalogue commun `dramas` ?
    const normalized = d.titre.trim().toLowerCase();
    const existant = state.entries.find((e) => e.titre.trim().toLowerCase() === normalized);
    if (existant) {
      dramaId = existant.id;
    } else {
      const nouveauDrama = {
        titre: d.titre, titre_kr: d.titre_kr, annee: d.annee,
        scenariste: d.scenariste, realisateur: d.realisateur, acteur: d.acteur, actrice: d.actrice,
        poster_url: d.poster_url,
      };
      const { data: inserted, error: e1 } = await sb.from("dramas").insert([nouveauDrama]).select().single();
      if (e1) throw e1;
      dramaId = inserted.id;
    }

    // Mon visionnage personnel (sans note pour l'instant — à compléter).
    const { error: e2 } = await sb.from("mes_visionnages").upsert({
      user_id: currentUserId(),
      drama_id: dramaId,
    }, { onConflict: "user_id,drama_id" });
    if (e2) throw e2;

    // Retire seulement mon lien personnel à cette envie (le catalogue
    // commun `a_voir` garde la suggestion pour les autres).
    const { error: e3 } = await sb.from("mes_a_voir").delete().eq("user_id", currentUserId()).eq("a_voir_id", d.id);
    if (e3) throw e3;

    await loadData();
    showToast(`${d.titre} déplacé vers Ma liste — pense à lui mettre une note !`);
  } catch (e) {
    console.error(e);
    showToast("Échec du déplacement.");
  }
}

export async function uploadAvatar(file) {
  if (!file) return;
  const userId = currentUserId();
  if (!userId) return;
  setState({ imageProcessing: true });
  try {
    const url = await uploadImage(file, "avatars");
    const { error } = await sb.from("profils").update({ avatar_url: url }).eq("id", userId);
    if (error) throw error;
    await loadProfilCourant();
    if (state.profilPublicId === userId) await openProfilPublic(userId);
    render();
    showToast("Photo de profil mise à jour.");
  } catch (e) {
    console.error(e);
    showToast("Échec de l'upload. Vérifie que le bucket autorise le dossier \"avatars\".");
  } finally {
    setState({ imageProcessing: false });
  }
}

export async function uploadPersonPhoto(file, nom, role) {
  if (!file) return;
  setState({ imageProcessing: true });
  try {
    const url = await uploadImage(file, "personnes");
    // onConflict: "nom,role" — la contrainte unique de "personnes" est
    // désormais (nom, role), pas "nom" seul (migration table
    // drama_personnes), pour permettre qu'une même personne ait
    // plusieurs rôles.
    const { error } = await sb.from("personnes").upsert({ nom, role, photo_url: url }, { onConflict: "nom,role" });
    if (error) throw error;
    const { data } = await sb.from("personnes").select("*");
    state.people = data || [];
    render();
    showToast("Photo ajoutée.");
  } catch (e) {
    console.error(e);
    showToast("Échec de l'upload.");
  } finally {
    setState({ imageProcessing: false });
  }
}

// Enregistre une correction de nom et/ou de rôle sur une fiche
// personne existante (identifiée par son id). Met à jour "personnes",
// puis "drama_personnes" (qui duplique le rôle pour faciliter les
// requêtes), et recharge les données pour que la correction se
// propage immédiatement partout dans l'app (fiche drama, tendances,
// quiz...) — c'est tout l'intérêt d'avoir un id stable plutôt que du
// texte dupliqué.
export async function enregistrerModificationPersonne() {
  const draft = state.editingPersonneDraft;
  if (!draft || !draft.id) return;
  const nom = (draft.nom || "").trim();
  if (!nom) {
    setState({ editingPersonneError: "Le nom ne peut pas être vide." });
    return;
  }
  setState({ imageProcessing: true, editingPersonneError: null });
  try {
    const { error: e1 } = await sb.from("personnes").update({ nom, role: draft.role }).eq("id", draft.id);
    if (e1) {
      // Conflit probable : (nom, role) existe déjà pour une autre
      // personne (contrainte unique). On affiche un message clair
      // plutôt que de laisser planter silencieusement.
      if (String(e1.message || "").toLowerCase().includes("duplicate") || e1.code === "23505") {
        throw new Error(`Une personne nommée "${nom}" existe déjà avec le rôle "${roleLabel(draft.role)}".`);
      }
      throw e1;
    }
    // drama_personnes.role est redondant avec personnes.role (pour
    // simplifier certaines requêtes) : on le resynchronise si le rôle
    // a changé.
    const { error: e2 } = await sb.from("drama_personnes").update({ role: draft.role }).eq("personne_id", draft.id);
    if (e2) throw e2;

    // Recharge les données nécessaires pour que la correction soit
    // visible immédiatement, sans recharger toute la page.
    const { data: people } = await sb.from("personnes").select("*");
    state.people = people || [];
    await chargerDramaPersonnes();
    const { data: dramasFraisData } = await sb.from("dramas").select("*").order("created_at", { ascending: true });
    state.entries = enrichirDramasAvecPersonnes(dramasFraisData || []);
    if (isLoggedIn()) await chargerMesVisionnages();

    setState({
      editingPersonneDraft: null,
      editingPersonneError: null,
      imageProcessing: false,
      personModal: { nom, role: draft.role },
    });
    showToast("Fiche mise à jour.");
  } catch (e) {
    console.error("Erreur modification personne", e);
    setState({ editingPersonneError: e.message || "Échec de la modification.", imageProcessing: false });
  }
}

// ============== FILTER / SORT ==============
export function getFilteredEntries() {
  let list = isLoggedIn() ? state.mesEntries : state.entries;
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((d) => [d.titre, d.titre_kr, d.acteur, d.actrice, d.scenariste, d.realisateur].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)));
  }
  if (state.filterDecade) {
    const decade = Number(state.filterDecade);
    list = list.filter((d) => d.annee && Number(d.annee) >= decade && Number(d.annee) < decade + 10);
  }
  if (state.filterMinNote) {
    const minN = Number(state.filterMinNote);
    list = list.filter((d) => d.note !== null && d.note !== undefined && Number(d.note) >= minN);
  }
  if (state.filterScenariste) {
    list = list.filter((d) => (d.scenariste || "").toLowerCase().includes(state.filterScenariste.toLowerCase()));
  }
  const byNum = (a, b, key, dir) => {
    const av = a[key] === null || a[key] === undefined || a[key] === "" ? -Infinity : Number(a[key]);
    const bv = b[key] === null || b[key] === undefined || b[key] === "" ? -Infinity : Number(b[key]);
    return dir === "asc" ? av - bv : bv - av;
  };
  const sorted = [...list];
  switch (state.sortBy) {
    case "note-desc": sorted.sort((a, b) => byNum(a, b, "note", "desc")); break;
    case "note-asc": sorted.sort((a, b) => byNum(a, b, "note", "asc")); break;
    case "annee-desc": sorted.sort((a, b) => byNum(a, b, "annee", "desc")); break;
    case "annee-asc": sorted.sort((a, b) => byNum(a, b, "annee", "asc")); break;
    case "az": sorted.sort((a, b) => a.titre.localeCompare(b.titre)); break;
  }
  return sorted;
}

export function getAvailableDecades() {
  const source = isLoggedIn() ? state.mesEntries : state.entries;
  const years = source.map((d) => d.annee).filter(Boolean);
  const decades = new Set(years.map((y) => Math.floor(Number(y) / 10) * 10));
  return Array.from(decades).sort((a, b) => b - a);
}

export function getStats() {
  const source = isLoggedIn() ? state.mesEntries : state.entries;
  const rated = source.filter((d) => d.note !== null && d.note !== undefined && d.note !== "");
  const avg = rated.length ? rated.reduce((s, d) => s + Number(d.note), 0) / rated.length : 0;
  const totalMin = source.reduce((s, d) => s + (Number(d.episodes) || 0) * (Number(d.duree) || 0), 0);
  return { count: source.length, avg, totalMin };
}

// ============== RENDER: LIST VIEW ==============
export function renderListView() {
  const filtered = getFilteredEntries();
  const decades = getAvailableDecades();
  const connecte = isLoggedIn();
  let html = `${!connecte ? `<div class="kt-controls" style="padding:14px 16px 0;">
    <div class="tr-insight" style="margin:0; flex:1;">📖 Tu consultes le catalogue commun en lecture seule (notes = moyenne de la communauté). <button class="text-btn" id="goToAuthFromListBtn" style="display:inline; color:var(--seal); font-weight:700; padding:0;">Connecte-toi</button> pour avoir ta propre liste et tes propres notes.</div>
  </div>` : ""}
  <div class="kt-controls">
    <div class="search-box">
      <span>🔍</span>
      <input id="searchInput" placeholder="Chercher un titre, un acteur…" value="${esc(state.query)}">
      ${state.query ? `<button class="clear-q" id="clearSearch">✕</button>` : ""}
    </div>
    <div class="sort-box">
      <select id="sortSelect">
        <option value="note-desc" ${state.sortBy === "note-desc" ? "selected" : ""}>Meilleure note</option>
        <option value="note-asc" ${state.sortBy === "note-asc" ? "selected" : ""}>Moins bonne note</option>
        <option value="annee-desc" ${state.sortBy === "annee-desc" ? "selected" : ""}>Plus récent</option>
        <option value="annee-asc" ${state.sortBy === "annee-asc" ? "selected" : ""}>Plus ancien</option>
        <option value="az" ${state.sortBy === "az" ? "selected" : ""}>A → Z</option>
      </select>
      <span class="sort-chevron">▾</span>
    </div>
    <button class="icon-btn" id="filterToggleBtn" aria-label="Filtres" style="${state.showFilters || state.filterDecade || state.filterMinNote || state.filterScenariste ? `border-color:var(--seal); color:var(--seal);` : ""}">⚙</button>
    <button class="icon-btn" id="viewModeToggleBtn" aria-label="Changer de vue">${state.viewMode === "liste" ? "▦" : "☰"}</button>
  </div>
  ${state.showFilters ? `
  <div class="filters-panel">
    <div class="filter-row">
      <span class="filter-label">Décennie</span>
      <select id="filterDecadeSelect">
        <option value="">Toutes</option>
        ${decades.map((dec) => `<option value="${dec}" ${state.filterDecade === String(dec) ? "selected" : ""}>${dec}s</option>`).join("")}
      </select>
    </div>
    <div class="filter-row">
      <span class="filter-label">Note min.</span>
      <select id="filterNoteSelect">
        <option value="">Toutes</option>
        ${[9, 8, 7, 6, 5].map((n) => `<option value="${n}" ${state.filterMinNote === String(n) ? "selected" : ""}>${n}+</option>`).join("")}
      </select>
    </div>
    <div class="filter-row">
      <span class="filter-label">Scénariste</span>
      <input id="filterScenaristeInput" placeholder="Nom..." value="${esc(state.filterScenariste)}">
    </div>
    ${(state.filterDecade || state.filterMinNote || state.filterScenariste) ? `<button class="text-btn" id="clearFiltersBtn">✕ Réinitialiser les filtres</button>` : ""}
    ${connecte ? `<div style="border-top:1px solid var(--line); margin-top:6px; padding-top:10px;">
      <button class="ghost-btn" id="tmdbImportBtn" style="width:100%;" ${state.tmdbImportEnCours ? "disabled" : ""}>
        ${state.tmdbImportEnCours ? `Import en cours… (${state.tmdbImportProgress}/${state.tmdbImportTotal})` : "📥 Importer des k-dramas populaires depuis TMDB"}
      </button>
    </div>` : ""}
  </div>` : ""}
  <main class="kt-list">`;

  if (filtered.length === 0) {
    html += connecte
      ? `<div class="empty-state"><p>Aucun résultat. Essaie un autre mot, ou ajoute ce drama toi-même.</p></div>`
      : `<div class="empty-state"><p>Aucun résultat dans le catalogue.</p></div>`;
    html += `</main>`;
    return html;
  }

  if (state.viewMode === "grille") {
    html += `</main>` + renderGridContent(filtered);
    return html;
  }

  filtered.forEach((d) => {
    const isOpen = state.expandedId === d.id;
    // Note affichée : la mienne si connecté (déjà dans d.note via mesEntries),
    // sinon la note de référence moyenne du catalogue commun.
    const noteAffichee = connecte ? d.note : getNoteReference(d.id);
    html += `<article class="drama-card ${isOpen ? "is-open" : ""}" data-card-id="${esc(d.id)}">
      <div class="card-row">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="poster-thumb">` : stampHtml(noteAffichee, false)}
        <div class="card-main">
          <h2>${esc(d.titre)}${d.annee ? `<span class="year"> · ${esc(d.annee)}</span>` : ""}</h2>
          ${d.titre_kr ? `<p class="kr">${esc(d.titre_kr)}</p>` : ""}
          <p class="cast" data-stop-propagation="1">${[castingLinksHtml(d.acteur, "acteur"), castingLinksHtml(d.actrice, "actrice")].filter(Boolean).join("  ·  ") || "Casting non renseigné"}</p>
        </div>
        ${d.poster_url ? stampHtml(noteAffichee, true) : ""}
        <span class="chevron ${isOpen ? "rot" : ""}">▾</span>
      </div>
      ${isOpen ? `
      <div class="card-detail" data-stop-propagation="1">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="poster-full">` : ""}
        <dl>
          <div><dt>Scénariste</dt><dd>${castingLinksHtml(d.scenariste, "scenariste") || "—"}</dd></div>
          <div><dt>Réalisateur</dt><dd>${castingLinksHtml(d.realisateur, "realisateur") || "—"}</dd></div>
          <div><dt>Épisodes</dt><dd>${d.episodes ? `${esc(d.episodes)} × ${esc(d.duree ?? "?")} min` : "—"}</dd></div>
          ${connecte && d.date_visionnage ? `<div><dt>Vu le</dt><dd>${esc(formatDateFr(d.date_visionnage))}</dd></div>` : ""}
          ${!connecte ? `<div><dt>Vu par</dt><dd>${getNombreVus(d.id)} personne${getNombreVus(d.id) === 1 ? "" : "s"}</dd></div>` : ""}
        </dl>
        <div class="card-actions">
          ${connecte ? `
            <button class="text-btn" data-edit-id="${esc(d.id)}">✎ Modifier</button>
            <button class="text-btn" data-share-id="${esc(d.id)}">🔗 Partager</button>
            ${state.confirmDeleteId === d.id
              ? `<button class="text-btn danger confirm" data-confirm-delete-id="${esc(d.id)}">✓ Confirmer la suppression</button>`
              : `<button class="text-btn danger" data-ask-delete-id="${esc(d.id)}">🗑 Supprimer</button>`}
          ` : `
            <button class="text-btn" data-goto-auth-card="1" style="color:var(--seal); font-weight:600;">🔑 Connecte-toi pour le noter</button>
          `}
        </div>
      </div>` : ""}
    </article>`;
  });

  html += `</main>`;
  return html;
}

export function renderGridContent(filtered) {
  const connecte = isLoggedIn();
  return `<div class="kt-grid">
    ${filtered.map((d) => `
      <div class="grid-cell" data-grid-id="${esc(d.id)}">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="grid-poster">` : `<div class="grid-poster grid-poster-empty motif-flower">${FLOWER_MOTIF_SVG}</div>`}
        <div class="grid-stamp">${stampHtml(connecte ? d.note : getNoteReference(d.id), true)}</div>
        <p class="grid-title">${esc(d.titre)}</p>
      </div>`).join("")}
  </div>`;
}

export function renderYearDramaList(year, entries) {
  const list = entries || state.mesEntries;
  const dramasOfYear = list.filter((d) => Number(d.annee) === Number(year));
  if (dramasOfYear.length === 0) return "";
  return `<div class="tr-year-list" id="tr-year-list-${esc(year)}">
    <p class="tr-subhead">Titres de ${year}</p>
    ${dramasOfYear.map((d) => `
      <div class="tr-person-row" data-drama-titre="${esc(d.titre)}">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" class="tr-person-avatar">` : `<span class="tr-rank motif-flower" style="width:24px;height:24px;">${FLOWER_MOTIF_SVG}</span>`}
        <div class="tr-person-info">
          <p class="tr-person-name">${esc(d.titre)}</p>
          <p class="tr-person-sub" data-stop-propagation="1">${[castingLinksHtml(d.acteur, "acteur"), castingLinksHtml(d.actrice, "actrice")].filter(Boolean).join(" · ")}</p>
        </div>
        <span class="tr-person-score">${fmtNote(d.note)}</span>
      </div>`).join("")}
  </div>`;
}

// ============== RENDER: TRENDS VIEW ==============
const TRENDS_SECTIONS = [
  { id: "tr-sec-extremes", label: "Les extrêmes" },
  { id: "tr-sec-notation", label: "La notation" },
  { id: "tr-sec-valeurs-sures", label: "Les valeurs sûres" },
  { id: "tr-sec-collab-repetee", label: "Collaboration répétée" },
  { id: "tr-sec-duos", label: "Duos à l'écran" },
  { id: "tr-sec-reguliers", label: "Réguliers vs imprévisibles" },
  { id: "tr-sec-annees", label: "Année par année" },
  { id: "tr-sec-formats", label: "Formats" },
  { id: "tr-sec-rendement", label: "Rendement note / temps" },
  { id: "tr-sec-habitudes", label: "Tes habitudes" },
];

export function renderTrendsNavDrawer() {
  if (!isLoggedIn()) return "";
  const onMainTrends = state.activeTab === "tendances";
  const onProfilTrends = state.activeTab === "profil" && state.profilPublicData && state.profilPublicData.profilSubTab === "tendances";
  if (!onMainTrends && !onProfilTrends) return "";
  const trends = onMainTrends ? computeTrends(state.mesEntries) : state.profilPublicData.trendsDuProfil;
  if (!trends || !trends.records) return "";
  const topRecurring = trends.recurringCollabs[0] || null;
  const sectionsPresentes = TRENDS_SECTIONS.filter((s) => {
    if (s.id === "tr-sec-collab-repetee") return !!topRecurring;
    if (s.id === "tr-sec-duos") return trends.actingDuos.length > 0;
    if (s.id === "tr-sec-habitudes") return !!(trends.viewingStats && trends.viewingStats.busiestMonthName);
    if (s.id === "tr-sec-rendement") return trends.efficiency.length > 0;
    return true;
  });
  return `
    <button class="trends-nav-tab" id="trendsNavTabBtn" aria-label="Ouvrir le sommaire des tendances">
      <span class="motif-flower" style="width:16px;height:16px;display:block;">${FLOWER_MOTIF_SVG}</span>
      <span>›</span>
    </button>
    ${state.trendsNavOpen ? `
    <div class="trends-nav-overlay" id="trendsNavOverlay">
      <nav class="trends-nav-drawer" id="trendsNavDrawer">
        <p class="trends-nav-title">Aller à…</p>
        ${sectionsPresentes.map((s) => `<button class="trends-nav-link" data-trends-nav-target="${s.id}">${esc(s.label)}</button>`).join("")}
      </nav>
    </div>` : ""}
  `;
}

export function attachTrendsNavDrawerListeners() {
  const tabBtn = document.getElementById("trendsNavTabBtn");
  if (tabBtn) tabBtn.addEventListener("click", () => setState({ trendsNavOpen: true }));

  const overlay = document.getElementById("trendsNavOverlay");
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) setState({ trendsNavOpen: false }); });

  document.querySelectorAll("[data-trends-nav-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.trendsNavTarget;
      setState({ trendsNavOpen: false });
      requestAnimationFrame(() => {
        const el = document.getElementById(targetId);
        const header = document.querySelector(".app-header");
        if (!el) return;
        const headerH = header ? header.getBoundingClientRect().height : 0;
        const targetY = el.getBoundingClientRect().top + window.scrollY - headerH - 10;
        window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
      });
    });
  });
}

export function renderTrendsView() {
  if (!isLoggedIn()) {
    return `<div class="trends-wrap"><div class="empty-state">
      <p>Connecte-toi pour voir tes tendances personnelles : tes records, tes valeurs sûres, tes habitudes de visionnage.</p>
      <button class="primary-btn" id="goToAuthFromTrendsBtn" style="margin-top:6px;">Se connecter / S'inscrire</button>
    </div></div>`;
  }
  const trends = computeTrends(state.mesEntries);
  if (!trends || !trends.records) {
    return `<div class="trends-wrap"><div class="empty-state"><p>Note au moins un drama pour voir apparaître tes tendances.</p></div></div>`;
  }
  return `<div class="trends-wrap">${renderTrendsSections(trends, state.mesEntries)}</div>`;
}

// Corps commun des sections de tendances, factorisé pour être utilisé à
// la fois par l'onglet principal "Tendances" (tes propres données,
// state.mesEntries) et par le sous-onglet "Tendances" d'une fiche
// profil (les données du profil consulté, qu'il s'agisse du tien ou de
// celui de quelqu'un d'autre) — voir renderProfilPublicView(). `entries`
// doit correspondre exactement aux entrées ayant servi à calculer
// `trends` via computeTrends(), pour que "Année par année" pointe vers
// les bons titres.
export function renderTrendsSections(trends, entries, profilId) {
  const { records, distribution, coupsDeCoeur, deceptions, avgNote, peopleProfiles, allCollabs, recurringCollabs, yearStats, mostGenerousYear, mostSevereYear, efficiency, formats, totalPeople, actingDuos, tasteProfile, viewingStats } = trends;

  const ranked = peopleProfiles.filter((p) => p.role === state.trendsRole && p.count >= 2 && p.avg_note !== null).sort((a, b) => b.avg_note - a.avg_note).slice(0, 8);
  const topRecurring = recurringCollabs[0] || null;
  const distMax = Math.max(1, ...Object.values(distribution));
  const varianced = peopleProfiles.filter((p) => p.variance !== null);
  const sortedByVar = [...varianced].sort((a, b) => a.variance - b.variance);
  const mostConsistent = sortedByVar.slice(0, 5);
  const mostVariable = sortedByVar.slice(-5).reverse();

  const personRow = (p, tag) => {
    const photo = findPersonPhoto(p.name, p.role);
    const avatarHtml = photo ? `<img src="${esc(photo)}" class="tr-person-avatar">` : `<span class="tr-rank" style="${tag ? `color:${tag === "steady" ? "var(--celadon)" : "var(--seal)"}` : ""}">${tag ? (tag === "steady" ? "◆" : "◇") : ""}</span>`;
    const scoreVal = tag ? p.variance.toFixed(1) : fmtNote(p.avg_note);
    const scoreColor = tag === "steady" ? "var(--celadon)" : tag === "variable" ? "var(--seal)" : "";
    return `<div class="tr-person-row" data-person-name="${esc(p.name)}" data-person-role="${esc(p.role)}">
      ${avatarHtml}
      <div class="tr-person-info">
        <p class="tr-person-name">${esc(p.name)} ${tag ? `<span class="tr-role-tag">(${roleLabel(p.role)})</span>` : ""}</p>
        <p class="tr-person-sub">${esc(p.titles.map((t) => (tag ? fmtNote(t.note) : t.titre)).join(tag ? " · " : ", "))}</p>
      </div>
      <span class="tr-person-score" style="${scoreColor ? `color:${scoreColor}` : ""}">${scoreVal}</span>
    </div>`;
  };

 // Build a one-line personal taste sentence from available signals.
const tasteParts = [];

if (tasteProfile.topActor && tasteProfile.topActor.count >= 3) {
  tasteParts.push(`adore ${tasteProfile.topActor.name}`);
}
if (tasteProfile.topActress && tasteProfile.topActress.count >= 3) {
  tasteParts.push(`suis ${tasteProfile.topActress.name} partout`); 
}
if (tasteProfile.topScenariste) {
  tasteParts.push(`aime la plume de ${tasteProfile.topScenariste.name} (${fmtNote(tasteProfile.topScenariste.avg_note)}/10 en moyenne)`);
}
if (tasteProfile.formatLean) {
  tasteParts.push(`préfères les formats ${tasteProfile.formatLean}`);
}

const tasteSentence = tasteParts.length ? `En quelques mots : ${tasteParts.join(", ")}.` : null;

  let html = `
    ${tasteSentence ? `
    <section class="tr-section">
      <div class="tr-highlight" style="background: linear-gradient(135deg, var(--paper-sunken), var(--seal-soft));">
        <p class="tr-hc-detail" style="font-size:13px;">${tasteSentence}</p>
      </div>
    </section>` : ""}
    <section class="tr-section" id="tr-sec-extremes">
      <h2 class="tr-title">Les extrêmes</h2>
      <div class="tr-records-grid">
        <div class="tr-record" data-drama-titre="${esc(records.best?.titre)}"><p class="tr-rk-label">Mieux noté</p><p class="tr-rk-title">${esc(records.best?.titre)}</p><p class="tr-rk-meta">${fmtNote(records.best?.note)}/10</p></div>
        <div class="tr-record" data-drama-titre="${esc(records.worst?.titre)}"><p class="tr-rk-label">Moins bien noté</p><p class="tr-rk-title">${esc(records.worst?.titre)}</p><p class="tr-rk-meta">${fmtNote(records.worst?.note)}/10</p></div>
        <div class="tr-record" data-drama-titre="${esc(records.oldest?.titre)}"><p class="tr-rk-label">Le plus ancien</p><p class="tr-rk-title">${esc(records.oldest?.titre)}</p><p class="tr-rk-meta">${esc(records.oldest?.annee)}</p></div>
        <div class="tr-record" data-drama-titre="${esc(records.newest?.titre)}"><p class="tr-rk-label">Le plus récent</p><p class="tr-rk-title">${esc(records.newest?.titre)}</p><p class="tr-rk-meta">${esc(records.newest?.annee)}</p></div>
        ${records.longest ? `<div class="tr-record" data-drama-titre="${esc(records.longest.titre)}"><p class="tr-rk-label">Le plus long</p><p class="tr-rk-title">${esc(records.longest.titre)}</p><p class="tr-rk-meta">${esc(records.longest.episodes)} ép.</p></div>` : ""}
        ${records.shortest ? `<div class="tr-record" data-drama-titre="${esc(records.shortest.titre)}"><p class="tr-rk-label">Le plus court</p><p class="tr-rk-title">${esc(records.shortest.titre)}</p><p class="tr-rk-meta">${esc(records.shortest.episodes)} ép.</p></div>` : ""}
      </div>
    </section>

    <section class="tr-section" id="tr-sec-notation">
      <h2 class="tr-title">La notation</h2>
      <div class="tr-card"><div class="tr-dist-chart">
        ${Object.keys(distribution).map((n) => {
          const count = distribution[n];
          const h = count ? Math.max(8, (count / distMax) * 100) : 4;
          return `<div class="tr-dist-col"><span class="tr-dist-num">${count || ""}</span><div class="tr-dist-bar ${Number(n) >= 9 ? "warm" : ""}" style="height:${h}px"></div><span class="tr-dist-lbl">${n}</span></div>`;
        }).join("")}
      </div></div>
      <div class="tr-insight"><b>${coupsDeCoeur} coups de cœur</b> (note ≥ 9) contre <b>${deceptions} déceptions</b> (note ≤ 4). Note moyenne : <b>${fmtNote(avgNote)}/10</b>.</div>
    </section>

    <section class="tr-section" id="tr-sec-valeurs-sures">
      <h2 class="tr-title">Les valeurs sûres</h2>
      <p class="tr-note">Sur ${totalPeople} personnes recensées, triées par note moyenne (minimum 2 titres).</p>
      <div class="tr-role-toggle">
        ${["acteur", "actrice", "scenariste", "realisateur"].map((r) => `<button class="${state.trendsRole === r ? "active" : ""}" data-trends-role="${r}">${roleLabel(r)}s</button>`).join("")}
      </div>
      ${ranked.length === 0 ? `<p class="tr-note">Pas encore 2 titres en commun pour cette catégorie.</p>` : ranked.map((p, i) => {
        const personneId = profilId ? findPersonneId(p.name, p.role) : null;
        const showActions = !!(profilId && personneId);
        const liked = showActions && hasLikedValeurSure(personneId);
        const likeCount = showActions ? getValeurSureLikeCount(personneId) : 0;
        const commentCount = showActions ? getValeurSureCommentCount(personneId) : 0;
        return `<div style="margin-bottom:${showActions ? "9px" : "0"};">
          <div class="tr-person-row" data-person-name="${esc(p.name)}" data-person-role="${esc(p.role)}" style="${showActions ? "margin-bottom:0; border-radius:12px 12px 0 0;" : ""}">
            ${findPersonPhoto(p.name, p.role) ? `<img src="${esc(findPersonPhoto(p.name, p.role))}" class="tr-person-avatar">` : `<span class="tr-rank">${i + 1}</span>`}
            <div class="tr-person-info"><p class="tr-person-name">${esc(p.name)}</p><p class="tr-person-sub">${esc(p.titles.map((t) => t.titre).join(", "))}</p></div>
            <span class="tr-person-score">${fmtNote(p.avg_note)}</span>
          </div>
          ${showActions ? `<div class="card-actions" style="background:var(--paper-raised); border:1px solid var(--line); border-top:none; border-radius:0 0 12px 12px; padding:8px 14px; margin-top:-1px;">
            <button class="text-btn" data-toggle-like-valeur-sure="${esc(personneId)}" data-owner-id="${esc(profilId)}" data-titre="${esc(p.name)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
            <button class="text-btn" data-open-comments-valeur-sure="${esc(personneId)}" data-owner-id="${esc(profilId)}" data-titre="${esc(p.name)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
          </div>` : ""}
        </div>`;
      }).join("")}
    </section>

    ${topRecurring ? `
    <section class="tr-section" id="tr-sec-collab-repetee">
      <h2 class="tr-title">La seule collaboration qui s'est répétée</h2>
      <div class="tr-highlight">
        <p class="tr-hc-names">${personLinkHtml(topRecurring.p1, topRecurring.role1)} <span>(${roleLabel(topRecurring.role1)})</span> + ${personLinkHtml(topRecurring.p2, topRecurring.role2)} <span>(${roleLabel(topRecurring.role2)})</span></p>
        <p class="tr-hc-detail">${esc(topRecurring.titles.map((t) => `${t.titre} — ${fmtNote(t.note)}/10`).join(" · "))}<br><br>
        Sur ${allCollabs.length} paires recensées, c'est la seule à s'être reformée — la note dépend surtout du titre, pas du tandem.</p>
      </div>
    </section>` : ""}

    ${actingDuos.length > 0 ? `
    <section class="tr-section" id="tr-sec-duos">
      <h2 class="tr-title">Duos à l'écran</h2>
      <p class="tr-note">Paires acteur-actrice, classées par nombre de titres ensemble.</p>
      ${actingDuos.slice(0, 5).map((c, i) => {
        const photo1 = findPersonPhoto(c.p1, c.role1);
        const photo2 = findPersonPhoto(c.p2, c.role2);
        return `
        <div class="tr-person-row" style="cursor:default;">
          <div class="tr-duo-avatars">
            ${photo1 ? `<img src="${esc(photo1)}" class="tr-person-avatar">` : `<span class="tr-person-avatar tr-avatar-placeholder"></span>`}
            ${photo2 ? `<img src="${esc(photo2)}" class="tr-person-avatar">` : `<span class="tr-person-avatar tr-avatar-placeholder"></span>`}
          </div>
          <div class="tr-person-info">
            <p class="tr-person-name">${personLinkHtml(c.p1, c.role1)} + ${personLinkHtml(c.p2, c.role2)}</p>
            <p class="tr-person-sub">${esc(c.titles.map((t) => t.titre).join(", "))}</p>
          </div>
          <span class="tr-person-score">${fmtNote(c.avg_note)}</span>
        </div>`;
      }).join("")}
    </section>` : ""}

    <section class="tr-section" id="tr-sec-reguliers">
      <h2 class="tr-title">Réguliers vs imprévisibles</h2>
      <p class="tr-note">Écart entre le meilleur et le pire titre d'une même personne (min. 2 titres).</p>
      ${mostConsistent.length > 0 ? `<p class="tr-subhead">Les plus réguliers</p>${mostConsistent.map((p) => personRow(p, "steady")).join("")}` : ""}
      ${mostVariable.length > 0 ? `<p class="tr-subhead">Les plus imprévisibles</p>${mostVariable.map((p) => personRow(p, "variable")).join("")}` : ""}
    </section>

    <section class="tr-section" id="tr-sec-annees">
      <h2 class="tr-title">Année par année</h2>
      <p class="tr-note">Touche une année pour voir les titres correspondants.</p>
      <div class="tr-card"><div class="tr-year-chart">
        ${yearStats.map((y) => {
          // La hauteur reflète la note moyenne (sur 10), cohérente avec
          // le chiffre affiché au-dessus de la barre — avant cette
          // correction, la hauteur dépendait du nombre de titres vus,
          // ce qui ne correspondait pas du tout à la note affichée et
          // rendait le graphique trompeur.
          const h = y.avg_note !== null ? Math.max(16, (y.avg_note / 10) * 100) : 16;
          const isSelected = state.selectedYear === y.annee;
          return `<div class="tr-year-col ${isSelected ? "selected" : ""}" data-year="${y.annee}"><span class="tr-year-note">${y.avg_note !== null ? fmtNote(y.avg_note) : "—"}</span><div class="tr-year-bar" style="height:${h}px"></div><span class="tr-year-lbl">${y.annee}</span></div>`;
        }).join("")}
      </div></div>
      ${mostGenerousYear && mostSevereYear ? `<div class="tr-insight">Année la mieux notée : <b>${mostGenerousYear.annee}</b> (${fmtNote(mostGenerousYear.avg_note)}/10, ${mostGenerousYear.count} titre${mostGenerousYear.count > 1 ? "s" : ""}). Année la moins bien notée : <b>${mostSevereYear.annee}</b> (${fmtNote(mostSevereYear.avg_note)}/10${mostSevereYear.count === 1 ? " — un seul titre, donc peu représentatif" : `, ${mostSevereYear.count} titres`}).</div>` : ""}
      ${state.selectedYear ? renderYearDramaList(state.selectedYear, entries) : ""}
    </section>

    <section class="tr-section" id="tr-sec-formats">
      <h2 class="tr-title">Formats</h2>
      <div class="tr-records-grid" style="grid-template-columns:1fr 1fr">
        <div class="tr-record"><p class="tr-rk-label">Courts (≤12 ép.)</p><p class="tr-rk-title">${fmtNote(formats.short.avg)}/10</p><p class="tr-rk-meta">sur ${formats.short.count} titres</p></div>
        <div class="tr-record"><p class="tr-rk-label">Longs (&gt;12 ép.)</p><p class="tr-rk-title">${fmtNote(formats.long.avg)}/10</p><p class="tr-rk-meta">sur ${formats.long.count} titres</p></div>
      </div>
    </section>

    ${efficiency.length > 0 ? `
    <section class="tr-section" id="tr-sec-rendement">
      <h2 class="tr-title">Rendement note / temps</h2>
      <p class="tr-note">(note ÷ durée totale en minutes) × 1000. Séries uniquement (les films, à durée unique, ne sont pas comparables sur ce ratio).</p>
      ${efficiency.slice(0, 8).map((e, i) => `
        <div class="tr-eff-row" data-drama-titre="${esc(e.titre)}">
          ${e.poster_url ? `<img src="${esc(e.poster_url)}" class="tr-poster-thumb">` : `<span class="tr-rank">${i + 1}</span>`}
          <div class="tr-person-info"><p class="tr-person-name">${esc(e.titre)}</p><p class="tr-person-sub">${fmtNote(e.note)}/10 · ${e.total_min} min</p></div>
          <span class="tr-eff-score">${e.score.toFixed(1)}</span>
        </div>`).join("")}
    </section>` : ""}

    ${viewingStats && viewingStats.busiestMonthName ? `
    <section class="tr-section" id="tr-sec-habitudes">
      <h2 class="tr-title">Tes habitudes</h2>
      <div class="tr-insight">Sur ${viewingStats.totalWithDate} titres avec une date de visionnage renseignée, c'est en <b>${viewingStats.busiestMonthName}</b> que tu regardes le plus de dramas (${viewingStats.busiestMonthCount} titre${viewingStats.busiestMonthCount > 1 ? "s" : ""}).</div>
    </section>` : ""}
  `;

  return html;
}
// ============== RENDER: A VOIR (WISHLIST) VIEW ==============
export function renderAVoirView() {
  const connecte = isLoggedIn();
  const liste = connecte ? state.aVoir : state.aVoirCatalogue;

  let html = `<main class="kt-list">`;
  html += connecte
    ? `<p class="tr-note" style="padding:0 16px 4px;">Les dramas que tu veux regarder. Marque-les comme vus une fois terminés pour leur donner une note dans Ma liste.</p>`
    : `<div style="padding:0 16px 4px;"><div class="tr-insight" style="margin:0;">📖 Catalogue commun de suggestions. <button class="text-btn" id="goToAuthFromAVoirBtn" style="display:inline; color:var(--seal); font-weight:700; padding:0;">Connecte-toi</button> pour construire ta propre liste à voir.</div></div>`;

  if (connecte && liste.length > 0) {
    html += `<div style="padding:0 16px 10px;"><button class="primary-btn" id="surpriseMeBtn" style="width:100%;">🎲 Surprends-moi</button></div>`;
  }

  if (liste.length === 0) {
    html += `<div class="empty-state"><p>${connecte ? "Ta liste à voir est vide pour l'instant." : "Aucune suggestion dans le catalogue pour l'instant."}</p></div>`;
  }

  liste.forEach((d) => {
    const isOpen = state.expandedAVoirId === d.id;
    html += `<article class="drama-card ${isOpen ? "is-open" : ""}" data-avoir-card-id="${esc(d.id)}">
      <div class="card-row">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="poster-thumb">` : `<div class="stamp empty motif-flower">${FLOWER_MOTIF_SVG}</div>`}
        <div class="card-main">
          <h2>${esc(d.titre)}${d.annee ? `<span class="year"> · ${esc(d.annee)}</span>` : ""}</h2>
          ${d.titre_kr ? `<p class="kr">${esc(d.titre_kr)}</p>` : ""}
          <p class="cast" data-stop-propagation="1">${[castingLinksHtml(d.acteur, "acteur"), castingLinksHtml(d.actrice, "actrice")].filter(Boolean).join("  ·  ") || "Casting non renseigné"}</p>
        </div>
        <span class="chevron ${isOpen ? "rot" : ""}">▾</span>
      </div>
      ${isOpen ? `
      <div class="card-detail" data-stop-propagation="1">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="poster-full">` : ""}
        ${d.resume ? `<p style="font-size:12.5px; color:var(--ink-soft); line-height:1.5; margin:0 0 12px;">${esc(d.resume)}</p>` : ""}
        <dl>
          <div><dt>Scénariste</dt><dd>${castingLinksHtml(d.scenariste, "scenariste") || "—"}</dd></div>
          <div><dt>Réalisateur</dt><dd>${castingLinksHtml(d.realisateur, "realisateur") || "—"}</dd></div>
        </dl>
        <div class="card-actions">
          ${connecte ? `
            <button class="text-btn" data-watched-id="${esc(d.id)}" style="color:var(--celadon); font-weight:600;">✓ Marquer comme vu</button>
            <button class="text-btn" data-edit-avoir-id="${esc(d.id)}">✎ Modifier</button>
            ${state.confirmDeleteAVoirId === d.id
              ? `<button class="text-btn danger confirm" data-confirm-delete-avoir-id="${esc(d.id)}">✓ Confirmer</button>`
              : `<button class="text-btn danger" data-ask-delete-avoir-id="${esc(d.id)}">🗑</button>`}
          ` : `
            <button class="text-btn" data-goto-auth-avoir="1" style="color:var(--seal); font-weight:600;">🔑 Connecte-toi pour l'ajouter à ta liste</button>
          `}
        </div>
      </div>` : ""}
    </article>`;
  });

  html += `</main>`;
  return html;
}

export function renderAVoirFormSheet() {
  if (!state.showAVoirForm) return "";
  const d = state.aVoirDraft;
  return `<div class="sheet-overlay" id="avoirFormOverlay">
    <div class="sheet" id="avoirFormSheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>${state.editingAVoirId ? "Modifier" : "Ajouter à la liste à voir"}</h3>
        <button class="icon-btn" id="avoirFormClose">✕</button>
      </div>
      <div class="sheet-body">
        <label>Titre *<input id="av-titre" value="${esc(d.titre)}" placeholder="ex. Twenty-Five Twenty-One" autofocus></label>
        <button type="button" class="text-btn" id="tmdbSearchAVoirBtn" style="color:var(--seal); font-weight:600;">🔎 Chercher le casting sur TMDB</button>
        ${renderTmdbSearchResults("avoir")}
        <label>Titre coréen<input id="av-titre_kr" value="${esc(d.titre_kr)}"></label>
        <div class="field-label-wrap">
          <span class="field-label">Affiche</span>
          <div class="poster-upload">
            ${d.poster_url
              ? `<div class="poster-preview"><img src="${esc(d.poster_url)}"><button type="button" class="poster-remove" id="avoirPosterRemove">✕</button></div>`
              : `<label class="poster-dropzone">📷<span>${state.imageProcessing ? "Traitement…" : "Choisir une photo"}</span><input type="file" accept="image/*" style="display:none" id="avoirPosterInput"></label>`}
          </div>
          ${!d.poster_url ? `<button type="button" class="text-btn" id="searchAVoirPosterBtn" style="margin-top:4px;">🔍 Chercher l'affiche en ligne</button>` : ""}
        </div>
        <label>Année<input id="av-annee" type="number" inputmode="numeric" value="${esc(d.annee)}"></label>
        <label>Acteur principal<input id="av-acteur" value="${esc(d.acteur)}"></label>
        <label>Actrice principale<input id="av-actrice" value="${esc(d.actrice)}"></label>
        <label>Scénariste<input id="av-scenariste" value="${esc(d.scenariste)}"></label>
        <label>Réalisateur<input id="av-realisateur" value="${esc(d.realisateur)}"></label>
        <label>Résumé<input id="av-resume" value="${esc(d.resume)}"></label>
      </div>
      <div class="sheet-footer">
        <button class="ghost-btn" id="avoirFormCancel">Annuler</button>
        <button class="primary-btn" id="avoirFormSave">${state.editingAVoirId ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </div>
  </div>`;
}

// ============== RENDER: FORM SHEET ==============
export function renderFormSheet() {
  if (!state.showForm) return "";
  const d = state.draft;
  return `<div class="sheet-overlay" id="formOverlay">
    <div class="sheet" id="formSheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>${state.editingId ? "Modifier le drama" : "Nouveau drama"}</h3>
        <button class="icon-btn" id="formClose">✕</button>
      </div>
      <div class="sheet-body">
        <label>Titre *<input id="f-titre" value="${esc(d.titre)}" placeholder="ex. Hospital Playlist" autofocus></label>
        <button type="button" class="text-btn" id="tmdbSearchBtn" style="color:var(--seal); font-weight:600;">🔎 Chercher le casting sur TMDB</button>
        ${renderTmdbSearchResults("drama")}
        <label>Titre coréen<input id="f-titre_kr" value="${esc(d.titre_kr)}" placeholder="슬기로운 의사생활"></label>
        <div class="field-label-wrap">
          <span class="field-label">Affiche</span>
          <div class="poster-upload">
            ${d.poster_url
              ? `<div class="poster-preview"><img src="${esc(d.poster_url)}"><button type="button" class="poster-remove" id="posterRemove">✕</button></div>`
              : `<label class="poster-dropzone">📷<span>${state.imageProcessing ? "Traitement…" : "Choisir une photo"}</span><input type="file" accept="image/*" style="display:none" id="posterInput"></label>`}
          </div>
          ${!d.poster_url ? `<button type="button" class="text-btn" id="searchPosterBtn" style="margin-top:4px;">🔍 Chercher l'affiche en ligne</button>` : ""}
        </div>
        <div class="field-pair">
          <label>Année<input id="f-annee" type="number" inputmode="numeric" value="${esc(d.annee)}" placeholder="2024"></label>
          <label>Note /10<input id="f-note" type="number" inputmode="decimal" step="0.5" min="0" max="10" value="${esc(d.note)}" placeholder="8 ou 8.5"></label>
        </div>
        <label>Vu le<input id="f-date_visionnage" type="date" value="${esc(d.date_visionnage)}"></label>
        ${renderCastingSelector("acteur", "Acteur principal")}
        ${renderCastingSelector("actrice", "Actrice principale")}
        ${renderCastingSelector("scenariste", "Scénariste")}
        ${renderCastingSelector("realisateur", "Réalisateur")}
        <div class="field-pair">
          <label>Épisodes<input id="f-episodes" type="number" inputmode="numeric" value="${esc(d.episodes)}" placeholder="16"></label>
          <label>Durée moy. (min)<input id="f-duree" type="number" inputmode="numeric" value="${esc(d.duree)}" placeholder="70"></label>
        </div>
      </div>
      <div class="sheet-footer">
        <button class="ghost-btn" id="formCancel">Annuler</button>
        <button class="primary-btn" id="formSave">${state.editingId ? "Enregistrer" : "Ajouter à ma liste"}</button>
      </div>
    </div>
  </div>`;
}

// ============== RENDER: PERSON MODAL ==============
export function renderPersonModal() {
  if (!state.personModal) return "";
  const { nom, role } = state.personModal;
  const trends = computeTrends(entriesPourFichesPersonnes());
  const profile = findProfile(trends, nom, role);
  if (!profile) return "";
  const collabs = findCollabsFor(trends, nom, role);
  const badge = reliabilityBadge(profile.count);
  const photo = findPersonPhoto(nom, role);
  const personneId = findPersonneId(profile.name, profile.role);
  const peutModifier = isLoggedIn() && personneId;
  const enEdition = peutModifier && state.editingPersonneDraft && state.editingPersonneDraft.id === personneId;

  return `<div class="modal-overlay" id="personModalOverlay">
    <div class="modal-sheet" id="personModalSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        ${state.modalStack.length > 0 ? `<button class="icon-btn" id="personModalBack" aria-label="Retour">←</button>` : ""}
        ${photo ? `<img src="${esc(photo)}" class="modal-avatar">` : ""}
        <div style="flex:1;">
          <h3>${esc(profile.name)}</h3>
          <p class="modal-role">${roleLabel(profile.role)}</p>
        </div>
        ${peutModifier ? `<button class="icon-btn" id="personModalEdit" aria-label="Modifier">✎</button>` : ""}
        <button class="icon-btn" id="personModalClose">✕</button>
      </div>
      <div class="modal-body">
        ${enEdition ? `
        <div class="field-label-wrap" style="margin-bottom:4px;">
          <span class="field-label">Nom</span>
          <input id="editingPersonneNom" value="${esc(state.editingPersonneDraft.nom)}" placeholder="Nom complet">
        </div>
        <div class="field-label-wrap">
          <span class="field-label">Rôle</span>
          <div class="tr-role-toggle">
            ${["acteur", "actrice", "scenariste", "realisateur"].map((r) => `<button data-editing-personne-role="${r}" class="${state.editingPersonneDraft.role === r ? "active" : ""}">${roleLabel(r)}</button>`).join("")}
          </div>
        </div>
        ${state.editingPersonneError ? `<p style="color:var(--seal); font-size:12.5px; margin-top:8px;">${esc(state.editingPersonneError)}</p>` : ""}
        <p class="tr-note" style="margin-top:6px;">La correction du nom et/ou du rôle s'appliquera automatiquement à tous les dramas liés à cette personne.</p>
        <div class="sheet-footer" style="padding:14px 0 0; border-top:none;">
          <button class="ghost-btn" id="personModalEditCancel">Annuler</button>
          <button class="primary-btn" id="personModalEditSave">${state.imageProcessing ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
        ` : `
        <div class="modal-stat-row">
          <div class="modal-stat"><span class="v">${profile.count}</span><span class="l">Titres</span></div>
          <div class="modal-stat"><span class="v">${fmtNote(profile.avg_note)}</span><span class="l">Note moy.</span></div>
          <div class="modal-stat"><span class="v">${profile.variance !== null ? profile.variance.toFixed(1) : "—"}</span><span class="l">Écart-type</span></div>
        </div>
        <span class="badge ${badge.cls}">${badge.label}</span>

        <div class="field-label-wrap modal-photo-upload">
          <span class="field-label">Photo de cette personne</span>
          <div class="poster-upload">
            ${photo
              ? `<div class="poster-preview"><img src="${esc(photo)}"></div>`
              : `<label class="poster-dropzone">📷<span>${state.imageProcessing ? "Traitement…" : "Ajouter une photo"}</span><input type="file" accept="image/*" style="display:none" id="personPhotoInput"></label>`}
          </div>
          ${!photo ? `<button type="button" class="text-btn" id="searchPersonPhotoBtn" data-search-name="${esc(profile.name)}" style="margin-top:4px;">🔍 Chercher une photo en ligne</button>` : ""}
        </div>

        <p class="modal-section-h">Ses titres</p>
        ${profile.titles.map((t) => `<div class="modal-title-row" data-drama-titre="${esc(t.titre)}" style="cursor:pointer;"><span>${esc(t.titre)} ${t.annee ? `<span class="modal-year">(${esc(t.annee)})</span>` : ""}</span><span class="modal-note">${fmtNote(t.note)}</span></div>`).join("")}
        <p class="modal-section-h">A travaillé avec (${collabs.length})</p>
        ${collabs.length === 0 ? `<p class="tr-note">Aucune collaboration recensée.</p>` : collabs.map((c) => {
          const other = c.p1 === profile.name && c.role1 === profile.role ? { name: c.p2, role: c.role2 } : { name: c.p1, role: c.role1 };
          return `<div class="modal-collab-row" data-person-name="${esc(other.name)}" data-person-role="${esc(other.role)}"><span>${esc(other.name)} <span class="modal-year">(${roleLabel(other.role)})</span></span><span class="modal-note">${fmtNote(c.avg_note)}</span></div>`;
        }).join("")}
        `}
      </div>
    </div>
  </div>`;
}

// ---- modale drama (accessible depuis la vue Tendances) ----
export function renderDramaModal() {
  if (!state.dramaModal) return "";
  const d = state.entries.find((e) => e.titre === state.dramaModal);
  if (!d) return "";
  const peutModifier = isLoggedIn();

  return `<div class="modal-overlay" id="dramaModalOverlay">
    <div class="modal-sheet" id="dramaModalSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        ${state.modalStack.length > 0 ? `<button class="icon-btn" id="dramaModalBack" aria-label="Retour">←</button>` : ""}
        <div style="flex:1;">
          <h3>${esc(d.titre)}</h3>
          ${d.titre_kr ? `<p class="modal-role kr" style="color:var(--pink-deep); font-family:'Noto Sans KR',sans-serif;">${esc(d.titre_kr)}</p>` : ""}
        </div>
        ${peutModifier ? `<button class="icon-btn" id="dramaModalEdit" aria-label="Modifier">✎</button>` : ""}
        <button class="icon-btn" id="dramaModalClose">✕</button>
      </div>
      <div class="modal-body">
        ${d.poster_url ? `<img src="${esc(d.poster_url)}" alt="" class="poster-full">` : ""}
        <div class="modal-stat-row">
          <div class="modal-stat"><span class="v">${fmtNote(d.note)}</span><span class="l">Note</span></div>
          <div class="modal-stat"><span class="v">${esc(d.annee || "—")}</span><span class="l">Année</span></div>
          <div class="modal-stat"><span class="v">${d.episodes ? esc(d.episodes) : "—"}</span><span class="l">Épisodes</span></div>
        </div>
        <p class="modal-section-h">Casting & équipe</p>
        <div class="modal-title-row"><span>Acteur principal</span><span class="modal-note" style="color:var(--ink); font-family:'Inter',sans-serif; font-weight:600;">${castingLinksHtml(d.acteur, "acteur") || "—"}</span></div>
        <div class="modal-title-row"><span>Actrice principale</span><span class="modal-note" style="color:var(--ink); font-family:'Inter',sans-serif; font-weight:600;">${castingLinksHtml(d.actrice, "actrice") || "—"}</span></div>
        <div class="modal-title-row"><span>Scénariste</span><span class="modal-note" style="color:var(--ink); font-family:'Inter',sans-serif; font-weight:600;">${castingLinksHtml(d.scenariste, "scenariste") || "—"}</span></div>
        <div class="modal-title-row"><span>Réalisateur</span><span class="modal-note" style="color:var(--ink); font-family:'Inter',sans-serif; font-weight:600;">${castingLinksHtml(d.realisateur, "realisateur") || "—"}</span></div>
        ${d.episodes && d.duree ? `<div class="modal-title-row"><span>Format</span><span class="modal-note" style="color:var(--ink); font-family:'Inter',sans-serif; font-weight:600;">${esc(d.episodes)} × ${esc(d.duree)} min</span></div>` : ""}
        ${isLoggedIn() ? `<button class="ghost-btn" id="dramaModalSuggererBtn" style="width:100%; margin-top:14px;" data-suggerer-titre="${esc(d.titre)}">🎁 Suggérer à...</button>` : ""}
        ${peutModifier ? `<button class="ghost-btn" id="dramaModalEditBtn" style="width:100%; margin-top:8px;">✎ Modifier ce drama</button>` : ""}
      </div>
    </div>
  </div>`;
}
