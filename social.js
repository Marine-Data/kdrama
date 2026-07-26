// ============================================================
// MODULE COMMUNAUTÉ — extrait de index.html (Kdramatrics)
// Avis publics + likes, abonnements, fil d'activité, profil public,
// recherche de profil.
// Dépend de main.js, quiz.js, ost.js, tierlist.js pour l'état global
// et les fonctions partagées ; catalogue.js et trends.js pour
// quelques actions croisées (marquer vu, tendances).
// ============================================================

import { state, setState, esc, showToast, sb, isLoggedIn, currentUserId, render, avecBoutonDesactive, formatDateFr, castingLinksHtml, computeTrends, enrichirDramasAvecPersonnes, fmtNote, chargerMesAVoir, FLOWER_MOTIF_SVG } from './main.js';
import { stampHtml } from './catalogue.js';
import { finishQuiz, loadLeaderboardQuiz } from './quiz.js';
import { loadOstLeaderboard } from './ost.js';
import { getTierlistLikeCount } from './tierlist.js';
import { markAsWatched, uploadAvatar, renderTrendsSections } from './catalogue.js';

export function renderRechercheProfilResultats() {
  if (state.rechercheProfilLoading) return `<p class="tr-note">Recherche…</p>`;
  const q = state.rechercheProfilQuery.trim();
  if (q.length < 2) return `<p class="tr-note">Tape au moins 2 lettres du pseudo.</p>`;
  const resultats = state.rechercheProfilResultats || [];
  if (resultats.length === 0) return `<p class="tr-note">Aucun profil trouvé pour "${esc(q)}".</p>`;
  return resultats.map((p) => `
    <div class="tr-person-row" data-open-profil-recherche="${esc(p.id)}">
      ${p.avatar_url ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar">` : `<span class="tr-rank motif-flower" style="width:24px;height:24px;">${FLOWER_MOTIF_SVG}</span>`}
      <div class="tr-person-info"><p class="tr-person-name">${esc(p.pseudo)}</p></div>
      <span class="text-btn" style="color:var(--blue-deep);">Voir le profil</span>
    </div>`).join("");
}
export function renderRechercheProfilModal() {
  if (!state.rechercheProfilOpen) return "";
  return `<div class="modal-overlay" id="rechercheProfilOverlay">
    <div class="modal-sheet" id="rechercheProfilSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Chercher un profil</h3></div>
        <button class="icon-btn" id="rechercheProfilClose">✕</button>
      </div>
      <div class="modal-body">
        <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500;">
          Pseudo
          <input id="rechercheProfilInput" value="${esc(state.rechercheProfilQuery)}" placeholder="ex. dramaqueen92" autofocus>
        </label>
        <div id="rechercheProfilResultats" style="margin-top:10px;">${renderRechercheProfilResultats()}</div>
      </div>
    </div>
  </div>`;
}
/* ============================================================
   MODULE COMMUNAUTÉ
   Avis publics + likes, abonnements, fil d'activité, profil public.
   ============================================================ */

// ---- état additionnel ----
// ---- chargement ----
export async function loadCommunaute() {
  try {
    const { data, error } = await sb
      .from("avis")
      .select("*, profils(pseudo, avatar_url), dramas(titre, titre_kr, poster_url, annee)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    state.avis = data || [];
  } catch (e) {
    console.error("Erreur chargement avis", e);
    state.avis = [];
  }

  // Activités "veut voir" : alimentent le fil au même titre que les
  // avis (cf. demande : "X veut voir Y" doit apparaître dans le fil),
  // mais restent une source de données distincte de `avis` — pas de
  // like/suppression depuis le fil pour ces cartes, l'envie se gère
  // depuis l'onglet À voir comme avant.
  try {
    const { data, error } = await sb
      .from("mes_a_voir")
      .select("*, profils(pseudo, avatar_url), a_voir(titre, titre_kr, poster_url, annee)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    state.activitesAVoir = data || [];
  } catch (e) {
    console.error("Erreur chargement activités à voir", e);
    state.activitesAVoir = [];
  }

  try {
    const { data, error } = await sb.from("abonnements").select("*");
    if (error) throw error;
    state.abonnements = data || [];
  } catch (e) {
    console.error("Erreur chargement abonnements", e);
    state.abonnements = [];
  }

  // Compte des likes par avis (requête groupée légère : on charge tout
  // et on compte côté client, le volume restant modeste pour cet usage).
  try {
    const { data, error } = await sb.from("avis_likes").select("avis_id, user_id");
    if (error) throw error;
    state.avisLikes = data || [];
  } catch (e) {
    state.avisLikes = [];
  }

  // Compte des likes par cadeau
  try {
    const { data, error } = await sb.from("cadeau_likes").select("cadeau_id, user_id");
    if (error) throw error;
    state.cadeauxLikes = data || [];
  } catch (e) {
    state.cadeauxLikes = [];
  }

  // Compte des commentaires par cadeau
  try {
    const { data, error } = await sb.from("cadeau_comments").select("cadeau_id");
    if (error) throw error;
    state.cadeauxComments = data || [];
  } catch (e) {
    state.cadeauxComments = [];
  }

  // Les 20 derniers inscrits, pour la carte "X a rejoint le carnet"
  // dans le fil — sans ça, un compte tout juste créé est invisible
  // (aucune activité encore) et impossible à trouver pour s'abonner.
  try {
    const { data, error } = await sb
      .from("profils")
      .select("id, pseudo, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    state.nouveauxInscrits = data || [];
  } catch (e) {
    console.error("Erreur chargement nouveaux inscrits", e);
    state.nouveauxInscrits = [];
  }

  // Cadeaux gagnés récemment par tout le monde (pas seulement les
  // miens), pour la carte "X a gagné [acteur]" dans le fil. Jointure
  // vers "profils" impossible ici (collection_acteurs.user_id
  // référence auth.users, pas profils directement — même limite que
  // pour suggestions_a_voir), donc on fusionne à la main avec les
  // profils déjà récupérés au-dessus si possible, sinon une requête
  // dédiée.
  try {
    const { data, error } = await sb
      .from("collection_acteurs")
      .select("*, personnes(id, nom, role, photo_url)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const gains = (data || []).filter((c) => c.personnes);
    const userIds = [...new Set(gains.map((c) => c.user_id))];
    let profilsParId = {};
    if (userIds.length > 0) {
      const { data: profils, error: e2 } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", userIds);
      if (e2) throw e2;
      (profils || []).forEach((p) => { profilsParId[p.id] = p; });
    }
    state.activitesCadeaux = gains.map((c) => ({ ...c, profil_gagnant: profilsParId[c.user_id] || null }));
  } catch (e) {
    console.error("Erreur chargement activités cadeaux", e);
    state.activitesCadeaux = [];
  }
}

export function getLikeCount(avisId) {
  return (state.avisLikes || []).filter((l) => l.avis_id === avisId).length;
}
export function hasLiked(avisId) {
  const uid = currentUserId();
  if (!uid) return false;
  return (state.avisLikes || []).some((l) => l.avis_id === avisId && l.user_id === uid);
}

// ---- Likes pour les cadeaux ----
export function getLikeCadeauCount(cadeauId) {
  return (state.cadeauxLikes || []).filter((l) => l.cadeau_id === cadeauId).length;
}
export function hasLikedCadeau(cadeauId) {
  const uid = currentUserId();
  if (!uid) return false;
  return (state.cadeauxLikes || []).some((l) => l.cadeau_id === cadeauId && l.user_id === uid);
}
export function getCadeauCommentCount(cadeauId) {
  return (state.cadeauxComments || []).filter((c) => c.cadeau_id === cadeauId).length;
}

// ---- Likes/commentaires sur les "vus" et "à voir" d'un profil ----
// Scopés à state.profilPublicData (chargés par openProfilPublic), pas
// globaux : on ne les affiche que sur la fiche profil consultée.
export function hasLikedVisionnage(visionnageId) {
  const uid = currentUserId();
  if (!uid || !state.profilPublicData) return false;
  return (state.profilPublicData.likesVisionnageDuProfil || []).some((l) => l.visionnage_id === visionnageId && l.user_id === uid);
}
export function getVisionnageLikeCount(visionnageId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.likesVisionnageDuProfil || []).filter((l) => l.visionnage_id === visionnageId).length;
}
export function getVisionnageCommentCount(visionnageId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.commentsVisionnageDuProfil || []).filter((c) => c.visionnage_id === visionnageId).length;
}
export function hasLikedAVoir(mesAVoirId) {
  const uid = currentUserId();
  if (!uid || !state.profilPublicData) return false;
  return (state.profilPublicData.likesAVoirDuProfil || []).some((l) => l.mes_a_voir_id === mesAVoirId && l.user_id === uid);
}
export function getAVoirLikeCount(mesAVoirId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.likesAVoirDuProfil || []).filter((l) => l.mes_a_voir_id === mesAVoirId).length;
}
export function getAVoirCommentCount(mesAVoirId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.commentsAVoirDuProfil || []).filter((c) => c.mes_a_voir_id === mesAVoirId).length;
}

export async function toggleLikeVisionnage(visionnageId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer."); return; }
  const uid = currentUserId();
  const d = state.profilPublicData;
  if (!d) return;
  try {
    if (hasLikedVisionnage(visionnageId)) {
      const { error } = await sb.from("mes_visionnages_likes").delete().eq("visionnage_id", visionnageId).eq("user_id", uid);
      if (error) throw error;
      d.likesVisionnageDuProfil = (d.likesVisionnageDuProfil || []).filter((l) => !(l.visionnage_id === visionnageId && l.user_id === uid));
    } else {
      const { error } = await sb.from("mes_visionnages_likes").insert([{ visionnage_id: visionnageId, user_id: uid }]);
      if (error) throw error;
      d.likesVisionnageDuProfil = [...(d.likesVisionnageDuProfil || []), { visionnage_id: visionnageId, user_id: uid }];
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: "visionnage", target_id: visionnageId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like visionnage", errNotif);
      }
    }
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

export async function toggleLikeAVoir(mesAVoirId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer."); return; }
  const uid = currentUserId();
  const d = state.profilPublicData;
  if (!d) return;
  try {
    if (hasLikedAVoir(mesAVoirId)) {
      const { error } = await sb.from("mes_a_voir_likes").delete().eq("mes_a_voir_id", mesAVoirId).eq("user_id", uid);
      if (error) throw error;
      d.likesAVoirDuProfil = (d.likesAVoirDuProfil || []).filter((l) => !(l.mes_a_voir_id === mesAVoirId && l.user_id === uid));
    } else {
      const { error } = await sb.from("mes_a_voir_likes").insert([{ mes_a_voir_id: mesAVoirId, user_id: uid }]);
      if (error) throw error;
      d.likesAVoirDuProfil = [...(d.likesAVoirDuProfil || []), { mes_a_voir_id: mesAVoirId, user_id: uid }];
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: "a_voir", target_id: mesAVoirId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like à voir", errNotif);
      }
    }
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- Likes/commentaires sur la page "Tendances" d'un profil, prise
// dans son ensemble (pas une ligne précise : la cible est profilId
// lui-même, à la fois pour le like et pour to_user_id de la notif).
export function hasLikedTendances(profilId) {
  const uid = currentUserId();
  if (!uid || !state.profilPublicData) return false;
  return (state.profilPublicData.likesTendancesDuProfil || []).some((l) => l.profil_id === profilId && l.user_id === uid);
}
export function getTendancesLikeCount(profilId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.likesTendancesDuProfil || []).filter((l) => l.profil_id === profilId).length;
}
export function getTendancesCommentCount(profilId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.commentsTendancesDuProfil || []).filter((c) => c.profil_id === profilId).length;
}
export async function toggleLikeTendances(profilId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer."); return; }
  const uid = currentUserId();
  const d = state.profilPublicData;
  if (!d) return;
  try {
    if (hasLikedTendances(profilId)) {
      const { error } = await sb.from("tendances_likes").delete().eq("profil_id", profilId).eq("user_id", uid);
      if (error) throw error;
      d.likesTendancesDuProfil = (d.likesTendancesDuProfil || []).filter((l) => !(l.profil_id === profilId && l.user_id === uid));
    } else {
      const { error } = await sb.from("tendances_likes").insert([{ profil_id: profilId, user_id: uid }]);
      if (error) throw error;
      d.likesTendancesDuProfil = [...(d.likesTendancesDuProfil || []), { profil_id: profilId, user_id: uid }];
      if (profilId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: profilId, from_user_id: uid, interaction_type: "like", target_kind: "tendances", target_id: profilId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like tendances", errNotif);
      }
    }
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- Likes/commentaires sur une personne (acteur/actrice/scénariste/
// réalisateur) telle qu'elle apparaît dans "Les valeurs sûres" d'un
// profil précis. Cible = (profilId, personneId), car la même personne
// peut apparaître chez plusieurs profils avec une note différente.
export function hasLikedValeurSure(personneId) {
  const uid = currentUserId();
  if (!uid || !state.profilPublicData) return false;
  return (state.profilPublicData.likesValeursSuresDuProfil || []).some((l) => l.personne_id === personneId && l.user_id === uid);
}
export function getValeurSureLikeCount(personneId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.likesValeursSuresDuProfil || []).filter((l) => l.personne_id === personneId).length;
}
export function getValeurSureCommentCount(personneId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.commentsValeursSuresDuProfil || []).filter((c) => c.personne_id === personneId).length;
}
export async function toggleLikeValeurSure(profilId, personneId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer."); return; }
  const uid = currentUserId();
  const d = state.profilPublicData;
  if (!d) return;
  try {
    if (hasLikedValeurSure(personneId)) {
      const { error } = await sb.from("valeurs_sures_likes").delete().eq("profil_id", profilId).eq("personne_id", personneId).eq("user_id", uid);
      if (error) throw error;
      d.likesValeursSuresDuProfil = (d.likesValeursSuresDuProfil || []).filter((l) => !(l.personne_id === personneId && l.user_id === uid));
    } else {
      const { error } = await sb.from("valeurs_sures_likes").insert([{ profil_id: profilId, personne_id: personneId, user_id: uid }]);
      if (error) throw error;
      d.likesValeursSuresDuProfil = [...(d.likesValeursSuresDuProfil || []), { profil_id: profilId, personne_id: personneId, user_id: uid }];
      if (profilId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: profilId, from_user_id: uid, interaction_type: "like", target_kind: "valeurs_sures", target_id: personneId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like valeur sûre", errNotif);
      }
    }
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- Likes/commentaires sur une partie de Quiz du jour ou d'OST
// Challenge ("Jeux" sur une fiche profil). target_kind ('quiz'|'ost')
// + target_id (scores_quiz.id ou scores_ost.id) identifient la partie.
export function hasLikedJeu(kind, targetId) {
  const uid = currentUserId();
  if (!uid || !state.profilPublicData) return false;
  return (state.profilPublicData.likesJeuxDuProfil || []).some((l) => l.target_kind === kind && l.target_id === targetId && l.user_id === uid);
}
export function getJeuLikeCount(kind, targetId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.likesJeuxDuProfil || []).filter((l) => l.target_kind === kind && l.target_id === targetId).length;
}
export function getJeuCommentCount(kind, targetId) {
  if (!state.profilPublicData) return 0;
  return (state.profilPublicData.commentsJeuxDuProfil || []).filter((c) => c.target_kind === kind && c.target_id === targetId).length;
}
export async function toggleLikeJeu(kind, targetId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer."); return; }
  const uid = currentUserId();
  const d = state.profilPublicData;
  if (!d) return;
  try {
    if (hasLikedJeu(kind, targetId)) {
      const { error } = await sb.from("jeux_likes").delete().eq("target_kind", kind).eq("target_id", targetId).eq("user_id", uid);
      if (error) throw error;
      d.likesJeuxDuProfil = (d.likesJeuxDuProfil || []).filter((l) => !(l.target_kind === kind && l.target_id === targetId && l.user_id === uid));
    } else {
      const { error } = await sb.from("jeux_likes").insert([{ target_kind: kind, target_id: targetId, user_id: uid }]);
      if (error) throw error;
      d.likesJeuxDuProfil = [...(d.likesJeuxDuProfil || []), { target_kind: kind, target_id: targetId, user_id: uid }];
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: kind, target_id: targetId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like jeu", errNotif);
      }
    }
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- modale commentaires sur une entrée "vu" / "à voir" / "tendances"
// / "valeurs sûres" / "cadeau" / "quiz" / "ost" ----
// Les commentaires sont chargés à la demande à l'ouverture (pas
// pré-stockés dans profilPublicData), pour que la même modale serve
// aussi bien depuis une fiche profil que depuis le fil communauté
// (ex. un cadeau gagné, qui n'a pas de "profilPublicData" parent).
export function ouvrirCommentairesEntry(kind, targetId, titre, ownerId) {
  setState({ entryCommentModal: { kind, targetId, titre, ownerId, draft: "", comments: [], loadingComments: true } });
  chargerCommentairesEntry(kind, targetId);
}
export function commentTableEtColonne(kind) {
  if (kind === "visionnage") return { table: "mes_visionnages_comments", col: "visionnage_id" };
  if (kind === "a_voir") return { table: "mes_a_voir_comments", col: "mes_a_voir_id" };
  if (kind === "tendances") return { table: "tendances_comments", col: "profil_id" };
  if (kind === "valeurs_sures") return { table: "valeurs_sures_comments", col: "personne_id" };
  if (kind === "cadeau") return { table: "cadeau_comments", col: "cadeau_id" };
  return { table: "jeux_comments", col: "target_id" }; // "quiz" | "ost"
}
export async function chargerCommentairesEntry(kind, targetId) {
  const { table, col } = commentTableEtColonne(kind);
  try {
    let query = sb.from(table).select("*, profils(pseudo, avatar_url)").eq(col, targetId).order("created_at", { ascending: false });
    if (kind === "quiz" || kind === "ost") query = query.eq("target_kind", kind);
    const { data, error } = await query;
    if (error) throw error;
    if (state.entryCommentModal && state.entryCommentModal.kind === kind && state.entryCommentModal.targetId === targetId) {
      setState({ entryCommentModal: { ...state.entryCommentModal, comments: data || [], loadingComments: false } });
    }
  } catch (e) {
    console.error("Erreur chargement commentaires", e);
    if (state.entryCommentModal) setState({ entryCommentModal: { ...state.entryCommentModal, comments: [], loadingComments: false } });
  }
}
export function fermerCommentairesEntry() {
  setState({ entryCommentModal: null });
}
export async function publierCommentaireEntry() {
  const m = state.entryCommentModal;
  if (!m) return;
  if (!isLoggedIn()) { showToast("Connecte-toi pour commenter."); return; }
  const texte = (m.draft || "").trim();
  if (!texte) { showToast("Écris un commentaire avant de publier."); return; }
  const uid = currentUserId();
  const { table } = commentTableEtColonne(m.kind);
  // "valeurs_sures" a besoin de DEUX colonnes (profil_id + personne_id) ;
  // "quiz"/"ost" ont besoin de target_kind EN PLUS de target_id (même
  // table jeux_comments pour les deux, distingués par target_kind).
  const insertObj = m.kind === "visionnage" ? { visionnage_id: m.targetId, user_id: uid, contenu: texte }
    : m.kind === "a_voir" ? { mes_a_voir_id: m.targetId, user_id: uid, contenu: texte }
    : m.kind === "tendances" ? { profil_id: m.targetId, user_id: uid, contenu: texte }
    : m.kind === "valeurs_sures" ? { profil_id: m.ownerId, personne_id: m.targetId, user_id: uid, contenu: texte }
    : m.kind === "cadeau" ? { cadeau_id: m.targetId, user_id: uid, contenu: texte }
    : { target_kind: m.kind, target_id: m.targetId, user_id: uid, contenu: texte }; // quiz/ost
  try {
    const { data, error } = await sb.from(table).insert([insertObj]).select("*, profils(pseudo, avatar_url)").single();
    if (error) throw error;
    setState({ entryCommentModal: { ...m, draft: "", comments: [data, ...(m.comments || [])] } });
    // Garde aussi à jour les compteurs affichés ailleurs (badge 💬 sur
    // la carte du fil ou sur la fiche profil), sans attendre un rechargement.
    if (m.kind === "cadeau") {
      state.cadeauxComments = [...(state.cadeauxComments || []), data];
    } else if (m.kind === "quiz" || m.kind === "ost") {
      const d = state.profilPublicData;
      if (d) d.commentsJeuxDuProfil = [data, ...(d.commentsJeuxDuProfil || [])];
    } else {
      const d = state.profilPublicData;
      if (d) {
        const listKey = m.kind === "visionnage" ? "commentsVisionnageDuProfil" : m.kind === "a_voir" ? "commentsAVoirDuProfil" : m.kind === "tendances" ? "commentsTendancesDuProfil" : "commentsValeursSuresDuProfil";
        d[listKey] = [data, ...(d[listKey] || [])];
      }
    }
    if (m.ownerId && m.ownerId !== uid) {
      const { error: errNotif } = await sb.from("notifications_interactions").insert([{
        to_user_id: m.ownerId, from_user_id: uid, interaction_type: "comment", target_kind: m.kind, target_id: m.targetId, titre: m.titre, contenu_apercu: texte.slice(0, 80),
      }]);
      if (errNotif) console.error("Erreur notification commentaire", errNotif);
    }
  } catch (e) {
    console.error(e);
    showToast("Publication impossible.");
  }
}

export function isFollowing(profilId) {
  const uid = currentUserId();
  if (!uid) return false;
  return state.abonnements.some((a) => a.follower_id === uid && a.followed_id === profilId);
}
export function getFollowerCount(profilId) {
  return state.abonnements.filter((a) => a.followed_id === profilId).length;
}
export function getFollowingCount(profilId) {
  return state.abonnements.filter((a) => a.follower_id === profilId).length;
}

// ---- modale "liste des abonnés / abonnements" d'un profil ----
// Comble un vrai trou fonctionnel : les chiffres "Abonnés"/"Abonnements"
// affichés sur une fiche profil n'étaient que des compteurs, sans
// aucun moyen de voir QUI ils sont ni de s'abonner depuis cette liste.
export async function ouvrirListeAbonnes(profilId, mode) {
  const ids = mode === "abonnes"
    ? state.abonnements.filter((a) => a.followed_id === profilId).map((a) => a.follower_id)
    : state.abonnements.filter((a) => a.follower_id === profilId).map((a) => a.followed_id);
  setState({ listeAbonnesModal: { mode, profils: [], loading: true } });
  if (ids.length === 0) {
    setState({ listeAbonnesModal: { mode, profils: [], loading: false } });
    return;
  }
  try {
    const { data, error } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", ids);
    if (error) throw error;
    setState({ listeAbonnesModal: { mode, profils: data || [], loading: false } });
  } catch (e) {
    console.error("Erreur chargement liste abonnés/abonnements", e);
    setState({ listeAbonnesModal: { mode, profils: [], loading: false } });
  }
}
export function fermerListeAbonnes() {
  setState({ listeAbonnesModal: null });
}

// ---- système de cadeaux (acteurs gagnés en terminant une tierlist ou un quiz) ----
export async function chargerMaCollectionActeurs() {
  if (!isLoggedIn()) { state.maCollectionActeurs = []; return; }
  try {
    const { data, error } = await sb
      .from("collection_acteurs")
      .select("*, personnes(id, nom, role, photo_url)")
      .eq("user_id", currentUserId())
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.maCollectionActeurs = (data || []).filter((c) => c.personnes);
  } catch (e) {
    console.error("Erreur chargement collection acteurs", e);
    state.maCollectionActeurs = [];
  }
}

// Tire au hasard une personne AVEC PHOTO, pas déjà dans la collection
// de l'utilisateur, l'ajoute à sa collection, et déclenche l'affichage
// du cadeau (popup emballage). Appelée à la fin d'une tierlist ou d'un
// quiz — voir sauvegarderTierlistBuilder() et finishQuiz().
// N'arrive jamais en erreur visible si aucune personne n'est éligible
// (catalogue trop petit, ou tout déjà collecté) : pas de cadeau, sans
// notification d'échec — l'absence de gain ne doit pas être perçue
// comme un bug par l'utilisateur.
export async function tenterGagnerCadeau(source) {
  // Toute la fonction est protégée par un seul try/catch global : le
  // système de cadeaux ne doit JAMAIS pouvoir faire échouer ou
  // afficher une erreur sur l'action principale qui l'a déclenché
  // (sauvegarde d'une tierlist ou d'un quiz, qui elle a déjà réussi
  // à ce stade) — voir sauvegarderTierlistBuilder() et finishQuiz().
  try {
    if (!isLoggedIn()) return;
    const idsDejaPossedes = new Set((state.maCollectionActeurs || []).map((c) => c.personne_id));
    const eligibles = (state.people || []).filter((p) => p.photo_url && !idsDejaPossedes.has(p.id));
    if (eligibles.length === 0) return;
    const gagnee = eligibles[Math.floor(Math.random() * eligibles.length)];
    const { error } = await sb.from("collection_acteurs").insert([{
      user_id: currentUserId(),
      personne_id: gagnee.id,
      gagne_via: source,
    }]);
    if (error) {
      // Conflit (déjà possédée) : improbable ici puisqu'on filtre déjà
      // dessus, mais sans danger si ça arrive (pas de doublon créé,
      // pas de cadeau affiché pour rien).
      if (error.code === "23505") return;
      throw error;
    }
    state.maCollectionActeurs = [{ id: null, personne_id: gagnee.id, personnes: gagnee }, ...state.maCollectionActeurs];
    // Ajoute aussi l'activité au fil communauté (visible par les
    // autres), pour qu'elle apparaisse immédiatement sans recharger
    // toute la page — voir cadeauActiviteCardHtml().
    state.activitesCadeaux = [{
      id: null, user_id: currentUserId(), personne_id: gagnee.id, personnes: gagnee,
      created_at: new Date().toISOString(), profil_gagnant: state.profil ? { id: currentUserId(), pseudo: state.profil.pseudo } : null,
    }, ...(state.activitesCadeaux || [])];
    setState({ cadeauEnCours: { personne: gagnee, ouvert: false } });
  } catch (e) {
    // Échec silencieux : l'absence de cadeau ne doit jamais être
    // perçue comme un bug, et ne doit jamais écraser le message de
    // succès de l'action qui a déclenché cette tentative.
    console.error("Erreur attribution cadeau (sans impact sur l'action principale)", e);
  }
}
export function ouvrirCadeau() {
  if (!state.cadeauEnCours) return;
  setState({ cadeauEnCours: { ...state.cadeauEnCours, ouvert: true } });
}
export function fermerCadeau() {
  setState({ cadeauEnCours: null });
}
export function ouvrirCollection() {
  setState({ collectionModalOpen: true });
}
export function fermerCollection() {
  setState({ collectionModalOpen: false });
}

// ---- "piocher dans les à-voir de mes abonnés" ----
// Charge, pour tous les profils que JE suis, leur liste "à voir"
// personnelle (table mes_a_voir, jointe au catalogue a_voir), avec le
// pseudo/avatar de chacun pour affichage. Lecture publique comme pour
// mes_visionnages (voir chargerTousLesVisionnages) — mes_a_voir d'un
// autre utilisateur est déjà lu avec succès ailleurs (openProfilPublic).
export async function ouvrirEnviesAbonnes() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour voir les envies de tes abonnements."); return; }
  const uid = currentUserId();
  const suivisIds = state.abonnements.filter((a) => a.follower_id === uid).map((a) => a.followed_id);
  setState({ enviesAbonnesOpen: true, enviesAbonnesLoading: true, enviesAbonnesData: null });
  if (suivisIds.length === 0) {
    setState({ enviesAbonnesLoading: false, enviesAbonnesData: [] });
    return;
  }
  try {
    const { data: mesAVoirAbonnes, error: e1 } = await sb
      .from("mes_a_voir")
      .select("*, a_voir(*)")
      .in("user_id", suivisIds);
    if (e1) throw e1;

    const { data: profils, error: e2 } = await sb
      .from("profils")
      .select("id, pseudo, avatar_url")
      .in("id", suivisIds);
    if (e2) throw e2;
    const profilsParId = {};
    (profils || []).forEach((p) => { profilsParId[p.id] = p; });

    const items = (mesAVoirAbonnes || [])
      .filter((m) => m.a_voir)
      .map((m) => ({
        ...m.a_voir,
        mes_a_voir_id_abonne: m.id,
        suggere_par: profilsParId[m.user_id] || null,
      }))
      // Évite de proposer un titre déjà présent dans MA propre liste à voir.
      .filter((item) => !state.mesAVoirIds.includes(item.id));

    setState({ enviesAbonnesLoading: false, enviesAbonnesData: items });
  } catch (e) {
    console.error("Erreur chargement envies abonnés", e);
    showToast("Impossible de charger les envies de tes abonnements.");
    setState({ enviesAbonnesLoading: false, enviesAbonnesData: [] });
  }
}
export function fermerEnviesAbonnes() {
  setState({ enviesAbonnesOpen: false, enviesAbonnesData: null });
}
// Ajoute un item choisi chez un abonné à MA propre liste à voir, avec
// le même upsert (user_id, a_voir_id) que la logique d'ajout standard.
export async function piocherEnvieAbonne(aVoirId) {
  if (!isLoggedIn()) return;
  try {
    const { error } = await sb.from("mes_a_voir").upsert({ user_id: currentUserId(), a_voir_id: aVoirId }, { onConflict: "user_id,a_voir_id" });
    if (error) throw error;
    await chargerMesAVoir();
    setState({
      enviesAbonnesData: (state.enviesAbonnesData || []).filter((item) => item.id !== aVoirId),
    });
    showToast("Ajouté à ta liste à voir !");
  } catch (e) {
    console.error("Erreur ajout depuis envies abonnés", e);
    showToast("Impossible d'ajouter ce titre.");
  }
}

// ---- suggérer un drama à un abonné ----

// Trouve ou crée l'entrée correspondante dans le catalogue commun
// `a_voir` à partir d'un objet drama (vu ou déjà à voir) — même
// pattern de correspondance par titre que markAsWatched().
export async function trouverOuCreerAVoir(d) {
  const normalized = d.titre.trim().toLowerCase();
  const existant = (state.aVoirCatalogue || []).find((a) => a.titre.trim().toLowerCase() === normalized);
  if (existant) return existant.id;
  const { data: inserted, error } = await sb.from("a_voir").insert([{
    titre: d.titre, titre_kr: d.titre_kr || null, annee: d.annee || null,
    scenariste: d.scenariste || null, realisateur: d.realisateur || null, acteur: d.acteur || null, actrice: d.actrice || null,
    poster_url: d.poster_url || null,
  }]).select().single();
  if (error) throw error;
  return inserted.id;
}

// Ouvre le petit sélecteur "à qui suggérer ce drama ?" depuis une
// fiche drama. `d` est l'objet drama affiché dans dramaModal/avoir.
export async function ouvrirSuggererA(d) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour suggérer un drama."); return; }
  const uid = currentUserId();
  const mesAbonnements = state.abonnements.filter((a) => a.follower_id === uid).map((a) => a.followed_id);
  if (mesAbonnements.length === 0) {
    showToast("Tu ne suis encore personne — abonne-toi à des profils pour pouvoir leur suggérer des dramas.");
    return;
  }
  setState({ suggererADraft: { drama: d, abonnementsIds: mesAbonnements, abonnementsProfils: [] } });
  try {
    const { data: profils, error } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", mesAbonnements);
    if (error) throw error;
    // Re-vérifie que la modale est toujours ouverte sur le même
    // drama avant d'appliquer (l'utilisateur pourrait avoir fermé
    // entre-temps pendant le chargement réseau).
    if (state.suggererADraft && state.suggererADraft.drama === d) {
      setState({ suggererADraft: { ...state.suggererADraft, abonnementsProfils: profils || [] } });
    }
  } catch (e) {
    console.error("Erreur chargement profils abonnements", e);
  }
}
export function fermerSuggererA() {
  setState({ suggererADraft: null });
}
export async function envoyerSuggestion(toUserId) {
  const draft = state.suggererADraft;
  if (!draft) return;
  try {
    const aVoirId = await trouverOuCreerAVoir(draft.drama);
    const { error } = await sb.from("suggestions_a_voir").insert([{
      from_user_id: currentUserId(),
      to_user_id: toUserId,
      a_voir_id: aVoirId,
    }]);
    if (error) throw error;
    showToast(`"${draft.drama.titre}" suggéré !`);
    setState({ suggererADraft: null });
  } catch (e) {
    console.error("Erreur envoi suggestion", e);
    showToast("Impossible d'envoyer la suggestion.");
  }
}

// ---- notifications (suggestions reçues) ----
export async function chargerNotificationsSuggestions() {
  if (!isLoggedIn()) { state.notifSuggestionsData = []; return; }
  try {
    // PostgREST ne peut pas faire de jointure imbriquée vers "profils"
    // ici : suggestions_a_voir.from_user_id référence auth.users, pas
    // profils directement (même si profils.id = auth.users.id en
    // pratique, ce n'est pas une vraie clé étrangère déclarée entre
    // les deux). On fait donc deux requêtes séparées et on fusionne
    // côté client — même pattern que ouvrirEnviesAbonnes().
    const { data, error } = await sb
      .from("suggestions_a_voir")
      .select("*, a_voir(*)")
      .eq("to_user_id", currentUserId())
      .order("created_at", { ascending: false });
    if (error) throw error;
    const suggestions = data || [];

    const fromIds = [...new Set(suggestions.map((s) => s.from_user_id))];
    let profilsParId = {};
    if (fromIds.length > 0) {
      const { data: profils, error: e2 } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", fromIds);
      if (e2) throw e2;
      (profils || []).forEach((p) => { profilsParId[p.id] = p; });
    }

    state.notifSuggestionsData = suggestions.map((s) => ({ ...s, profil_expediteur: profilsParId[s.from_user_id] || null }));
  } catch (e) {
    console.error("Erreur chargement notifications suggestions", e);
    state.notifSuggestionsData = [];
  }
}
export function getSuggestionsNonLues() {
  return (state.notifSuggestionsData || []).filter((s) => !s.vue).length;
}

// Charge les notifications "nouvel abonné" reçues (où je suis
// followed_id), même principe que chargerNotificationsSuggestions :
// deux requêtes séparées (notifications puis profils) car il n'y a
// pas de vraie clé étrangère déclarée entre notifications_abonnements
// et profils côté PostgREST pour une jointure imbriquée fiable ici.
export async function chargerNotificationsAbonnements() {
  if (!isLoggedIn()) { state.notifAbonnementsData = []; return; }
  try {
    const { data, error } = await sb
      .from("notifications_abonnements")
      .select("*")
      .eq("followed_id", currentUserId())
      .order("created_at", { ascending: false });
    if (error) throw error;
    const notifs = data || [];

    const followerIds = [...new Set(notifs.map((n) => n.follower_id))];
    let profilsParId = {};
    if (followerIds.length > 0) {
      const { data: profils, error: e2 } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", followerIds);
      if (e2) throw e2;
      (profils || []).forEach((p) => { profilsParId[p.id] = p; });
    }

    state.notifAbonnementsData = notifs.map((n) => ({ ...n, profil_follower: profilsParId[n.follower_id] || null }));
  } catch (e) {
    console.error("Erreur chargement notifications abonnements", e);
    state.notifAbonnementsData = [];
  }
}

// Charge les notifications "quelqu'un a aimé/commenté ton vu ou ton à
// voir" reçues (où je suis to_user_id), même principe que les deux
// fonctions précédentes (jointure profils faite à la main côté client).
export async function chargerNotificationsInteractions() {
  if (!isLoggedIn()) { state.notifInteractionsData = []; return; }
  try {
    const { data, error } = await sb
      .from("notifications_interactions")
      .select("*")
      .eq("to_user_id", currentUserId())
      .order("created_at", { ascending: false });
    if (error) throw error;
    const notifs = data || [];

    const fromIds = [...new Set(notifs.map((n) => n.from_user_id))];
    let profilsParId = {};
    if (fromIds.length > 0) {
      const { data: profils, error: e2 } = await sb.from("profils").select("id, pseudo, avatar_url").in("id", fromIds);
      if (e2) throw e2;
      (profils || []).forEach((p) => { profilsParId[p.id] = p; });
    }

    state.notifInteractionsData = notifs.map((n) => ({ ...n, profil_auteur: profilsParId[n.from_user_id] || null }));
  } catch (e) {
    console.error("Erreur chargement notifications interactions", e);
    state.notifInteractionsData = [];
  }
}
// Nombre total de notifications non lues, suggestions + nouveaux
// abonnés + interactions (likes/commentaires sur vus/à voir) confondus
// (cloche unique — voir le choix produit).
export function getNotificationsNonLues() {
  return getSuggestionsNonLues() + (state.notifAbonnementsData || []).filter((n) => !n.vue).length + (state.notifInteractionsData || []).filter((n) => !n.vue).length;
}
// Marque les notifications "nouvel abonné" comme vues (même logique
// que marquerSuggestionsVues, appelée en plus à l'ouverture de la cloche).
export async function marquerAbonnementsVus() {
  const idsNonLues = (state.notifAbonnementsData || []).filter((n) => !n.vue).map((n) => n.id);
  if (idsNonLues.length === 0) return;
  try {
    const { error } = await sb.from("notifications_abonnements").update({ vue: true }).in("id", idsNonLues);
    if (error) throw error;
    state.notifAbonnementsData = state.notifAbonnementsData.map((n) => idsNonLues.includes(n.id) ? { ...n, vue: true } : n);
    render();
  } catch (e) {
    console.error("Erreur marquage abonnements vus", e);
  }
}
// Marque les notifications de likes/commentaires sur vus/à voir comme vues.
export async function marquerInteractionsVues() {
  const idsNonLues = (state.notifInteractionsData || []).filter((n) => !n.vue).map((n) => n.id);
  if (idsNonLues.length === 0) return;
  try {
    const { error } = await sb.from("notifications_interactions").update({ vue: true }).in("id", idsNonLues);
    if (error) throw error;
    state.notifInteractionsData = state.notifInteractionsData.map((n) => idsNonLues.includes(n.id) ? { ...n, vue: true } : n);
    render();
  } catch (e) {
    console.error("Erreur marquage interactions vues", e);
  }
}
export async function ouvrirNotifSuggestions() {
  setState({ notifSuggestionsOpen: true });
}
export function fermerNotifSuggestions() {
  setState({ notifSuggestionsOpen: false });
}
// Marque toutes les suggestions reçues comme vues (appelé à
// l'ouverture de la modale, pour faire disparaître le badge).
export async function marquerSuggestionsVues() {
  const idsNonLues = (state.notifSuggestionsData || []).filter((s) => !s.vue).map((s) => s.id);
  if (idsNonLues.length === 0) return;
  try {
    const { error } = await sb.from("suggestions_a_voir").update({ vue: true }).in("id", idsNonLues);
    if (error) throw error;
    state.notifSuggestionsData = state.notifSuggestionsData.map((s) => idsNonLues.includes(s.id) ? { ...s, vue: true } : s);
    render();
  } catch (e) {
    console.error("Erreur marquage suggestions vues", e);
  }
}
// Ajoute le drama suggéré à MA liste à voir, depuis la notification.
export async function ajouterDepuisSuggestion(suggestion) {
  if (!suggestion.a_voir) return;
  try {
    const { error } = await sb.from("mes_a_voir").upsert({ user_id: currentUserId(), a_voir_id: suggestion.a_voir.id }, { onConflict: "user_id,a_voir_id" });
    if (error) throw error;
    await chargerMesAVoir();
    showToast(`"${suggestion.a_voir.titre}" ajouté à ta liste à voir !`);
    render();
  } catch (e) {
    console.error("Erreur ajout depuis suggestion", e);
    showToast("Impossible d'ajouter ce titre.");
  }
}

// ---- recherche de profil par pseudo ----
// Permet de trouver et s'abonner à quelqu'un même si son compte n'a
// encore aucune activité visible dans le fil (cas d'un compte qui
// vient juste d'être créé — c'est le trou fonctionnel à combler).
export function ouvrirRechercheProfil() {
  setState({ rechercheProfilOpen: true, rechercheProfilQuery: "", rechercheProfilResultats: [] });
}
export function fermerRechercheProfil() {
  setState({ rechercheProfilOpen: false });
}
let rechercheProfilDebounceTimer = null;
export function lancerRechercheProfilDebounced(query) {
  state.rechercheProfilQuery = query;
  if (rechercheProfilDebounceTimer) clearTimeout(rechercheProfilDebounceTimer);
  if (query.trim().length < 2) {
    state.rechercheProfilResultats = [];
    majDomResultatsRechercheProfil();
    return;
  }
  rechercheProfilDebounceTimer = setTimeout(() => rechercherProfilParPseudo(query), 350);
}
// Met à jour SEULEMENT le bloc de résultats en DOM direct, sans
// jamais passer par render()/innerHTML sur tout #app — sinon le champ
// de recherche perdrait le focus à chaque résultat reçu (innerHTML
// met document.activeElement à null, même si l'élément recréé a le
// même id). Même principe que le sélecteur de casting.
export function majDomResultatsRechercheProfil() {
  const zone = document.getElementById("rechercheProfilResultats");
  if (zone) zone.innerHTML = renderRechercheProfilResultats();
  document.querySelectorAll("[data-open-profil-recherche]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.openProfilRecherche;
      setState({ rechercheProfilOpen: false });
      openProfilPublic(id);
    });
  });
}
export async function rechercherProfilParPseudo(query) {
  const q = query.trim();
  if (q.length < 2) return;
  state.rechercheProfilLoading = true;
  majDomResultatsRechercheProfil();
  try {
    const { data, error } = await sb
      .from("profils")
      .select("id, pseudo, avatar_url")
      .ilike("pseudo", `%${q}%`)
      .neq("id", currentUserId() || "00000000-0000-0000-0000-000000000000")
      .limit(20);
    if (error) throw error;
    state.rechercheProfilResultats = data || [];
  } catch (e) {
    console.error("Erreur recherche profil", e);
    state.rechercheProfilResultats = [];
  } finally {
    state.rechercheProfilLoading = false;
    majDomResultatsRechercheProfil();
  }
}

// ---- actions : avis ----
export function openComposer(dramaId) {
  // Pré-remplit si l'utilisateur a déjà un avis sur ce drama (édition).
  const existant = state.avis.find((a) => a.drama_id === dramaId && a.user_id === currentUserId());
  setState({
    composerOpen: true,
    composerDramaId: dramaId || "",
    composerNote: existant ? String(existant.note ?? "") : "",
    composerCommentaire: existant ? (existant.commentaire || "") : "",
  });
}
export function closeComposer() {
  setState({ composerOpen: false, composerDramaId: "", composerNote: "", composerCommentaire: "" });
}

export async function publierAvis() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour publier un avis."); return; }
  const dramaId = state.composerDramaId;
  if (!dramaId) { showToast("Choisis un drama."); return; }
  const note = state.composerNote === "" ? null : Number(state.composerNote);
  if (note !== null && (note < 0 || note > 10)) { showToast("La note doit être entre 0 et 10."); return; }

  const payload = {
    user_id: currentUserId(),
    drama_id: dramaId,
    note,
    commentaire: state.composerCommentaire.trim() || null,
  };
  try {
    // upsert : un seul avis par utilisateur et par drama (contrainte unique en base)
    const { error } = await sb.from("avis").upsert(payload, { onConflict: "user_id,drama_id" });
    if (error) throw error;
    await loadCommunaute();
    closeComposer();
    showToast("Avis publié.");
    render();
  } catch (e) {
    console.error(e);
    showToast("Publication impossible.");
  }
}

export async function supprimerAvis(avisId) {
  try {
    const { error } = await sb.from("avis").delete().eq("id", avisId);
    if (error) throw error;
    await loadCommunaute();
    showToast("Avis supprimé.");
    render();
  } catch (e) {
    console.error(e);
    showToast("Suppression impossible.");
  }
}

export async function toggleLikeAvis(avisId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer un avis."); return; }
  const uid = currentUserId();
  try {
    if (hasLiked(avisId)) {
      const { error } = await sb.from("avis_likes").delete().eq("avis_id", avisId).eq("user_id", uid);
      if (error) throw error;
    } else {
      const { error } = await sb.from("avis_likes").insert([{ avis_id: avisId, user_id: uid }]);
      if (error) throw error;
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: "avis", target_id: avisId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like avis", errNotif);
      }
    }
    await loadCommunaute();
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- Likes pour les cadeaux ----
export async function toggleLikeCadeau(cadeauId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer un cadeau."); return; }
  const uid = currentUserId();
  try {
    if (hasLikedCadeau(cadeauId)) {
      const { error } = await sb.from("cadeau_likes").delete().eq("cadeau_id", cadeauId).eq("user_id", uid);
      if (error) throw error;
    } else {
      const { error } = await sb.from("cadeau_likes").insert([{ cadeau_id: cadeauId, user_id: uid }]);
      if (error) throw error;
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: "cadeau", target_id: cadeauId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like cadeau", errNotif);
      }
    }
    await loadCommunaute();
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- actions : abonnements ----
export async function toggleFollow(profilId) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour suivre quelqu'un."); return; }
  const uid = currentUserId();
  if (uid === profilId) return;
  try {
    if (isFollowing(profilId)) {
      const { error } = await sb.from("abonnements").delete().eq("follower_id", uid).eq("followed_id", profilId);
      if (error) throw error;
      showToast("Tu ne suis plus cette personne.");
    } else {
      const { error } = await sb.from("abonnements").insert([{ follower_id: uid, followed_id: profilId }]);
      if (error) throw error;
      // Notifie la personne suivie. En upsert sur (follower_id,
      // followed_id) : un réabonnement après désabonnement remet la
      // même ligne à "non vue" plutôt que d'empiler un doublon.
      const { error: errNotif } = await sb.from("notifications_abonnements")
        .upsert({ follower_id: uid, followed_id: profilId, vue: false }, { onConflict: "follower_id,followed_id" });
      if (errNotif) console.error("Erreur création notification abonnement", errNotif);
      showToast("Abonnement ajouté.");
    }
    await loadCommunaute();
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- profil public ----
export async function openProfilPublic(profilId) {
  // Mémorise d'où on vient pour pouvoir y revenir avec le bouton
  // retour (voir renderProfilPublicView()). Si on est déjà sur une
  // fiche profil (cas d'un clic en chaîne profil -> profil -> profil),
  // on garde le point d'entrée d'origine plutôt que d'empiler des
  // fiches : "retour" doit ramener au contenu, pas à la fiche précédente.
  const retourTab = state.activeTab === "profil" ? state.profilRetourTab : state.activeTab;
  setState({ profilPublicId: profilId, profilPublicData: null, activeTab: "profil", profilRetourTab: retourTab });
  try {
    const { data: profil, error: e1 } = await sb.from("profils").select("*").eq("id", profilId).single();
    if (e1) throw e1;
    const avisDuProfil = state.avis.filter((a) => a.user_id === profilId);
    const { data: tierlistsDuProfil, error: e2 } = await sb
      .from("tierlists")
      .select("*")
      .eq("user_id", profilId)
      .eq("est_publique", true)
      .order("created_at", { ascending: false });
    if (e2) throw e2;

    // Ses dramas vus (jointure visionnages + catalogue, même format
    // que state.mesEntries pour pouvoir réutiliser computeTrends/getStats).
    // On garde aussi `visionnage_id` (l'id de la ligne mes_visionnages
    // elle-même) à part de `id` (celui du drama, écrasé par le spread) :
    // c'est lui qui identifie un like/commentaire précis sur CETTE
    // personne ayant vu CE drama, pas le drama en général.
    const { data: visionnagesData, error: e3 } = await sb
      .from("mes_visionnages")
      .select("*, dramas(*)")
      .eq("user_id", profilId);
    if (e3) throw e3;
    const entriesDuProfil = enrichirDramasAvecPersonnes((visionnagesData || [])
      .filter((v) => v.dramas)
      .map((v) => ({ ...v.dramas, note: v.note, date_visionnage: v.date_visionnage, visionnage_id: v.id })));

    // Sa liste à voir (jointure mes_a_voir + catalogue a_voir). Même
    // logique : `mes_a_voir_id` est conservé à part de `id` (celui du
    // catalogue a_voir) pour identifier précisément CETTE envie-là.
    const { data: aVoirData, error: e4 } = await sb
      .from("mes_a_voir")
      .select("*, a_voir(*)")
      .eq("user_id", profilId);
    if (e4) throw e4;
    const aVoirDuProfil = (aVoirData || []).filter((m) => m.a_voir).map((m) => ({ ...m.a_voir, mes_a_voir_id: m.id }));

    // Likes + commentaires sur ses "vus" et son "à voir" — scopés aux
    // ids de CE profil pour rester légers (pas un chargement global).
    const visionnageIds = (visionnagesData || []).map((v) => v.id);
    const mesAVoirIds = (aVoirData || []).map((m) => m.id);
    let likesVisionnageDuProfil = [];
    let commentsVisionnageDuProfil = [];
    let likesAVoirDuProfil = [];
    let commentsAVoirDuProfil = [];
    if (visionnageIds.length > 0) {
      const { data: lv } = await sb.from("mes_visionnages_likes").select("*").in("visionnage_id", visionnageIds);
      likesVisionnageDuProfil = lv || [];
      const { data: cv } = await sb.from("mes_visionnages_comments").select("*, profils(pseudo, avatar_url)").in("visionnage_id", visionnageIds).order("created_at", { ascending: false });
      commentsVisionnageDuProfil = cv || [];
    }
    if (mesAVoirIds.length > 0) {
      const { data: lav } = await sb.from("mes_a_voir_likes").select("*").in("mes_a_voir_id", mesAVoirIds);
      likesAVoirDuProfil = lav || [];
      const { data: cav } = await sb.from("mes_a_voir_comments").select("*, profils(pseudo, avatar_url)").in("mes_a_voir_id", mesAVoirIds).order("created_at", { ascending: false });
      commentsAVoirDuProfil = cav || [];
    }

    // Likes + commentaires sur sa page "Tendances" dans son ensemble
    // (pas une ligne précise, donc identifiés par profilId lui-même).
    const { data: ltd } = await sb.from("tendances_likes").select("*").eq("profil_id", profilId);
    const likesTendancesDuProfil = ltd || [];
    const { data: ctd } = await sb.from("tendances_comments").select("*, profils(pseudo, avatar_url)").eq("profil_id", profilId).order("created_at", { ascending: false });
    const commentsTendancesDuProfil = ctd || [];

    // Likes + commentaires sur les personnes de SES "valeurs sûres"
    // (identifiés par le couple profil_id + personne_id, car la même
    // personne peut apparaître chez plusieurs profils avec une note
    // différente — voir renderTrendsSections()).
    const { data: lvs } = await sb.from("valeurs_sures_likes").select("*").eq("profil_id", profilId);
    const likesValeursSuresDuProfil = lvs || [];
    const { data: cvs } = await sb.from("valeurs_sures_comments").select("*, profils(pseudo, avatar_url)").eq("profil_id", profilId).order("created_at", { ascending: false });
    const commentsValeursSuresDuProfil = cvs || [];

    // Sa collection de cadeaux (acteurs gagnés en terminant une
    // tierlist ou un quiz) — visible par tout le monde, même principe
    // que "Ma collection" mais pour le profil consulté.
    const { data: collectionData, error: e5 } = await sb
      .from("collection_acteurs")
      .select("*, personnes(id, nom, role, photo_url)")
      .eq("user_id", profilId)
      .order("created_at", { ascending: false });
    if (e5) throw e5;
    const collectionDuProfil = (collectionData || []).filter((c) => c.personnes);

    // Son historique de quiz (scores déjà publics par ailleurs via le
    // classement — voir loadLeaderboardQuiz()).
    const { data: quizData, error: e6 } = await sb
      .from("scores_quiz")
      .select("*")
      .eq("user_id", profilId)
      .order("date_quiz", { ascending: false });
    if (e6) throw e6;
    const quizDuProfil = quizData || [];

    // Son historique OST Challenge (même principe, classement déjà
    // public via loadOstLeaderboard()).
    const { data: ostData, error: e7 } = await sb
      .from("scores_ost")
      .select("*")
      .eq("user_id", profilId)
      .order("date_partie", { ascending: false });
    if (e7) throw e7;
    const ostDuProfil = ostData || [];

    // Likes + commentaires sur ses parties Quiz/OST (regroupées sous
    // l'onglet "Jeux" — voir renderProfilPublicView()). Une seule paire
    // de tables génériques (target_kind 'quiz'|'ost'), donc une seule
    // requête par sens plutôt qu'une par jeu.
    const idsQuiz = quizDuProfil.map((q) => q.id);
    const idsOst = ostDuProfil.map((o) => o.id);
    const idsJeux = [...idsQuiz, ...idsOst];
    let likesJeuxDuProfil = [];
    let commentsJeuxDuProfil = [];
    if (idsJeux.length > 0) {
      const { data: lj } = await sb.from("jeux_likes").select("*").in("target_id", idsJeux);
      likesJeuxDuProfil = lj || [];
      const { data: cj } = await sb.from("jeux_comments").select("*, profils(pseudo, avatar_url)").in("target_id", idsJeux).order("created_at", { ascending: false });
      commentsJeuxDuProfil = cj || [];
    }

    const trendsDuProfil = computeTrends(entriesDuProfil);

    setState({
      profilPublicData: {
        profil, avisDuProfil, tierlistsDuProfil: tierlistsDuProfil || [],
        entriesDuProfil, aVoirDuProfil, trendsDuProfil, collectionDuProfil, quizDuProfil, ostDuProfil,
        likesVisionnageDuProfil, commentsVisionnageDuProfil, likesAVoirDuProfil, commentsAVoirDuProfil,
        likesTendancesDuProfil, commentsTendancesDuProfil,
        likesValeursSuresDuProfil, commentsValeursSuresDuProfil,
        likesJeuxDuProfil, commentsJeuxDuProfil,
        profilSubTab: "vus", // "vus" | "a-voir" | "tendances" | "avis" | "tierlists" | "cadeaux" | "jeux"
      },
    });
  } catch (e) {
    console.error(e);
    showToast("Profil introuvable.");
  }
}

// ---- rendu : fil d'activité ----
// Fusionne trois sources hétérogènes (avis publiés, envies "à voir"
// ajoutées, tierlists publiques créées) en une liste d'activités
// triée par date, normalisée avec un champ `type` pour savoir quel
// gabarit de carte appliquer.
export function getFeedEntries() {
  const activitesAvis = state.avis.map((a) => ({ type: "avis", date: a.created_at, data: a }));
  const activitesAVoir = (state.activitesAVoir || []).map((m) => ({ type: "a_voir", date: m.created_at, data: m }));
  const activitesTierlist = (state.tierlists || [])
    .filter((t) => t.est_publique)
    .map((t) => ({ type: "tierlist", date: t.created_at, data: t }));
  const activitesCadeaux = (state.activitesCadeaux || []).map((c) => ({ type: "cadeau", date: c.created_at, data: c }));

  // Les cartes "X a rejoint le carnet" sont désormais affichées dans
  // l'onglet "Abonnements" plutôt que dans le Fil d'actualité — leur
  // seule action possible (Suivre) les rattache au réseau social, pas
  // au flux de contenu — voir renderAbonnementsView().
  return [...activitesAvis, ...activitesAVoir, ...activitesTierlist, ...activitesCadeaux].sort((x, y) => new Date(y.date) - new Date(x.date));
}

export function activiteCardHtml(entry) {
  if (entry.type === "avis") return avisCardHtml(entry.data);
  if (entry.type === "tierlist") return tierlistActiviteCardHtml(entry.data);
  if (entry.type === "inscription") return inscriptionActiviteCardHtml(entry.data);
  if (entry.type === "cadeau") return cadeauActiviteCardHtml(entry.data);
  return aVoirActiviteCardHtml(entry.data);
}

export function avisCardHtml(a) {
  const liked = hasLiked(a.id);
  const likeCount = getLikeCount(a.id);
  const pseudo = a.profils ? a.profils.pseudo : "Utilisateur supprimé";
  const avatar = a.profils ? a.profils.avatar_url : null;
  const drama = a.dramas || {};
  const mine = a.user_id === currentUserId();
  return `<article class="drama-card" style="cursor:default;">
    <div class="card-row" style="align-items:flex-start;">
      ${avatar
        ? `<img src="${esc(avatar)}" class="tr-person-avatar" style="width:56px;height:56px;cursor:pointer;object-fit:cover;" data-open-profil="${esc(a.user_id)}">`
        : `<div class="stamp mini motif-flower" style="width:56px;height:56px;cursor:pointer;" data-open-profil="${esc(a.user_id)}">${FLOWER_MOTIF_SVG}</div>`}
      <div class="card-main">
        <p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(a.user_id)}">${esc(pseudo)}</p>
        <p class="cast" style="margin-top:1px;">a noté <b data-drama-titre="${esc(drama.titre)}" style="cursor:pointer; color:var(--blue-deep);">${esc(drama.titre || "un drama")}</b>${drama.annee ? ` (${esc(drama.annee)})` : ""}</p>
      </div>
      ${a.note !== null && a.note !== undefined ? stampHtml(a.note, true) : ""}
    </div>
    ${a.commentaire ? `<p style="font-size:13px; color:var(--ink); line-height:1.5; margin:10px 0 0;">${esc(a.commentaire)}</p>` : ""}
    <div class="card-actions" style="margin-top:10px;">
      <button class="text-btn" data-toggle-like="${esc(a.id)}" data-owner-id="${esc(a.user_id)}" data-titre="${esc(drama.titre || "un drama")}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">
        ${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}
      </button>
      ${mine ? `<button class="text-btn danger" data-delete-avis="${esc(a.id)}">🗑 Supprimer</button>` : ""}
    </div>
  </article>`;
}

// Carte "X veut voir Y" — même gabarit visuel que les avis (pas de
// distinction demandée), mais sans like ni suppression depuis le fil
// (l'envie se gère depuis l'onglet À voir).
export function aVoirActiviteCardHtml(m) {
  const pseudo = m.profils ? m.profils.pseudo : "Utilisateur supprimé";
  const avatar = m.profils ? m.profils.avatar_url : null;
  const drama = m.a_voir || {};
  return `<article class="drama-card" style="cursor:default;">
    <div class="card-row" style="align-items:flex-start;">
      ${avatar
        ? `<img src="${esc(avatar)}" class="tr-person-avatar" style="width:56px;height:56px;cursor:pointer;object-fit:cover;" data-open-profil="${esc(m.user_id)}">`
        : `<div class="stamp mini motif-flower" style="width:56px;height:56px;cursor:pointer;" data-open-profil="${esc(m.user_id)}">${FLOWER_MOTIF_SVG}</div>`}
      <div class="card-main">
        <p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(m.user_id)}">${esc(pseudo)}</p>
        <p class="cast" style="margin-top:1px;">veut voir <b style="color:var(--blue-deep);">${esc(drama.titre || "un drama")}</b>${drama.annee ? ` (${esc(drama.annee)})` : ""}</p>
      </div>
      ${drama.poster_url ? `<img src="${esc(drama.poster_url)}" class="tr-person-avatar" style="width:56px;height:76px;border-radius:4px;object-fit:cover;">` : ""}
    </div>
  </article>`;
}

// Carte "X a créé une tierlist Y" dans le fil. Donne un accès direct
// à la modal de visionnage (qui inclut désormais les commentaires) —
// c'est là que se fait l'interaction, pas directement depuis la carte
// du fil (pour rester cohérent avec le gabarit commun demandé).
export function tierlistActiviteCardHtml(t) {
  const pseudo = t.profils ? t.profils.pseudo : "Utilisateur supprimé";
  const avatar = t.profils ? t.profils.avatar_url : null;
  const likeCount = getTierlistLikeCount(t.id);
  return `<article class="drama-card" data-view-tierlist="${esc(t.id)}">
    <div class="card-row" style="align-items:flex-start;">
      ${avatar
        ? `<img src="${esc(avatar)}" class="tr-person-avatar" style="width:56px;height:56px;cursor:pointer;object-fit:cover;" data-open-profil="${esc(t.user_id)}" data-stop-propagation="1">`
        : `<div class="stamp mini motif-flower" style="width:56px;height:56px;cursor:pointer;" data-open-profil="${esc(t.user_id)}" data-stop-propagation="1">${FLOWER_MOTIF_SVG}</div>`}
      <div class="card-main">
        <p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(t.user_id)}" data-stop-propagation="1">${esc(pseudo)}</p>
        <p class="cast" style="margin-top:1px;">a créé la tierlist <b style="color:var(--blue-deep);">${esc(t.titre)}</b>${t.theme ? ` · ${esc(t.theme)}` : ""}</p>
      </div>
      <span class="tr-rank">▦</span>
    </div>
    <div class="card-actions" style="margin-top:10px;">
      <span class="text-btn" style="cursor:default;">${likeCount > 0 ? `♥ ${likeCount}` : "♡"}</span>
      <span class="text-btn" style="cursor:default;">👁 Voir et commenter</span>
    </div>
  </article>`;
}

// Carte "X a rejoint le carnet" : seule façon de découvrir un compte
// tout juste créé, qui n'a encore aucune activité (avis, tierlist...)
// donc n'apparaîtrait jamais autrement dans le fil.
export function inscriptionActiviteCardHtml(p) {
  const dejaAbonne = isFollowing(p.id);
  const estMoi = p.id === currentUserId();
  return `<article class="drama-card" style="cursor:default;">
    <div class="card-row" style="align-items:flex-start;">
      ${p.avatar_url
        ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar" style="width:56px;height:56px;cursor:pointer;object-fit:cover;" data-open-profil="${esc(p.id)}">`
        : `<div class="stamp mini motif-flower" style="width:56px;height:56px;cursor:pointer;" data-open-profil="${esc(p.id)}">${FLOWER_MOTIF_SVG}</div>`}
      <div class="card-main">
        <p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(p.id)}">${esc(p.pseudo)}</p>
        <p class="cast" style="margin-top:1px;">🌱 a rejoint le carnet</p>
      </div>
      ${!estMoi ? `<button class="ghost-btn" style="flex:0; padding:8px 14px; ${dejaAbonne ? "border-color:var(--seal); color:var(--seal);" : ""}" data-follow-id="${esc(p.id)}">${dejaAbonne ? "Abonné(e)" : "Suivre"}</button>` : ""}
    </div>
  </article>`;
}

// Carte "X a gagné [acteur]" : activité publique liée au système de
// cadeaux (tenterGagnerCadeau), affichée avec la photo de l'acteur
// gagné — demandé explicitement, à la différence des autres cartes
// qui montrent surtout l'avatar de l'utilisateur.
export function cadeauActiviteCardHtml(c) {
  const pseudo = c.profil_gagnant ? c.profil_gagnant.pseudo : "Quelqu'un";
  const p = c.personnes;
  const liked = hasLikedCadeau(c.id);
  const likeCount = getLikeCadeauCount(c.id);
  const commentCount = getCadeauCommentCount(c.id);
  return `<article class="drama-card" style="cursor:default;">
    <div class="card-row" style="align-items:flex-start;">
      <img src="${esc(p.photo_url)}" class="tr-person-avatar" style="width:56px;height:56px;object-fit:cover; cursor:pointer;" data-person-name="${esc(p.nom)}" data-person-role="${esc(p.role)}">
      <div class="card-main">
        ${c.profil_gagnant ? `<p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(c.profil_gagnant.id)}">${esc(pseudo)}</p>` : `<p class="tr-person-name">${esc(pseudo)}</p>`}
        <p class="cast" style="margin-top:1px;">🎁 a gagné <b style="color:var(--blue-deep); cursor:pointer;" data-person-name="${esc(p.nom)}" data-person-role="${esc(p.role)}">${esc(p.nom)}</b></p>
      </div>
      <span class="tr-rank">🏆</span>
    </div>
    <div class="card-actions" style="margin-top:10px;">
      <button class="text-btn" data-toggle-like-cadeau="${esc(c.id)}" data-owner-id="${esc(c.user_id)}" data-titre="${esc(p.nom)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">
        ${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}
      </button>
      <button class="text-btn" data-open-comments-cadeau="${esc(c.id)}" data-owner-id="${esc(c.user_id)}" data-titre="${esc(p.nom)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
    </div>
  </article>`;
}

export function renderCommunauteView() {
  if (!isLoggedIn()) {
    return `<div class="trends-wrap"><div class="empty-state">
      <p>Connecte-toi pour voir le fil de la communauté, publier des avis et suivre d'autres fans.</p>
      <button class="primary-btn" id="goToAuthBtn" style="margin-top:6px;">Se connecter / S'inscrire</button>
    </div></div>`;
  }

  const entries = getFeedEntries();
  let html = `<main class="kt-list" style="padding-top:14px;">`;

  if (entries.length === 0) {
    html += `<div class="empty-state"><p>Aucune activité pour l'instant.</p></div>`;
  } else {
    html += entries.map(activiteCardHtml).join("");
  }
  html += `</main>`;
  return html;
}

