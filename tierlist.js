// ============================================================
// MODULE TIERLISTS — extrait de index.html (Kdramatrics)
// Création de classements S/A/B/C/D, drag-and-drop, partage, likes,
// commentaires, modale de visualisation.
// Dépend de main.js pour l'état global et les helpers partagés.
// ============================================================

import { state, setState, esc, showToast, sb, isLoggedIn, currentUserId, render, avecBoutonDesactive, findPersonPhoto, splitPeople, FLOWER_MOTIF_SVG } from './main.js';
import { stampHtml } from './catalogue.js';
import { tenterGagnerCadeau } from './social.js';

export function renderTierlistViewerModal() {
  return `<div class="modal-overlay" id="tierlistViewerOverlay">
    <div class="modal-sheet" id="tierlistViewerSheet">
      <div class="modal-handle"></div>
      <div class="modal-header" style="padding:0 18px;">
        <div style="flex:1;"></div>
        <button class="icon-btn" id="tierlistViewerClose">✕</button>
      </div>
      <div class="modal-body">${state.tierlistViewerHtml}</div>
    </div>
  </div>`;
}
export function attachTierlistViewerListeners() {
  const fermerViewer = () => setState({ tierlistViewerOpen: false, tierlistViewerId: null, tierlistCommentDraft: "", tierlistCommentNote: "" });
  const overlay = document.getElementById("tierlistViewerOverlay");
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) fermerViewer(); });
  const closeBtn = document.getElementById("tierlistViewerClose");
  if (closeBtn) closeBtn.addEventListener("click", fermerViewer);

  const commentInput = document.getElementById("tierlist-comment-input");
  if (commentInput) commentInput.addEventListener("input", (e) => { state.tierlistCommentDraft = e.target.value; });
  const commentNoteInput = document.getElementById("tierlist-comment-note");
  if (commentNoteInput) commentNoteInput.addEventListener("input", (e) => { state.tierlistCommentNote = e.target.value; });
  const commentSubmitBtn = document.getElementById("tierlistCommentSubmitBtn");
  if (commentSubmitBtn) commentSubmitBtn.addEventListener("click", publierTierlistComment);
  document.querySelectorAll("[data-toggle-like-comment]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeTierlistComment(btn.dataset.toggleLikeComment));
  });
  document.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", () => supprimerTierlistComment(btn.dataset.deleteComment));
  });
}
/* ============================================================
   MODULE TIERLISTS
   Création de classements S/A/B/C/D, drag-and-drop, partage, likes.
   ============================================================ */

export const NIVEAUX = ["S", "A", "B", "C", "D"];
export const NIVEAU_COLORS = { S: "var(--seal)", A: "var(--gold)", B: "var(--celadon)", C: "var(--ink-soft)", D: "var(--ink-faint)" };

// Palette générique pour les tierlists à niveaux personnalisés (pas S/A/B/C/D).
// Utilisée dans l'ordre, une couleur par position — jusqu'à 7 niveaux distincts.
export const PALETTE_NIVEAUX_PERSO = ["var(--seal)", "var(--gold)", "var(--celadon)", "var(--blue-deep)", "var(--pink-deep)", "var(--ink-soft)", "var(--ink-faint)"];

// ---- chargement ----
export async function loadTierlists() {
  try {
    let query = sb.from("tierlists").select("*, profils(pseudo, avatar_url)").order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    // RLS filtre déjà : publiques pour tous + privées si propriétaire.
    state.tierlists = data || [];
  } catch (e) {
    console.error("Erreur chargement tierlists", e);
    state.tierlists = [];
  }
  try {
    const { data, error } = await sb.from("tierlist_likes").select("tierlist_id, user_id");
    if (error) throw error;
    state.tierlistLikes = data || [];
  } catch (e) {
    state.tierlistLikes = [];
  }
}

// Retourne { items, error }. IMPORTANT : en cas d'erreur réseau, on ne
// doit JAMAIS retourner un tableau vide silencieusement — openTierlistBuilder()
// croirait alors que la tierlist n'a aucun contenu, proposerait un
// nouveau pool à classer, et un enregistrement ultérieur EFFACERAIT
// les vrais items existants en base (sauvegarderTierlistBuilder fait
// un DELETE complet puis ré-insère uniquement ce qui a été chargé).
// C'est la cause d'un bug réel signalé : des dramas déjà classés
// disparaissant après réouverture d'une tierlist.
export async function loadItemsForTierlist(tierlistId) {
  try {
    const { data, error } = await sb.from("tierlist_items").select("*").eq("tierlist_id", tierlistId).order("position", { ascending: true });
    if (error) throw error;
    return { items: data || [], error: null };
  } catch (e) {
    console.error(e);
    return { items: [], error: e };
  }
}

export function getTierlistLikeCount(tierlistId) {
  return state.tierlistLikes.filter((l) => l.tierlist_id === tierlistId).length;
}
export function hasLikedTierlist(tierlistId) {
  const uid = currentUserId();
  if (!uid) return false;
  return state.tierlistLikes.some((l) => l.tierlist_id === tierlistId && l.user_id === uid);
}

