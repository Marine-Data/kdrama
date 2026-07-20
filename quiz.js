// ============================================================
// MODULE QUIZ QUOTIDIEN — extrait de index.html (Kdramatrics)
// Questions générées depuis les dramas existants, une tentative/jour,
// points + bonus, leaderboard jour/semaine/mois.
// Dépend de main.js pour l'état global et les helpers partagés.
// ============================================================

import { state, setState, esc, showToast, sb, isLoggedIn, currentUserId, render, formatDateFr } from './main.js';
import { tenterGagnerCadeau } from './social.js';

/* ============================================================
   MODULE QUIZ QUOTIDIEN
   Questions générées depuis les dramas existants, une tentative/jour,
   points + bonus, leaderboard jour/semaine/mois.
   ============================================================ */

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---- génération de questions à partir des données existantes ----
// Ces questions sont générées côté client à la demande (pas stockées
// par défaut, cf. note dans schema.sql sur les policies d'écriture de
// `questions`). Si vous voulez les persister pour que tout le monde
// ait le MÊME quiz un jour donné, il faut soit :
//  - les insérer manuellement une fois par jour dans l'éditeur SQL, soit
//  - ouvrir temporairement une policy INSERT authenticated sur `questions`
//    et appeler `genererEtSauvegarderQuizDuJour()` une fois.
export function genererQuestionsDepuisCatalogue(entries, n) {
  n = n || 6;
  const candidats = entries.filter((d) => d.acteur || d.actrice || d.realisateur || d.scenariste);
  if (candidats.length < 4) return [];

  const shuffled = [...candidats].sort(() => Math.random() - 0.5);
  const questions = [];
  const typesUtilises = [];

  function pickWrongAnswers(correctValue, pool, count) {
    const wrongs = pool.filter((v) => v && v !== correctValue);
    const unique = Array.from(new Set(wrongs));
    const shuffled2 = unique.sort(() => Math.random() - 0.5);
    return shuffled2.slice(0, count);
  }

  for (const d of shuffled) {
    if (questions.length >= n) break;
    const typeRoll = Math.floor(Math.random() * 3);

    if (typeRoll === 0 && d.acteur) {
      const wrongs = pickWrongAnswers(d.acteur, entries.map((x) => x.acteur), 3);
      if (wrongs.length < 3) continue;
      const options = shuffleWithCorrect(d.acteur, wrongs);
      questions.push({
        texte: `Quel acteur a joué dans "${d.titre}" ?`,
        options: options.choices,
        bonne_reponse: options.correctIndex + 1,
        categorie: "casting",
      });
    } else if (typeRoll === 1 && d.annee) {
      const wrongAnnees = pickWrongAnswers(String(d.annee), entries.map((x) => String(x.annee)), 3);
      if (wrongAnnees.length < 3) continue;
      const options = shuffleWithCorrect(String(d.annee), wrongAnnees);
      questions.push({
        texte: `En quelle année est sorti "${d.titre}" ?`,
        options: options.choices,
        bonne_reponse: options.correctIndex + 1,
        categorie: "annee",
      });
    } else if (d.realisateur) {
      const wrongs = pickWrongAnswers(d.realisateur, entries.map((x) => x.realisateur), 3);
      if (wrongs.length < 3) continue;
      const options = shuffleWithCorrect(d.realisateur, wrongs);
      questions.push({
        texte: `Qui a réalisé "${d.titre}" ?`,
        options: options.choices,
        bonne_reponse: options.correctIndex + 1,
        categorie: "realisation",
      });
    }
  }
  return questions.slice(0, n);
}

