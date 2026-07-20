import { renderDeezerMiniPlayer, loadOstLeaderboard, attachDeezerListeners, renderOstView, attachOstListeners } from './ost.js';
import { initAuth, renderAuthModal, attachAuthModalListeners, loadProfilCourant, renderPushPromptBanner } from './auth.js';
import { renderTierlistViewerModal, attachTierlistViewerListeners, loadTierlists, getTierlistLikeCount, renderTierlistsView, renderTierlistBuilder, renderTierlistFormSheet, attachTierlistListeners } from './tierlist.js';
import { loadQuizDuJour, loadLeaderboardQuiz, renderQuizView, renderHistoriqueQuizModal, attachQuizListeners } from './quiz.js';
import { loadCommunaute, chargerMaCollectionActeurs, chargerNotificationsSuggestions, chargerNotificationsAbonnements, chargerNotificationsInteractions, renderCommunauteView, renderAbonnementsView, renderJeuxView, renderProfilPublicView, renderComposerSheet, renderRechercheProfilModal, attachCommunauteListeners, ajouterDepuisSuggestion, envoyerSuggestion, fermerCollection, fermerNotifSuggestions, fermerRechercheProfil, fermerSuggererA, getNotificationsNonLues, lancerRechercheProfilDebounced, marquerAbonnementsVus, marquerInteractionsVues, marquerSuggestionsVues, openComposer, openProfilPublic, ouvrirNotifSuggestions, ouvrirSuggererA } from './social.js';
import { openNew, openEdit, closeForm, updateDraft, attachCastingResultListeners, renderCastingSelector, handlePosterUpload, removePoster, saveDraft, searchPosterOnline, searchPersonPhotoOnline, getTmdbApiKey, setTmdbApiKey, demanderCleTmdbSiAbsente, rechercherSurTmdb, appliquerResultatTmdb, importerCatalogueTmdb, renderTmdbKeyModal, renderTmdbSearchResults, shareDrama, deleteEntry, openNewAVoir, openEditAVoir, closeAVoirForm, updateAVoirDraft, handleAVoirPosterUpload, removeAVoirPoster, saveAVoirDraft, deleteAVoirEntry, exportData, surpriseMe, markAsWatched, uploadAvatar, uploadPersonPhoto, enregistrerModificationPersonne, getFilteredEntries, getAvailableDecades, getStats, renderListView, renderGridContent, renderYearDramaList, renderTrendsNavDrawer, attachTrendsNavDrawerListeners, renderTrendsView, renderTrendsSections, renderAVoirView, renderAVoirFormSheet, renderFormSheet, renderPersonModal, ajouterPersonneAuCasting, retirerPersonneDuCasting, renderDramaModal } from './catalogue.js';

// ============== CONFIG ==============
const SUPABASE_URL = "https://osqyczwawbbwjwaubtvc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Z4ykq9R8uYhtrAks301TPA_ujR1K2VB";
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "kdrama-images";

const SEED = JSON.parse(`[{"titre": "The 1st Shop of Coffee Prince", "titre_kr": "커피프린스 1호점", "annee": 2007, "scenariste": "Lee Jung-ah, Jang Hyun-joo", "realisateur": "Lee Yoon-jung", "acteur": "Gong Yoo", "actrice": "Yoon Eun-hye", "note": 7, "episodes": 17, "duree": 60}, {"titre": "Reply 1988", "titre_kr": "응답하라 1988", "annee": 2015, "scenariste": "Lee Woo-jung", "realisateur": "Shin Won-ho", "acteur": "Park Bo-gum", "actrice": "Hyeri, Ra Mi-ran", "note": 4, "episodes": null, "duree": null}, {"titre": "Descendants of the Sun", "titre_kr": "태양의 후예", "annee": 2016, "scenariste": "Kim Eun-sook, Kim Won-seok", "realisateur": "Lee Eung-bok, Baek Sang-hoon", "acteur": "Song Joong-ki", "actrice": "Song Hye-kyo", "note": 4, "episodes": 16, "duree": 60}, {"titre": "Strong Girl Bong-soon", "titre_kr": "힘쎈여자 도봉순", "annee": 2017, "scenariste": "Baek Mi-kyeong", "realisateur": "Lee Hyung-min", "acteur": "Park Hyung-sik", "actrice": "Park Bo-young", "note": 7, "episodes": 16, "duree": 65}, {"titre": "Fight for My Way", "titre_kr": "쌈 마이웨이", "annee": 2017, "scenariste": "Im Sang-choon", "realisateur": "Lee Na-jeong", "acteur": "Park Seo-joon", "actrice": "Kim Ji-won", "note": 10, "episodes": 16, "duree": 60}, {"titre": "Because This Is My First Life", "titre_kr": "이번 생은 처음이라", "annee": 2017, "scenariste": "Yoon Nan-joong", "realisateur": "Park Joon-hwa", "acteur": "Lee Min-ki", "actrice": "Jung So-min", "note": 6, "episodes": 16, "duree": 60}, {"titre": "Suspicious Partner", "titre_kr": "수상한 파트너", "annee": 2017, "scenariste": "Kwon Ki-young", "realisateur": "Park Sun-ho", "acteur": "Ji Chang-wook", "actrice": "Nam Ji-hyun", "note": 7, "episodes": 20, "duree": 70}, {"titre": "What's Wrong with Secretary Kim", "titre_kr": "김비서가 왜 그럴까", "annee": 2018, "scenariste": "Jung Eun-young", "realisateur": "Park Joon-hwa", "acteur": "Park Seo-joon", "actrice": "Park Min-young", "note": 7, "episodes": 16, "duree": 65}, {"titre": "Clean With Passion for Now", "titre_kr": "일단 뜨겁게 청소하라", "annee": 2018, "scenariste": "Han Hee-jung", "realisateur": "No Jong-chan", "acteur": "Yoon Kyun-sang", "actrice": "Kim Yoo-jung", "note": 6, "episodes": 16, "duree": 60}, {"titre": "100 days my prince", "titre_kr": "백일의 낭군님", "annee": 2018, "scenariste": "No Ji-sul", "realisateur": "Lee Jong-jae, Nam Sung-woo", "acteur": "Kim Seon-ho", "actrice": null, "note": 5, "episodes": 16, "duree": 75}, {"titre": "Her Private Life", "titre_kr": "그녀의 사생활", "annee": 2019, "scenariste": "Kim Hye-young", "realisateur": "Hong Jong-chan", "acteur": "Kim Jae-wook", "actrice": "Park Min-young", "note": 6, "episodes": 16, "duree": 60}, {"titre": "Crash Landing on You", "titre_kr": "사랑의 불시착", "annee": 2019, "scenariste": "Park Ji-eun", "realisateur": "Lee Jung-hyo", "acteur": "Hyun Bin", "actrice": "Son Ye-jin", "note": 10, "episodes": 16, "duree": 70}, {"titre": "Backstreet Rookie", "titre_kr": "편의점 샛별이", "annee": 2020, "scenariste": "Son Geun-joo", "realisateur": "Lee Myung-woo", "acteur": "Ji Chang-wook", "actrice": "Kim Yoo-jung", "note": 10, "episodes": 16, "duree": 60}, {"titre": "True Beauty", "titre_kr": "여신강림", "annee": 2020, "scenariste": "Lee Si-eun", "realisateur": "Kim Sang-hyeop", "acteur": "Cha Eun-woo", "actrice": "Moon Ga-young", "note": 10, "episodes": 16, "duree": 60}, {"titre": "Itaewon Class", "titre_kr": "이태원 클라쓰", "annee": 2020, "scenariste": "Jo Gwang-jin", "realisateur": "Kim Sung-yoon", "acteur": "Park Seo-joon", "actrice": "Kim Da-mi", "note": 9, "episodes": 16, "duree": 70}, {"titre": "Record of Youth", "titre_kr": "청춘기록", "annee": 2020, "scenariste": "Ha Myung-hee", "realisateur": "Ahn Gil-ho", "acteur": "Park Bo-gum", "actrice": "Park So-dam", "note": 5, "episodes": 16, "duree": 70}, {"titre": "Lovestruck in the city", "titre_kr": "도시남녀의 사랑법", "annee": 2020, "scenariste": "Jung Hyun-jung, Jung Da-yun", "realisateur": "Park Shin-woo", "acteur": "Ji Chang-wook", "actrice": "Kim Ji-won", "note": 10, "episodes": 17, "duree": 30}, {"titre": "Start-up", "titre_kr": "스타트업", "annee": 2020, "scenariste": "Park Hye-ryun", "realisateur": "Oh Chung-hwan", "acteur": "Kim Seon-ho", "actrice": "Bae Suzy", "note": 4, "episodes": 16, "duree": 80}, {"titre": "Vincenzo", "titre_kr": "빈센조", "annee": 2021, "scenariste": "Park Jae-bum", "realisateur": "Kim Hee-won", "acteur": "Song Joong-ki", "actrice": "Jeon Yeo-been", "note": 7, "episodes": 20, "duree": 75}, {"titre": "Hometown Cha-Cha-Cha", "titre_kr": "갯마을 차차차", "annee": 2021, "scenariste": "Shin Ha-eun", "realisateur": "Yoo Je-won", "acteur": "Kim Seon-ho", "actrice": "Shin Min-a", "note": 10, "episodes": 16, "duree": 75}, {"titre": "Doom at Your Service", "titre_kr": "어느 날 우리 집 현관으로 멸망이 들어왔다", "annee": 2021, "scenariste": "Im Me-a-ri", "realisateur": "Kwon Young-il", "acteur": "Seo In-guk", "actrice": "Park Bo-young", "note": 3, "episodes": 16, "duree": 60}, {"titre": "Taxi Driver", "titre_kr": "모범택시", "annee": 2021, "scenariste": "Oh Sang-ho, Lee Ji-hyun", "realisateur": "Park Joon-woo", "acteur": "Lee Je-hoon", "actrice": "Pyo Ye-jin", "note": 5, "episodes": 16, "duree": 60}, {"titre": "My Liberation Notes", "titre_kr": "나의 해방일지", "annee": 2022, "scenariste": "Park Hae-young", "realisateur": "Kim Seok-yoon", "acteur": "Son Suk-ku", "actrice": "Kim Ji-won", "note": 8, "episodes": 16, "duree": 70}, {"titre": "The Glory", "titre_kr": "더 글로리", "annee": 2022, "scenariste": "Kim Eun-sook", "realisateur": "Ahn Gil-ho", "acteur": "Lee Do-hyun", "actrice": "Song Hye-kyo", "note": 10, "episodes": 16, "duree": 60}, {"titre": "Juvenile Justice", "titre_kr": "소년 심판", "annee": 2022, "scenariste": "Kim Min-seok", "realisateur": "Hong Jong-chan", "acteur": "Kim Mu-yeol", "actrice": "Kim Hye-soo", "note": 4, "episodes": 10, "duree": 60}, {"titre": "Café Minamdang", "titre_kr": "미남당", "annee": 2022, "scenariste": "Park Hye-jin", "realisateur": "Go Jae-hyun", "acteur": "Seo In-guk", "actrice": "Oh Yeon-seo", "note": 2, "episodes": 18, "duree": 70}, {"titre": "A Good Day to Be a Dog", "titre_kr": "오늘도 사랑스럽개", "annee": 2023, "scenariste": "Baek In-ah", "realisateur": "Kim Dae-woong", "acteur": "Cha Eun-woo", "actrice": "Park Gyu-young", "note": 6, "episodes": 14, "duree": 45}, {"titre": "Delivery Man", "titre_kr": "딜리버리맨", "annee": 2023, "scenariste": "Joo Hyo-jin", "realisateur": "Kang Sol", "acteur": "Yoon Chan-young", "actrice": "Bang Min-ah", "note": 3, "episodes": 12, "duree": 60}, {"titre": "Dream", "titre_kr": "드림", "annee": 2023, "scenariste": "Lee Byeong-heon", "realisateur": "Lee Byeong-heon", "acteur": "Park Seo-joon", "actrice": "IU (Lee Ji-eun)", "note": 6, "episodes": 1, "duree": 125}, {"titre": "Welcome to Samdal-ri", "titre_kr": "웰컴투 삼달리", "annee": 2023, "scenariste": "Kwon Hye-joo", "realisateur": "Cha Young-hoon", "acteur": "Ji Chang-wook", "actrice": "Shin Hae-sun", "note": 9, "episodes": 16, "duree": 69}, {"titre": "Crash course in romance", "titre_kr": "일타 스캔들", "annee": 2023, "scenariste": "Yang Hee-seung", "realisateur": "Yoo Je-won", "acteur": "Jeong Kyeong-ho", "actrice": "Jeon Do-yeon", "note": 7, "episodes": 16, "duree": 70}, {"titre": "Wonderland", "titre_kr": "원더랜드", "annee": 2024, "scenariste": "Kim Tae-yong", "realisateur": "Kim Tae-yong", "acteur": "Gong Yoo", "actrice": "Tang Wei / Bae Suzy", "note": 8, "episodes": 1, "duree": 115}, {"titre": "Officers Black Belt", "titre_kr": "오피서 블랙 벨트", "annee": 2024, "scenariste": "Jason Kim", "realisateur": "Jason Kim", "acteur": "Kim Woo-bin", "actrice": null, "note": 6, "episodes": 1, "duree": 120}, {"titre": "Study Group", "titre_kr": "스터디 그룹", "annee": 2024, "scenariste": "Jang Ho-jin", "realisateur": "Lee Jang-hoon", "acteur": "Hwang Min-hyun", "actrice": "Han Ji-won", "note": 5, "episodes": 8, "duree": 50}, {"titre": "Queen of tears", "titre_kr": "눈물의 여왕", "annee": 2024, "scenariste": "Park Ji-eun", "realisateur": "Kim Hee-won, Jang Young-woo", "acteur": "Kim Soo-hyun", "actrice": "Kim Ji-won", "note": 8, "episodes": 16, "duree": 75}, {"titre": "Lovely Runner", "titre_kr": "선재 업고 튀어", "annee": 2024, "scenariste": "Lee Si-eun", "realisateur": "Yoon Jong-ho", "acteur": "Byeon Woo-seok", "actrice": "Kim Hye-yoon", "note": 8, "episodes": 16, "duree": 70}, {"titre": "Life Gives You Tangerines", "titre_kr": "라이프 기브스 유 탄제린", "annee": 2025, "scenariste": "Im Sang-choon", "realisateur": "Kim Won-seok", "acteur": "Park Bo-gum", "actrice": "IU (Lee Ji-eun)", "note": 10, "episodes": 12, "duree": 60}, {"titre": "Our unwritten Seoul", "titre_kr": "미지의 서울", "annee": 2025, "scenariste": "Lee Kang", "realisateur": "Park Shin-woo", "acteur": "Park Jin-young", "actrice": "Park Bo-young", "note": 5, "episodes": 12, "duree": 70}, {"titre": "The winning try", "titre_kr": "트라이: 우리는 기적이 된다", "annee": 2025, "scenariste": "Lim Jin-ah", "realisateur": "Jang Yeong-seok", "acteur": "Yoon Kye-sang", "actrice": "Im Se-mi", "note": null, "episodes": 12, "duree": 70}, {"titre": "La Vie rêvée de M. Kim", "titre_kr": "서울 자가에 대기업 다니는 김 부장 이야기", "annee": 2025, "scenariste": "Kim Hong-ki, Yoon Hye-sung", "realisateur": "Jo Hyun-tak", "acteur": "Ryoo Seung-ryong", "actrice": "Myung Se-bin", "note": 10, "episodes": 12, "duree": 61}, {"titre": "Boyfriend on Demand", "titre_kr": "월간남친", "annee": 2026, "scenariste": "Namgung Do-young", "realisateur": "Kim Jung-sik", "acteur": "Seo In-guk", "actrice": "Jisoo", "note": 5, "episodes": 10, "duree": 60}, {"titre": "Perfect Crown", "titre_kr": "21세기 대군부인", "annee": 2026, "scenariste": "Yoo Ji-won", "realisateur": "Park Joon-hwa, Bae Hee-young", "acteur": "Byeon Woo-seok", "actrice": "IU", "note": 6, "episodes": 12, "duree": 72}, {"titre": "We are all trying here", "titre_kr": "모두가 자신의 무가치함과 싸우고 있다", "annee": 2026, "scenariste": "Park Hae-young", "realisateur": "Cha Young-hoon", "acteur": "Koo Kyo-hwan", "actrice": "Go Youn-jung", "note": 7, "episodes": 12, "duree": 70}, {"titre": "Can this love be translated ?", "titre_kr": "이 사랑 통역 되나요?", "annee": 2026, "scenariste": "Hong Jung-eun, Hong Mi-ran", "realisateur": "Yoo Young-eun", "acteur": "Kim Seon-ho", "actrice": "Go Youn-jung", "note": 7, "episodes": 12, "duree": 65}]`);