// ---- commentaires de tierlist ----
export async function chargerTierlistComments(tierlistId) {
  try {
    const { data, error } = await sb
      .from("tierlist_comments")
      .select("*, profils(pseudo, avatar_url)")
      .eq("tierlist_id", tierlistId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.tierlistComments = data || [];
  } catch (e) {
    console.error("Erreur chargement commentaires tierlist", e);
    state.tierlistComments = [];
  }
  try {
    const { data, error } = await sb.from("tierlist_comment_likes").select("comment_id, user_id");
    if (error) throw error;
    state.tierlistCommentLikes = data || [];
  } catch (e) {
    state.tierlistCommentLikes = [];
  }
  // `tierlistViewerHtml` est une chaîne HTML pré-calculée (pas régénérée
  // automatiquement à chaque render, contrairement aux autres vues) :
  // on doit explicitement la reconstruire ici, sinon les nouveaux
  // commentaires/likes resteraient invisibles jusqu'à la prochaine
  // ouverture de la modal.
  if (state.tierlistViewerOpen && tierlistId) {
    state.tierlistViewerHtml = await renderTierlistViewer(tierlistId);
  }
  render();
}

export function getTierlistCommentLikeCount(commentId) {
  return state.tierlistCommentLikes.filter((l) => l.comment_id === commentId).length;
}
export function hasLikedTierlistComment(commentId) {
  const uid = currentUserId();
  if (!uid) return false;
  return state.tierlistCommentLikes.some((l) => l.comment_id === commentId && l.user_id === uid);
}

export async function publierTierlistComment() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour commenter."); return; }
  const tierlistId = state.tierlistViewerId;
  if (!tierlistId) return;
  const texte = state.tierlistCommentDraft.trim();
  if (!texte) { showToast("Écris un commentaire avant de publier."); return; }
  const note = state.tierlistCommentNote === "" ? null : Number(state.tierlistCommentNote);
  if (note !== null && (note < 0 || note > 10)) { showToast("La note doit être entre 0 et 10."); return; }
  const uid = currentUserId();

  try {
    const { error } = await sb.from("tierlist_comments").insert([{
      tierlist_id: tierlistId,
      user_id: uid,
      note,
      commentaire: texte,
    }]);
    if (error) throw error;
    setState({ tierlistCommentDraft: "", tierlistCommentNote: "" });
    await chargerTierlistComments(tierlistId);
    showToast("Commentaire publié.");
    const t = state.tierlists.find((x) => x.id === tierlistId);
    if (t && t.user_id && t.user_id !== uid) {
      const { error: errNotif } = await sb.from("notifications_interactions").insert([{
        to_user_id: t.user_id, from_user_id: uid, interaction_type: "comment", target_kind: "tierlist", target_id: tierlistId, titre: t.titre, contenu_apercu: texte.slice(0, 80),
      }]);
      if (errNotif) console.error("Erreur notification commentaire tierlist", errNotif);
    }
  } catch (e) {
    console.error(e);
    showToast("Publication impossible.");
  }
}

export async function supprimerTierlistComment(commentId) {
  try {
    const { error } = await sb.from("tierlist_comments").delete().eq("id", commentId);
    if (error) throw error;
    await chargerTierlistComments(state.tierlistViewerId);
    showToast("Commentaire supprimé.");
  } catch (e) {
    console.error(e);
    showToast("Suppression impossible.");
  }
}