// Persiste le quiz du jour en base, pour que TOUS les utilisateurs
// voient exactement les mêmes questions ce jour-là (au lieu d'un quiz
// généré indépendamment dans chaque navigateur, comme le fait le repli
// local de loadQuizDuJour()).
//
// Pré-requis : la table `questions` n'a aucune policy INSERT ouverte
// par défaut (cf. schema.sql) pour éviter que n'importe quel compte
// authentifié ne puisse écrire le quiz de tout le monde. Pour utiliser
// cette fonction vous devez donc, une fois :
//   1) Exécuter dans l'éditeur SQL Supabase :
//        create policy "Admin insere les questions du jour"
//          on public.questions for insert to authenticated
//          with check (true);
//   2) Appeler genererEtSauvegarderQuizDuJour() une fois par jour
//      (manuellement depuis la console du navigateur, ou via un appel
//      programmé), avec un compte authentifié.
//   3) Idéalement, retirer ensuite cette policy et migrer vers une
//      Edge Function planifiée (cron) utilisant la service_role key,
//      pour ne plus dépendre d'un compte utilisateur classique.
export async function genererEtSauvegarderQuizDuJour(nombreDeQuestions) {
  const date = todayISO();

  // Évite d'écraser un quiz déjà généré aujourd'hui.
  const { data: existantes, error: errCheck } = await sb.from("questions").select("id").eq("date_quiz", date);
  if (errCheck) {
    console.error(errCheck);
    showToast("Impossible de vérifier le quiz existant.");
    return;
  }
  if (existantes && existantes.length > 0) {
    showToast(`Un quiz existe déjà pour le ${date} (${existantes.length} questions).`);
    return;
  }

  const questions = genererQuestionsDepuisCatalogue(state.entries, nombreDeQuestions || 6);
  if (questions.length === 0) {
    showToast("Pas assez de données dans le catalogue pour générer un quiz.");
    return;
  }

  const payload = questions.map((q) => ({
    texte: q.texte,
    choix1: q.options[0], choix2: q.options[1], choix3: q.options[2], choix4: q.options[3],
    bonne_reponse: q.bonne_reponse,
    categorie: q.categorie,
    date_quiz: date,
  }));

  try {
    const { error } = await sb.from("questions").insert(payload);
    if (error) throw error;
    showToast(`Quiz du ${date} enregistré (${payload.length} questions).`);
    await loadQuizDuJour();
    render();
  } catch (e) {
    console.error(e);
    showToast("Enregistrement du quiz impossible (policy INSERT manquante sur `questions` ?).");
  }
}

export function shuffleWithCorrect(correctValue, wrongValues) {
  const all = [correctValue, ...wrongValues];
  // mélange Fisher-Yates simple
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { choices: all, correctIndex: all.indexOf(correctValue) };
}

// ---- chargement du quiz du jour (depuis la table `questions`) ----
export async function loadQuizDuJour() {
  try {
    const { data, error } = await sb.from("questions").select("*").eq("date_quiz", todayISO());
    if (error) throw error;
    if (data && data.length > 0) {
      state.questionsAujourdhui = data;
    } else {
      // Repli : génération à la volée côté client si rien n'est en base
      // pour aujourd'hui (cf. note ci-dessus sur la persistance).
      const generees = genererQuestionsDepuisCatalogue(state.entries, 6);
      state.questionsAujourdhui = generees.map((q, i) => ({
        id: `local-${todayISO()}-${i}`,
        texte: q.texte,
        choix1: q.options[0], choix2: q.options[1], choix3: q.options[2], choix4: q.options[3],
        bonne_reponse: q.bonne_reponse,
        categorie: q.categorie,
        date_quiz: todayISO(),
        _local: true, // ces questions ne peuvent pas être référencées par reponses_quiz (pas de vraie ligne en base)
      }));
    }
  } catch (e) {
    console.error("Erreur chargement quiz", e);
    state.questionsAujourdhui = [];
  }

  if (isLoggedIn()) {
    try {
      const { data, error } = await sb.from("scores_quiz").select("*").eq("user_id", currentUserId()).eq("date_quiz", todayISO()).maybeSingle();
      if (error) throw error;
      state.quizScoreDuJour = data || null;
    } catch (e) {
      state.quizScoreDuJour = null;
    }
  }
}