// ============== STATE ==============
export let state = {
  loading: true,
  entries: [],       // CATALOGUE COMMUN (table `dramas`, métadonnées factuelles)
  mesVisionnages: [],   // lignes brutes `mes_visionnages` de l'utilisateur courant
  mesEntries: [],        // jointure visionnages+catalogue, même format que l'ancien `entries` (pour computeTrends/getStats)
  mesVisionnagesTous: [], // tous les visionnages (tous users), pour la note de référence du catalogue
  aVoirCatalogue: [],      // CATALOGUE COMMUN d'envies suggérées (table `a_voir`)
  mesAVoirIds: [],          // ids `a_voir` que l'utilisateur courant a dans sa liste perso
  people: [],
  // Index drama_id -> [{id, nom, role, ordre, photo_url}], peuplé par
  // chargerDramaPersonnes() ; voir enrichirDramasAvecPersonnes().
  dramaPersonnesMap: {},
  aVoir: [],
  activeTab: "tendances",
  trendsNavOpen: false,
  query: "",
  sortBy: "note-desc",
  expandedId: null,
  showForm: false,
  editingId: null,
  draft: emptyDraft(),
  // Texte tapé dans chaque champ de recherche du sélecteur de casting
  // (un par rôle), et personne en cours de création (nom déjà tapé
  // mais pas encore confirmé) — voir renderCastingSelector().
  castingSearchQuery: { acteur: "", actrice: "", scenariste: "", realisateur: "" },
  confirmDeleteId: null,
  imageProcessing: false,
  toastMsg: null,
  trendsRole: "acteur",
  personModal: null,
  // Formulaire d'édition de la fiche personne (nom + rôle) : null
  // quand fermé, sinon { id, nom, role } (brouillon en cours d'édition).
  editingPersonneDraft: null,
  editingPersonneError: null,
  // Pile de navigation entre fiche drama <-> fiche personne : quand on
  // ouvre une fiche depuis une autre (ex. clic sur un acteur depuis la
  // fiche drama), on empile ici l'état qu'on quitte ({type, value}),
  // pour pouvoir y revenir avec un bouton "retour" plutôt que de la
  // perdre. Vidée quand on ferme complètement (bouton ✕).
  modalStack: [],
  expandedAVoirId: null,
  showAVoirForm: false,
  editingAVoirId: null,
  aVoirDraft: emptyAVoirDraft(),
  confirmDeleteAVoirId: null,
  dramaModal: null,
  selectedYear: null,
  searchHadFocus: false,
  viewMode: "liste", // "liste" | "grille"
  filterDecade: "",
  filterMinNote: "",
  filterScenariste: "",
  showFilters: false,
  confirmDuplicateAdd: false,

  // ---- Auth ----
  session: null,
  profil: null,
  authScreen: "login",
  authForm: { email: "", password: "", pseudo: "" },
  authError: null,
  authLoading: false,
  showAuthModal: false,

  // ---- Communauté ----
  avis: [],
  activitesAVoir: [],
  avisLikes: [],
  cadeauxLikes: [],
  cadeauxComments: [],
  abonnements: [],
  // Les 20 derniers profils créés, utilisés pour afficher une carte
  // "X a rejoint le carnet" dans le fil communauté — sans ça, un
  // compte qui vient d'être créé et n'a encore aucune activité
  // (avis, tierlist...) est invisible nulle part dans le fil.
  nouveauxInscrits: [],
  // Cadeaux gagnés récemment par tout le monde (catalogue commun),
  // pour la carte "X a gagné [acteur]" dans le fil — voir loadCommunaute().
  activitesCadeaux: [],
  feedFilter: "suivis",
  // Système de cadeaux (acteurs gagnés en terminant une tierlist ou
  // un quiz) : ma collection (chargée au démarrage), et le cadeau en
  // cours d'ouverture (null tant que personne n'en a gagné un dans
  // cette session).
  maCollectionActeurs: [],
  cadeauEnCours: null, // { personne: {id, nom, role, photo_url}, ouvert: bool }
  collectionModalOpen: false,
  // Modale de commentaires sur une entrée "vu" ou "à voir" d'un profil
  // (likes/commentaires des autres) : null tant que fermée, sinon
  // { kind: "visionnage"|"a_voir", targetId, titre, ownerId, draft }.
  entryCommentModal: null,
  // Notifications "quelqu'un a aimé/commenté ton vu ou ton à voir",
  // même principe que notifAbonnementsData / notifSuggestionsData.
  notifInteractionsData: [],
  // Modale "Envies de mes abonnés" (piocher dans leur liste à voir) :
  // null tant que fermée, sinon tableau d'items {a_voir item, pseudo, avatar_url, user_id}.
  enviesAbonnesOpen: false,
  enviesAbonnesData: null,
  enviesAbonnesLoading: false,
  // Sélecteur "Suggérer à..." ouvert depuis une fiche drama : null
  // fermé, sinon { sourceType: "drama"|"avoir", drama } en cours de
  // suggestion à un abonné.
  suggererADraft: null,
  // Cloche de notifications (suggestions reçues + nouveaux abonnés) :
  // compteur non lu + liste complète, chargés au démarrage et
  // rafraîchis périodiquement. Les deux types sont fusionnés dans la
  // même cloche/modale (notifSuggestionsData garde son nom historique
  // mais ne contient plus que les suggestions ; notifAbonnementsData
  // contient les nouveaux abonnés, et les deux sont combinés à
  // l'affichage — voir getNotificationsNonLues()/renderNotifSuggestionsModal()).
  notifSuggestionsOpen: false,
  notifSuggestionsData: [],
  notifAbonnementsData: [],
  // Modale "Chercher un profil" (par pseudo) : permet de trouver et
  // s'abonner à quelqu'un qui n'a encore aucune activité visible dans
  // le fil (ex. un compte qui vient d'être créé).
  rechercheProfilOpen: false,
  rechercheProfilQuery: "",
  rechercheProfilResultats: [],
  rechercheProfilLoading: false,
  // Modale liste "Abonnés"/"Abonnements" d'un profil : null fermée,
  // sinon { mode: "abonnes"|"abonnements", profils: [...], loading }.
  listeAbonnesModal: null,
  composerOpen: false,
  composerDramaId: "",
  composerNote: "",
  composerCommentaire: "",
  profilPublicId: null,
  profilPublicData: null,
  profilRetourTab: "communaute", // onglet vers lequel revenir avec le bouton ← Retour de la fiche profil
  // "default" (jamais demandé) | "granted" | "denied" | "unsupported"
  pushPermissionStatus: ("Notification" in window) ? Notification.permission : "unsupported",

  // ---- Tierlists ----
  tierlists: [],
  tierlistLikes: [],
  showTierlistForm: false,
  tierlistFormStep: "choix",
  tierlistDraft: { id: null, titre: "", theme: "", description: "", est_publique: true, sourceType: "drama", niveaux: null },
  editingTierlistId: null,
  editingTierlistNiveaux: null,
  builderItems: [],
  builderPool: [],
  builderSearchQuery: "",
  builderSearchHadFocus: false,
  tierlistsSort: "populaires",
  tierlistViewerOpen: false,
  tierlistViewerHtml: "",
  tierlistViewerId: null,
  tierlistComments: [],
  tierlistCommentLikes: [],
  tierlistCommentDraft: "",
  tierlistCommentNote: "",

  // ---- Quiz quotidien ----
  questionsAujourdhui: [],
  quizEnCours: false,
  quizIndex: 0,
  quizReponses: [],
  quizChoixActuel: null,
  quizTermine: false,
  quizScoreDuJour: null,
  quizReponsesDuJour: null,
  quizRecapVisible: false,
  leaderboardQuiz: [],
  leaderboardPeriode: "jour",
  // Modale "Mes quiz passés" : null fermée, sinon { loading, quizPasses: [{date, score, detailVisible, questions: [...]}] }.
  historiqueQuizModal: null,

  // ---- OST Challenge ----
  ostMode: "ecoute", // "ecoute" | "correspondance"
  widgetSimplePlaylistId: null,
  showChangerPlaylistOst: false,
  playlistLienInput: "",
  ostRoundsTotal: 6,
  ostEnCours: false,
  ostIndex: 0,
  // ---- Mini-lecteur Deezer flottant (persistant, hors de #app) ----
  // miniPlayerOpen ne déclenche QUE renderDeezerMiniPlayer(), jamais
  // render() global — voir le commentaire sur #deezer-mini-player.
  miniPlayerOpen: false,
  miniPlayerPlaylistId: null, // null => OST_PLAYLIST_DEFAUT
  miniPlayerShowChange: false,
  miniPlayerLienInput: "",
  miniPlayerError: null,
  ostScore: 0,
  ostQuestions: [],
  ostTermine: false,
  ostLeaderboard: [],
  ostError: null,

  // ---- TMDB ----
  showTmdbKeyModal: false,
  tmdbSearchLoading: false,
  tmdbSearchResults: [],
  tmdbImportEnCours: false,
  tmdbImportProgress: 0,
  tmdbImportTotal: 0,
};