export async function toggleLikeTierlistComment(commentId) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer un commentaire."); return; }
  const uid = currentUserId();
  try {
    if (hasLikedTierlistComment(commentId)) {
      await sb.from("tierlist_comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid);
    } else {
      await sb.from("tierlist_comment_likes").insert([{ comment_id: commentId, user_id: uid }]);
    }
    await chargerTierlistComments(state.tierlistViewerId);
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

// ---- création / édition ----
// Modèles prêts à l'emploi : pré-remplissent titre/thème/sourceType
// pour démarrer plus vite. L'utilisateur garde la main pour tout
// modifier ensuite (titre, visibilité, éléments classés).
export const TIERLIST_TEMPLATES = [
  { id: "ost", titre: "Mes OST inoubliables", theme: "OST", description: "Les chansons de k-dramas qui me restent en tête.", sourceType: "drama" },
  {
    id: "cliches",
    titre: "Kcliché !",
    theme: "Clichés de k-drama",
    description: "Tu ne notes pas la qualité du drama, mais le nombre de clichés qu'il coche. Chaque colonne correspond à une scène culte qu'on voit dans tous les dramas.",
    sourceType: "drama",
    niveaux: [
      { emoji: "☔", coreen: "비", romanise: "Bi", fr: "La pluie", desc: "Combien de fois un personnage se tient sous la pluie en pleurant, ou court sous l'averse pour retrouver l'amour ?" },
      { emoji: "🚗", coreen: "사고", romanise: "Sago", fr: "L'accident", desc: "Présence d'un accident de voiture mystérieux (souvent un camion blanc = taxi)." },
      { emoji: "🍜", coreen: "라면", romanise: "Ra-myeon", fr: "Le ramyeon", desc: "Y a-t-il une scène de partage de ramyeon à 2 baguettes dans une petite cuisine ? (Cliché ultime du rapprochement)." },
      { emoji: "🔄", coreen: "과거", romanise: "Gwageo", fr: "Le passé", desc: "Ont-ils un lien d'enfance caché qu'ils ne découvrent qu'à l'épisode 8 ? (\"On s'est déjà rencontrés étant petits\")." },
      { emoji: "💍", coreen: "재벌", romanise: "Jae-beol", fr: "Le richissime", desc: "Le héros est-il un chaebol (héritier) hyper riche qui n'a jamais cuisiné de sa vie ?" },
    ],
  },
  {
    id: "ressenti-general",
    titre: "K Moodboard",
    theme: "Ressenti général",
    description: "Le classement général par émotion pure.",
    sourceType: "drama",
    niveaux: [
      { emoji: "👑", coreen: "어떡해", romanise: "Oettoke", fr: "La légende", desc: "Le drama est tellement génial que je ne sais plus quoi faire de ma vie. Je l'ai en boucle, je pleure, je ris, je suis en PLS. LA LÉGENDE." },
      { emoji: "🥇", coreen: "가자", romanise: "Gaja", fr: "On enchaîne", desc: "Allez, on enchaîne ! Ultra addictif, j'ai enchaîné les épisodes sans m'en rendre compte. Très bon drama." },
      { emoji: "🥈", coreen: "먹자", romanise: "Mokja", fr: "Confortable", desc: "Confortable comme un bon repas. Un drama sympa, réconfortant, que j'ai bien aimé sans être transcendée. Parfait pour le quotidien." },
      { emoji: "🥉", coreen: "잘 자", romanise: "Jalja", fr: "Soporifique", desc: "Doux mais un peu lent. Il m'a aidé à m'endormir certains soirs. Pas mauvais, mais parfois soporifique." },
      { emoji: "🤔", coreen: "왜?", romanise: "Wae?", fr: "Pourquoi ?", desc: "Mais pourquoi j'ai regardé ça ? Des incohérences, des personnages agaçants, je n'ai pas compris l'engouement." },
      { emoji: "💀", coreen: "씨발", romanise: "Shibal", fr: "La colère", desc: "La grosse colère. Soit la fin est une catastrophe, soit le jeu d'acteur est nul, soit je l'ai arrêté au bout de 2 épisodes. Je le maudis." },
    ],
  },
  {
    id: "ressenti-detaille",
    titre: "Le palmarès",
    theme: "Ressenti détaillé",
    description: "Une autre grille de notes pour varier les plaisirs !",
    sourceType: "drama",
    niveaux: [
      { emoji: "💎", coreen: "대박", romanise: "Daebak", fr: "La claque", desc: "La claque monumentale. Un chef-d'œuvre absolu, celui qui te fait dire \"Wah, c'est énorme !\". Il restera dans l'histoire du drama." },
      { emoji: "🥺", coreen: "보고 싶어", romanise: "Bogo sipeo", fr: "Coup de cœur", desc: "Le coup de cœur romantique. Pas forcément le plus parfait, mais tu es tellement attaché aux personnages que tu vas terriblement leur manquer." },
      { emoji: "🤯", coreen: "진짜?", romanise: "Jin-jja?", fr: "Le twist", desc: "Le retourneur de cerveau. Scénario plein de twists, de surprises et de révélations. Chaque fin d'épisode te faisait hurler \"VRAIMENT ?!\"." },
      { emoji: "😬", coreen: "아이고", romanise: "A-i-go", fr: "Le malaise", desc: "Le malaise / la gêne. Un drama où tu as passé ton temps à cacher ta tête dans l'oreiller à cause de la gêne. Parfait pour les \"cringe comedy\"." },
      { emoji: "😤", coreen: "아이씨", romanise: "A-issi", fr: "La râlerie", desc: "Pas une colère noire comme le \"Shibal\", juste une frustration constante. Le héros est trop passif, ou l'héroïne fait des choix débiles." },
      { emoji: "🤪", coreen: "미쳤어", romanise: "Michyeosseo", fr: "Le délire", desc: "Le délire absurde. Tellement perché, improbable et exagéré que tu t'es demandé si les scénaristes étaient drogués. Réservé aux makjangs de compétition." },
    ],
  },
  {
    id: "emotions-precises",
    titre: "Les compétences cachées du drama",
    theme: "Compétences cachées",
    description: "Ici, tu notes les dramas sur des critères précis, comme une feuille de stats !",
    sourceType: "drama",
    niveaux: [
      { emoji: "🫂", coreen: "괜찮아", romanise: "Gwaen-chan-a", fr: "Le doudou", desc: "Ce drama a-t-il réussi à te réconforter, à te faire du bien au cœur, comme une couverture chaude un jour de pluie ?" },
      { emoji: "💔", coreen: "가지마", romanise: "Ga-ji-ma", fr: "La séparation", desc: "Mesure la puissance des adieux. Est-ce que les acteurs pleurent bien ? Plus c'est haut, plus tu as vidé ta boîte de mouchoirs." },
      { emoji: "⏸️", coreen: "잠깐만", romanise: "Jam-kkan-man", fr: "Le temps mort", desc: "Les persos se regardent en silence pendant 3 plombes avant d'avouer leurs sentiments. Plus c'est haut, plus tu as soupiré devant la barre de progression." },
      { emoji: "🔥", coreen: "화이팅", romanise: "Hwa-i-ting", fr: "Le teamwork", desc: "Les personnages se soutiennent-ils entre eux ? Bonne dynamique de groupe (amis, collègues, famille) qui donne envie de se dépasser ?" },
    ],
  },
  {
    id: "jugement-acteurs",
    titre: "Acteur de légende ou fraude internationale",
    theme: "Le grand procès des acteurs",
    description: "Le grand procès des acteurs !",
    sourceType: "acteur",
    niveaux: [
      { emoji: "👑", coreen: "오빠/누나", romanise: "Oppa/Nouna", fr: "La légende", desc: "Celui/celle pour qui tu regardes TOUT. Qu'il joue dans un drama génial ou nul, tu es là ! Tu l'appellerais volontiers \"Oppa\" ou \"Nouna\" dans la vraie vie." },
      { emoji: "🤔", coreen: "왜?", romanise: "Wae?", fr: "Pourquoi ?", desc: "Mais pourquoi il est célèbre ? Tu ne comprends PAS l'engouement autour de lui, malgré le succès auprès des autres." },
      { emoji: "💀", coreen: "씨발", romanise: "Shibal", fr: "La purge", desc: "Dès qu'il apparaît à l'écran, tu as envie de jeter ta télécommande. Son jeu d'acteur est en bois, il casse toute l'ambiance du drama." },
      { emoji: "😤", coreen: "이제 끝?", romanise: "Izikia", fr: "Gâché", desc: "L'acteur qui a gâché son potentiel. Il a fait un drama incroyable au début, puis il a enchaîné les mauvais choix de rôles." },
    ],
  },
  {
    id: "personnages-marquants",
    titre: "Who the best Oppa and who's sshi-bal ?",
    theme: "Quel rôle incarne-t-il le mieux",
    description: "On classe les acteurs selon le type de personnage qu'ils incarnent le mieux.",
    sourceType: "acteur",
    niveaux: [
      { emoji: "💕", coreen: "오빠", romanise: "Oppa", fr: "Le héros", desc: "Le Meilleur Héros — celui qui fait battre le cœur. Beau, attachant, green flag absolu." },
      { emoji: "😈", coreen: "씨발", romanise: "Ssi-bal", fr: "Le méchant", desc: "Le Meilleur Méchant / Grosse Rage — le perso qu'on adore détester, ou celui qui t'a fait le plus hurler de frustration." },
      { emoji: "👨‍👩‍👧", coreen: "엄마/아빠", romanise: "Eomma/Appa", fr: "Parent toxic ou adorable", desc: "Ceux qui pleurent en cuisinant du kimchi, ou ceux qui gâchent la vie de leurs enfants." },
      { emoji: "😭", coreen: "이제 끝?", romanise: "Ije kkeut?", fr: "Gâché", desc: "Le Plus Frustrant / Gâché — celui qui avait un potentiel de ouf mais qui a ruiné sa fin (ou son dernier quart)." },
    ],
  },
];

export function openNewTierlistForm() {
  setState({
    showTierlistForm: true,
    tierlistFormStep: "choix", // "choix" (modèle ou libre) | "formulaire"
    tierlistDraft: { id: null, titre: "", theme: "", description: "", est_publique: true, sourceType: "drama", niveaux: null },
  });
}
export function choisirTemplateTierlist(templateId) {
  const tpl = TIERLIST_TEMPLATES.find((t) => t.id === templateId);
  setState({
    tierlistFormStep: "formulaire",
    tierlistDraft: { id: null, titre: tpl.titre, theme: tpl.theme, description: tpl.description, est_publique: true, sourceType: tpl.sourceType, niveaux: tpl.niveaux || null },
  });
}
export function partirDeZeroTierlist() {
  setState({
    tierlistFormStep: "formulaire",
    tierlistDraft: { id: null, titre: "", theme: "", description: "", est_publique: true, sourceType: "drama", niveaux: null },
  });
}
export function closeTierlistForm() {
  setState({ showTierlistForm: false });
}
export function updateTierlistDraft(patch) {
  setState({ tierlistDraft: { ...state.tierlistDraft, ...patch } });
}

export async function creerTierlist() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour créer une tierlist."); return; }
  const d = state.tierlistDraft;
  if (!d.titre.trim()) { showToast("Le titre est obligatoire."); return; }

  try {
    const { data, error } = await sb.from("tierlists").insert([{
      user_id: currentUserId(),
      titre: d.titre.trim(),
      theme: d.theme.trim() || null,
      description: d.description.trim() || null,
      est_publique: d.est_publique,
      niveaux: d.niveaux || null,
    }]).select().single();
    if (error) throw error;
    await loadTierlists();
    closeTierlistForm();
    showToast("Tierlist créée — place les éléments dans les niveaux !");
    openTierlistBuilder(data.id, d.sourceType, d.niveaux);
    // Prévient tous les abonnés (pas juste ceux qui likent/commentent
    // après coup) qu'une vraie nouvelle tierlist a été créée — rien à
    // voir avec les notifications d'interaction (like/commentaire) sur
    // une tierlist déjà existante. Seulement si publique : notifier
    // pour une tierlist privée mènerait vers un contenu invisible.
    if (d.est_publique) {
      try {
        const { data: abonnes, error: errAbonnes } = await sb
          .from("abonnements")
          .select("follower_id")
          .eq("followed_id", currentUserId());
        if (errAbonnes) throw errAbonnes;
        if (abonnes && abonnes.length > 0) {
          const notifs = abonnes.map((a) => ({
            to_user_id: a.follower_id,
            from_user_id: currentUserId(),
            interaction_type: "creation",
            target_kind: "tierlist",
            target_id: data.id,
            titre: data.titre,
          }));
          const { error: errNotif } = await sb.from("notifications_interactions").insert(notifs);
          if (errNotif) console.error("Erreur notification création tierlist", errNotif);
        }
      } catch (e) {
        console.error("Erreur notification abonnés (nouvelle tierlist)", e);
      }
    }
  } catch (e) {
    console.error(e);
    showToast("Création impossible.");
  }
}

// ---- builder (glisser-déposer) ----
// Construit le pool d'éléments disponibles pour un rôle donné
// (drama/acteur/actrice), en excluant ceux déjà présents dans
// `dejaPlaces` (element_label des items déjà classés dans la
// tierlist) — sinon un même drama/acteur pourrait apparaître à la
// fois dans le réservoir ET déjà placé dans un niveau.
export function construirePoolPourType(sourceType, dejaPlaces) {
  const exclus = new Set(dejaPlaces);
  if (sourceType === "acteur") {
    const noms = new Set();
    state.entries.forEach((d) => { if (d.acteur) noms.add(d.acteur); });
    return Array.from(noms).filter((nom) => !exclus.has(nom)).map((nom) => ({
      element_type: "acteur", element_id: null, element_label: nom, element_image_url: findPersonPhoto(nom, "acteur"),
    }));
  }
  if (sourceType === "actrice") {
    const noms = new Set();
    state.entries.forEach((d) => { if (d.actrice) splitPeople(d.actrice).forEach((n) => noms.add(n)); });
    return Array.from(noms).filter((nom) => !exclus.has(nom)).map((nom) => ({
      element_type: "actrice", element_id: null, element_label: nom, element_image_url: findPersonPhoto(nom, "actrice"),
    }));
  }
  // "drama" par défaut.
  return state.entries.filter((d) => !exclus.has(d.titre)).map((d) => ({
    element_type: "drama", element_id: d.id, element_label: d.titre, element_image_url: d.poster_url,
  }));
}

export async function openTierlistBuilder(tierlistId, sourceType) {
  const { items, error } = await loadItemsForTierlist(tierlistId);
  if (error) {
    // Ne JAMAIS ouvrir le builder dans un état trompeur : si le
    // chargement des items existants a échoué, on refuse d'ouvrir
    // plutôt que de risquer d'écraser le contenu déjà sauvegardé au
    // prochain "Enregistrer" (voir le commentaire sur loadItemsForTierlist).
    showToast("Impossible de charger cette tierlist (problème réseau) — réessaie dans un instant.");
    return;
  }

  let pool;
  if (items.length === 0) {
    // Tierlist toute neuve : rien à analyser pour deviner le type, on
    // se base donc sur le choix fait dans le formulaire de création
    // (sourceType), comme avant.
    pool = construirePoolPourType(sourceType || "drama", []);
  } else {
    // Reprise d'une tierlist déjà commencée : le type est déjà
    // déterminé par ce qu'elle contient — on ne redemande plus rien
    // (voir la demande "il ne faut pas que la personne choisisse entre
    // drama et acteurs/actrices mais que ce soit automatique"). On
    // exclut du réservoir les éléments déjà classés, pour ne pas les
    // proposer une deuxième fois.
    const typeDetecte = items[0].element_type;
    const dejaPlaces = items.map((it) => it.element_label);
    pool = construirePoolPourType(typeDetecte, dejaPlaces);
  }

  // Les niveaux personnalisés sont stockés sur la tierlist elle-même en
  // base (colonne `niveaux`) — on les relit depuis state.tierlists plutôt
  // que de dépendre d'un paramètre, pour couvrir création/édition/duplication.
  const tierlistEnBase = state.tierlists.find((t) => t.id === tierlistId);
  const niveauxPerso = (tierlistEnBase && tierlistEnBase.niveaux) || null;

  setState({
    editingTierlistId: tierlistId,
    editingTierlistNiveaux: niveauxPerso,
    builderItems: items.map((it) => ({ ...it })),
    builderPool: pool,
    activeTab: "tierlist-builder",
  });
}

export function closeTierlistBuilder() {
  setState({ editingTierlistId: null, editingTierlistNiveaux: null, builderItems: [], builderPool: [], builderSearchQuery: "", activeTab: "communaute" });
}

export function moveItemToNiveau(item, niveau, fromPool) {
  if (fromPool) {
    state.builderPool = state.builderPool.filter((p) => p !== item);
  } else {
    state.builderItems = state.builderItems.filter((it) => it !== item);
  }
  const itemsInNiveau = state.builderItems.filter((it) => it.niveau === niveau).length;
  state.builderItems.push({ ...item, niveau, position: itemsInNiveau, tierlist_id: state.editingTierlistId });
  render();
}

export function moveItemBackToPool(item) {
  state.builderItems = state.builderItems.filter((it) => it !== item);
  state.builderPool.push(item);
  render();
}

export async function sauvegarderTierlistBuilder() {
  try {
    // Stratégie simple et robuste : on supprime tous les items existants
    // de cette tierlist puis on réinsère l'état courant du builder.
    // Le volume par tierlist est faible (quelques dizaines d'items max),
    // donc le coût de ce remplacement complet est négligeable.
    const { error: delError } = await sb.from("tierlist_items").delete().eq("tierlist_id", state.editingTierlistId);
    if (delError) throw delError;

    if (state.builderItems.length > 0) {
      const payload = state.builderItems.map((it, i) => ({
        tierlist_id: state.editingTierlistId,
        element_type: it.element_type,
        element_id: it.element_id || null,
        element_label: it.element_label,
        element_image_url: it.element_image_url || null,
        niveau: it.niveau,
        position: it.position ?? i,
      }));
      const { error: insError } = await sb.from("tierlist_items").insert(payload);
      if (insError) throw insError;
    }
    showToast("Tierlist enregistrée.");
    await loadTierlists();
    closeTierlistBuilder();
  } catch (e) {
    console.error(e);
    showToast("Enregistrement impossible.");
    return; // on ne tente pas de cadeau si l'enregistrement a échoué
  }
  // Volontairement HORS du try/catch ci-dessus, et déjà protégé par
  // son propre try/catch interne : le système de cadeaux ne doit
  // JAMAIS pouvoir affecter le message de succès/échec de la
  // sauvegarde de la tierlist, qui est l'action principale ici.
  await tenterGagnerCadeau("tierlist");
}

export async function dupliquerTierlist(tierlistId) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour dupliquer une tierlist."); return; }
  try {
    const original = state.tierlists.find((t) => t.id === tierlistId);
    if (!original) return;
    const { items, error: errLoad } = await loadItemsForTierlist(tierlistId);
    if (errLoad) throw errLoad;
    const { data: newTierlist, error } = await sb.from("tierlists").insert([{
      user_id: currentUserId(),
      titre: `${original.titre} (copie)`,
      theme: original.theme,
      description: original.description,
      est_publique: false,
      niveaux: original.niveaux || null,
    }]).select().single();
    if (error) throw error;
    if (items.length > 0) {
      const payload = items.map((it) => ({
        tierlist_id: newTierlist.id, element_type: it.element_type, element_id: it.element_id,
        element_label: it.element_label, element_image_url: it.element_image_url,
        niveau: it.niveau, position: it.position,
      }));
      await sb.from("tierlist_items").insert(payload);
    }
    await loadTierlists();
    showToast("Tierlist dupliquée dans tes brouillons (privée).");
    openTierlistBuilder(newTierlist.id, null);
  } catch (e) {
    console.error(e);
    showToast("Duplication impossible.");
  }
}