// Charge le détail des réponses données aujourd'hui, pour permettre de
// revoir bonne/mauvaise réponse après coup (sans pouvoir rejouer — la
// contrainte unique sur scores_quiz empêche toujours un 2e essai noté).
export async function loadReponsesDuJour() {
  if (!isLoggedIn()) { state.quizReponsesDuJour = null; return; }
  const idsQuestionsDuJour = state.questionsAujourdhui.filter((q) => !q._local).map((q) => q.id);
  if (idsQuestionsDuJour.length === 0) { state.quizReponsesDuJour = []; return; }
  try {
    const { data, error } = await sb
      .from("reponses_quiz")
      .select("*")
      .eq("user_id", currentUserId())
      .in("question_id", idsQuestionsDuJour);
    if (error) throw error;
    state.quizReponsesDuJour = data || [];
  } catch (e) {
    console.error("Erreur chargement réponses du jour", e);
    state.quizReponsesDuJour = null;
  }
}

// ---- historique de tous les quiz passés ("Revoir mes réponses") ----
// Construit, pour chaque jour où l'utilisateur a joué (scores_quiz),
// le détail complet des questions/réponses/bonnes réponses, en
// joignant reponses_quiz -> questions côté client (questions.date_quiz
// permet de regrouper les réponses par jour).
export async function ouvrirHistoriqueQuiz() {
  if (!isLoggedIn()) { showToast("Connecte-toi pour voir ton historique de quiz."); return; }
  setState({ historiqueQuizModal: { loading: true, quizPasses: [] } });
  try {
    const { data: scores, error: e1 } = await sb
      .from("scores_quiz")
      .select("*")
      .eq("user_id", currentUserId())
      .order("date_quiz", { ascending: false });
    if (e1) throw e1;

    const { data: mesReponses, error: e2 } = await sb
      .from("reponses_quiz")
      .select("*, questions(*)")
      .eq("user_id", currentUserId());
    if (e2) throw e2;

    const quizPasses = (scores || []).map((score) => {
      const reponsesDeCeJour = (mesReponses || []).filter((r) => r.questions && r.questions.date_quiz === score.date_quiz);
      return {
        date: score.date_quiz,
        score: score.score_total,
        bonnesReponses: score.bonnes_reponses,
        totalQuestions: score.total_questions,
        detailVisible: false,
        reponses: reponsesDeCeJour,
      };
    });
    setState({ historiqueQuizModal: { loading: false, quizPasses } });
  } catch (e) {
    console.error("Erreur chargement historique quiz", e);
    showToast("Impossible de charger ton historique de quiz.");
    setState({ historiqueQuizModal: null });
  }
}
export function fermerHistoriqueQuiz() {
  setState({ historiqueQuizModal: null });
}
export function toggleDetailQuizPasse(date) {
  if (!state.historiqueQuizModal) return;
  const quizPasses = state.historiqueQuizModal.quizPasses.map((q) =>
    q.date === date ? { ...q, detailVisible: !q.detailVisible } : q
  );
  setState({ historiqueQuizModal: { ...state.historiqueQuizModal, quizPasses } });
}

export async function loadLeaderboardQuiz() {
  try {
    let dateMin;
    const now = new Date();
    if (state.leaderboardPeriode === "jour") {
      dateMin = todayISO();
    } else if (state.leaderboardPeriode === "semaine") {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      dateMin = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      dateMin = d.toISOString().slice(0, 10);
    }
    const { data, error } = await sb
      .from("scores_quiz")
      .select("*, profils(pseudo, avatar_url)")
      .gte("date_quiz", dateMin)
      .order("score_total", { ascending: false })
      .limit(20);
    if (error) throw error;
    state.leaderboardQuiz = data || [];
  } catch (e) {
    console.error(e);
    state.leaderboardQuiz = [];
  }
}