export function emptyDraft() {
  return {
    id: null, visionnage_id: null, titre: "", titre_kr: "", annee: "", scenariste: "", realisateur: "", acteur: "", actrice: "",
    note: "", episodes: "", duree: "", poster_url: "", date_visionnage: "",
    // Casting structuré pour le nouveau sélecteur de personnes : un
    // tableau {id, nom} par rôle (id null = personne pas encore créée
    // en base, sera créée à l'enregistrement). Les champs texte
    // ci-dessus (scenariste, realisateur, acteur, actrice) restent
    // remplis par TMDB pour compatibilité, mais ne sont plus la
    // source d'enregistrement — voir saveDraft().
    castingSelection: { acteur: [], actrice: [], scenariste: [], realisateur: [] },
  };
}

export function emptyAVoirDraft() {
  return { id: null, mes_a_voir_id: null, titre: "", titre_kr: "", annee: "", scenariste: "", realisateur: "", acteur: "", actrice: "", resume: "", poster_url: "" };
}

export function setState(patch) {
  state = { ...state, ...patch };
  // render() reconstruit tout le DOM via innerHTML, ce qui fait perdre
  // la position de scroll (la page "saute" en haut à chaque frappe,
  // par ex. dans la recherche du réservoir de tierlist). On mémorise
  // la position avant le re-render et on la restaure juste après.
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  render();
  window.scrollTo(scrollX, scrollY);
}

let toastTimer = null;
export function showToast(msg) {
  setState({ toastMsg: msg });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toastMsg: null }), 2600);
}

// Désactive un bouton et change son texte pendant l'exécution d'une
// action asynchrone (évite les doubles clics — double tierlist créée,
// double avis publié, etc.), puis le restaure systématiquement à la
// fin (succès ou échec), y compris si l'action lève une exception.
// N'agit que sur le DOM directement (pas setState), pour rester léger
// et ne provoquer aucun re-render parasite.
export async function avecBoutonDesactive(boutonId, texteEnCours, action) {
  const btn = document.getElementById(boutonId);
  const texteOriginal = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = texteEnCours; }
  try {
    await action();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = texteOriginal; }
  }
}

// ============== DATA LOADING ==============

// Reconstruit, pour chaque drama, les champs texte historiques
// (acteur, actrice, scenariste, realisateur) à partir de la nouvelle
// table de liaison drama_personnes + personnes, plutôt que depuis les
// colonnes texte brutes de "dramas" (qui restent en base comme filet
// de sécurité mais ne sont plus la source de vérité). Cela permet à
// tout le code existant qui lit d.acteur / d.actrice / etc. de
// continuer à fonctionner sans modification, tout en bénéficiant de
// la correction d'un nom propagée partout via la fiche personne.
//
// Attache aussi `personnes_liees` (tableau {id, nom, role, ordre})
// sur chaque drama, pour les futurs usages qui ont besoin de l'id
// (fiche personne modifiable, formulaire de saisie par sélection).
//
// state.dramaPersonnesMap doit être peuplée au préalable par
// chargerDramaPersonnes().
export function enrichirDramasAvecPersonnes(dramasList) {
  if (!Array.isArray(dramasList)) return dramasList;
  const map = state.dramaPersonnesMap || {};
  return dramasList.map((d) => {
    const liens = (map[d.id] || []).slice().sort((a, b) => a.ordre - b.ordre);
    if (liens.length === 0) {
      // Aucun lien structuré pour ce drama (ex. créé avant la
      // migration, ou jamais rechargé) : on garde les colonnes texte
      // telles quelles, sans rien casser.
      return { ...d, personnes_liees: [] };
    }
    const parRole = (role) => liens.filter((l) => l.role === role);
    const texteParRole = (role) => parRole(role).map((l) => l.nom).join(", ") || null;
    const acteurs = parRole("acteur");
    return {
      ...d,
      acteur: acteurs.length > 0 ? acteurs[0].nom : null, // historiquement un seul nom dans ce champ
      actrice: texteParRole("actrice"),
      scenariste: texteParRole("scenariste"),
      realisateur: texteParRole("realisateur"),
      personnes_liees: liens,
    };
  });
}

// Charge tous les liens drama<->personne en une fois (catalogue
// commun, peu de lignes), et les indexe par drama_id pour un accès
// rapide dans enrichirDramasAvecPersonnes().
export async function chargerDramaPersonnes() {
  try {
    const { data, error } = await sb
      .from("drama_personnes")
      .select("drama_id, role, ordre, personnes(id, nom, role, photo_url)");
    if (error) throw error;
    const map = {};
    (data || []).forEach((row) => {
      if (!row.personnes) return;
      if (!map[row.drama_id]) map[row.drama_id] = [];
      map[row.drama_id].push({
        id: row.personnes.id,
        nom: row.personnes.nom,
        role: row.role,
        ordre: row.ordre,
        photo_url: row.personnes.photo_url,
      });
    });
    state.dramaPersonnesMap = map;
  } catch (e) {
    console.error("Erreur chargement drama_personnes", e);
    state.dramaPersonnesMap = {};
  }
}


export async function loadData() {
  // dramaPersonnesMap doit être prêt avant d'enrichir les dramas qui
  // suivent (state.entries ci-dessous, puis mesEntries plus bas via
  // chargerMesVisionnages()).
  await chargerDramaPersonnes();

  try {
    const { data: dramas, error: e1 } = await sb.from("dramas").select("*").order("created_at", { ascending: true });
    if (e1) throw e1;
    state.entries = enrichirDramasAvecPersonnes(dramas || []); // CATALOGUE COMMUN (métadonnées factuelles, plus de note/date perso fiable ici)
  } catch (e) {
    console.error("Load error", e);
    state.entries = [];
  }

  try {
    const { data: people, error: e2 } = await sb.from("personnes").select("*");
    if (e2) throw e2;
    state.people = people || [];
  } catch (e) {
    state.people = [];
  }

  try {
    const { data: avoir, error: e3 } = await sb.from("a_voir").select("*").order("created_at", { ascending: true });
    if (e3) throw e3;
    state.aVoirCatalogue = avoir || []; // CATALOGUE COMMUN d'envies suggérées
  } catch (e) {
    console.error("A voir load error", e);
    state.aVoirCatalogue = [];
  }

  // Couche personnelle (Modèle B) : visionnages et envies propres à
  // l'utilisateur connecté. Vide si personne n'est connecté.
  await chargerMesVisionnages();
  await chargerMesAVoir();
  await chargerTousLesVisionnages();

  // Modules sociaux : chargés après le catalogue de base, car certains
  // (tierlists notamment) s'appuient sur state.entries pour proposer un
  // pool d'éléments par défaut. Chaque chargement est indépendant et ne
  // doit pas faire échouer les autres en cas d'erreur réseau ponctuelle.
  await Promise.allSettled([
    loadCommunaute(),
    loadTierlists(),
    loadQuizDuJour(),
    loadLeaderboardQuiz(),
    loadOstLeaderboard(),
    chargerNotificationsSuggestions(),
    chargerNotificationsAbonnements(),
    chargerNotificationsInteractions(),
    chargerMaCollectionActeurs(),
  ]);

  state.loading = false;
  render();
}

// ---- couche personnelle : visionnages (Modèle B) ----
// Produit un tableau dans le MÊME FORMAT que l'ancien state.entries
// (mêmes clés : titre, acteur, actrice, note, episodes, duree...), où
// `note` et `date_visionnage` viennent de `mes_visionnages` (perso) et
// le reste vient du catalogue `dramas` (factuel, partagé). Ainsi
// computeTrends(), getStats() et le reste du moteur de Tendances
// continuent de fonctionner sans aucune modification : on change
// seulement CE QU'ON LEUR PASSE en argument.
export async function chargerMesVisionnages() {
  if (!isLoggedIn()) { state.mesVisionnages = []; state.mesEntries = []; return; }
  try {
    const { data, error } = await sb
      .from("mes_visionnages")
      .select("*, dramas(*)")
      .eq("user_id", currentUserId());
    if (error) throw error;
    state.mesVisionnages = data || [];
    const brut = (data || [])
      .filter((v) => v.dramas) // ignore les visionnages dont le drama aurait été supprimé du catalogue
      .map((v) => ({ ...v.dramas, note: v.note, date_visionnage: v.date_visionnage, visionnage_id: v.id }));
    state.mesEntries = enrichirDramasAvecPersonnes(brut);
  } catch (e) {
    console.error("Erreur chargement visionnages", e);
    state.mesVisionnages = [];
    state.mesEntries = [];
  }
}

// ---- couche personnelle : à voir (Modèle B) ----
export async function chargerMesAVoir() {
  if (!isLoggedIn()) { state.mesAVoirIds = []; state.aVoir = []; return; }
  try {
    const { data, error } = await sb
      .from("mes_a_voir")
      .select("*, a_voir(*)")
      .eq("user_id", currentUserId());
    if (error) throw error;
    state.mesAVoirIds = (data || []).map((m) => m.a_voir_id);
    state.aVoir = (data || [])
      .filter((m) => m.a_voir)
      .map((m) => ({ ...m.a_voir, mes_a_voir_id: m.id }));
  } catch (e) {
    console.error("Erreur chargement a-voir perso", e);
    state.mesAVoirIds = [];
    state.aVoir = [];
  }
}

// Tous les visionnages de tous les utilisateurs (lecture publique,
// RLS l'autorise), utilisés uniquement pour calculer les notes de
// référence agrégées du catalogue. Distinct de state.mesVisionnages
// (qui ne contient que ceux de l'utilisateur courant).
async function chargerTousLesVisionnages() {
  try {
    const { data, error } = await sb.from("mes_visionnages").select("drama_id, note");
    if (error) throw error;
    state.mesVisionnagesTous = data || [];
  } catch (e) {
    console.error("Erreur chargement visionnages globaux", e);
    state.mesVisionnagesTous = [];
  }
}

// Note de référence affichée dans le catalogue commun (recherche,
// tierlists, fiche détail) : moyenne de toutes les notes personnelles
// enregistrées par les utilisateurs ayant vu ce drama. `null` si
// personne n'a encore noté.
export function getNoteReference(dramaId) {
  const notes = (state.mesVisionnagesTous || [])
    .filter((v) => v.drama_id === dramaId && v.note !== null && v.note !== undefined)
    .map((v) => Number(v.note));
  if (notes.length === 0) return null;
  return notes.reduce((s, n) => s + n, 0) / notes.length;
}
export function getNombreVus(dramaId) {
  return (state.mesVisionnagesTous || []).filter((v) => v.drama_id === dramaId).length;
}

export function findPersonPhoto(nom, role) {
  if (!nom) return null;
  const p = state.people.find((pp) => pp.nom === nom && (!role || pp.role === role));
  return p ? p.photo_url : null;
}

// Retrouve l'id (uuid) d'une personne dans la table "personnes" à
// partir de son nom+rôle. Utilisé pour permettre l'édition depuis
// personModal, qui n'a souvent que {nom, role} au moment de
// l'ouverture (cas hérité du code existant). (nom, role) est unique
// en base, donc cette correspondance est fiable.
export function findPersonneId(nom, role) {
  if (!nom) return null;
  const p = state.people.find((pp) => pp.nom === nom && pp.role === role);
  return p ? p.id : null;
}