// ---- onglet "Abonnements" : tout ce qui touche au réseau social,
// auparavant éparpillé en boutons en haut du Fil (regroupé ici pour
// plus de clarté — voir la refonte de la navigation Communauté).
export function renderAbonnementsView() {
  if (!isLoggedIn()) {
    return `<div class="trends-wrap"><div class="empty-state">
      <p>Connecte-toi pour gérer tes abonnements et découvrir d'autres fans.</p>
      <button class="primary-btn" id="goToAuthFromAbonnementsBtn" style="margin-top:6px;">Se connecter / S'inscrire</button>
    </div></div>`;
  }
  const uid = currentUserId();
  const nouveaux = (state.nouveauxInscrits || []).filter((p) => p.id !== uid);
  return `<div class="trends-wrap">
    <section class="tr-section">
      <div class="modal-stat-row" style="margin:0 0 14px;">
        <div class="modal-stat" style="cursor:pointer;" data-voir-liste-abonnes="${esc(uid)}:abonnes"><span class="v">${getFollowerCount(uid)}</span><span class="l">Abonnés</span></div>
        <div class="modal-stat" style="cursor:pointer;" data-voir-liste-abonnes="${esc(uid)}:abonnements"><span class="v">${getFollowingCount(uid)}</span><span class="l">Abonnements</span></div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="ghost-btn" id="ouvrirEnviesAbonnesBtn" style="width:100%;">🎁 Envies de mes abonnements</button>
        <button class="ghost-btn" id="ouvrirRechercheProfilBtn" style="width:100%;">🔍 Rechercher un profil</button>
      </div>
    </section>
    <section class="tr-section">
      <h2 class="tr-title">Nouveaux membres</h2>
      ${nouveaux.length === 0 ? `<p class="tr-note">Personne de nouveau pour l'instant.</p>` : nouveaux.map(inscriptionActiviteCardHtml).join("")}
    </section>
  </div>`;
}

// ---- onglet "Jeux" : page d'accueil regroupant Quiz du jour, OST
// Challenge et Tierlists (auparavant 3 boutons distincts du subnav
// Communauté, plus "Deezer" qui est désormais retiré — voir le
// mini-lecteur flottant persistant qui couvre déjà cet usage).
export function renderJeuxView() {
  const nbCadeaux = (state.maCollectionActeurs || []).length;
  return `<div class="trends-wrap">
    <section class="tr-section" style="display:flex; flex-direction:column; gap:9px;">
      <button class="jeu-card" data-tab="quiz">
        <span class="jeu-card-icon" style="background:var(--celadon-soft);">🧠</span>
        <span class="jeu-card-info"><span class="jeu-card-titre">Quiz du jour</span><span class="jeu-card-sub">Un nouveau défi chaque jour</span></span>
        <span class="jeu-card-chevron">›</span>
      </button>
      <button class="jeu-card" data-tab="ost">
        <span class="jeu-card-icon" style="background:var(--gold-soft);">🎵</span>
        <span class="jeu-card-info"><span class="jeu-card-titre">OST Challenge</span><span class="jeu-card-sub">Reconnais la bande-son</span></span>
        <span class="jeu-card-chevron">›</span>
      </button>
      <button class="jeu-card" data-tab="tierlists">
        <span class="jeu-card-icon" style="background:var(--seal-soft);">▦</span>
        <span class="jeu-card-info"><span class="jeu-card-titre">Tierlists</span><span class="jeu-card-sub">Classe tes acteurs préférés</span></span>
        <span class="jeu-card-chevron">›</span>
      </button>
      ${isLoggedIn() ? `<button class="jeu-card" id="ouvrirCollectionBtn">
        <span class="jeu-card-icon" style="background:var(--paper-sunken);">🏆</span>
        <span class="jeu-card-info"><span class="jeu-card-titre">Ma collection</span><span class="jeu-card-sub">${nbCadeaux} acteur${nbCadeaux === 1 ? "" : "s"} gagné${nbCadeaux === 1 ? "" : "s"}</span></span>
        <span class="jeu-card-chevron">›</span>
      </button>` : ""}
    </section>
  </div>`;
}

export function renderProfilPublicView() {
  const d = state.profilPublicData;
  if (!d) return `<div class="trends-wrap"><div class="empty-state"><p>Chargement du profil…</p></div></div>`;
  const { profil, avisDuProfil, tierlistsDuProfil, entriesDuProfil, aVoirDuProfil, trendsDuProfil, collectionDuProfil, quizDuProfil, ostDuProfil, profilSubTab } = d;
  const isMe = profil.id === currentUserId();
  const ratedEntries = entriesDuProfil.filter((e) => e.note !== null && e.note !== undefined);
  const note_avg = ratedEntries.length ? ratedEntries.reduce((s, e) => s + Number(e.note), 0) / ratedEntries.length : null;
  const subTab = profilSubTab || "vus";

  const subnavHtml = `<div class="subnav" style="padding:0 0 14px;">
    <button class="${subTab === "vus" ? "active" : ""}" data-profil-subtab="vus">Vus (${entriesDuProfil.length})</button>
    <button class="${subTab === "a-voir" ? "active" : ""}" data-profil-subtab="a-voir">À voir (${aVoirDuProfil.length})</button>
    <button class="${subTab === "tendances" ? "active" : ""}" data-profil-subtab="tendances">Tendances</button>
    <button class="${subTab === "avis" ? "active" : ""}" data-profil-subtab="avis">Avis (${avisDuProfil.length})</button>
    <button class="${subTab === "tierlists" ? "active" : ""}" data-profil-subtab="tierlists">Tierlists</button>
    <button class="${subTab === "cadeaux" ? "active" : ""}" data-profil-subtab="cadeaux">🎁 Cadeaux (${collectionDuProfil.length})</button>
    <button class="${subTab === "jeux" ? "active" : ""}" data-profil-subtab="jeux">Jeux (${quizDuProfil.length + ostDuProfil.length})</button>
  </div>`;

  let contentHtml = "";
  if (subTab === "vus") {
    contentHtml = entriesDuProfil.length === 0 ? `<p class="tr-note">Aucun drama vu pour l'instant.</p>` : entriesDuProfil
      .slice().sort((a, b) => (b.note || 0) - (a.note || 0))
      .map((dr) => {
        const liked = hasLikedVisionnage(dr.visionnage_id);
        const likeCount = getVisionnageLikeCount(dr.visionnage_id);
        const commentCount = getVisionnageCommentCount(dr.visionnage_id);
        return `<div style="margin-bottom:9px;">
          <article class="drama-card" data-drama-titre="${esc(dr.titre)}" style="margin-bottom:0; border-radius:12px 12px 0 0;">
            <div class="card-row">
              ${dr.poster_url ? `<img src="${esc(dr.poster_url)}" alt="" class="poster-thumb">` : stampHtml(dr.note, false)}
              <div class="card-main">
                <h2>${esc(dr.titre)}${dr.annee ? `<span class="year"> · ${esc(dr.annee)}</span>` : ""}</h2>
                <p class="cast" data-stop-propagation="1">${[castingLinksHtml(dr.acteur, "acteur"), castingLinksHtml(dr.actrice, "actrice")].filter(Boolean).join("  ·  ") || "Casting non renseigné"}</p>
              </div>
              ${dr.poster_url ? stampHtml(dr.note, true) : ""}
            </div>
          </article>
          <div class="card-actions" style="background:var(--paper-raised); border:1px solid var(--line); border-top:none; border-radius:0 0 12px 12px; padding:8px 14px; margin-top:-1px;">
            <button class="text-btn" data-toggle-like-visionnage="${esc(dr.visionnage_id)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(dr.titre)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
            <button class="text-btn" data-open-comments-visionnage="${esc(dr.visionnage_id)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(dr.titre)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
          </div>
        </div>`;
      }).join("");
  } else if (subTab === "a-voir") {
    contentHtml = aVoirDuProfil.length === 0 ? `<p class="tr-note">Aucune envie enregistrée.</p>` : aVoirDuProfil.map((dr) => {
      const liked = hasLikedAVoir(dr.mes_a_voir_id);
      const likeCount = getAVoirLikeCount(dr.mes_a_voir_id);
      const commentCount = getAVoirCommentCount(dr.mes_a_voir_id);
      return `<div style="margin-bottom:9px;">
        <article class="drama-card" data-drama-titre="${esc(dr.titre)}" style="margin-bottom:0; border-radius:12px 12px 0 0;">
          <div class="card-row">
            ${dr.poster_url ? `<img src="${esc(dr.poster_url)}" alt="" class="poster-thumb">` : `<div class="stamp empty motif-flower">${FLOWER_MOTIF_SVG}</div>`}
            <div class="card-main">
              <h2>${esc(dr.titre)}${dr.annee ? `<span class="year"> · ${esc(dr.annee)}</span>` : ""}</h2>
              <p class="cast" data-stop-propagation="1">${[castingLinksHtml(dr.acteur, "acteur"), castingLinksHtml(dr.actrice, "actrice")].filter(Boolean).join("  ·  ") || "Casting non renseigné"}</p>
            </div>
          </div>
        </article>
        <div class="card-actions" style="background:var(--paper-raised); border:1px solid var(--line); border-top:none; border-radius:0 0 12px 12px; padding:8px 14px; margin-top:-1px;">
          <button class="text-btn" data-toggle-like-a-voir="${esc(dr.mes_a_voir_id)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(dr.titre)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
          <button class="text-btn" data-open-comments-a-voir="${esc(dr.mes_a_voir_id)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(dr.titre)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
        </div>
      </div>`;
    }).join("");
  } else if (subTab === "tendances") {
    const tLiked = hasLikedTendances(profil.id);
    const tLikeCount = getTendancesLikeCount(profil.id);
    const tCommentCount = getTendancesCommentCount(profil.id);
    const tendancesActionsHtml = `<div class="card-actions" style="background:var(--paper-raised); border:1px solid var(--line); border-radius:12px; padding:8px 14px; margin-bottom:14px;">
      <button class="text-btn" data-toggle-like-tendances="${esc(profil.id)}" data-titre="Tendances de ${esc(profil.pseudo)}" style="${tLiked ? "color:var(--seal); font-weight:600;" : ""}">${tLiked ? "♥" : "♡"} ${tLikeCount > 0 ? tLikeCount : ""}</button>
      <button class="text-btn" data-open-comments-tendances="${esc(profil.id)}" data-titre="Tendances de ${esc(profil.pseudo)}">💬 ${tCommentCount > 0 ? tCommentCount : ""}</button>
    </div>`;
    if (!trendsDuProfil || !trendsDuProfil.records) {
      contentHtml = tendancesActionsHtml + `<p class="tr-note">Pas encore assez de dramas notés pour calculer des tendances.</p>`;
    } else {
      contentHtml = tendancesActionsHtml + renderTrendsSections(trendsDuProfil, entriesDuProfil, profil.id);
    }
  } else if (subTab === "avis") {
    contentHtml = avisDuProfil.length === 0 ? `<p class="tr-note">Aucun avis publié.</p>` : avisDuProfil.map(avisCardHtml).join("");
  } else if (subTab === "tierlists") {
    contentHtml = tierlistsDuProfil.length === 0 ? `<p class="tr-note">Aucune tierlist publique.</p>` : tierlistsDuProfil.map((t) => `
      <div class="tr-person-row" data-view-tierlist="${esc(t.id)}">
        <span class="tr-rank">▦</span>
        <div class="tr-person-info"><p class="tr-person-name">${esc(t.titre)}</p><p class="tr-person-sub">${esc(t.theme || "")}</p></div>
      </div>`).join("");
  } else if (subTab === "cadeaux") {
    contentHtml = collectionDuProfil.length === 0 ? `<p class="tr-note">Aucun cadeau gagné pour l'instant.</p>` : `
      <div class="collection-grid">
        ${collectionDuProfil.map((c) => {
          const liked = hasLikedCadeau(c.id);
          const likeCount = getLikeCadeauCount(c.id);
          const commentCount = getCadeauCommentCount(c.id);
          return `
          <div>
            <div class="collection-item" data-person-name="${esc(c.personnes.nom)}" data-person-role="${esc(c.personnes.role)}">
              <img src="${esc(c.personnes.photo_url)}" alt="${esc(c.personnes.nom)}">
              <p>${esc(c.personnes.nom)}</p>
            </div>
            <div style="display:flex; justify-content:center; gap:10px; margin-top:4px;">
              <button class="text-btn" data-toggle-like-cadeau="${esc(c.id)}" data-owner-id="${esc(c.user_id)}" data-titre="${esc(c.personnes.nom)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
              <button class="text-btn" data-open-comments-cadeau="${esc(c.id)}" data-owner-id="${esc(c.user_id)}" data-titre="${esc(c.personnes.nom)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
            </div>
          </div>`;
        }).join("")}
      </div>`;
  } else if (subTab === "jeux") {
    const quizRows = quizDuProfil.map((q) => ({ kind: "quiz", id: q.id, date: q.date_quiz, detail: `${q.bonnes_reponses}/${q.total_questions} bonnes réponses`, score: `${q.score_total} pts`, icon: "🧠" }));
    const ostRows = ostDuProfil.map((o) => ({ kind: "ost", id: o.id, date: o.date_partie, detail: o.mode || "OST Challenge", score: `${o.score} pts`, icon: "🎵" }));
    const toutesLesParties = [...quizRows, ...ostRows].sort((a, b) => new Date(b.date) - new Date(a.date));
    contentHtml = toutesLesParties.length === 0 ? `<p class="tr-note">Aucune partie jouée pour l'instant.</p>` : toutesLesParties.map((p) => {
      const liked = hasLikedJeu(p.kind, p.id);
      const likeCount = getJeuLikeCount(p.kind, p.id);
      const commentCount = getJeuCommentCount(p.kind, p.id);
      const titreJeu = p.kind === "quiz" ? "Quiz du jour" : "OST Challenge";
      return `<div style="margin-bottom:9px;">
        <div class="tr-person-row" style="margin-bottom:0; border-radius:12px 12px 0 0; cursor:default;">
          <span class="tr-rank">${p.icon}</span>
          <div class="tr-person-info"><p class="tr-person-name">${esc(titreJeu)} · ${formatDateFr(typeof p.date === "string" && p.date.includes("T") ? p.date.slice(0, 10) : p.date)}</p><p class="tr-person-sub">${esc(p.detail)}</p></div>
          <span class="tr-person-score">${esc(p.score)}</span>
        </div>
        <div class="card-actions" style="background:var(--paper-raised); border:1px solid var(--line); border-top:none; border-radius:0 0 12px 12px; padding:8px 14px; margin-top:-1px;">
          <button class="text-btn" data-toggle-like-jeu="${esc(p.id)}" data-jeu-kind="${esc(p.kind)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(titreJeu)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
          <button class="text-btn" data-open-comments-jeu="${esc(p.id)}" data-jeu-kind="${esc(p.kind)}" data-owner-id="${esc(profil.id)}" data-titre="${esc(titreJeu)}">💬 ${commentCount > 0 ? commentCount : ""}</button>
        </div>
      </div>`;
    }).join("");
  }

  return `<div class="trends-wrap">
    ${state.profilRetourTab ? `<button class="text-btn" id="profilRetourBtn" style="margin-bottom:10px; font-weight:600;">← Retour</button>` : ""}
    <section class="tr-section">
      <div class="profil-header-card">
        <div class="profil-header-top">
          ${isMe ? `
          <label class="avatar-upload-zone">
            ${profil.avatar_url ? `<img src="${esc(profil.avatar_url)}" class="profil-avatar">` : `<div class="stamp motif-flower profil-avatar" style="display:flex;align-items:center;justify-content:center;">${FLOWER_MOTIF_SVG}</div>`}
            <span class="avatar-upload-badge">${state.imageProcessing ? "…" : "📷"}</span>
            <input type="file" accept="image/*" style="display:none" id="avatarUploadInput">
          </label>` : `
          ${profil.avatar_url ? `<img src="${esc(profil.avatar_url)}" class="profil-avatar">` : `<div class="stamp motif-flower profil-avatar" style="display:flex;align-items:center;justify-content:center;">${FLOWER_MOTIF_SVG}</div>`}`}
          <div class="profil-header-info">
            <h3 class="profil-pseudo">${esc(profil.pseudo)}</h3>
            ${profil.bio ? `<p class="profil-bio">${esc(profil.bio)}</p>` : profil.created_at ? `<p class="profil-bio">Membre depuis ${new Date(profil.created_at).getFullYear()}</p>` : ""}
          </div>
          ${!isMe ? `<button class="profil-follow-btn ${isFollowing(profil.id) ? "is-following" : ""}" data-follow-id="${esc(profil.id)}">${isFollowing(profil.id) ? "Abonné(e)" : "Suivre"}</button>` : `<button class="profil-follow-btn" id="logoutBtn">Déconnexion</button>`}
        </div>
        <div class="profil-stats-grid">
          <div class="profil-stat" style="background:var(--celadon-soft);"><span class="v">${entriesDuProfil.length}</span><span class="l">Vus</span></div>
          <div class="profil-stat" style="background:var(--gold-soft);"><span class="v">${fmtNote(note_avg)}</span><span class="l">Note moy.</span></div>
          <div class="profil-stat" style="background:var(--seal-soft); cursor:pointer;" data-voir-liste-abonnes="${esc(profil.id)}:abonnes"><span class="v">${getFollowerCount(profil.id)}</span><span class="l">Abonnés</span></div>
          <div class="profil-stat" style="background:var(--celadon-soft); cursor:pointer;" data-voir-liste-abonnes="${esc(profil.id)}:abonnements"><span class="v">${getFollowingCount(profil.id)}</span><span class="l">Abonnements</span></div>
        </div>
        ${isMe ? `
        <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--line);">
          ${state.pushPermissionStatus === "granted" ? `
            <button class="text-btn" id="desactiverPushBtn">🔕 Désactiver les notifications sur cet appareil</button>
          ` : state.pushPermissionStatus === "denied" ? `
            <p class="tr-note" style="margin:0;">🔕 Notifications bloquées — réactive-les dans les réglages de ton navigateur si tu changes d'avis.</p>
          ` : state.pushPermissionStatus === "unsupported" ? `
            <p class="tr-note" style="margin:0;">Les notifications ne sont pas prises en charge sur cet appareil/navigateur.</p>
          ` : `
            <button class="text-btn" id="activerPushBtn" style="font-weight:600; color:var(--blue-deep);">🔔 Activer les notifications sur ce téléphone</button>
          `}
        </div>` : ""}
      </div>
    </section>
    <section class="tr-section">
      ${subnavHtml}
      ${contentHtml}
    </section>
  </div>`;
}