// ---- déroulement du quiz ----
export function startQuiz() {
  if (state.quizScoreDuJour) { showToast("Tu as déjà fait le quiz d'aujourd'hui !"); return; }
  setState({ quizEnCours: true, quizIndex: 0, quizReponses: [], quizChoixActuel: null, quizTermine: false });
}

export function answerQuizQuestion(choixIndex) {
  if (state.quizChoixActuel !== null) return; // déjà répondu, on attend la transition automatique
  const q = state.questionsAujourdhui[state.quizIndex];
  const correcte = choixIndex === q.bonne_reponse;
  state.quizReponses.push({ question_id: q.id, reponse_donnee: choixIndex, correcte, isLocal: !!q._local });
  setState({ quizChoixActuel: choixIndex });

  setTimeout(() => {
    if (state.quizIndex + 1 >= state.questionsAujourdhui.length) {
      finishQuiz();
    } else {
      setState({ quizIndex: state.quizIndex + 1, quizChoixActuel: null });
    }
  }, 1400);
}

export async function finishQuiz() {
  const bonnes = state.quizReponses.filter((r) => r.correcte).length;
  const total = state.quizReponses.length;
  let score = bonnes * 10;
  if (bonnes === total && total > 0) score += 20; // bonus sans faute

  setState({ quizTermine: true, quizEnCours: false });

  if (!isLoggedIn()) {
    showToast(`Score : ${score} pts — connecte-toi pour l'enregistrer au classement !`);
    return;
  }

  try {
    const { data, error } = await sb.from("scores_quiz").upsert({
      user_id: currentUserId(),
      date_quiz: todayISO(),
      score_total: score,
      bonnes_reponses: bonnes,
      total_questions: total,
    }, { onConflict: "user_id,date_quiz" }).select().single();
    if (error) throw error;
    state.quizScoreDuJour = data;

    // Enregistre aussi le détail des réponses, pour l'historique
    // consultable ("Revoir mes réponses"). On ignore les questions
    // générées localement (pas de vraie ligne `questions` à
    // référencer — ne devrait plus arriver maintenant que le quiz du
    // jour est généré automatiquement en base, voir generer_quiz_du_jour()).
    const reponsesAEnregistrer = state.quizReponses.filter((r) => !r.isLocal);
    if (reponsesAEnregistrer.length > 0) {
      const { error: errReponses } = await sb.from("reponses_quiz").insert(
        reponsesAEnregistrer.map((r) => ({ user_id: currentUserId(), question_id: r.question_id, reponse_donnee: r.reponse_donnee }))
      );
      // Ne fait volontairement pas échouer tout le quiz si cette
      // insertion rate (le score, lui, est déjà bien enregistré) —
      // mais on le signale clairement dans la console plutôt que de
      // l'ignorer en silence comme avant, ce qui rendait le bug
      // invisible et empêchait tout historique de se construire.
      if (errReponses) console.error("Erreur enregistrement détail des réponses du quiz", errReponses);
    }
    showToast(`Quiz terminé : ${score} points !`);
    await loadLeaderboardQuiz();
    render();
  } catch (e) {
    console.error(e);
    showToast("Score calculé mais non enregistré (déjà joué aujourd'hui ?).");
    return; // on ne tente pas de cadeau si le score n'a pas pu être enregistré
  }
  // Volontairement HORS du try/catch ci-dessus, et déjà protégé par
  // son propre try/catch interne : voir le même commentaire dans
  // sauvegarderTierlistBuilder().
  await tenterGagnerCadeau("quiz");
}