// ============== IMAGE UPLOAD ==============
function resizeImageFile(file, maxDim, quality) {
  maxDim = maxDim || 480;
  quality = quality || 0.8;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, pathPrefix) {
  const blob = await resizeImageFile(file);
  const fileName = `${pathPrefix}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ============== TRENDS CALCULATIONS ==============
export function splitPeople(s) {
  if (!s) return [];
  return String(s).replace(/ et /g, ",").split(",").map((p) => p.trim()).filter(Boolean);
}

export function computeTrends(entries) {
  if (!entries || entries.length === 0) return null;

  const titles = entries.map((d) => {
    const people = [];
    if (d.acteur) people.push([d.acteur.trim(), "acteur"]);
    splitPeople(d.actrice).forEach((n) => people.push([n, "actrice"]));
    splitPeople(d.scenariste).forEach((n) => people.push([n, "scenariste"]));
    splitPeople(d.realisateur).forEach((n) => people.push([n, "realisateur"]));
    const note = d.note === null || d.note === undefined || d.note === "" ? null : Number(d.note);
    return { ...d, note, people };
  });

  const rated = titles.filter((t) => t.note !== null);
  const withEp = titles.filter((t) => t.episodes && Number(t.episodes) >= 2);

  const KNOWN_RELEASE_DATES = {
    "Boyfriend on Demand": 20260306,
    "Can this love be translated ?": 20260116,
    "Perfect Crown": 20260410,
    "We are all trying here": 20260418,
  };
  const sortKey = (t) => KNOWN_RELEASE_DATES[t.titre] || (t.annee ? t.annee * 10000 : 0);

  const records = rated.length
    ? {
        best: rated.reduce((a, b) => (b.note > a.note ? b : a)),
        worst: rated.reduce((a, b) => (b.note < a.note ? b : a)),
        oldest: titles.reduce((a, b) => (b.annee && (!a.annee || sortKey(b) < sortKey(a)) ? b : a)),
        newest: titles.reduce((a, b) => (b.annee && (!a.annee || sortKey(b) > sortKey(a)) ? b : a)),
        longest: withEp.length ? withEp.reduce((a, b) => (Number(b.episodes) > Number(a.episodes) ? b : a)) : null,
        shortest: withEp.length ? withEp.reduce((a, b) => (Number(b.episodes) < Number(a.episodes) ? b : a)) : null,
      }
    : null;

  const distribution = {};
  for (let n = 0; n <= 10; n++) distribution[n] = 0;
  rated.forEach((t) => { const r = Math.round(t.note); distribution[r] = (distribution[r] || 0) + 1; });
  const coupsDeCoeur = rated.filter((t) => t.note >= 9).length;
  const deceptions = rated.filter((t) => t.note <= 4).length;
  const avgNote = rated.length ? rated.reduce((s, t) => s + t.note, 0) / rated.length : null;

  const profileMap = new Map();
  titles.forEach((t) => {
    t.people.forEach(([name, role]) => {
      const key = name + "||" + role;
      if (!profileMap.has(key)) profileMap.set(key, { name, role, titles: [] });
      profileMap.get(key).titles.push({ titre: t.titre, note: t.note, annee: t.annee });
    });
  });
  const peopleProfiles = Array.from(profileMap.values()).map((p) => {
    const notes = p.titles.map((t) => t.note).filter((n) => n !== null);
    const avg_note = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : null;
    let variance = null;
    if (notes.length >= 2) {
      const m = avg_note;
      variance = Math.sqrt(notes.reduce((s, n) => s + (n - m) * (n - m), 0) / notes.length);
    }
    return { ...p, count: p.titles.length, avg_note, variance };
  });

  const collabMap = new Map();
  titles.forEach((t) => {
    const ppl = t.people;
    for (let i = 0; i < ppl.length; i++) {
      for (let j = i + 1; j < ppl.length; j++) {
        const [n1, r1] = ppl[i], [n2, r2] = ppl[j];
        const pair = [{ name: n1, role: r1 }, { name: n2, role: r2 }].sort((a, b) => (a.name + a.role).localeCompare(b.name + b.role));
        const key = pair.map((p) => p.name + "||" + p.role).join("::");
        if (!collabMap.has(key)) collabMap.set(key, { p1: pair[0].name, role1: pair[0].role, p2: pair[1].name, role2: pair[1].role, titles: [] });
        collabMap.get(key).titles.push({ titre: t.titre, note: t.note });
      }
    }
  });
  const allCollabs = Array.from(collabMap.values()).map((c) => {
    const notes = c.titles.map((t) => t.note).filter((n) => n !== null);
    const avg_note = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : null;
    return { ...c, count: c.titles.length, avg_note };
  });
  const recurringCollabs = allCollabs.filter((c) => c.count >= 2).sort((a, b) => b.count - a.count);

  const byYear = new Map();
  titles.forEach((t) => {
    if (!t.annee) return;
    if (!byYear.has(t.annee)) byYear.set(t.annee, []);
    byYear.get(t.annee).push(t);
  });
  const yearStats = Array.from(byYear.entries())
    .map(([annee, list]) => {
      const notes = list.map((t) => t.note).filter((n) => n !== null);
      return { annee, count: list.length, avg_note: notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : null };
    })
    .sort((a, b) => a.annee - b.annee);
  const yearsWithNotes = yearStats.filter((y) => y.avg_note !== null);
  const mostGenerousYear = yearsWithNotes.length ? yearsWithNotes.reduce((a, b) => (b.avg_note > a.avg_note ? b : a)) : null;
  const mostSevereYear = yearsWithNotes.length ? yearsWithNotes.reduce((a, b) => (b.avg_note < a.avg_note ? b : a)) : null;

  const efficiency = titles
    .filter((t) => t.note !== null && t.episodes && t.duree && Number(t.episodes) >= 2)
    .map((t) => {
      const totalMin = Number(t.episodes) * Number(t.duree);
      return { titre: t.titre, note: t.note, total_min: totalMin, score: (t.note / totalMin) * 1000, poster_url: t.poster_url };
    })
    .sort((a, b) => b.score - a.score);

  const withFormat = titles.filter((t) => t.note !== null && t.episodes && t.duree);
  const shortFormat = withFormat.filter((t) => Number(t.episodes) <= 12);
  const longFormat = withFormat.filter((t) => Number(t.episodes) > 12);
  const avgOf = (arr) => (arr.length ? arr.reduce((s, t) => s + t.note, 0) / arr.length : null);

  // Acting duos only (acteur + actrice pairs), separate from writer/director collaborations.
  const actingDuos = allCollabs
    .filter((c) => (c.role1 === "acteur" && c.role2 === "actrice") || (c.role1 === "actrice" && c.role2 === "acteur"))
    .sort((a, b) => b.count - a.count || (b.avg_note || 0) - (a.avg_note || 0));

  // Personal taste profile: dominant actor/actress, favorite scenariste, format leaning.
  const topActor = peopleProfiles.filter((p) => p.role === "acteur").sort((a, b) => b.count - a.count)[0] || null;
  const topActress = peopleProfiles.filter((p) => p.role === "actrice").sort((a, b) => b.count - a.count)[0] || null;
  const topScenariste = peopleProfiles.filter((p) => p.role === "scenariste" && p.count >= 2 && p.avg_note !== null).sort((a, b) => b.avg_note - a.avg_note)[0] || null;
  const formatLean = (shortFormat.length || 0) >= (longFormat.length || 0) ? "courts" : "longs";

  // Viewing history based on date_visionnage (when available).
  const withViewDate = titles.filter((t) => t.date_visionnage);
  const monthCounts = {};
  const moisNoms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  withViewDate.forEach((t) => {
    const m = Number(t.date_visionnage.split("-")[1]) - 1;
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  let busiestMonth = null;
  Object.keys(monthCounts).forEach((m) => {
    if (!busiestMonth || monthCounts[m] > monthCounts[busiestMonth]) busiestMonth = m;
  });
  const viewingStats = withViewDate.length >= 2
    ? { busiestMonthName: busiestMonth !== null ? moisNoms[busiestMonth] : null, busiestMonthCount: busiestMonth !== null ? monthCounts[busiestMonth] : 0, totalWithDate: withViewDate.length }
    : null;

  return {
    records, distribution, coupsDeCoeur, deceptions, avgNote, peopleProfiles, allCollabs, recurringCollabs,
    yearStats, mostGenerousYear, mostSevereYear, efficiency,
    formats: { short: { avg: avgOf(shortFormat), count: shortFormat.length }, long: { avg: avgOf(longFormat), count: longFormat.length } },
    totalPeople: peopleProfiles.length,
    actingDuos,
    tasteProfile: { topActor, topActress, topScenariste, formatLean },
    viewingStats,
  };
}

export function findProfile(trends, name, role) {
  return trends ? trends.peopleProfiles.find((p) => p.name === name && p.role === role) || null : null;
}

// ---- dramas "tous confondus", pour les fiches acteur/actrice ----
// Une fiche personne (clic sur un nom dans le casting) doit s'ouvrir
// peu importe d'où vient le clic : un drama déjà vu (mesEntries), un
// drama "à voir" (aVoir), ou un drama du catalogue commun pas encore
// ajouté (entries). Sans cette fusion, computeTrends(state.mesEntries)
// ne "connaît" que les dramas vus, et la fiche d'un acteur/actrice
// présent seulement dans "à voir" ou le catalogue reste vide (aucun
// profil trouvé) : le clic semble alors ne rien faire. On fusionne
// donc les trois sources, en dédupliquant par titre — en gardant la
// version "mesEntries" (note/date perso) en priorité si un même titre
// existe dans plusieurs listes à la fois.
export function entriesPourFichesPersonnes() {
  const parTitre = new Map();
  (state.entries || []).forEach((d) => parTitre.set(d.titre, d));
  (state.aVoir || []).forEach((d) => parTitre.set(d.titre, d));
  (state.mesEntries || []).forEach((d) => parTitre.set(d.titre, d));
  return Array.from(parTitre.values());
}
export function findCollabsFor(trends, name, role) {
  if (!trends) return [];
  return trends.allCollabs.filter((c) => (c.p1 === name && c.role1 === role) || (c.p2 === name && c.role2 === role)).sort((a, b) => b.count - a.count);
}

// Revient à la fiche (drama ou personne) précédente dans modalStack,
// utilisé par le bouton "←" des fiches drama/personne quand on y est
// arrivé en cliquant depuis une autre fiche.
function goBackModalStack() {
  const stack = state.modalStack.slice();
  const previous = stack.pop();
  if (!previous) return;
  if (previous.type === "drama") {
    setState({ dramaModal: previous.value, personModal: null, modalStack: stack });
  } else if (previous.type === "person") {
    setState({ personModal: previous.value, dramaModal: null, modalStack: stack });
  }
}

// Traditional Korean blue-and-white porcelain-style floral motif, used as placeholder when no image is set.
const FLOWER_MOTIF_SVG = `<svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <circle cx="30" cy="30" r="27" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <g fill="currentColor" opacity="0.9">
    <ellipse cx="30" cy="18" rx="5" ry="9"/>
    <ellipse cx="30" cy="42" rx="5" ry="9"/>
    <ellipse cx="18" cy="30" rx="9" ry="5"/>
    <ellipse cx="42" cy="30" rx="9" ry="5"/>
    <ellipse cx="21" cy="21" rx="5" ry="8" transform="rotate(-45 21 21)"/>
    <ellipse cx="39" cy="39" rx="5" ry="8" transform="rotate(-45 39 39)"/>
    <ellipse cx="39" cy="21" rx="5" ry="8" transform="rotate(45 39 21)"/>
    <ellipse cx="21" cy="39" rx="5" ry="8" transform="rotate(45 21 39)"/>
  </g>
  <circle cx="30" cy="30" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

export const fmtNote = (n) => (n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));
export const roleLabel = (r) => ({ acteur: "Acteur", actrice: "Actrice", scenariste: "Scénariste", realisateur: "Réalisateur" }[r] || r);
export const reliabilityBadge = (count) => {
  if (count >= 3) return { label: `Tendance · ${count} titres`, cls: "b3" };
  if (count === 2) return { label: "À confirmer · 2 titres", cls: "b2" };
  return { label: "Anecdotique · 1 titre", cls: "b1" };
};
export function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---- liens cliquables vers une fiche personne ----
// `splitPeople` (déjà défini plus bas, gère "X, Y" et "X et Y") est
// utilisé ici pour transformer un champ multi-noms en plusieurs liens
// distincts. `data-stop-propagation` empêche le clic de se propager à
// une carte parente cliquable (ouverture/fermeture de détail), comme
// déjà utilisé pour `.card-detail`.
export function personLinkHtml(nom, role) {
  if (!nom) return "";
  return `<span data-stop-propagation="1" data-person-name="${esc(nom)}" data-person-role="${esc(role)}" style="cursor:pointer; color:var(--blue-deep); font-weight:600;">${esc(nom)}</span>`;
}
export function castingLinksHtml(champ, role, separateur) {
  if (!champ) return "";
  const noms = splitPeople(champ);
  return noms.map((n) => personLinkHtml(n, role)).join(separateur || ", ");
}