export async function toggleLikeTierlist(tierlistId, ownerId, titre) {
  if (!isLoggedIn()) { showToast("Connecte-toi pour aimer une tierlist."); return; }
  const uid = currentUserId();
  try {
    if (hasLikedTierlist(tierlistId)) {
      await sb.from("tierlist_likes").delete().eq("tierlist_id", tierlistId).eq("user_id", uid);
    } else {
      await sb.from("tierlist_likes").insert([{ tierlist_id: tierlistId, user_id: uid }]);
      if (ownerId && ownerId !== uid) {
        const { error: errNotif } = await sb.from("notifications_interactions").insert([{
          to_user_id: ownerId, from_user_id: uid, interaction_type: "like", target_kind: "tierlist", target_id: tierlistId, titre,
        }]);
        if (errNotif) console.error("Erreur notification like tierlist", errNotif);
      }
    }
    await loadTierlists();
    render();
  } catch (e) {
    console.error(e);
    showToast("Action impossible.");
  }
}

export async function supprimerTierlist(tierlistId) {
  try {
    const { error } = await sb.from("tierlists").delete().eq("id", tierlistId);
    if (error) throw error;
    await loadTierlists();
    showToast("Tierlist supprimée.");
    render();
  } catch (e) {
    console.error(e);
    showToast("Suppression impossible.");
  }
}