// ---- rendu ----
export function renderQuizView() {
  if (state.quizEnCours) return renderQuizEnCours();
  if (state.quizTermine) return renderQuizResultat();

  const dejaJoue = !!state.quizScoreDuJour;
  return `<div class="trends-wrap">
    <section class="tr-section">
      <h2 class="tr-title">Quiz du jour</h2>
      <div class="tr-highlight">
        <p class="tr-hc-names">${state.questionsAujourdhui.length} questions</p>
        <p class="tr-hc-detail">10 points par bonne réponse, +20 points bonus si tu fais un sans-faute.</p>
      </div>
      ${dejaJoue
        ? `<div class="tr-insight" style="margin-top:11px;">Tu as déjà joué aujourd'hui : <b>${state.quizScoreDuJour.score_total} points</b> (${state.quizScoreDuJour.bonnes_reponses}/${state.quizScoreDuJour.total_questions} bonnes réponses). Reviens demain pour un nouveau quiz !</div>
           <button class="ghost-btn" id="toggleQuizRecapBtn" style="width:100%; margin-top:10px;">${state.quizRecapVisible ? "Masquer mes réponses" : "👁 Revoir mes réponses"}</button>`
        : `<button class="primary-btn" id="startQuizBtn" style="width:100%; margin-top:14px;" ${state.questionsAujourdhui.length === 0 ? "disabled" : ""}>Commencer le quiz</button>`
      }
      ${dejaJoue && state.quizRecapVisible ? renderQuizRecap(state.quizReponsesDuJour, false) : ""}
      <button class="ghost-btn" id="ouvrirHistoriqueQuizBtn" style="width:100%; margin-top:10px;">📜 Mes quiz passés</button>
    </section>

    <section class="tr-section">
      <h2 class="tr-title">Classement</h2>
      <div class="tr-role-toggle">
        <button class="${state.leaderboardPeriode === "jour" ? "active" : ""}" data-leaderboard-periode="jour">Aujourd'hui</button>
        <button class="${state.leaderboardPeriode === "semaine" ? "active" : ""}" data-leaderboard-periode="semaine">Semaine</button>
        <button class="${state.leaderboardPeriode === "mois" ? "active" : ""}" data-leaderboard-periode="mois">Mois</button>
      </div>
      ${state.leaderboardQuiz.length === 0 ? `<p class="tr-note">Personne n'a encore joué sur cette période.</p>` : state.leaderboardQuiz.map((s, i) => `
        <div class="tr-person-row" data-open-profil="${esc(s.user_id)}">
          ${s.profils && s.profils.avatar_url ? `<img src="${esc(s.profils.avatar_url)}" class="tr-person-avatar">` : `<span class="tr-rank">${i + 1}</span>`}
          <div class="tr-person-info"><p class="tr-person-name">${esc(s.profils ? s.profils.pseudo : "?")}</p><p class="tr-person-sub">${s.bonnes_reponses}/${s.total_questions} bonnes réponses</p></div>
          <span class="tr-person-score">${s.score_total}</span>
        </div>`).join("")}
    </section>
  </div>`;
}

export function renderQuizEnCours() {
  const q = state.questionsAujourdhui[state.quizIndex];
  const choix = [q.choix1, q.choix2, q.choix3, q.choix4];
  const choisi = state.quizChoixActuel;
  const aRepondu = choisi !== null;
  return `<div class="trends-wrap">
    <section class="tr-section">
      <p class="tr-note">Question ${state.quizIndex + 1} / ${state.questionsAujourdhui.length}</p>
      <div class="tr-card">
        <p class="tr-rk-title" style="font-size:15px; margin-bottom:14px;">${esc(q.texte)}</p>
        <div style="display:flex; flex-direction:column; gap:9px;">
          ${choix.map((c, i) => {
            const num = i + 1;
            let etat = "";
            if (aRepondu) {
              if (num === q.bonne_reponse) etat = "quiz-correct";
              else if (num === choisi) etat = "quiz-incorrect";
            }
            const icone = etat === "quiz-correct" ? `<span class="quiz-answer-icon">✓</span>` : etat === "quiz-incorrect" ? `<span class="quiz-answer-icon">✕</span>` : "";
            return `<button class="ghost-btn quiz-answer-btn ${etat}" data-quiz-answer="${num}" style="text-align:left; padding:12px;" ${aRepondu ? "disabled" : ""}>${esc(c)}${icone}</button>`;
          }).join("")}
        </div>
      </div>
    </section>
  </div>`;
}