// ============================================================
// === DEBUT DES NOUVEAUX MODULES SOCIAUX (Auth, Communaute,
// === Tierlists, Quiz, OST Challenge) ===
// ============================================================

export function isLoggedIn() {
  return !!state.session;
}

export function currentUserId() {
  return state.session ? state.session.user.id : null;
}


// ---- modale "envies de mes abonnés" ----
function renderEnviesAbonnesModal() {
  if (!state.enviesAbonnesOpen) return "";
  const items = state.enviesAbonnesData;
  return `<div class="modal-overlay" id="enviesAbonnesOverlay">
    <div class="modal-sheet" id="enviesAbonnesSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Envies de tes abonnements</h3></div>
        <button class="icon-btn" id="enviesAbonnesClose">✕</button>
      </div>
      <div class="modal-body">
        ${state.enviesAbonnesLoading ? `<p class="tr-note">Chargement…</p>` : !items ? "" : items.length === 0 ? `
          <p class="tr-note">Aucune envie à piocher pour l'instant — soit tu ne suis personne, soit tes abonnements n'ont rien dans leur liste à voir que tu n'aies pas déjà.</p>
        ` : items.map((item) => `
          <article class="drama-card" style="cursor:default;">
            <div class="card-row">
              ${item.poster_url ? `<img src="${esc(item.poster_url)}" alt="" class="poster-thumb">` : `<div class="stamp empty motif-flower">${FLOWER_MOTIF_SVG}</div>`}
              <div class="card-main">
                <h2>${esc(item.titre)}${item.annee ? `<span class="year"> · ${esc(item.annee)}</span>` : ""}</h2>
                <p class="cast">${[castingLinksHtml(item.acteur, "acteur"), castingLinksHtml(item.actrice, "actrice")].filter(Boolean).join("  ·  ") || "Casting non renseigné"}</p>
                ${item.suggere_par ? `<p class="cast" style="margin-top:4px;">Envie de <b style="color:var(--blue-deep); cursor:pointer;" data-open-profil="${esc(item.suggere_par.id)}">${esc(item.suggere_par.pseudo)}</b></p>` : ""}
              </div>
            </div>
            <div class="card-actions" style="margin-top:8px;">
              <button class="text-btn" data-piocher-envie="${esc(item.id)}">➕ Ajouter à ma liste à voir</button>
            </div>
          </article>`).join("")}
      </div>
    </div>
  </div>`;
}