// ---- rendu : page "Tierlists populaires" / liste ----
export function renderTierlistsView() {
  let list = [...state.tierlists];
  if (state.tierlistsSort === "populaires") {
    list.sort((a, b) => getTierlistLikeCount(b.id) - getTierlistLikeCount(a.id));
  } else {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  let html = `<div class="kt-controls" style="padding:14px 16px 0;">
    <div class="tabbar" style="padding:0; flex:1;">
      <button class="tab-btn ${state.tierlistsSort === "populaires" ? "active" : ""}" data-tierlist-sort="populaires">Populaires</button>
      <button class="tab-btn ${state.tierlistsSort === "recentes" ? "active" : ""}" data-tierlist-sort="recentes">Récentes</button>
    </div>
  </div>
  <main class="kt-list">`;

  if (list.length === 0) {
    html += `<div class="empty-state"><p>Aucune tierlist pour l'instant. Sois la première à en créer une !</p></div>`;
  } else {
    html += list.map((t) => {
      const mine = t.user_id === currentUserId();
      const liked = hasLikedTierlist(t.id);
      const likeCount = getTierlistLikeCount(t.id);
      const pseudo = t.profils ? t.profils.pseudo : "?";
      return `<article class="drama-card" style="cursor:default;">
        <div class="card-row">
          <span class="tr-rank" style="width:44px; height:44px; font-size:20px;">▦</span>
          <div class="card-main">
            <h2>${esc(t.titre)} ${!t.est_publique ? `<span class="year" style="color:var(--ink-faint);">· privée</span>` : ""}</h2>
            <p class="cast">${esc(t.theme || "")} — par <span data-open-profil="${esc(t.user_id)}" style="cursor:pointer; color:var(--blue-deep); font-weight:600;">${esc(pseudo)}</span></p>
          </div>
        </div>
        <div class="card-actions" style="margin-top:10px;">
          <button class="text-btn" data-view-tierlist="${esc(t.id)}">👁 Voir</button>
          <button class="text-btn" data-toggle-like-tierlist="${esc(t.id)}" data-owner-id="${esc(t.user_id)}" data-titre="${esc(t.titre)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
          ${isLoggedIn() ? `<button class="text-btn" data-duplicate-tierlist="${esc(t.id)}">⧉ Dupliquer</button>` : ""}
          ${mine ? `<button class="text-btn" data-edit-tierlist="${esc(t.id)}">✎ Modifier</button><button class="text-btn danger" data-delete-tierlist="${esc(t.id)}">🗑</button>` : ""}
        </div>
      </article>`;
    }).join("");
  }
  html += `</main>`;
  return html;
}

// ---- rendu : vue lecture d'une tierlist (niveaux remplis) ----
export async function renderTierlistViewer(tierlistId) {
  const t = state.tierlists.find((x) => x.id === tierlistId);
  if (!t) return `<div class="trends-wrap"><p class="tr-note">Tierlist introuvable.</p></div>`;
  const { items, error: errLoad } = await loadItemsForTierlist(tierlistId);
  if (errLoad) {
    return `<div class="trends-wrap"><p class="tr-note">Impossible de charger le contenu de cette tierlist pour le moment — réessaie dans un instant.</p></div>`;
  }
  const pseudoAuteur = t.profils ? t.profils.pseudo : "Utilisateur supprimé";
  let html = `<div class="trends-wrap">
    <section class="tr-section">
      <h2 class="tr-title">${esc(t.titre)}</h2>
      <p class="cast" style="margin:0 0 10px;">par <span data-open-profil="${esc(t.user_id)}" style="cursor:pointer; color:var(--blue-deep); font-weight:600;">${esc(pseudoAuteur)}</span>${t.theme ? ` · ${esc(t.theme)}` : ""}</p>
      ${t.description ? `<p class="tr-note">${esc(t.description)}</p>` : ""}
      ${getNiveauxDeTierlist(t.niveaux).map((niv) => {
        const itemsNiv = items.filter((it) => it.niveau === niv.value).sort((a, b) => a.position - b.position);
        return `<div class="tierlist-row">
          <div class="tierlist-niveau-label" style="background:${niv.color};" title="${esc(niv.desc)}">${niveauLabelHtml(niv)}</div>
          <div class="tierlist-niveau-items">
            ${niv.desc ? `<p class="tr-niveau-desc">${esc(niv.desc)}</p>` : ""}
            ${itemsNiv.length === 0 ? `<span class="tr-note" style="margin:0;">—</span>` : itemsNiv.map((it) => `
              <div class="tierlist-chip">
                ${it.element_image_url ? `<img src="${esc(it.element_image_url)}" alt="">` : ""}
                <span>${esc(it.element_label)}</span>
              </div>`).join("")}
          </div>
        </div>`;
      }).join("")}
    </section>

    <section class="tr-section">
      <h2 class="tr-title">Commentaires (${state.tierlistComments.length})</h2>
      ${isLoggedIn() ? `
        <div class="tr-card" style="margin-bottom:14px;">
          <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500;">
            Ton avis sur cette tierlist
            <input id="tierlist-comment-input" value="${esc(state.tierlistCommentDraft)}" placeholder="Qu'en penses-tu ?">
          </label>
          <div class="field-pair" style="margin-top:8px;">
            <label style="flex:0 0 110px;">Note /10 (option.)<input id="tierlist-comment-note" type="number" inputmode="decimal" step="0.5" min="0" max="10" value="${esc(state.tierlistCommentNote)}"></label>
            <button class="primary-btn" id="tierlistCommentSubmitBtn" style="align-self:flex-end;">Publier</button>
          </div>
        </div>
      ` : `<p class="tr-note">Connecte-toi pour commenter.</p>`}
      ${state.tierlistComments.length === 0 ? `<p class="tr-note">Aucun commentaire pour l'instant.</p>` : state.tierlistComments.map((c) => {
        const pseudo = c.profils ? c.profils.pseudo : "Utilisateur supprimé";
        const avatar = c.profils ? c.profils.avatar_url : null;
        const liked = hasLikedTierlistComment(c.id);
        const likeCount = getTierlistCommentLikeCount(c.id);
        const mine = c.user_id === currentUserId();
        return `<article class="drama-card" style="cursor:default;">
          <div class="card-row" style="align-items:flex-start;">
            ${avatar
              ? `<img src="${esc(avatar)}" class="tr-person-avatar" style="width:38px;height:38px;cursor:pointer;object-fit:cover;" data-open-profil="${esc(c.user_id)}">`
              : `<div class="stamp mini motif-flower" style="width:38px;height:38px;cursor:pointer;" data-open-profil="${esc(c.user_id)}">${FLOWER_MOTIF_SVG}</div>`}
            <div class="card-main">
              <p class="tr-person-name" style="cursor:pointer;" data-open-profil="${esc(c.user_id)}">${esc(pseudo)}</p>
            </div>
            ${c.note !== null && c.note !== undefined ? stampHtml(c.note, true) : ""}
          </div>
          <p style="font-size:13px; color:var(--ink); line-height:1.5; margin:8px 0 0;">${esc(c.commentaire)}</p>
          <div class="card-actions" style="margin-top:8px;">
            <button class="text-btn" data-toggle-like-comment="${esc(c.id)}" style="${liked ? "color:var(--seal); font-weight:600;" : ""}">${liked ? "♥" : "♡"} ${likeCount > 0 ? likeCount : ""}</button>
            ${mine ? `<button class="text-btn danger" data-delete-comment="${esc(c.id)}">🗑 Supprimer</button>` : ""}
          </div>
        </article>`;
      }).join("")}
    </section>
  </div>`;
  return html;
}

// Normalise les niveaux d'une tierlist : soit S/A/B/C/D classiques (avec
// NIVEAU_COLORS), soit une liste personnalisée [{emoji, coreen, romanise,
// fr, desc}] stockée sur la tierlist, à laquelle on attribue une couleur
// de la palette générique dans l'ordre. `value` est ce qui est réellement
// stocké en base dans `tierlist_items.niveau` — on utilise le mot coréen
// comme identifiant pour les niveaux personnalisés (unique au sein d'un
// même modèle), et la lettre pour S/A/B/C/D.
export function getNiveauxDeTierlist(niveauxPerso) {
  if (niveauxPerso && niveauxPerso.length > 0) {
    return niveauxPerso.map((n, i) => ({
      value: n.coreen,
      emoji: n.emoji || "",
      coreen: n.coreen,
      romanise: n.romanise || "",
      fr: n.fr || "",
      desc: n.desc || "",
      color: PALETTE_NIVEAUX_PERSO[i % PALETTE_NIVEAUX_PERSO.length],
    }));
  }
  return NIVEAUX.map((niv) => ({ value: niv, emoji: "", coreen: niv, romanise: "", fr: "", desc: "", color: NIVEAU_COLORS[niv] }));
}

// Génère le HTML interne d'un label de niveau : pour les niveaux
// personnalisés, emoji + coréen + romanisation, puis séparateur et
// traduction française ; pour S/A/B/C/D classiques, juste la lettre.
export function niveauLabelHtml(niv) {
  if (!niv.romanise && !niv.fr) return esc(niv.coreen);
  return `
    ${niv.emoji ? `<span class="niveau-emoji">${esc(niv.emoji)}</span>` : ""}
    <span class="niveau-coreen">${esc(niv.coreen)}</span>
    ${niv.romanise ? `<span class="niveau-romanise">${esc(niv.romanise)}</span>` : ""}
    ${niv.fr ? `<span class="niveau-fr">${esc(niv.fr)}</span>` : ""}
  `;
}

// ---- rendu : builder (drag and drop) ----
export function renderTierlistBuilder() {
  const t = state.tierlists.find((x) => x.id === state.editingTierlistId);
  const niveaux = getNiveauxDeTierlist(state.editingTierlistNiveaux);
  return `<div class="trends-wrap">
    <section class="tr-section">
      <h2 class="tr-title">${t ? esc(t.titre) : "Construis ta tierlist"}</h2>
      <p class="tr-note">Touche un élément du réservoir, puis touche le niveau où le placer. Touche un élément déjà placé pour le renvoyer dans le réservoir.</p>

      ${niveaux.map((niv) => {
        const itemsNiv = state.builderItems.filter((it) => it.niveau === niv.value);
        const labelTexte = [niv.coreen, niv.romanise].filter(Boolean).join(" ");
        return `<div class="tierlist-row">
          <div class="tierlist-niveau-label" style="background:${niv.color};" title="${esc(niv.desc)}">${niveauLabelHtml(niv)}</div>
          <div class="tierlist-niveau-items" data-niveau-drop="${esc(niv.value)}">
            ${niv.desc ? `<p class="tr-niveau-desc">${esc(niv.desc)}</p>` : ""}
            ${itemsNiv.length === 0 ? `<span class="tr-note" style="margin:0;">Touche un élément ci-dessous puis "${esc(labelTexte)}"</span>` : itemsNiv.map((it, idx) => `
              <button class="tierlist-chip" data-item-back-idx="${idx}" data-item-back-niv="${esc(niv.value)}">
                ${it.element_image_url ? `<img src="${esc(it.element_image_url)}" alt="">` : ""}
                <span>${esc(it.element_label)}</span>
              </button>`).join("")}
          </div>
        </div>`;
      }).join("")}

      <p class="tr-subhead">Réservoir (${state.builderPool.length})</p>
      <label style="display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); font-weight:500; margin-bottom:10px;">
        Chercher un élément à classer
        <input id="builder-search-input" value="${esc(state.builderSearchQuery || "")}" placeholder="Filtrer le réservoir...">
      </label>
      <div class="tierlist-pool">
        ${(() => {
          const q = (state.builderSearchQuery || "").trim().toLowerCase();
          if (state.builderPool.length === 0) return `<p class="tr-note">Tout est classé ! Touche "Enregistrer" pour sauvegarder.</p>`;
          // Le réservoir reste entièrement affiché (et défilable) par
          // défaut ; la recherche ne fait que le filtrer en plus, dès la
          // première lettre tapée.
          const poolFiltre = q.length === 0
            ? state.builderPool
            : state.builderPool.filter((it) => it.element_label.toLowerCase().includes(q));
          if (poolFiltre.length === 0) return `<p class="tr-note">Aucun résultat pour "${esc(state.builderSearchQuery)}".</p>`;
          return poolFiltre.map((it) => {
            const idx = state.builderPool.indexOf(it);
            return `
            <div class="tierlist-pool-item" data-pool-idx="${idx}">
              <div class="tierlist-chip" style="margin-bottom:5px;">
                ${it.element_image_url ? `<img src="${esc(it.element_image_url)}" alt="">` : ""}
                <span>${esc(it.element_label)}</span>
              </div>
              <div class="tierlist-niveau-picker">
                ${niveaux.map((niv) => `<button class="tierlist-niveau-pick-btn" style="border-color:${niv.color}; color:${niv.color};" data-place-pool="${idx}" data-place-niveau="${esc(niv.value)}" title="${esc(niv.desc)}">${niveauLabelHtml(niv)}</button>`).join("")}
              </div>
            </div>`;
          }).join("");
        })()}
      </div>
    </section>

    <div class="sheet-footer" style="position:sticky; bottom:0; background:var(--paper); border-top:1px solid var(--line);">
      <button class="ghost-btn" id="builderCancelBtn">Quitter</button>
      <button class="primary-btn" id="builderSaveBtn">Enregistrer</button>
    </div>
  </div>`;
}

export function renderTierlistFormSheet() {
  if (!state.showTierlistForm) return "";

  if (state.tierlistFormStep === "choix") {
    return `<div class="sheet-overlay" id="tierlistFormOverlay">
      <div class="sheet" id="tierlistFormSheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>Nouvelle tierlist</h3>
          <button class="icon-btn" id="tierlistFormClose">✕</button>
        </div>
        <div class="sheet-body">
          <p class="tr-note" style="margin:0 0 4px;">Pars d'un modèle pour démarrer plus vite, ou crée une tierlist entièrement libre.</p>
          ${TIERLIST_TEMPLATES.map((tpl) => `
            <div class="tr-person-row" data-choose-template="${tpl.id}" style="align-items:flex-start;">
              <span class="tr-rank">▦</span>
              <div class="tr-person-info">
                <p class="tr-person-name">${esc(tpl.titre)}</p>
                <p class="tr-person-sub" style="white-space:normal; overflow:visible;">${esc(tpl.description)}</p>
              </div>
            </div>`).join("")}
          <button class="ghost-btn" id="tierlistFromScratchBtn" style="width:100%; margin-top:6px;">✎ Partir de zéro</button>
        </div>
      </div>
    </div>`;
  }

  const d = state.tierlistDraft;
  return `<div class="sheet-overlay" id="tierlistFormOverlay">
    <div class="sheet" id="tierlistFormSheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>Nouvelle tierlist</h3>
        <button class="icon-btn" id="tierlistFormClose">✕</button>
      </div>
      <div class="sheet-body">
        <label>Titre *<input id="tl-titre" value="${esc(d.titre)}" placeholder="ex. Mes acteurs préférés"></label>
        <label>Thème<input id="tl-theme" value="${esc(d.theme)}" placeholder="ex. Acteurs, Dramas romantiques, OST..."></label>
        <label>Description<textarea id="tl-description" placeholder="optionnel" rows="3">${esc(d.description)}</textarea></label>
        <div class="field-label-wrap">
          <span class="field-label">Quoi classer ?</span>
          <div class="tr-role-toggle">
            <button class="${d.sourceType === "drama" ? "active" : ""}" data-source-type="drama">Mes dramas</button>
            <button class="${d.sourceType === "acteur" ? "active" : ""}" data-source-type="acteur">Acteurs</button>
            <button class="${d.sourceType === "actrice" ? "active" : ""}" data-source-type="actrice">Actrices</button>
          </div>
        </div>
        <div class="filter-row">
          <span class="filter-label">Visibilité</span>
          <select id="tl-visibilite">
            <option value="true" ${d.est_publique ? "selected" : ""}>Publique</option>
            <option value="false" ${!d.est_publique ? "selected" : ""}>Privée</option>
          </select>
        </div>
      </div>
      <div class="sheet-footer">
        <button class="ghost-btn" id="tierlistFormBack">← Retour</button>
        <button class="primary-btn" id="tierlistFormSave">Créer et classer</button>
      </div>
    </div>
  </div>`;
}

export function attachTierlistListeners() {
  document.querySelectorAll("[data-tierlist-sort]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ tierlistsSort: btn.dataset.tierlistSort }));
  });
  document.querySelectorAll("[data-toggle-like-tierlist]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLikeTierlist(btn.dataset.toggleLikeTierlist, btn.dataset.ownerId, btn.dataset.titre));
  });
  document.querySelectorAll("[data-duplicate-tierlist]").forEach((btn) => {
    btn.addEventListener("click", () => dupliquerTierlist(btn.dataset.duplicateTierlist));
  });
  document.querySelectorAll("[data-delete-tierlist]").forEach((btn) => {
    btn.addEventListener("click", () => supprimerTierlist(btn.dataset.deleteTierlist));
  });
  document.querySelectorAll("[data-edit-tierlist]").forEach((btn) => {
    btn.addEventListener("click", () => openTierlistBuilder(btn.dataset.editTierlist, null));
  });
  document.querySelectorAll("[data-view-tierlist]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (e.target.closest("[data-stop-propagation]")) return;
      setState({ dramaModal: null, modalStack: [], tierlistViewerOpen: true, tierlistViewerId: btn.dataset.viewTierlist, tierlistViewerHtml: `<p class="tr-note">Chargement…</p>` });
      await chargerTierlistComments(btn.dataset.viewTierlist);
    });
  });

  const newTierlistBtn = document.getElementById("openNewTierlistBtn");
  if (newTierlistBtn) newTierlistBtn.addEventListener("click", openNewTierlistForm);

  // Form
  const tierlistFormOverlay = document.getElementById("tierlistFormOverlay");
  if (tierlistFormOverlay) tierlistFormOverlay.addEventListener("click", (e) => { if (e.target === tierlistFormOverlay) closeTierlistForm(); });
  const tierlistFormClose = document.getElementById("tierlistFormClose");
  if (tierlistFormClose) tierlistFormClose.addEventListener("click", closeTierlistForm);
  const tierlistFormBack = document.getElementById("tierlistFormBack");
  if (tierlistFormBack) tierlistFormBack.addEventListener("click", () => setState({ tierlistFormStep: "choix" }));
  const tierlistFromScratchBtn = document.getElementById("tierlistFromScratchBtn");
  if (tierlistFromScratchBtn) tierlistFromScratchBtn.addEventListener("click", partirDeZeroTierlist);
  document.querySelectorAll("[data-choose-template]").forEach((el) => {
    el.addEventListener("click", () => choisirTemplateTierlist(el.dataset.chooseTemplate));
  });
  const tierlistFormSave = document.getElementById("tierlistFormSave");
  if (tierlistFormSave) tierlistFormSave.addEventListener("click", creerTierlist);
  const tlTitre = document.getElementById("tl-titre");
  if (tlTitre) tlTitre.addEventListener("input", (e) => { state.tierlistDraft.titre = e.target.value; });
  const tlTheme = document.getElementById("tl-theme");
  if (tlTheme) tlTheme.addEventListener("input", (e) => { state.tierlistDraft.theme = e.target.value; });
  const tlDescription = document.getElementById("tl-description");
  if (tlDescription) tlDescription.addEventListener("input", (e) => { state.tierlistDraft.description = e.target.value; });
  const tlVisibilite = document.getElementById("tl-visibilite");
  if (tlVisibilite) tlVisibilite.addEventListener("change", (e) => { state.tierlistDraft.est_publique = e.target.value === "true"; });
  document.querySelectorAll("[data-source-type]").forEach((btn) => {
    btn.addEventListener("click", () => updateTierlistDraft({ sourceType: btn.dataset.sourceType }));
  });

  // Builder
  document.querySelectorAll("[data-place-pool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.placePool);
      const niveau = btn.dataset.placeNiveau;
      moveItemToNiveau(state.builderPool[idx], niveau, true);
    });
  });
  document.querySelectorAll("[data-item-back-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.itemBackIdx);
      const niv = btn.dataset.itemBackNiv;
      const itemsNiv = state.builderItems.filter((it) => it.niveau === niv);
      moveItemBackToPool(itemsNiv[idx]);
    });
  });
  const builderCancelBtn = document.getElementById("builderCancelBtn");
  if (builderCancelBtn) builderCancelBtn.addEventListener("click", closeTierlistBuilder);
  const builderSaveBtn = document.getElementById("builderSaveBtn");
  if (builderSaveBtn) builderSaveBtn.addEventListener("click", () => avecBoutonDesactive("builderSaveBtn", "Enregistrement…", sauvegarderTierlistBuilder));
  const builderSearchInput = document.getElementById("builder-search-input");
  if (builderSearchInput) {
    builderSearchInput.addEventListener("input", (e) => setState({ builderSearchQuery: e.target.value }));
    if (state.builderSearchHadFocus) {
      builderSearchInput.focus();
      builderSearchInput.setSelectionRange(builderSearchInput.value.length, builderSearchInput.value.length);
    }
    builderSearchInput.addEventListener("focus", () => { state.builderSearchHadFocus = true; });
    builderSearchInput.addEventListener("blur", () => { state.builderSearchHadFocus = false; });
  }
}