export function renderComposerSheet() {
  if (!state.composerOpen) return "";
  const dramaOptions = state.entries.map((d) => `<option value="${esc(d.id)}" ${state.composerDramaId === d.id ? "selected" : ""}>${esc(d.titre)}${d.annee ? ` (${esc(d.annee)})` : ""}</option>`).join("");
  return `<div class="sheet-overlay" id="composerOverlay">
    <div class="sheet" id="composerSheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>Nouvel avis</h3>
        <button class="icon-btn" id="composerClose">✕</button>
      </div>
      <div class="sheet-body">
        <label>Drama
          <select id="composer-drama" style="border:1px solid var(--line); background:var(--paper-raised); border-radius:3px; border-width:2px; padding:10px 11px; font-size:14.5px; font-family:inherit;">
            <option value="">— Choisir —</option>
            ${dramaOptions}
          </select>
        </label>
        <label>Note /10 (optionnelle)<input id="composer-note" type="number" inputmode="decimal" step="0.5" min="0" max="10" value="${esc(state.composerNote)}"></label>
        <label>Ton avis<input id="composer-commentaire" value="${esc(state.composerCommentaire)}" placeholder="Qu'as-tu pensé de ce drama ?"></label>
      </div>
      <div class="sheet-footer">
        <button class="ghost-btn" id="composerCancel">Annuler</button>
        <button class="primary-btn" id="composerSave">Publier</button>
      </div>
    </div>
  </div>`;
}