export function renderQuizResultat() {
  const bonnes = state.quizReponses.filter((r) => r.correcte).length;
  const total = state.quizReponses.length;
  const score = state.quizScoreDuJour ? state.quizScoreDuJour.score_total : bonnes * 10 + (bonnes === total ? 20 : 0);
  return `<div class="trends-wrap">
    <section class="tr-section">
      <div class="tr-highlight">
        <p class="tr-hc-names">Quiz terminé !</p>
        <p class="tr-hc-detail">${bonnes} / ${total} bonnes réponses<br>Score : <b>${score} points</b>${bonnes === total ? " (bonus sans-faute inclus !)" : ""}</p>
      </div>
      <button class="ghost-btn" id="backToQuizHomeBtn" style="width:100%; margin-top:14px;">Retour</button>
      ${renderQuizRecap(state.quizReponses, true)}
    </section>
  </div>`;
}

export function renderQuizRecap(reponses, inclureLocales) {
  if (reponses === null) return `<p class="tr-note" style="margin-top:10px;">Chargement de tes réponses…</p>`;
  const questionsAvecReponse = inclureLocales ? state.questionsAujourdhui : state.questionsAujourdhui.filter((q) => !q._local);
  if (questionsAvecReponse.length === 0) return `<p class="tr-note" style="margin-top:10px;">Pas de détail disponible pour ce quiz.</p>`;
  return `<div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
    ${questionsAvecReponse.map((q, i) => {
      const rep = reponses.find((r) => r.question_id === q.id);
      const choisi = rep ? rep.reponse_donnee : null;
      const choix = [q.choix1, q.choix2, q.choix3, q.choix4];
      return `<div class="tr-card">
        <p class="tr-rk-title" style="font-size:13.5px; margin-bottom:10px;">${i + 1}. ${esc(q.texte)}</p>
        <div style="display:flex; flex-direction:column; gap:7px;">
          ${choix.map((c, idx) => {
            const num = idx + 1;
            let etat = "";
            if (num === q.bonne_reponse) etat = "quiz-correct";
            else if (num === choisi) etat = "quiz-incorrect";
            const icone = etat === "quiz-correct" ? `<span class="quiz-answer-icon">✓</span>` : etat === "quiz-incorrect" ? `<span class="quiz-answer-icon">✕</span>` : "";
            return `<button class="ghost-btn quiz-answer-btn ${etat}" style="text-align:left; padding:10px;" disabled>${esc(c)}${icone}</button>`;
          }).join("")}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// Version générique du détail rouge/vert pour l'historique : prend
// directement le résultat de la jointure reponses_quiz -> questions
// (chaque élément a .questions et .reponse_donnee), sans dépendre de
// state.questionsAujourdhui comme le fait renderQuizRecap ci-dessus
// (qui ne couvre que le quiz du jour même).
export function renderDetailQuizPasse(reponses) {
  if (!reponses || reponses.length === 0) return `<p class="tr-note" style="margin-top:8px;">Détail indisponible pour ce quiz.</p>`;
  return `<div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
    ${reponses.map((r, i) => {
      const q = r.questions;
      if (!q) return "";
      const choix = [q.choix1, q.choix2, q.choix3, q.choix4];
      return `<div class="tr-card">
        <p class="tr-rk-title" style="font-size:13px; margin-bottom:8px;">${i + 1}. ${esc(q.texte)}</p>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${choix.map((c, idx) => {
            const num = idx + 1;
            let etat = "";
            if (num === q.bonne_reponse) etat = "quiz-correct";
            else if (num === r.reponse_donnee) etat = "quiz-incorrect";
            const icone = etat === "quiz-correct" ? `<span class="quiz-answer-icon">✓</span>` : etat === "quiz-incorrect" ? `<span class="quiz-answer-icon">✕</span>` : "";
            return `<button class="ghost-btn quiz-answer-btn ${etat}" style="text-align:left; padding:9px;" disabled>${esc(c)}${icone}</button>`;
          }).join("")}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// ---- modale "Mes quiz passés" ----
export function renderHistoriqueQuizModal() {
  const m = state.historiqueQuizModal;
  if (!m) return "";
  return `<div class="modal-overlay" id="historiqueQuizOverlay">
    <div class="modal-sheet" id="historiqueQuizSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Mes quiz passés</h3></div>
        <button class="icon-btn" id="historiqueQuizClose">✕</button>
      </div>
      <div class="modal-body">
        ${m.loading ? `<p class="tr-note">Chargement…</p>` : m.quizPasses.length === 0 ? `
          <p class="tr-note">Tu n'as encore joué à aucun quiz.</p>
        ` : m.quizPasses.map((q) => `
          <div class="tr-card" style="margin-bottom:9px;">
            <div class="card-row" style="cursor:pointer;" data-toggle-detail-quiz="${esc(q.date)}">
              <div class="card-main">
                <p class="tr-rk-title" style="font-size:13.5px;">${esc(formatDateFr(q.date))}</p>
                <p class="cast" style="margin-top:2px;">${q.bonnesReponses}/${q.totalQuestions} bonnes réponses · ${q.score} points</p>
              </div>
              <span class="tr-rank">${q.detailVisible ? "▲" : "▼"}</span>
            </div>
            ${q.detailVisible ? renderDetailQuizPasse(q.reponses) : ""}
          </div>`).join("")}
      </div>
    </div>
  </div>`;
}



export function attachQuizListeners() {
  const startQuizBtn = document.getElementById("startQuizBtn");
  if (startQuizBtn) startQuizBtn.addEventListener("click", startQuiz);
  document.querySelectorAll("[data-quiz-answer]").forEach((btn) => {
    btn.addEventListener("click", () => answerQuizQuestion(Number(btn.dataset.quizAnswer)));
  });
  const backToQuizHomeBtn = document.getElementById("backToQuizHomeBtn");
  if (backToQuizHomeBtn) backToQuizHomeBtn.addEventListener("click", () => setState({ quizTermine: false }));
  const toggleQuizRecapBtn = document.getElementById("toggleQuizRecapBtn");
  if (toggleQuizRecapBtn) {
    toggleQuizRecapBtn.addEventListener("click", async () => {
      const ouverture = !state.quizRecapVisible;
      setState({ quizRecapVisible: ouverture });
      if (ouverture && state.quizReponsesDuJour === null) {
        await loadReponsesDuJour();
        render();
      }
    });
  }
  const ouvrirHistoriqueQuizBtn = document.getElementById("ouvrirHistoriqueQuizBtn");
  if (ouvrirHistoriqueQuizBtn) ouvrirHistoriqueQuizBtn.addEventListener("click", ouvrirHistoriqueQuiz);
  const historiqueQuizClose = document.getElementById("historiqueQuizClose");
  if (historiqueQuizClose) historiqueQuizClose.addEventListener("click", fermerHistoriqueQuiz);
  const historiqueQuizOverlay = document.getElementById("historiqueQuizOverlay");
  if (historiqueQuizOverlay) {
    historiqueQuizOverlay.addEventListener("click", (e) => { if (e.target === historiqueQuizOverlay) fermerHistoriqueQuiz(); });
  }
  document.querySelectorAll("[data-toggle-detail-quiz]").forEach((el) => {
    el.addEventListener("click", () => toggleDetailQuizPasse(el.dataset.toggleDetailQuiz));
  });
  document.querySelectorAll("[data-leaderboard-periode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      setState({ leaderboardPeriode: btn.dataset.leaderboardPeriode });
      await loadLeaderboardQuiz();
      render();
    });
  });
}