// ---- modale notifications (suggestions reçues) ----
function renderNotifSuggestionsModal() {
  if (!state.notifSuggestionsOpen) return "";
  const suggestions = (state.notifSuggestionsData || []).map((s) => ({ type: "suggestion", date: s.created_at, data: s }));
  const abonnements = (state.notifAbonnementsData || []).map((n) => ({ type: "abonnement", date: n.created_at, data: n }));
  const interactions = (state.notifInteractionsData || []).map((n) => ({ type: "interaction", date: n.created_at, data: n }));
  const items = [...suggestions, ...abonnements, ...interactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  return `<div class="modal-overlay" id="notifSuggestionsOverlay">
    <div class="modal-sheet" id="notifSuggestionsSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Notifications</h3></div>
        <button class="icon-btn" id="notifSuggestionsClose">✕</button>
      </div>
      <div class="modal-body">
        ${items.length === 0 ? `<p class="tr-note">Aucune notification pour l'instant.</p>` : items.map((item) => {
          if (item.type === "interaction") {
            const n = item.data;
            const p = n.profil_auteur;
            const pseudo = p ? p.pseudo : "Quelqu'un";
            if (n.interaction_type === "creation") {
              // Cas à part : ce n'est pas une réaction à ton contenu,
              // c'est l'auteur qui annonce SA propre nouvelle création
              // à ses abonnés (voir creerTierlist()) — la phrase ne suit
              // donc pas le schéma "X a aimé/commenté [ton contenu]".
              return `<article class="drama-card" style="cursor:default; ${!n.vue ? "border-color:var(--seal);" : ""}">
                <div class="card-row">
                  ${p && p.avatar_url
                    ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar" style="width:48px;height:48px;object-fit:cover;cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">`
                    : `<div class="stamp mini motif-flower" style="width:48px;height:48px;cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">${FLOWER_MOTIF_SVG}</div>`}
                  <div class="card-main">
                    <h2>▦ ${esc(n.titre || "")}</h2>
                    <p class="cast"><b style="color:var(--blue-deep); cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">${esc(pseudo)}</b> a créé une nouvelle tierlist</p>
                  </div>
                </div>
              </article>`;
            }
            const lieu = n.target_kind === "visionnage" ? "un drama que tu as vu"
              : n.target_kind === "a_voir" ? "une envie de ta liste à voir"
              : n.target_kind === "tendances" ? "tes tendances"
              : n.target_kind === "valeurs_sures" ? "ta sélection \"valeurs sûres\""
              : n.target_kind === "avis" ? "un de tes avis"
              : n.target_kind === "tierlist" ? "une de tes tierlists"
              : n.target_kind === "cadeau" ? "un de tes cadeaux"
              : n.target_kind === "quiz" ? "une de tes parties de quiz"
              : n.target_kind === "ost" ? "une de tes parties d'OST Challenge"
              : "ton contenu";
            const action = n.interaction_type === "like" ? "a aimé" : "a commenté";
            return `<article class="drama-card" style="cursor:default; ${!n.vue ? "border-color:var(--seal);" : ""}">
              <div class="card-row">
                ${p && p.avatar_url
                  ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar" style="width:48px;height:48px;object-fit:cover;cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">`
                  : `<div class="stamp mini motif-flower" style="width:48px;height:48px;cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">${FLOWER_MOTIF_SVG}</div>`}
                <div class="card-main">
                  <h2>${n.interaction_type === "like" ? "♥" : "💬"} ${esc(n.titre || "")}</h2>
                  <p class="cast"><b style="color:var(--blue-deep); cursor:pointer;" data-open-profil="${esc(n.from_user_id)}">${esc(pseudo)}</b> ${action} ${lieu}</p>
                  ${n.contenu_apercu ? `<p class="cast" style="font-style:italic;">"${esc(n.contenu_apercu)}"</p>` : ""}
                </div>
              </div>
            </article>`;
          }
          if (item.type === "abonnement") {
            const n = item.data;
            const p = n.profil_follower;
            const pseudo = p ? p.pseudo : "Quelqu'un";
            return `<article class="drama-card" style="cursor:default; ${!n.vue ? "border-color:var(--seal);" : ""}">
              <div class="card-row">
                ${p && p.avatar_url
                  ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar" style="width:48px;height:48px;object-fit:cover;cursor:pointer;" data-open-profil="${esc(n.follower_id)}">`
                  : `<div class="stamp mini motif-flower" style="width:48px;height:48px;cursor:pointer;" data-open-profil="${esc(n.follower_id)}">${FLOWER_MOTIF_SVG}</div>`}
                <div class="card-main">
                  <h2>🌱 Nouvel abonné</h2>
                  <p class="cast"><b style="color:var(--blue-deep); cursor:pointer;" data-open-profil="${esc(n.follower_id)}">${esc(pseudo)}</b> s'est abonné(e) à toi</p>
                </div>
              </div>
            </article>`;
          }
          const s = item.data;
          return `<article class="drama-card" style="cursor:default; ${!s.vue ? "border-color:var(--seal);" : ""}">
            <div class="card-row">
              ${s.a_voir && s.a_voir.poster_url ? `<img src="${esc(s.a_voir.poster_url)}" alt="" class="poster-thumb">` : `<div class="stamp empty motif-flower">${FLOWER_MOTIF_SVG}</div>`}
              <div class="card-main">
                <h2>${esc(s.a_voir ? s.a_voir.titre : "Titre supprimé")}</h2>
                ${s.profil_expediteur ? `<p class="cast">Suggéré par <b style="color:var(--blue-deep); cursor:pointer;" data-open-profil="${esc(s.profil_expediteur.id)}">${esc(s.profil_expediteur.pseudo)}</b></p>` : ""}
              </div>
            </div>
            ${s.a_voir ? `<div class="card-actions" style="margin-top:8px;">
              <button class="text-btn" data-ajouter-depuis-suggestion="${esc(s.id)}">➕ Ajouter à ma liste à voir</button>
            </div>` : ""}
          </article>`;
        }).join("")}
      </div>
    </div>
  </div>`;
}

// ---- sélecteur "Suggérer à..." depuis une fiche drama ----
function renderSuggererAModal() {
  const draft = state.suggererADraft;
  if (!draft) return "";
  const abonnementsProfils = draft.abonnementsProfils || [];
  return `<div class="modal-overlay" id="suggererAOverlay">
    <div class="modal-sheet" id="suggererASheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Suggérer "${esc(draft.drama.titre)}"</h3></div>
        <button class="icon-btn" id="suggererAClose">✕</button>
      </div>
      <div class="modal-body">
        <p class="tr-note">Choisis à qui envoyer cette suggestion.</p>
        ${abonnementsProfils.length === 0 ? `<p class="tr-note">Chargement de tes abonnements…</p>` : abonnementsProfils.map((p) => `
          <div class="tr-person-row" data-envoyer-suggestion="${esc(p.id)}">
            ${p.avatar_url ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar">` : `<span class="tr-rank motif-flower" style="width:24px;height:24px;">${FLOWER_MOTIF_SVG}</span>`}
            <div class="tr-person-info"><p class="tr-person-name">${esc(p.pseudo)}</p></div>
          </div>`).join("")}
      </div>
    </div>
  </div>`;
}

// ---- modale "Chercher un profil" (par pseudo) ----

// ---- modale "liste des abonnés / abonnements" ----
function renderListeAbonnesModal() {
  const m = state.listeAbonnesModal;
  if (!m) return "";
  const titre = m.mode === "abonnes" ? "Abonnés" : "Abonnements";
  return `<div class="modal-overlay" id="listeAbonnesOverlay">
    <div class="modal-sheet" id="listeAbonnesSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>${esc(titre)}</h3></div>
        <button class="icon-btn" id="listeAbonnesClose">✕</button>
      </div>
      <div class="modal-body">
        ${m.loading ? `<p class="tr-note">Chargement…</p>` : m.profils.length === 0 ? `
          <p class="tr-note">${m.mode === "abonnes" ? "Personne ne suit ce profil pour l'instant." : "Ce profil ne suit personne pour l'instant."}</p>
        ` : m.profils.map((p) => `
          <div class="tr-person-row" data-open-profil-liste="${esc(p.id)}">
            ${p.avatar_url ? `<img src="${esc(p.avatar_url)}" class="tr-person-avatar">` : `<span class="tr-rank motif-flower" style="width:24px;height:24px;">${FLOWER_MOTIF_SVG}</span>`}
            <div class="tr-person-info"><p class="tr-person-name">${esc(p.pseudo)}</p></div>
          </div>`).join("")}
      </div>
    </div>
  </div>`;
}

// ---- modale commentaires sur une entrée "vu" / "à voir" ----
function renderEntryCommentModal() {
  const m = state.entryCommentModal;
  if (!m) return "";
  const comments = m.comments || [];
  return `<div class="modal-overlay" id="entryCommentOverlay">
    <div class="modal-sheet" id="entryCommentSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>${esc(m.titre)}</h3></div>
        <button class="icon-btn" id="entryCommentClose">✕</button>
      </div>
      <div class="modal-body">
        ${isLoggedIn() ? `
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <input id="entry-comment-input" value="${esc(m.draft)}" placeholder="Écrire un commentaire…" style="flex:1; border:1px solid var(--line); background:var(--paper-raised); border-radius:3px; border-width:2px; padding:10px 11px; font-size:14px; font-family:inherit;">
          <button class="primary-btn" id="entryCommentSubmitBtn" style="flex:0 0 auto;">Publier</button>
        </div>` : `<p class="tr-note">Connecte-toi pour commenter.</p>`}
        ${m.loadingComments ? `<p class="tr-note">Chargement…</p>` : comments.length === 0 ? `<p class="tr-note">Aucun commentaire pour l'instant.</p>` : comments.map((c) => `
          <div class="tr-person-row" style="cursor:default;">
            ${c.profils && c.profils.avatar_url ? `<img src="${esc(c.profils.avatar_url)}" class="tr-person-avatar">` : `<span class="tr-rank">💬</span>`}
            <div class="tr-person-info">
              <p class="tr-person-name">${esc(c.profils ? c.profils.pseudo : "Quelqu'un")}</p>
              <p class="tr-person-sub">${esc(c.contenu)}</p>
            </div>
          </div>`).join("")}
      </div>
    </div>
  </div>`;
}

// ---- popup cadeau (acteur gagné) ----
function renderCadeauModal() {
  const c = state.cadeauEnCours;
  if (!c) return "";
  const p = c.personne;
  return `<div class="modal-overlay" id="cadeauOverlay">
    <div class="cadeau-box">
      ${!c.ouvert ? `
        <button class="cadeau-emballage" id="cadeauOuvrirBtn" aria-label="Ouvrir le cadeau">
          <span class="cadeau-emoji">🎁</span>
          <span class="cadeau-texte">Tu as gagné un cadeau !<br>Touche pour l'ouvrir</span>
        </button>
      ` : `
        <div class="cadeau-reveal">
          <span class="cadeau-coeur">💓</span>
          <img src="${esc(p.photo_url)}" class="cadeau-photo" alt="${esc(p.nom)}">
          <h3 class="cadeau-nom">${esc(p.nom)}</h3>
          <p class="cadeau-role">${esc(roleLabel(p.role))} ajouté à ta collection !</p>
          <button class="primary-btn" id="cadeauFermerBtn" style="width:100%; margin-top:10px;">Super !</button>
        </div>
      `}
    </div>
  </div>`;
}

// ---- modale "Ma collection" ----
function renderCollectionModal() {
  if (!state.collectionModalOpen) return "";
  const collection = state.maCollectionActeurs || [];
  return `<div class="modal-overlay" id="collectionOverlay">
    <div class="modal-sheet" id="collectionSheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="flex:1;"><h3>Ma collection (${collection.length})</h3></div>
        <button class="icon-btn" id="collectionClose">✕</button>
      </div>
      <div class="modal-body">
        ${collection.length === 0 ? `<p class="tr-note">Termine une tierlist ou un quiz pour gagner ton premier acteur !</p>` : `
        <div class="collection-grid">
          ${collection.map((c) => `
            <div class="collection-item" data-person-name="${esc(c.personnes.nom)}" data-person-role="${esc(c.personnes.role)}">
              <img src="${esc(c.personnes.photo_url)}" alt="${esc(c.personnes.nom)}">
              <p>${esc(c.personnes.nom)}</p>
            </div>`).join("")}
        </div>`}
      </div>
    </div>
  </div>`;
}



// ============================================================
// === FIN DES NOUVEAUX MODULES SOCIAUX ===
// ============================================================


export function formatDateFr(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${Number(d)} ${mois[Number(m) - 1]} ${y}`;
}


// ============== MAIN RENDER ==============
// Bouton d'ajout flottant (FAB) : toujours accessible au pouce en bas
// à droite de l'écran, peu importe le défilement — remplace l'ancien
// bouton "+" ancré en haut du header, difficile à atteindre sur
// mobile une fois qu'on a fait défiler la liste.
function renderFabAddBtn() {
  if (state.activeTab === "liste" || state.activeTab === "avoir") {
    return `<button class="fab-add-btn" id="openNewBtn" aria-label="Ajouter">＋</button>`;
  }
  if (state.activeTab === "tierlists") {
    return `<button class="fab-add-btn" id="openNewTierlistBtn" aria-label="Nouvelle tierlist">＋</button>`;
  }
  if (state.activeTab === "communaute") {
    return `<button class="fab-add-btn" id="openComposerBtn" aria-label="Nouvel avis">＋</button>`;
  }
  return "";
}

export function render() {
  const root = document.getElementById("app");
  if (state.loading) {
    root.innerHTML = `<div class="loading-screen"><div class="app-seal motif-flower">${FLOWER_MOTIF_SVG}</div><p>Ouverture du carnet…</p></div>`;
    return;
  }

  const stats = getStats();
  root.innerHTML = `
    <header class="app-header">
      <div class="app-header-brand">
        <div class="app-seal motif-flower">${FLOWER_MOTIF_SVG}</div>
        <p class="app-eyebrow">내 드라마 일지</p>
        <h1>Mon carnet de k-dramas</h1>
      </div>
      <button class="icon-btn account-avatar-btn" id="accountBtn" style="position:absolute; top:16px; left:16px;" aria-label="${isLoggedIn() ? "Mon profil" : "Se connecter"}">
        ${isLoggedIn() && state.profil && state.profil.avatar_url
          ? `<img src="${esc(state.profil.avatar_url)}" class="tr-person-avatar account-avatar-img">`
          : `<span class="account-avatar-fallback">${isLoggedIn() ? "👤" : "🔑"}</span>`}
      </button>
      ${isLoggedIn() ? `<button class="icon-btn" id="notifBellBtn" style="position:absolute; top:16px; right:${state.activeTab === "tendances" ? "62px" : "16px"};" aria-label="Notifications">
        🔔${getNotificationsNonLues() > 0 ? `<span class="notif-badge">${getNotificationsNonLues()}</span>` : ""}
      </button>` : ""}
      ${state.activeTab === "tendances"
        ? `<button class="icon-btn" id="exportBtn" style="position:absolute; top:16px; right:16px;" aria-label="Exporter mes données">⇩</button>`
        : ""}
      <div class="hero-stats">
        <div class="hero-stat"><span class="num">${stats.count}</span><span class="lbl">vus</span></div>
        <div class="hero-stat"><span class="num">${stats.avg ? stats.avg.toFixed(1) : "–"}</span><span class="lbl">note moy.</span></div>
        <div class="hero-stat"><span class="num">${Math.round(stats.totalMin / 60)}</span><span class="lbl">heures</span></div>
      </div>
      <div class="main-nav">
        <button class="main-nav-btn ${["tendances","liste","avoir"].includes(state.activeTab) ? "active" : ""}" data-main-nav="profil">👤 Mon profil</button>
        <button class="main-nav-btn ${["communaute","tierlists","tierlist-builder","profil","quiz","ost","abonnements","jeux"].includes(state.activeTab) ? "active" : ""}" data-main-nav="communaute">🇰🇷 Communauté</button>
      </div>
      ${["tendances","liste","avoir"].includes(state.activeTab) ? `
      <div class="tabbar">
        <button class="tab-btn ${state.activeTab === "tendances" ? "active" : ""}" data-tab="tendances">Tendances</button>
        <button class="tab-btn ${state.activeTab === "liste" ? "active" : ""}" data-tab="liste">Ma liste</button>
        <button class="tab-btn ${state.activeTab === "avoir" ? "active" : ""}" data-tab="avoir">À voir</button>
      </div>` : ""}
      ${["communaute","tierlists","tierlist-builder","profil","quiz","ost","abonnements","jeux"].includes(state.activeTab) ? `
      <div class="subnav subnav-grid">
        <button class="${state.activeTab === "communaute" ? "active" : ""}" data-tab="communaute">Fil d'actualité</button>
        <button class="${state.activeTab === "abonnements" ? "active" : ""}" data-tab="abonnements">Abonnements</button>
        <button class="${["jeux","quiz","ost","tierlists","tierlist-builder"].includes(state.activeTab) ? "active" : ""}" data-tab="jeux">Jeux</button>
      </div>` : ""}
    </header>
    ${renderPushPromptBanner()}
    ${state.activeTab === "liste" ? renderListView()
      : state.activeTab === "avoir" ? renderAVoirView()
      : state.activeTab === "tendances" ? renderTrendsView()
      : state.activeTab === "communaute" ? renderCommunauteView()
      : state.activeTab === "abonnements" ? renderAbonnementsView()
      : state.activeTab === "jeux" ? renderJeuxView()
      : state.activeTab === "tierlists" ? renderTierlistsView()
      : state.activeTab === "tierlist-builder" ? renderTierlistBuilder()
      : state.activeTab === "profil" ? renderProfilPublicView()
      : state.activeTab === "quiz" ? renderQuizView()
      : state.activeTab === "ost" ? renderOstView()
      : renderTrendsView()}
    ${renderTrendsNavDrawer()}
    ${renderFormSheet()}
    ${renderAVoirFormSheet()}
    ${renderPersonModal()}
    ${renderDramaModal()}
    ${renderComposerSheet()}
    ${renderTierlistFormSheet()}
    ${state.tierlistViewerOpen ? renderTierlistViewerModal() : ""}
    ${renderEnviesAbonnesModal()}
    ${renderNotifSuggestionsModal()}
    ${renderSuggererAModal()}
    ${renderRechercheProfilModal()}
    ${renderListeAbonnesModal()}
    ${renderEntryCommentModal()}
    ${renderCollectionModal()}
    ${renderCadeauModal()}
    ${renderHistoriqueQuizModal()}
    ${(state.showAuthModal && !isLoggedIn()) ? renderAuthModal() : ""}
    ${renderTmdbKeyModal()}
    ${renderFabAddBtn()}
    ${state.toastMsg ? `<div class="toast">${esc(state.toastMsg)}</div>` : ""}
  `;

  attachListeners();
  attachCommunauteListeners();
  attachTierlistListeners();
  attachTierlistViewerListeners();
  attachQuizListeners();
  attachDeezerListeners();
  attachOstListeners();
  attachTrendsNavDrawerListeners();
  attachAuthModalListeners();

  const headerEl = document.querySelector(".app-header");
  if (headerEl) headerEl.classList.toggle("scrolled", computeHeaderScrolled());
}

// ============== ETAT REPLI HEADER (avec hystérésis) ==============
// Un seul seuil (ex: scrollY > 40) peut faire trembler le header :
// dès qu'il se replie, sa hauteur diminue, ce qui peut suffire à
// repasser scrollY sous le seuil -> le header se redéplie -> boucle.
// On utilise donc deux seuils distincts avec une zone tampon entre eux :
// au-dessus de 60px on replie, au-dessous de 20px on déplie, et entre
// les deux on garde l'état précédent (pas de changement = pas de tremblement).
let headerScrolledState = false;
function computeHeaderScrolled() {
  const y = window.scrollY;
  if (y > 60) headerScrolledState = true;
  else if (y < 20) headerScrolledState = false;
  return headerScrolledState;
}

// ============== EVENT LISTENERS ==============
function attachListeners() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ activeTab: btn.dataset.tab, trendsNavOpen: false }));
  });
  document.querySelectorAll("[data-main-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const groupe = btn.dataset.mainNav;
      // Bascule vers le premier onglet du groupe choisi.
      setState({ activeTab: groupe === "profil" ? "tendances" : "communaute", trendsNavOpen: false });
    });
  });

  const addBtn = document.getElementById("openNewBtn");
  if (addBtn) addBtn.addEventListener("click", () => { state.activeTab === "avoir" ? openNewAVoir() : openNew(); });
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  const accountBtn = document.getElementById("accountBtn");
  if (accountBtn) {
    accountBtn.addEventListener("click", () => {
      if (isLoggedIn()) {
        openProfilPublic(currentUserId());
      } else {
        setState({ showAuthModal: true });
      }
    });
  }
  const notifBellBtn = document.getElementById("notifBellBtn");
  if (notifBellBtn) {
    notifBellBtn.addEventListener("click", () => {
      ouvrirNotifSuggestions();
      marquerSuggestionsVues();
      marquerAbonnementsVus();
      marquerInteractionsVues();
    });
  }
  const notifSuggestionsClose = document.getElementById("notifSuggestionsClose");
  if (notifSuggestionsClose) notifSuggestionsClose.addEventListener("click", fermerNotifSuggestions);
  const notifSuggestionsOverlay = document.getElementById("notifSuggestionsOverlay");
  if (notifSuggestionsOverlay) {
    notifSuggestionsOverlay.addEventListener("click", (e) => { if (e.target === notifSuggestionsOverlay) fermerNotifSuggestions(); });
  }
  document.querySelectorAll("[data-ajouter-depuis-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = (state.notifSuggestionsData || []).find((x) => x.id === btn.dataset.ajouterDepuisSuggestion);
      if (s) ajouterDepuisSuggestion(s);
    });
  });
  const suggererAClose = document.getElementById("suggererAClose");
  if (suggererAClose) suggererAClose.addEventListener("click", fermerSuggererA);
  const suggererAOverlay = document.getElementById("suggererAOverlay");
  if (suggererAOverlay) {
    suggererAOverlay.addEventListener("click", (e) => { if (e.target === suggererAOverlay) fermerSuggererA(); });
  }
  document.querySelectorAll("[data-envoyer-suggestion]").forEach((row) => {
    row.addEventListener("click", () => envoyerSuggestion(row.dataset.envoyerSuggestion));
  });
  const ouvrirRechercheProfilBtn = document.getElementById("ouvrirRechercheProfilBtn");
  if (ouvrirRechercheProfilBtn) ouvrirRechercheProfilBtn.addEventListener("click", ouvrirRechercheProfil);
  const ouvrirCollectionBtn = document.getElementById("ouvrirCollectionBtn");
  if (ouvrirCollectionBtn) ouvrirCollectionBtn.addEventListener("click", ouvrirCollection);
  const collectionClose = document.getElementById("collectionClose");
  if (collectionClose) collectionClose.addEventListener("click", fermerCollection);
  const collectionOverlay = document.getElementById("collectionOverlay");
  if (collectionOverlay) {
    collectionOverlay.addEventListener("click", (e) => { if (e.target === collectionOverlay) fermerCollection(); });
  }
  const cadeauOuvrirBtn = document.getElementById("cadeauOuvrirBtn");
  if (cadeauOuvrirBtn) cadeauOuvrirBtn.addEventListener("click", ouvrirCadeau);
  const cadeauFermerBtn = document.getElementById("cadeauFermerBtn");
  if (cadeauFermerBtn) cadeauFermerBtn.addEventListener("click", fermerCadeau);
  const rechercheProfilClose = document.getElementById("rechercheProfilClose");
  if (rechercheProfilClose) rechercheProfilClose.addEventListener("click", fermerRechercheProfil);
  const rechercheProfilOverlay = document.getElementById("rechercheProfilOverlay");
  if (rechercheProfilOverlay) {
    rechercheProfilOverlay.addEventListener("click", (e) => { if (e.target === rechercheProfilOverlay) fermerRechercheProfil(); });
  }
  const rechercheProfilInput = document.getElementById("rechercheProfilInput");
  if (rechercheProfilInput) {
    // Pas de re-render à chaque frappe (on perdrait le focus) : on met
    // juste à jour l'état, et le résultat de la recherche débouncée
    // ne touche que la petite zone de résultats en DOM direct — voir
    // majDomResultatsRechercheProfil(), qui réattache aussi son
    // propre listener [data-open-profil-recherche] à chaque mise à
    // jour (inutile de le faire ici).
    rechercheProfilInput.addEventListener("input", (e) => lancerRechercheProfilDebounced(e.target.value));
  }
  const openComposerBtn = document.getElementById("openComposerBtn");
  if (openComposerBtn) openComposerBtn.addEventListener("click", () => openComposer(null));

  // List view
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => setState({ query: e.target.value }));
    if (state.searchHadFocus) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
    searchInput.addEventListener("focus", () => { state.searchHadFocus = true; });
    searchInput.addEventListener("blur", () => { state.searchHadFocus = false; });
  }
  const clearSearch = document.getElementById("clearSearch");
  if (clearSearch) clearSearch.addEventListener("click", () => setState({ query: "" }));
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) sortSelect.addEventListener("change", (e) => setState({ sortBy: e.target.value }));

  const viewModeToggleBtn = document.getElementById("viewModeToggleBtn");
  if (viewModeToggleBtn) viewModeToggleBtn.addEventListener("click", () => setState({ viewMode: state.viewMode === "liste" ? "grille" : "liste" }));
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  if (filterToggleBtn) filterToggleBtn.addEventListener("click", () => setState({ showFilters: !state.showFilters }));
  const filterDecadeSelect = document.getElementById("filterDecadeSelect");
  if (filterDecadeSelect) filterDecadeSelect.addEventListener("change", (e) => setState({ filterDecade: e.target.value }));
  const filterNoteSelect = document.getElementById("filterNoteSelect");
  if (filterNoteSelect) filterNoteSelect.addEventListener("change", (e) => setState({ filterMinNote: e.target.value }));
  const filterScenaristeInput = document.getElementById("filterScenaristeInput");
  if (filterScenaristeInput) filterScenaristeInput.addEventListener("input", (e) => { state.filterScenariste = e.target.value; });
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", () => setState({ filterDecade: "", filterMinNote: "", filterScenariste: "" }));

  document.querySelectorAll("[data-grid-id]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const source = isLoggedIn() ? state.mesEntries : state.entries;
      const d = source.find((x) => String(x.id) === cell.dataset.gridId);
      if (d) setState({ dramaModal: d.titre });
    });
  });
  document.querySelectorAll("[data-share-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const source = isLoggedIn() ? state.mesEntries : state.entries;
      const d = source.find((x) => String(x.id) === btn.dataset.shareId);
      if (d) shareDrama(d);
    });
  });

  document.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-stop-propagation]")) return;
      const id = card.dataset.cardId;
      setState({ expandedId: state.expandedId === id ? null : id });
    });
  });
  document.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = state.mesEntries.find((x) => String(x.id) === btn.dataset.editId);
      if (d) openEdit(d);
    });
  });
  document.querySelectorAll("[data-ask-delete-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); setState({ confirmDeleteId: btn.dataset.askDeleteId }); });
  });
  document.querySelectorAll("[data-confirm-delete-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); deleteEntry(btn.dataset.confirmDeleteId); });
  });
  document.querySelectorAll("[data-goto-auth-card]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); setState({ showAuthModal: true }); });
  });
  const goToAuthFromListBtn = document.getElementById("goToAuthFromListBtn");
  if (goToAuthFromListBtn) goToAuthFromListBtn.addEventListener("click", () => setState({ showAuthModal: true }));
  const goToAuthFromTrendsBtn = document.getElementById("goToAuthFromTrendsBtn");
  if (goToAuthFromTrendsBtn) goToAuthFromTrendsBtn.addEventListener("click", () => setState({ showAuthModal: true }));

  // Trends view
  document.querySelectorAll("[data-trends-role]").forEach((btn) => {
    btn.addEventListener("click", () => setState({ trendsRole: btn.dataset.trendsRole }));
  });
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.addEventListener("click", () => {
      const y = Number(el.dataset.year);
      const ouverture = state.selectedYear !== y; // true si on ouvre une nouvelle année (pas si on referme)
      setState({ selectedYear: state.selectedYear === y ? null : y });
      // setState() restaure la position de scroll précédente par
      // défaut (voir son commentaire), donc sans ce scroll explicite,
      // la liste des titres apparaît hors champ, plus bas — exactement
      // le souci signalé ("le drama est trop bas sur l'écran"). On ne
      // scrolle que si on vient d'OUVRIR une année (pas en la refermant,
      // où il n'y a plus rien à montrer).
      //
      // Le header étant sticky et de hauteur variable (replié ou non,
      // voir .app-header.scrolled), scrollIntoView({block:"start"})
      // seul placerait le haut de la liste exactement sous le bord de
      // l'écran, caché par le header — d'où l'impression que "le drama
      // est trop bas" décrite. On calcule donc l'offset réel du header
      // au moment du clic et on ajuste la position finale avec
      // window.scrollTo, plutôt qu'une marge CSS fixe qui ne pourrait
      // pas suivre la hauteur changeante du header.
      if (ouverture) {
        requestAnimationFrame(() => {
          const liste = document.getElementById(`tr-year-list-${y}`);
          const header = document.querySelector(".app-header");
          if (!liste) return;
          const headerHeight = header ? header.getBoundingClientRect().height : 0;
          const top = liste.getBoundingClientRect().top + window.scrollY - headerHeight - 12; // 12px de respiration
          window.scrollTo({ top, behavior: "smooth" });
        });
      }
    });
  });
  document.querySelectorAll("[data-person-name]").forEach((el) => {
    el.addEventListener("click", () => {
      // Si une fiche (drama ou personne) est déjà ouverte, on l'empile
      // pour pouvoir y revenir avec le bouton retour.
      const stack = state.modalStack.slice();
      if (state.dramaModal) stack.push({ type: "drama", value: state.dramaModal });
      else if (state.personModal) stack.push({ type: "person", value: state.personModal });
      setState({ personModal: { nom: el.dataset.personName, role: el.dataset.personRole }, dramaModal: null, modalStack: stack });
    });
  });
  document.querySelectorAll("[data-drama-titre]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-stop-propagation]")) return;
      const titre = el.dataset.dramaTitre;
      if (!titre) return;
      const stack = state.modalStack.slice();
      if (state.dramaModal) stack.push({ type: "drama", value: state.dramaModal });
      else if (state.personModal) stack.push({ type: "person", value: state.personModal });
      setState({ dramaModal: titre, personModal: null, modalStack: stack });
    });
  });

  // Person modal
  const personModalOverlay = document.getElementById("personModalOverlay");
  if (personModalOverlay) {
    personModalOverlay.addEventListener("click", (e) => { if (e.target === personModalOverlay) setState({ personModal: null, modalStack: [], editingPersonneDraft: null, editingPersonneError: null }); });
  }
  const personModalClose = document.getElementById("personModalClose");
  if (personModalClose) personModalClose.addEventListener("click", () => setState({ personModal: null, modalStack: [], editingPersonneDraft: null, editingPersonneError: null }));
  const personModalBack = document.getElementById("personModalBack");
  if (personModalBack) personModalBack.addEventListener("click", () => { state.editingPersonneDraft = null; state.editingPersonneError = null; goBackModalStack(); });
  const personModalEdit = document.getElementById("personModalEdit");
  if (personModalEdit) {
    personModalEdit.addEventListener("click", () => {
      if (!state.personModal) return;
      const id = findPersonneId(state.personModal.nom, state.personModal.role);
      if (!id) { showToast("Impossible de modifier cette fiche."); return; }
      setState({ editingPersonneDraft: { id, nom: state.personModal.nom, role: state.personModal.role }, editingPersonneError: null });
    });
  }
  const personModalEditCancel = document.getElementById("personModalEditCancel");
  if (personModalEditCancel) personModalEditCancel.addEventListener("click", () => setState({ editingPersonneDraft: null, editingPersonneError: null }));
  const editingPersonneNomInput = document.getElementById("editingPersonneNom");
  if (editingPersonneNomInput) {
    editingPersonneNomInput.addEventListener("input", (e) => {
      if (state.editingPersonneDraft) state.editingPersonneDraft.nom = e.target.value;
    });
  }
  document.querySelectorAll("[data-editing-personne-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.editingPersonneDraft) setState({ editingPersonneDraft: { ...state.editingPersonneDraft, role: btn.dataset.editingPersonneRole } });
    });
  });
  const personModalEditSave = document.getElementById("personModalEditSave");
  if (personModalEditSave) personModalEditSave.addEventListener("click", enregistrerModificationPersonne);
  const personPhotoInput = document.getElementById("personPhotoInput");
  if (personPhotoInput) {
    personPhotoInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file && state.personModal) uploadPersonPhoto(file, state.personModal.nom, state.personModal.role);
    });
  }
  const searchPersonPhotoBtn = document.getElementById("searchPersonPhotoBtn");
  if (searchPersonPhotoBtn) {
    searchPersonPhotoBtn.addEventListener("click", () => {
      searchPersonPhotoOnline(searchPersonPhotoBtn.dataset.searchName);
    });
  }

  // Drama modal (from Tendances)
  const dramaModalOverlay = document.getElementById("dramaModalOverlay");
  if (dramaModalOverlay) {
    dramaModalOverlay.addEventListener("click", (e) => { if (e.target === dramaModalOverlay) setState({ dramaModal: null, modalStack: [] }); });
  }
  const dramaModalClose = document.getElementById("dramaModalClose");
  if (dramaModalClose) dramaModalClose.addEventListener("click", () => setState({ dramaModal: null, modalStack: [] }));
  const dramaModalBack = document.getElementById("dramaModalBack");
  if (dramaModalBack) dramaModalBack.addEventListener("click", goBackModalStack);
  const dramaModalEditHandler = () => {
    if (!isLoggedIn()) { showToast("Connecte-toi pour modifier ce drama."); return; }
    // openEdit() attend les champs perso (note, date_visionnage,
    // visionnage_id) — on cherche donc la version jointe dans
    // mesEntries plutôt que la fiche catalogue brute de state.entries.
    const dramaCatalogue = state.entries.find((e) => e.titre === state.dramaModal);
    if (!dramaCatalogue) return;
    const mesDonnees = state.mesEntries.find((e) => e.id === dramaCatalogue.id);
    setState({ dramaModal: null, modalStack: [] });
    openEdit(mesDonnees || dramaCatalogue);
  };
  const dramaModalEdit = document.getElementById("dramaModalEdit");
  if (dramaModalEdit) dramaModalEdit.addEventListener("click", dramaModalEditHandler);
  const dramaModalEditBtn = document.getElementById("dramaModalEditBtn");
  if (dramaModalEditBtn) dramaModalEditBtn.addEventListener("click", dramaModalEditHandler);
  const dramaModalSuggererBtn = document.getElementById("dramaModalSuggererBtn");
  if (dramaModalSuggererBtn) {
    dramaModalSuggererBtn.addEventListener("click", () => {
      const titre = dramaModalSuggererBtn.dataset.suggererTitre;
      const d = state.entries.find((e) => e.titre === titre);
      if (d) ouvrirSuggererA(d);
    });
  }

  // Form sheet
  const formOverlay = document.getElementById("formOverlay");
  if (formOverlay) formOverlay.addEventListener("click", (e) => { if (e.target === formOverlay) closeForm(); });
  const formClose = document.getElementById("formClose");
  if (formClose) formClose.addEventListener("click", closeForm);
  const formCancel = document.getElementById("formCancel");
  if (formCancel) formCancel.addEventListener("click", closeForm);
  const formSave = document.getElementById("formSave");
  if (formSave) formSave.addEventListener("click", () => avecBoutonDesactive("formSave", state.editingId ? "Enregistrement…" : "Ajout…", saveDraft));

  const fieldMap = { "f-titre": "titre", "f-titre_kr": "titre_kr", "f-annee": "annee", "f-note": "note", "f-episodes": "episodes", "f-duree": "duree", "f-date_visionnage": "date_visionnage" };
  Object.keys(fieldMap).forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", (e) => {
        state.draft = { ...state.draft, [fieldMap[id]]: e.target.value };
        // Avoid full re-render on every keystroke to keep focus; update state silently.
      });
    }
  });

  // Sélecteur de casting (acteur/actrice/scénariste/réalisateur) :
  // la frappe dans le champ de recherche ne doit PAS provoquer un
  // re-render complet (on perdrait le focus, comme pour fieldMap
  // ci-dessus) — on met juste à jour state.castingSearchQuery
  // silencieusement, puis on reconstruit uniquement la petite zone de
  // résultats sous le champ concerné, en DOM direct.
  document.querySelectorAll("[data-casting-search]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const role = input.dataset.castingSearch;
      state.castingSearchQuery = { ...state.castingSearchQuery, [role]: e.target.value };
      const wrapper = input.closest(".casting-selector");
      if (wrapper) {
        const html = renderCastingSelector(role, wrapper.dataset.castingLabel);
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const newResults = temp.querySelector(".casting-results");
        let existingResults = wrapper.querySelector(".casting-results");
        if (existingResults) existingResults.remove();
        if (newResults) wrapper.appendChild(newResults);
        attachCastingResultListeners(wrapper);
      }
    });
  });
  document.querySelectorAll("[data-casting-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ajouterPersonneAuCasting(btn.dataset.castingPick, { id: btn.dataset.castingPickId, nom: btn.dataset.castingPickNom });
    });
  });
  document.querySelectorAll("[data-casting-create]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nom = (btn.dataset.castingCreateNom || "").trim();
      if (!nom) return;
      ajouterPersonneAuCasting(btn.dataset.castingCreate, { id: null, nom });
    });
  });
  document.querySelectorAll("[data-casting-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [role, idx] = btn.dataset.castingRemove.split(":");
      retirerPersonneDuCasting(role, Number(idx));
    });
  });

  const posterInput = document.getElementById("posterInput");
  if (posterInput) posterInput.addEventListener("change", (e) => handlePosterUpload(e.target.files && e.target.files[0]));
  const posterRemove = document.getElementById("posterRemove");
  if (posterRemove) posterRemove.addEventListener("click", removePoster);
  const searchPosterBtn = document.getElementById("searchPosterBtn");
  if (searchPosterBtn) {
    searchPosterBtn.addEventListener("click", () => {
      const titreInput = document.getElementById("f-titre");
      searchPosterOnline(titreInput ? titreInput.value : state.draft.titre);
    });
  }
  const tmdbSearchBtn = document.getElementById("tmdbSearchBtn");
  if (tmdbSearchBtn) {
    tmdbSearchBtn.addEventListener("click", () => {
      const titreInput = document.getElementById("f-titre");
      rechercherSurTmdb(titreInput ? titreInput.value : state.draft.titre);
    });
  }

  // A voir (wishlist) view
  const surpriseMeBtn = document.getElementById("surpriseMeBtn");
  if (surpriseMeBtn) surpriseMeBtn.addEventListener("click", surpriseMe);
  const goToAuthFromAVoirBtn = document.getElementById("goToAuthFromAVoirBtn");
  if (goToAuthFromAVoirBtn) goToAuthFromAVoirBtn.addEventListener("click", () => setState({ showAuthModal: true }));
  document.querySelectorAll("[data-goto-auth-avoir]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); setState({ showAuthModal: true }); });
  });
  document.querySelectorAll("[data-avoir-card-id]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-stop-propagation]")) return;
      const id = card.dataset.avoirCardId;
      setState({ expandedAVoirId: state.expandedAVoirId === id ? null : id });
    });
  });
  document.querySelectorAll("[data-watched-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = state.aVoir.find((x) => String(x.id) === btn.dataset.watchedId);
      if (d) markAsWatched(d);
    });
  });
  document.querySelectorAll("[data-edit-avoir-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = state.aVoir.find((x) => String(x.id) === btn.dataset.editAvoirId);
      if (d) openEditAVoir(d);
    });
  });
  document.querySelectorAll("[data-ask-delete-avoir-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); setState({ confirmDeleteAVoirId: btn.dataset.askDeleteAvoirId }); });
  });
  document.querySelectorAll("[data-confirm-delete-avoir-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); deleteAVoirEntry(btn.dataset.confirmDeleteAvoirId); });
  });

  // A voir form sheet
  const avoirFormOverlay = document.getElementById("avoirFormOverlay");
  if (avoirFormOverlay) avoirFormOverlay.addEventListener("click", (e) => { if (e.target === avoirFormOverlay) closeAVoirForm(); });
  const avoirFormClose = document.getElementById("avoirFormClose");
  if (avoirFormClose) avoirFormClose.addEventListener("click", closeAVoirForm);
  const avoirFormCancel = document.getElementById("avoirFormCancel");
  if (avoirFormCancel) avoirFormCancel.addEventListener("click", closeAVoirForm);
  const avoirFormSave = document.getElementById("avoirFormSave");
  if (avoirFormSave) avoirFormSave.addEventListener("click", () => avecBoutonDesactive("avoirFormSave", state.editingAVoirId ? "Enregistrement…" : "Ajout…", saveAVoirDraft));

  const avoirFieldMap = { "av-titre": "titre", "av-titre_kr": "titre_kr", "av-annee": "annee", "av-acteur": "acteur", "av-actrice": "actrice", "av-scenariste": "scenariste", "av-realisateur": "realisateur", "av-resume": "resume" };
  Object.keys(avoirFieldMap).forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", (e) => {
        state.aVoirDraft = { ...state.aVoirDraft, [avoirFieldMap[id]]: e.target.value };
      });
    }
  });
  const avoirPosterInput = document.getElementById("avoirPosterInput");
  if (avoirPosterInput) avoirPosterInput.addEventListener("change", (e) => handleAVoirPosterUpload(e.target.files && e.target.files[0]));
  const avoirPosterRemove = document.getElementById("avoirPosterRemove");
  if (avoirPosterRemove) avoirPosterRemove.addEventListener("click", removeAVoirPoster);
  const searchAVoirPosterBtn = document.getElementById("searchAVoirPosterBtn");
  if (searchAVoirPosterBtn) {
    searchAVoirPosterBtn.addEventListener("click", () => {
      const titreInput = document.getElementById("av-titre");
      searchPosterOnline(titreInput ? titreInput.value : state.aVoirDraft.titre);
    });
  }
  const tmdbSearchAVoirBtn = document.getElementById("tmdbSearchAVoirBtn");
  if (tmdbSearchAVoirBtn) {
    tmdbSearchAVoirBtn.addEventListener("click", () => {
      const titreInput = document.getElementById("av-titre");
      rechercherSurTmdb(titreInput ? titreInput.value : state.aVoirDraft.titre);
    });
  }

  // TMDB : sélection d'un résultat de recherche (commun aux deux formulaires)
  document.querySelectorAll("[data-tmdb-pick]").forEach((el) => {
    el.addEventListener("click", () => appliquerResultatTmdb(el.dataset.tmdbPick, el.dataset.tmdbCible));
  });

  // TMDB : import en masse
  const tmdbImportBtn = document.getElementById("tmdbImportBtn");
  if (tmdbImportBtn) tmdbImportBtn.addEventListener("click", () => importerCatalogueTmdb(2));

  // TMDB : modal de clé API
  const tmdbKeyModalOverlay = document.getElementById("tmdbKeyModalOverlay");
  if (tmdbKeyModalOverlay) tmdbKeyModalOverlay.addEventListener("click", (e) => { if (e.target === tmdbKeyModalOverlay) setState({ showTmdbKeyModal: false }); });
  const tmdbKeyModalClose = document.getElementById("tmdbKeyModalClose");
  if (tmdbKeyModalClose) tmdbKeyModalClose.addEventListener("click", () => setState({ showTmdbKeyModal: false }));
  const tmdbKeySaveBtn = document.getElementById("tmdbKeySaveBtn");
  if (tmdbKeySaveBtn) {
    tmdbKeySaveBtn.addEventListener("click", () => {
      const input = document.getElementById("tmdb-key-input");
      const key = input ? input.value.trim() : "";
      if (!key) { showToast("Indique une clé API."); return; }
      setTmdbApiKey(key);
      setState({ showTmdbKeyModal: false });
      showToast("Clé TMDB enregistrée dans ce navigateur.");
    });
  }
}

// ============== SCROLL HEADER ==============
// Replie la ligne de stats (vus / note moy. / heures) dès qu'on
// scrolle vers le bas, pour gagner de la place pour le contenu.
// Réapparaît dès qu'on remonte tout en haut.
// Limité par requestAnimationFrame : sans ça, l'écriture DOM
// (classList.toggle) se répète à chaque event "scroll" natif — qui
// peut se déclencher plus souvent qu'une frame d'affichage pendant un
// scroll rapide — et entre en concurrence avec le rendu en cours.
let scrollHeaderRaf = null;
window.addEventListener("scroll", () => {
  if (scrollHeaderRaf) return;
  scrollHeaderRaf = requestAnimationFrame(() => {
    scrollHeaderRaf = null;
    const header = document.querySelector(".app-header");
    if (!header) return;
    header.classList.toggle("scrolled", computeHeaderScrolled());
  });
}, { passive: true });

// ============== INIT ==============
initAuth().then(() => loadData());
// Le mini-lecteur Deezer vit hors de #app (voir le commentaire sur
// #deezer-mini-player) : il est initialisé une seule fois ici, et ne
// sera plus jamais reconstruit par render()/setState() ensuite — seuls
// ses propres listeners le mettent à jour.
renderDeezerMiniPlayer();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