export function attachCommunauteListeners() {
  const ouvrirEnviesAbonnesBtn = document.getElementById("ouvrirEnviesAbonnesBtn");
  if (ouvrirEnviesAbonnesBtn) ouvrirEnviesAbonnesBtn.addEventListener("click", ouvrirEnviesAbonnes);
  const enviesAbonnesClose = document.getElementById("enviesAbonnesClose");
  if (enviesAbonnesClose) enviesAbonnesClose.addEventListener("click", fermerEnviesAbonnes);
  const enviesAbonnesOverlay = document.getElementById("enviesAbonnesOverlay");
  if (enviesAbonnesOverlay) {
    enviesAbonnesOverlay.addEventListener("click", (e) => { if (e.target === enviesAbonnesOverlay) fermerEnviesAbonnes(); });
  }
  document.querySelectorAll("[data-piocher-envie]").forEach((btn) => {
    btn.addEventListener("click", () => piocherEnvieAbonne(btn.dataset.piocherEnvie));
  });
  document.querySelectorAll("[data-toggle-like]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeAvis(btn.dataset.toggleLike, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-toggle-like-cadeau]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeCadeau(btn.dataset.toggleLikeCadeau, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-cadeau]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry("cadeau", btn.dataset.openCommentsCadeau, btn.dataset.titre, btn.dataset.ownerId));
  });
  document.querySelectorAll("[data-delete-avis]").forEach((btn) => {
    btn.addEventListener("click", () => supprimerAvis(btn.dataset.deleteAvis));
  });
  document.querySelectorAll("[data-open-profil]").forEach((el) => {
    el.addEventListener("click", () => openProfilPublic(el.dataset.openProfil));
  });
  document.querySelectorAll("[data-follow-id]").forEach((btn) => {
    btn.addEventListener("click", () => toggleFollow(btn.dataset.followId));
  });
  document.querySelectorAll("[data-profil-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.profilPublicData) return;
      setState({ profilPublicData: { ...state.profilPublicData, profilSubTab: btn.dataset.profilSubtab } });
    });
  });
  document.querySelectorAll("[data-voir-liste-abonnes]").forEach((el) => {
    el.addEventListener("click", () => {
      const [profilId, mode] = el.dataset.voirListeAbonnes.split(":");
      ouvrirListeAbonnes(profilId, mode);
    });
  });
  const listeAbonnesClose = document.getElementById("listeAbonnesClose");
  if (listeAbonnesClose) listeAbonnesClose.addEventListener("click", fermerListeAbonnes);
  const listeAbonnesOverlay = document.getElementById("listeAbonnesOverlay");
  if (listeAbonnesOverlay) {
    listeAbonnesOverlay.addEventListener("click", (e) => { if (e.target === listeAbonnesOverlay) fermerListeAbonnes(); });
  }
  document.querySelectorAll("[data-open-profil-liste]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.openProfilListe;
      setState({ listeAbonnesModal: null });
      openProfilPublic(id);
    });
  });
  document.querySelectorAll("[data-toggle-like-visionnage]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeVisionnage(btn.dataset.toggleLikeVisionnage, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-visionnage]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry("visionnage", btn.dataset.openCommentsVisionnage, btn.dataset.titre, btn.dataset.ownerId));
  });
  document.querySelectorAll("[data-toggle-like-a-voir]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeAVoir(btn.dataset.toggleLikeAVoir, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-a-voir]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry("a_voir", btn.dataset.openCommentsAVoir, btn.dataset.titre, btn.dataset.ownerId));
  });
  document.querySelectorAll("[data-toggle-like-tendances]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeTendances(btn.dataset.toggleLikeTendances, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-tendances]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry("tendances", btn.dataset.openCommentsTendances, btn.dataset.titre, btn.dataset.openCommentsTendances));
  });
  document.querySelectorAll("[data-toggle-like-valeur-sure]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeValeurSure(btn.dataset.ownerId, btn.dataset.toggleLikeValeurSure, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-valeur-sure]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry("valeurs_sures", btn.dataset.openCommentsValeurSure, btn.dataset.titre, btn.dataset.ownerId));
  });
  document.querySelectorAll("[data-toggle-like-jeu]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeJeu(btn.dataset.jeuKind, btn.dataset.toggleLikeJeu, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-open-comments-jeu]").forEach((btn) => {
    btn.addEventListener("click", () => ouvrirCommentairesEntry(btn.dataset.jeuKind, btn.dataset.openCommentsJeu, btn.dataset.titre, btn.dataset.ownerId));
  });
  const entryCommentClose = document.getElementById("entryCommentClose");
  if (entryCommentClose) entryCommentClose.addEventListener("click", fermerCommentairesEntry);
  const entryCommentOverlay = document.getElementById("entryCommentOverlay");
  if (entryCommentOverlay) {
    entryCommentOverlay.addEventListener("click", (e) => { if (e.target === entryCommentOverlay) fermerCommentairesEntry(); });
  }
  const entryCommentInput = document.getElementById("entry-comment-input");
  if (entryCommentInput) entryCommentInput.addEventListener("input", (e) => { if (state.entryCommentModal) state.entryCommentModal.draft = e.target.value; });
  const entryCommentSubmitBtn = document.getElementById("entryCommentSubmitBtn");
  if (entryCommentSubmitBtn) entryCommentSubmitBtn.addEventListener("click", publierCommentaireEntry);
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  const profilRetourBtn = document.getElementById("profilRetourBtn");
  if (profilRetourBtn) {
    profilRetourBtn.addEventListener("click", () => {
      setState({ activeTab: state.profilRetourTab || "communaute" });
    });
  }
  const activerPushBtn = document.getElementById("activerPushBtn");
  if (activerPushBtn) activerPushBtn.addEventListener("click", activerNotificationsPush);
  const desactiverPushBtn = document.getElementById("desactiverPushBtn");
  if (desactiverPushBtn) desactiverPushBtn.addEventListener("click", desactiverNotificationsPush);
  const pushPromptActiverBtn = document.getElementById("pushPromptActiverBtn");
  if (pushPromptActiverBtn) pushPromptActiverBtn.addEventListener("click", activerNotificationsPush);
  const pushPromptPlusTardBtn = document.getElementById("pushPromptPlusTardBtn");
  if (pushPromptPlusTardBtn) pushPromptPlusTardBtn.addEventListener("click", dismissPushPrompt);
  const avatarUploadInput = document.getElementById("avatarUploadInput");
  if (avatarUploadInput) {
    avatarUploadInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) uploadAvatar(file);
    });
  }
  const goToAuthBtn = document.getElementById("goToAuthBtn");
  if (goToAuthBtn) goToAuthBtn.addEventListener("click", () => setState({ showAuthModal: true }));

  // Composer
  const composerOverlay = document.getElementById("composerOverlay");
  if (composerOverlay) composerOverlay.addEventListener("click", (e) => { if (e.target === composerOverlay) closeComposer(); });
  const composerClose = document.getElementById("composerClose");
  if (composerClose) composerClose.addEventListener("click", closeComposer);
  const composerCancel = document.getElementById("composerCancel");
  if (composerCancel) composerCancel.addEventListener("click", closeComposer);
  const composerSave = document.getElementById("composerSave");
  if (composerSave) composerSave.addEventListener("click", () => avecBoutonDesactive("composerSave", "Publication…", publierAvis));
  const composerDrama = document.getElementById("composer-drama");
  if (composerDrama) composerDrama.addEventListener("change", (e) => { state.composerDramaId = e.target.value; });
  const composerNote = document.getElementById("composer-note");
  if (composerNote) composerNote.addEventListener("input", (e) => { state.composerNote = e.target.value; });
  const composerCommentaire = document.getElementById("composer-commentaire");
  if (composerCommentaire) composerCommentaire.addEventListener("input", (e) => { state.composerCommentaire = e.target.value; });
}






