// ============== DATA ==============
// Participants, planning, corvées, avatars par défaut et quêtes vivent
// maintenant dans saraillon-data.js (chargé juste avant ce script).

// ✅ Échappe le HTML pour tout contenu tapé par un participant (commentaires, descriptions,
// options de sondage, messages du feed...) avant de l'injecter dans le DOM via innerHTML.
// Sans ça, n'importe qui pourrait taper du HTML/JS dans un commentaire et l'exécuter
// chez tout le monde qui ouvre l'app (faille XSS stockée).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let currentUser = PARTICIPANTS[0];
let inscriptions = {
  // Structure: { "personId-dayIdx-actIdx": true/false }
};
let activitiesInscription = [
  { dayIdx: 3, actIdx: 0, nom: "Plongée", emoji: "🤿", jour: "Lundi" },
  { dayIdx: 4, actIdx: 0, nom: "Bateau", emoji: "⛵", jour: "Mardi" },
  { dayIdx: 6, actIdx: 0, nom: "Via Ferrata", emoji: "🧗", jour: "Jeudi" }
];

// SESSION 4: PROFILS PERSONNELS & CHECK-LIST VALISE
let previousTab = null;
let currentViewingProfileId = null;
let checklistValise = {};

let shoppingList = [];
let choreLog = []; // ✅ Historique des corvées accomplies : { id, personId, personName, choreName, emoji, xp, timestamp }
let departureTasksDone = {}; // ✅ Tâches du jour de départ cochées : { "dayIdx-actIdx": true }
let polls = [];
let expenses = [];
let galleryItems = [];
let feed = [];
let notifications = [];
let selectedDay = 0;
let galleryFilterDay = "";
let galleryFilterCreatorId = "";
let undoHistory = [];
let historyIndex = -1;
let isOnline = navigator.onLine;

// ============== AUTHENTICATION ==============
let selectedProfileData = null;

async function startProfileSelection() {
  loadAllData(); // ✅ Charger les données (avatars inclus) AVANT d'afficher le carousel

  // ✅ Si un profil a déjà été choisi sur cet appareil, on saute directement le carousel
  const lastId = localStorage.getItem('saraillon_last_profile_id');
  if (lastId) {
    const remembered = PARTICIPANTS.find(p => String(p.id) === String(lastId));
    if (remembered && remembered.pseudo && remembered.pseudo.trim() !== '') {
      selectedProfileData = remembered;
      currentUser = remembered;
      await enterMainApp();
      return;
    }
  }

  document.getElementById('modalProfileSelect').style.display = 'flex';
  profileCarouselIndex = 0;
  renderProfileSelectCarousel();
}

let profileCarouselIndex = 0;

function renderProfileSelectCarousel() {
  const container = document.getElementById('profileCarousel');
  const dotsContainer = document.getElementById('profileCarouselDots');
  if (!container) return;

  if (!container.dataset.swipeSetup) {
    container.dataset.swipeSetup = '1';
    let startX = 0;
    container.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 40) shiftProfileCarousel(-1);
      else if (dx < -40) shiftProfileCarousel(1);
    }, { passive: true });
  }

  const types = {
    FEU: { c: 'var(--accent-red)', text: '#fff' },
    EAU: { c: 'var(--primary)', text: '#fff' },
    PLANTE: { c: 'var(--accent-green)', text: '#fff' },
    ELECTRIK: { c: 'var(--accent-gold)', text: '#1a1a1a', label: 'ÉLECTRIK' },
    PSY: { c: 'var(--accent-purple)', text: '#fff' },
    FEE: { c: 'var(--accent-pink)', text: '#fff', label: 'FÉE' },
  };
  const typeById = {
    1: 'FEU', 2: 'EAU', 3: 'PLANTE', 4: 'ELECTRIK', 5: 'PSY', 6: 'FEE', 7: 'EAU', 8: 'EAU', 9: 'PLANTE',
  };
  const cycleOrder = Object.keys(types);
  const n = PARTICIPANTS.length;
  const idx = ((profileCarouselIndex % n) + n) % n;

  const getPerson = (offset) => {
    const i = ((idx + offset) % n + n) % n;
    const p = PARTICIPANTS[i];
    const avatar = (personalsData[p.id] && personalsData[p.id].avatar) || null;
    const typeKey = typeById[p.id] || cycleOrder[i % cycleOrder.length];
    const t = types[typeKey];
    return { p, avatar, c: t.c, text: t.text, label: t.label || typeKey };
  };

  const centerP = getPerson(0);
  const prevP = getPerson(-1);
  const nextP = getPerson(1);

  const portrait = (person, size, opacity, blur, glow) => `
    <div style="width: ${size}px; height: ${size}px; border-radius: 50%; overflow: hidden; opacity: ${opacity}; filter: blur(${blur}px); box-shadow: ${glow}; background: rgba(255,255,255,0.12); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; font-size: ${Math.round(size * 0.35)}px; font-weight: 800; color: var(--accent-gold); transition: all 0.3s ease;">
      ${person.avatar ? `<img src="${person.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : person.p.name[0]}
    </div>
  `;

  container.innerHTML = `
    <div onclick="shiftProfileCarousel(-1)" style="position: absolute; left: -6px; cursor: pointer;">
      ${portrait(prevP, 68, 0.4, 2, '0 8px 20px rgba(0,0,0,0.3)')}
    </div>
    <div onclick="confirmProfileCarouselSelection()" style="position: relative; z-index: 2; text-align: center; cursor: pointer;">
      ${portrait(centerP, 190, 1, 0, '0 0 50px rgba(255, 203, 5, 0.5), 0 20px 40px rgba(0,0,0,0.4)')}
      <div style="margin-top: 14px; display: inline-block; background: ${centerP.c}; color: ${centerP.text}; padding: 3px 12px; border-radius: 8px; font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">${centerP.label}</div>
      <div style="margin-top: 8px; font-family: var(--font-display); font-weight: 500; font-size: 15px; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6);">${centerP.p.name.toUpperCase()}</div>
      ${(['Marine', 'Mathieu'].includes(centerP.p.name) && new Date() < new Date('2026-07-18')) ? `<div style="margin-top: 4px; display: inline-block; background: rgba(239, 68, 68, 0.12); color: var(--danger); padding: 2px 10px; border-radius: 6px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px;">🧪 PROFIL TEST — jusqu'au 17/07</div>` : ''}
    </div>
    <div onclick="shiftProfileCarousel(1)" style="position: absolute; right: -6px; cursor: pointer;">
      ${portrait(nextP, 68, 0.4, 2, '0 8px 20px rgba(0,0,0,0.3)')}
    </div>
  `;

  dotsContainer.innerHTML = PARTICIPANTS.map((p, i) => `
    <div onclick="jumpProfileCarousel(${i})" style="width: ${i === idx ? '20px' : '6px'}; height: 6px; border-radius: 3px; background: ${i === idx ? 'var(--accent-gold)' : 'rgba(34,85,164,0.25)'}; cursor: pointer; transition: all 0.3s ease;"></div>
  `).join('');
}

function shiftProfileCarousel(dir) {
  const n = PARTICIPANTS.length;
  profileCarouselIndex = ((profileCarouselIndex + dir) % n + n) % n;
  renderProfileSelectCarousel();
}

function jumpProfileCarousel(i) {
  profileCarouselIndex = i;
  renderProfileSelectCarousel();
}

function confirmProfileCarouselSelection() {
  const n = PARTICIPANTS.length;
  const idx = ((profileCarouselIndex % n) + n) % n;
  selectProfile(PARTICIPANTS[idx].id);
}

let autoSaveStarted = false; // ✅ Empêche de démarrer plusieurs intervals d'auto-save

// ============== NOTIFICATIONS PUSH (même app fermée) ==============
// Clé publique VAPID : sans danger à exposer côté client (c'est tout son rôle —
// seule la clé PRIVÉE, côté Edge Function "send-push", doit rester secrète).
const VAPID_PUBLIC_KEY = 'BHWdyrhiAYAoRFMs_kmnlX7h0drS-V4AuV7IxUFgUoGXBex-WF1d-wyK1cGrlezoS8wQqUkqd_LTZoR6Wi_EMF0';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function activerNotificationsPush() {
  if (!currentUser) { showNotification('⚠️ Sélectionne ton profil d\'abord', 'error'); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showNotification('⚠️ Notifications push non supportées sur cet appareil/navigateur', 'error');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showNotification('⚠️ Permission refusée. Réactivable dans les réglages du navigateur.', 'error');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const keys = subscription.toJSON().keys;
    const ok = await window.syncToSupabase('push_subscriptions', {
      endpoint: subscription.endpoint,
      person_id: currentUser.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent
    });
    if (ok) {
      localStorage.setItem('pushActivated', 'true');
      showNotification('🔔 Notifications push activées sur cet appareil !', 'success');
    } else {
      showNotification('⚠️ Erreur lors de l\'activation', 'error');
    }
  } catch (e) {
    console.error('Erreur activation push:', e);
    showNotification('⚠️ Impossible d\'activer les notifications push', 'error');
  }
}

async function desactiverNotificationsPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      if (window.supabase) {
        await window.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
    localStorage.removeItem('pushActivated');
    showNotification('🔕 Notifications push désactivées sur cet appareil', 'success');
  } catch (e) {
    console.error('Erreur désactivation push:', e);
  }
}

// ✅ Point d'entrée unique dans l'app : attend Supabase AVANT d'afficher les données,
// puis démarre l'auto-save. Utilisé par selectProfile() ET finishProfileSetup().
async function enterMainApp() {
  document.getElementById('appContent').style.display = 'block';
  document.getElementById('appContainer').style.display = 'block'; // ✅ Affiche le vrai conteneur de l'app (header, onglets...)
  loadAllData();
  switchTab('home');
  showNotification('⏳ Synchronisation des données...', 'success'); // attente visible

  await loadFromSupabaseCloud(); // ✅ ATTEND avant de render, plus d'écran vide

  loadAllData();
  renderPlanning();
  showMyProfile();
  renderShopping();
  renderGallery();
  renderFeed();
  renderHome(); // ✅ Rafraîchir le widget d'activité récente sur Home
  checkGalleryMentions(); // ✅ Notifie si quelqu'un a mentionné l'utilisateur avec @pseudo
  checkPrivateMessages(); // ✅ Notifie si un message privé (voir profil de Marine) est arrivé
  renderDaySelector();
  await loadChoreAssignmentsCloud(); // ✅ Corvées partagées : affiche ce que d'autres ont déjà assigné/fait
  await loadTresorFromCloud(); // ✅ Chasse au trésor partagée
  ensureTodaySecretMission(); // ✅ Mission secrète privée du jour
  refreshSecretMissionXpCache();
  renderChallenges();
  renderMysteryPhoto();
  renderInscriptions();
  renderPolls();
  renderExpenses();
  showMorningWisdomIfDue(); // ✅ Message du matin (sagesse + programme du jour), une fois par jour
  setTimeout(() => maybeShowProverbCrawl(), 900); // ✅ Proverbe du jour, une fois par jour, générique plein écran

  showNotification(`👋 Bienvenue ${currentUser.name}!`, 'success');

  if (!autoSaveStarted) {
    autoSaveStarted = true;
    setInterval(() => { saveAllData(); }, 30000); // ✅ Auto-save toutes les 30s
  }

  if (!window.__choreCloudPollStarted) {
    window.__choreCloudPollStarted = true;
    // ✅ Repasse chercher TOUTES les données partagées toutes les 25s : corvées,
    // fil d'actualité, inscriptions, notifications, galerie, sondages, dépenses...
    // Avant ce correctif, chaque téléphone ne relisait Supabase qu'une fois, à
    // l'ouverture de l'app — du coup deux personnes connectées en même temps
    // voyaient des versions figées et différentes de l'app (le cas Marine/Mathieu).
    setInterval(async () => {
      await loadChoreAssignmentsCloud();
      await loadTresorFromCloud();
      await loadFromSupabaseCloud();
      await checkPrivateMessages(); // ✅ Message privé (profil de Marine) arrivé entre-temps
      // ✅ Chaque appel est isolé : si l'onglet correspondant n'est pas monté dans
      // le DOM (utilisateur sur un autre écran), certaines fonctions de rendu
      // plantent sur un élément introuvable — ça ne doit pas empêcher les autres
      // écrans de se rafraîchir dans le même cycle.
      const safe = (fn) => { try { fn(); } catch (e) { /* écran non actif, ignoré */ } };
      safe(renderFeed);
      safe(renderGallery);
      safe(renderChallenges);
      safe(renderInscriptions);
      safe(renderPolls);
      safe(renderExpenses);
      safe(renderShopping);
      safe(renderTresor);
      safe(renderNotifications);
      safe(updateNotifBadge);
      safe(renderHomeGroupSpirit);
      safe(renderSyncStatus);
      safe(refreshSecretMissionXpCache);
    }, 25000);
  }

  if (!localStorage.getItem('saraillon_onboarding_seen')) {
    showOnboarding();
  }
}

let onboardingCurrentSlide = 1;

function showOnboarding() {
  onboardingCurrentSlide = 1;
  updateOnboardingSlide();
  document.getElementById('onboardingModal').style.display = 'flex';
}

function nextOnboardingSlide() {
  if (onboardingCurrentSlide >= 3) {
    closeOnboarding();
    return;
  }
  onboardingCurrentSlide++;
  updateOnboardingSlide();
}

function updateOnboardingSlide() {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`onboarding-slide-${i}`).style.display = i === onboardingCurrentSlide ? 'block' : 'none';
    document.getElementById(`onboarding-dot-${i}`).style.background = i === onboardingCurrentSlide ? 'var(--accent-gold)' : 'var(--border)';
  }
  document.getElementById('onboarding-next-btn').textContent = onboardingCurrentSlide === 3 ? "C'est parti ! 🚀" : 'Suivant →';
}

function closeOnboarding() {
  localStorage.setItem('saraillon_onboarding_seen', 'true');
  document.getElementById('onboardingModal').style.display = 'none';
}

async function selectProfile(id) {
  selectedProfileData = PARTICIPANTS.find(p => p.id === id);
  currentUser = selectedProfileData;
  document.getElementById('modalProfileSelect').style.display = 'none';
  
  // Si le profil est déjà complet, aller directement à Home
  if (currentUser.pseudo && currentUser.pseudo.trim() !== '') {
    localStorage.setItem('saraillon_last_profile_id', String(id)); // ✅ Se souvenir du profil pour sauter le carousel la prochaine fois
    await enterMainApp();
  } else {
    // Sinon, afficher le modal de complétion
    document.getElementById('modalProfileComplete').style.display = 'flex';
    renderProfileCompletion();
  }
}

function renderProfileCompletion() {
  const p = selectedProfileData;
  const avatar = (personalsData[p.id] && personalsData[p.id].avatar) || null; // ✅ avatar vit dans personalsData
  document.getElementById('profileSelectAvatar').innerHTML = avatar ? `<img src="${avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : p.name[0];
  document.getElementById('profileSelectName').textContent = p.name;
  document.getElementById('completePseudoInput').value = p.pseudo || '';
  document.getElementById('completeBioInput').value = p.bio || '';
  document.getElementById('completeRegimesInput').value = p.regimes || '';
}

function handleCompleteAvatarUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // ✅ Compression revue à la hausse (500px / 85%) — 300px/70% donnait des avatars
      // flous, surtout sur écrans haute densité (retina).
      compressImage(e.target.result, (compressedImage) => {
        personalsData[selectedProfileData.id] = personalsData[selectedProfileData.id] || {};
        personalsData[selectedProfileData.id].avatar = compressedImage;
        document.getElementById('profileSelectAvatar').innerHTML = `<img src="${compressedImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      }, 500, 0.85);
    };
    reader.readAsDataURL(file);
  }
}

async function finishProfileSetup() {
  selectedProfileData.pseudo = document.getElementById('completePseudoInput').value.trim();
  selectedProfileData.bio = document.getElementById('completeBioInput').value.trim();
  selectedProfileData.regimes = document.getElementById('completeRegimesInput').value.trim();
  
  if (!selectedProfileData.pseudo) {
    alert('⚠️ Rentre un pseudo !');
    return;
  }
  
  currentUser = selectedProfileData;
  saveAllData();
  localStorage.setItem('saraillon_last_profile_id', String(currentUser.id)); // ✅ Se souvenir du profil
  
  document.getElementById('modalProfileComplete').style.display = 'none';

  await enterMainApp();

  requestNotificationPermission();
}

function goBackToCode() {
  // Afficher à nouveau le modal de sélection de profil
  document.getElementById('modalProfileSelect').style.display = 'flex';
  renderProfileSelectCarousel();
}

function goBackToProfileSelect() {
  document.getElementById('modalProfileComplete').style.display = 'none';
  document.getElementById('modalProfileSelect').style.display = 'flex';
}

function switchToOtherProfile() {
  showConfirmation('Changer de personnage ? Tu devras reprendre depuis l\'écran de sélection.', () => {
    localStorage.removeItem('saraillon_last_profile_id');
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('modalProfileSelect').style.display = 'flex';
    profileCarouselIndex = 0;
    renderProfileSelectCarousel();
  });
}

// ============== INIT ==============
function loadAllData() {
  // ✅ On garde une copie des avatars par défaut codés en dur (photos ajoutées récemment)
  // pour ne jamais les perdre face à un vieux cache localStorage sans photo.
  const defaultAvatars = {};
  Object.keys(personalsData).forEach(id => {
    if (personalsData[id] && typeof personalsData[id].avatar === 'string' && personalsData[id].avatar.startsWith('data:image')) {
      defaultAvatars[id] = personalsData[id].avatar;
    }
  });

  const data = localStorage.getItem('saraillon_all');
  if (data) {
    // ✅ Si ce JSON est corrompu (écriture tronquée par un ancien dépassement de quota,
    // stockage modifié à la main, etc.), on ignore proprement plutôt que de bloquer
    // TOUT le chargement de l'app dès la première ligne — sans ce filet, une donnée
    // locale abîmée empêchait l'app de démarrer, sur ce téléphone, tant qu'on n'allait
    // pas vider le cache à la main.
    let parsed = null;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      console.error('Données locales corrompues, on repart des valeurs par défaut', err);
      parsed = null;
    }
    if (parsed) {
    inscriptions = parsed.inscriptions || {};
    // 🐛 CORRECTIF IMPORTANT : l'ancien code effaçait TOUTE la progression des défis
    // (qui a relevé quoi, preuves, likes, commentaires) dès que challengesVersion ne
    // correspondait plus pile à CHALLENGES_VERSION — donc à chaque mise à jour du contenu
    // des défis, tout le monde repartait de zéro sans prévenir, même sur les défis
    // inchangés. On fusionne maintenant par id : la progression de chaque défi déjà
    // relevé est conservée, seuls le texte/xp viennent du code à jour, et les nouveaux
    // défis ajoutés depuis apparaissent normalement.
    if (parsed.challenges && Array.isArray(parsed.challenges) && parsed.challenges.length > 0) {
      challenges = challenges.map(seedCh => {
        const saved = parsed.challenges.find(c => c.id === seedCh.id);
        if (!saved) return seedCh;
        return {
          ...seedCh,
          completedBy: saved.completedBy || [],
          proofs: saved.proofs || {},
          likes: saved.likes || [],
          comments: saved.comments || [],
        };
      });
    }
    shoppingList = parsed.shopping || [];
    galleryItems = parsed.gallery || [];
    feed = parsed.feed || [];
    notifications = parsed.notifications || [];
    currentUser = parsed.currentUser || PARTICIPANTS[0];
    checklistValise = parsed.checklistValise || {};
    personalsData = Object.assign(personalsData, parsed.personalsData || {});
    Object.assign(PARTICIPANTS, parsed.participants || []);
    // ✅ Ne restaure le planning depuis le cache local QUE si sa version correspond au code actuel.
    // Sinon on garde le contenu frais codé en dur (évite qu'un vieux cache masque une mise à jour du planning).
    if (parsed.planningVersion === PLANNING_VERSION) {
      Object.assign(planningData, parsed.planning || []);
    }
    polls = parsed.polls || [];
    expenses = parsed.expenses || [];
    choreLog = parsed.choreLog || [];
    departureTasksDone = parsed.departureTasksDone || {};
    }
  }

  // ✅ Si le profil chargé (cache local) n'a pas de vraie photo, on réapplique la photo par défaut
  Object.keys(defaultAvatars).forEach(id => {
    const current = personalsData[id] && personalsData[id].avatar;
    if (!current || typeof current !== 'string' || !current.startsWith('data:image')) {
      personalsData[id] = personalsData[id] || {};
      personalsData[id].avatar = defaultAvatars[id];
    }
  });

  updateNotifBadge();
}

// 🌐 Load data from Supabase (async)
async function loadFromSupabaseCloud() {
  // Attendre que Supabase soit prêt
  let retries = 0;
  while ((!window.supabaseReady || !window.loadFromSupabase) && retries < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (!window.supabaseReady || !window.loadFromSupabase) {
    console.warn('⚠️ Supabase not ready after retries, using localStorage only');
    return;
  }
  
  console.log('🌐 Loading from Supabase...');
  
  try {
    // Load shopping list
    const shopData = await window.loadFromSupabase('shopping_list');
    if (shopData && shopData.length > 0) {
      console.log(`✅ Loaded ${shopData.length} shopping items from Supabase`);
      shoppingList = shopData.map(item => ({
        id: item.id,
        item: item.item,
        done: item.done || false
      }));
    }
    
    // Load inscriptions
    const inscData = await window.loadFromSupabase('inscriptions');
    if (inscData && inscData.length > 0) {
      console.log(`✅ Loaded ${inscData.length} inscriptions from Supabase`);
      inscriptions = {};
      inscData.forEach(insc => {
        inscriptions[`${insc.person_id}-${insc.day_idx}-${insc.act_idx}`] = true;
      });
    }
    
    // Load gallery
    // ✅ Charge l'état partagé des défis (qui a relevé quoi, preuves, likes,
    // commentaires) depuis Supabase — corrige le fait que ça ne se synchronisait
    // jamais entre appareils. Le texte/xp restent ceux du code (saraillon-data.js),
    // seul l'état "vécu" vient du cloud, pour ne jamais perdre un défi créé en local
    // avant que la synchro n'existe.
    const challengesData = await window.loadFromSupabase('challenges');
    if (challengesData && challengesData.length > 0) {
      challengesData.forEach(row => {
        const existing = challenges.find(c => c.id === row.id);
        if (existing) {
          existing.completedBy = row.completed_by || [];
          existing.proofs = row.proofs || {};
          existing.likes = row.likes || [];
          existing.comments = row.comments || [];
        } else {
          // Défi créé par quelqu'un d'autre, jamais vu sur cet appareil.
          challenges.push({
            id: row.id,
            creator: row.creator,
            isQuest: row.is_quest || false,
            questLabel: row.quest_label || null,
            xp: row.xp || 20,
            description: row.description || '',
            media: row.media || null,
            completedBy: row.completed_by || [],
            proofs: row.proofs || {},
            likes: row.likes || [],
            comments: row.comments || [],
            timestamp: row.timestamp || new Date()
          });
        }
      });
      console.log(`✅ Loaded ${challengesData.length} challenges state from Supabase`);
    }

    const galleryData = await window.loadFromSupabase('gallery_items');
    if (galleryData && galleryData.length > 0) {
      console.log(`✅ Loaded ${galleryData.length} gallery items from Supabase`);
      galleryItems = galleryData.map(item => ({
        id: item.id,
        src: item.image_url,
        type: item.type || 'image',
        creator: item.creator,
        location: item.location,
        description: item.description || '',
        // ✅ Priorité à la date explicite envoyée par l'app (item.timestamp), qui est
        // la vraie date de publication — created_at (géré par la base) en repli
        // seulement pour les très vieilles photos publiées avant ce correctif.
        timestamp: item.timestamp || item.created_at || new Date(),
        tags: item.tags || [],
        likes: item.likes || [],
        comments: item.comments || []
      }));
    }
    
    // Load feed
    const feedData = await window.loadFromSupabase('feed_entries');
    if (feedData && feedData.length > 0) {
      console.log(`✅ Loaded ${feedData.length} feed entries from Supabase`);
      feed = feedData.map(entry => {
        const parsedData = entry.data ? JSON.parse(entry.data) : { likes: [], comments: [] };
        return {
          id: entry.id,
          personId: entry.person_id,
          user: entry.user_name,
          userId: entry.person_id,
          message: entry.text,
          emoji: entry.emoji,
          timestamp: entry.timestamp,
          likes: parsedData.likes || [],
          comments: parsedData.comments || [],
          // 🐛 CORRECTIF : refType/refId n'étaient ni envoyés ni relus depuis Supabase,
          // donc le lien "Voir →" du fil d'activité (renderFeed) disparaissait dès que
          // la page rechargeait ou que le polling 25s re-fetchait le fil. On les stocke
          // dans le même blob JSON que likes/comments (pas de colonne dédiée nécessaire).
          refType: parsedData.refType || null,
          refId: parsedData.refId || null
        };
      });
    }
    
    // Load checklist valise
    // 🐛 CORRECTIF : chaque case cochée est maintenant liée à person_id — sans ce filtre,
    // tout le monde partageait les mêmes coches (bug), la valise n'était pas vraiment
    // personnelle malgré l'intention initiale ("LOCAL ONLY" dans saveAllData, contournée
    // ici pour permettre la synchro multi-appareils SANS partager entre personnes).
    const valisData = await window.loadFromSupabase('checklist_valise');
    if (valisData && valisData.length > 0) {
      const mine = valisData.filter(item => String(item.person_id) === String(currentUser.id));
      console.log(`✅ Loaded ${mine.length} checklist items from Supabase (perso)`);
      checklistValise = {};
      mine.forEach(item => {
        checklistValise[item.key] = item.status;
      });
    }
    
    // Load user profiles
    const profileData = await window.loadFromSupabase('user_profiles');
    if (profileData && profileData.length > 0) {
      profileData.forEach(profile => {
        // ✅ Fusionner au lieu d'écraser : garde les données locales si le cloud n'a rien de plus récent
        personalsData[profile.person_id] = personalsData[profile.person_id] || {};
        if (profile.bio) personalsData[profile.person_id].bio = profile.bio;
        const localAvatar = personalsData[profile.person_id].avatar;
        const localIsRealPhoto = typeof localAvatar === 'string' && localAvatar.startsWith('data:image');
        // 🐛 CORRECTIF : "cloudIsRealPhoto" ne vérifiait que le préfixe ("data:image...") — une
        // photo tronquée en base (ex. colonne trop courte) passait quand même ce test et pouvait
        // écraser une bonne photo locale par une image cassée (cause probable de photos de profil
        // "perdues"). On exige maintenant une longueur plausible pour une vraie photo compressée.
        const cloudIsRealPhoto = typeof profile.avatar === 'string' && profile.avatar.startsWith('data:image') && profile.avatar.length > 2000;
        // Ne jamais remplacer une vraie photo locale par un simple emoji, une valeur vide,
        // ou une image tronquée/corrompue venue du cloud.
        if (profile.avatar && (cloudIsRealPhoto || !localIsRealPhoto)) {
          personalsData[profile.person_id].avatar = profile.avatar;
        }
      });
    }
    
    // Load notifications (fusion : ajoute les nouvelles, garde le statut lu/non-lu local pour celles déjà connues)
    const notifData = await window.loadFromSupabase('notifications');
    if (notifData && notifData.length > 0) {
      console.log(`✅ Loaded ${notifData.length} notifications from Supabase`);
      const existingIds = new Set(notifications.map(n => n.id));
      notifData.forEach(n => {
        if (!existingIds.has(n.id)) {
          notifications.push({
            id: n.id,
            message: n.message,
            emoji: n.emoji || '📌',
            type: n.type || 'general',
            refId: n.ref_id || null,
            // ✅ Priorité à la date explicite envoyée par l'app (n.timestamp), qui est
            // la vraie date d'origine — created_at (géré par la base) en repli
            // seulement pour les très vieilles notifications d'avant ce correctif.
            timestamp: n.timestamp || n.created_at || new Date(),
            read: n.author_id === (currentUser ? currentUser.id : null) // ✅ Ses propres notifs sont déjà "vues"
          });
        }
      });
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (notifications.length > 50) notifications = notifications.slice(0, 50);
      updateNotifBadge();
      renderNotifications();
    }
    
    // Load sondages
    const pollsData = await window.loadFromSupabase('polls');
    if (pollsData && pollsData.length > 0) {
      console.log(`✅ Loaded ${pollsData.length} polls from Supabase`);
      polls = pollsData.map(p => ({
        id: p.id,
        question: p.question,
        options: p.options || [],
        creator: p.creator || '',
        timestamp: p.created_at || new Date()
      }));
    }

    // Load dépenses
    const expensesData = await window.loadFromSupabase('expenses');
    if (expensesData && expensesData.length > 0) {
      console.log(`✅ Loaded ${expensesData.length} expenses from Supabase`);
      expenses = expensesData.map(e => ({
        id: e.id,
        payer: e.payer,
        amount: e.amount,
        description: e.description || '',
        splitAmong: e.split_among || [],
        timestamp: e.created_at || new Date()
      }));
    }

    console.log('✅ Données chargées depuis Supabase!');
  } catch (err) {
    console.log('📱 Utilisation des données locales (Supabase non disponible)');
  }
}

function saveAllData() {
  const data = {
    inscriptions, challenges, challengesVersion: CHALLENGES_VERSION, shopping: shoppingList, gallery: galleryItems, feed, notifications,
    currentUser, participants: PARTICIPANTS, planning: planningData, planningVersion: PLANNING_VERSION, checklistValise, personalsData,
    polls, expenses, choreLog, departureTasksDone
  };
  // ✅ Protégé contre un dépassement de quota localStorage (les photos de galerie en base64
  // peuvent faire grossir ce blob jusqu'à la limite du navigateur). Sans ce try/catch, une
  // exception ici arrêtait tout le reste de saveAllData() — historique, sync Supabase, indicateur —
  // exactement comme l'a fait le bug "history" plus tôt : silencieux, mais tous les boutons cassés.
  try {
    localStorage.setItem('saraillon_all', JSON.stringify(data));
  } catch (err) {
    console.error('localStorage.setItem a échoué (quota dépassé ?)', err);
    if (!window.__quotaWarningShown) {
      window.__quotaWarningShown = true;
      showNotification('⚠️ Stockage local plein — les données restent synchronisées en ligne mais pas sur cet appareil', 'error');
    }
  }
  saveHistory(data);
  
  // ✅ Afficher l'indicateur de sauvegarde
  const saveInd = document.getElementById('saveIndicator');
  if (saveInd) {
    saveInd.classList.add('show');
    setTimeout(() => saveInd.classList.remove('show'), 800);
  }
  
  // 🌐 SYNC TO SUPABASE (en arrière-plan, sans attendre)
  if (window.supabaseReady && window.syncToSupabase) {
    // Sync shopping list
    shoppingList.forEach(item => {
      window.syncToSupabase('shopping_list', { id: item.id, item: item.item, done: item.done }).catch(err => console.error('Sync Supabase échouée:', err));
    });
    
    // Sync inscriptions (clé composée: person_id, day_idx, act_idx)
    Object.entries(inscriptions).forEach(([key, value]) => {
      if (value === true) {
        const [personId, dayIdx, actIdx] = key.split('-').map(Number);
        window.syncToSupabase('inscriptions', { 
          person_id: personId, 
          day_idx: dayIdx, 
          act_idx: actIdx 
        }).catch(err => console.error('Sync Supabase échouée:', err));
      }
    });
    
    // ✅ Sync challenges — jusqu'ici, qui a relevé quoi/likes/commentaires n'était
    // JAMAIS synchronisé entre appareils (contrairement à la galerie/corvées) : un
    // commentaire posté par quelqu'un d'autre pouvait ne jamais apparaître ailleurs.
    challenges.forEach(ch => {
      window.syncToSupabase('challenges', {
        id: ch.id,
        creator: ch.creator || null,
        is_quest: ch.isQuest || false,
        quest_label: ch.questLabel || null,
        xp: ch.xp || 20,
        description: ch.description || '',
        media: ch.media || null,
        completed_by: ch.completedBy || [],
        proofs: ch.proofs || {},
        likes: ch.likes || [],
        comments: ch.comments || [],
        timestamp: ch.timestamp instanceof Date ? ch.timestamp.toISOString() : ch.timestamp
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });

    // Sync gallery items
    galleryItems.forEach(item => {
      const imgSrc = item.src || item.image || '';
      // ✅ Ne jamais synchroniser une image vide : ça écraserait une bonne photo déjà en ligne
      if (!imgSrc) {
        console.error(`Photo "${item.location}" sans image locale, sync ignorée pour éviter d'écraser la version en ligne`);
        return;
      }
      window.syncToSupabase('gallery_items', {
        id: item.id,
        creator: item.creator,
        location: item.location,
        description: item.description || '',
        type: item.type || 'image',
        image_url: imgSrc,
        tags: item.tags || [],
        likes: item.likes || [],
        comments: item.comments || [],
        // 🐛 CORRECTIF : jamais envoyée jusqu'ici — sans cette date explicite, la
        // photo affichait "maintenant" à chaque rechargement au lieu de sa vraie
        // date/heure de publication (visible différemment pour chacun, à chaque fois).
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });
    
    // Sync feed entries
    // Sync feed (sérialiser en JSON)
    feed.forEach(entry => {
      window.syncToSupabase('feed_entries', {
        id: entry.id,
        person_id: entry.userId || 1,
        user_name: entry.user,
        text: entry.message,
        emoji: entry.emoji,
        // 🐛 CORRECTIF : refType/refId n'étaient jamais envoyés vers Supabase — le lien
        // "Voir →" du fil d'activité (renderFeed) n'existait donc que le temps de la
        // session en cours, avant le premier rechargement ou le premier polling 25s.
        data: JSON.stringify({ likes: entry.likes || [], comments: entry.comments || [], refType: entry.refType || null, refId: entry.refId || null }),
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });
    
    // Notifications: synchronisées individuellement dans addNotification() dès leur création (pas ici en masse)
    
    // Sync checklist valise — désormais synchronisée avec person_id, pour qu'elle survive
    // à un changement d'appareil SANS être partagée avec les autres (voir loadAllData).
    Object.entries(checklistValise).forEach(([key, status]) => {
      window.syncToSupabase('checklist_valise', {
        key,
        person_id: currentUser.id,
        status: !!status
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });
    
    
    // Sync sondages
    polls.forEach(poll => {
      window.syncToSupabase('polls', {
        id: poll.id,
        question: poll.question,
        options: poll.options || [],
        creator: poll.creator || ''
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });

    // Sync dépenses
    expenses.forEach(exp => {
      window.syncToSupabase('expenses', {
        id: exp.id,
        payer: exp.payer,
        amount: exp.amount,
        description: exp.description || '',
        split_among: exp.splitAmong || []
      }).catch(err => console.error('Sync Supabase échouée:', err));
    });

    // Sync user profile — ⚠️ SEULEMENT le profil de l'utilisateur actuel de CET
    // appareil. Avant ce correctif, chaque appareil renvoyait les 9 profils à
    // partir de son propre cache local à chaque sauvegarde (toutes les 30s et à
    // chaque action) : si le téléphone de Marine avait une copie ancienne de la
    // bio de Delphine, il écrasait régulièrement la vraie mise à jour de Delphine
    // dans Supabase avec cette ancienne version. C'est la cause des "anciennes
    // descriptions de profil" qui réapparaissaient.
    if (currentUser && Number.isInteger(currentUser.id)) {
      const profile = personalsData[currentUser.id];
      if (profile) {
        const avatarStr = typeof profile.avatar === 'string' ? profile.avatar : '';
        if (avatarStr.length > 2000000) {
          console.error(`Avatar trop volumineux (${avatarStr.length} caractères), sync ignorée`);
        } else {
          window.syncToSupabase('user_profiles', {
            person_id: currentUser.id,
            pseudo: String(currentUser.pseudo || ''),
            bio: String(profile.bio || ''),
            avatar: avatarStr,
            regimes: String(currentUser.regimes || '')
          }).catch(err => console.error('Échec sync profil:', err));
        }
      }
    }
  }
}

function saveHistory(data) {
  historyIndex++;
  undoHistory = undoHistory.slice(0, historyIndex);
  undoHistory.push(JSON.stringify(data));
  if (undoHistory.length > 20) undoHistory.shift();
}

function toggleUndo() {
  if (historyIndex > 0) {
    historyIndex--;
    const data = JSON.parse(undoHistory[historyIndex]);
    applyHistory(data);
    showNotification('↶ Annulé');
  }
}

function toggleRedo() {
  if (historyIndex < undoHistory.length - 1) {
    historyIndex++;
    const data = JSON.parse(undoHistory[historyIndex]);
    applyHistory(data);
    showNotification('↷ Refait');
  }
}

function applyHistory(data) {
  inscriptions = data.inscriptions;
  challenges = data.challenges;
  shoppingList = data.shopping;
  galleryItems = data.gallery;
  feed = data.feed;
  currentUser = data.currentUser;
  // ✅ Ces champs étaient bien sauvegardés dans l'historique mais jamais restaurés :
  // annuler/refaire laissait les dépenses, sondages, valise et corvées inchangés,
  // ce qui donnait un "annuler" trompeur (partiel).
  expenses = data.expenses || expenses;
  polls = data.polls || polls;
  checklistValise = data.checklistValise || checklistValise;
  choreLog = data.choreLog || choreLog;
  departureTasksDone = data.departureTasksDone || departureTasksDone;
  renderPlanning();
  renderShopping();
  renderChallenges();
  renderGallery();
  renderFeed();
  renderExpenses();
  renderPolls();
  renderChoreLogPanel();
}

// ✅ Upload direct vers Supabase Storage (contrairement aux photos de galerie qui
// passent en base64 dans une ligne de table, ceci envoie le vrai fichier — seule
// méthode viable pour des vidéos de plusieurs dizaines de Mo). Permet d'uploader
// depuis le téléphone/ordinateur SANS passer par le dashboard Supabase.
// ✅ Upload direct vers Supabase Storage — appel REST manuel plutôt que le module
// storage du SDK JS. Le SDK (figé en version 2.45.0) semble incompatible avec le
// nouveau format de clé "sb_publishable_..." spécifiquement pour les uploads —
// toutes les lectures/écritures en base fonctionnaient, mais aucun fichier n'a
// jamais réellement été envoyé jusqu'ici. Cet appel direct contourne le souci.
async function uploadFileToStorage(bucket, path, file) {
  if (!window.supabaseReady || !window.SUPABASE_URL) throw new Error('Supabase non prêt, réessaie dans quelques secondes.');

  const url = `${window.SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
      'apikey': window.SUPABASE_ANON_KEY,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch (e) {}
    throw new Error(`Upload échoué (HTTP ${res.status}) ${detail}`.trim());
  }

  return `${window.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ✅ Upload direct de la vidéo d'un challenge CHALLENGE 1-4, au bon nom de fichier
// dans le bucket 'challenge-videos' — le chemin correspond exactement à l'URL déjà
// codée dans saraillon-data.js, donc dès l'upload terminé, tout le monde voit la
// vidéo sans qu'aucune autre donnée n'ait besoin d'être synchronisée.
async function uploadChallengeVideo(challengeId, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  const ch = challenges.find(c => c.id === challengeId);
  if (!ch) return;

  const num = (ch.creator.match(/\d+/) || ['?'])[0];
  // 🐛 CORRECTIF : générait "challenge-1.mp4" (avec tiret) alors que les fichiers réels
  // dans le bucket sont nommés "challenge1.mp4" (sans tiret) — un envoi depuis l'app
  // créait un fichier différent au lieu de remplacer le bon.
  const path = `challenge${num}.mp4`;
  const progressEl = document.getElementById(`upload-progress-${challengeId}`);
  if (progressEl) progressEl.textContent = '⏳ Envoi en cours...';

  try {
    const publicUrl = await uploadFileToStorage('challenge-videos', path, file);
    ch.media = { type: 'video', src: `${publicUrl}?t=${Date.now()}` }; // cache-buster
    if (progressEl) progressEl.textContent = '✅ Vidéo envoyée !';
    showNotification('🎥 Vidéo uploadée avec succès !', 'success');
    renderChallenges();
  } catch (err) {
    console.error('Échec upload vidéo challenge:', err);
    const detail = (err && err.message) ? err.message : 'erreur inconnue';
    if (progressEl) progressEl.textContent = `❌ Échec : ${detail}`;
    showNotification(`❌ Échec upload : ${detail}`, 'error');
  }
}

// ✅ Bascule entre les 3 panneaux de l'onglet Défis (quêtes / chasse au trésor / classement),
// pour éviter d'empiler plusieurs listes verticalement (illisible). Le classement XP était
// auparavant sur l'accueil (home-leaderboard) : il vit maintenant ici, à sa vraie place.
const QUEST_PANELS = {
  quetes:     { band: 'https://iupghubmnibbdipingnj.supabase.co/storage/v1/object/public/app-assets/band-quete.jpg', eyebrow: 'Aventure', title: 'Quêtes', emoji: '🎮 Quêtes' },
  tresor:     { band: 'https://iupghubmnibbdipingnj.supabase.co/storage/v1/object/public/app-assets/band-tresor.jpg', eyebrow: 'Exploration', title: 'Chasse au trésor', emoji: '🗺️ Trésor' },
  classement: { band: 'https://iupghubmnibbdipingnj.supabase.co/storage/v1/object/public/app-assets/band-quete.jpg', eyebrow: 'Le groupe', title: 'Classement', emoji: '🏆 Classement' },
};

function switchQuestPanel(panel) {
  currentQuestPanel = panel;
  Object.keys(QUEST_PANELS).forEach(key => {
    const panelEl = document.getElementById(`quest-panel-${key}`);
    const btnEl = document.getElementById(`quest-panel-tab-${key}`);
    const active = key === panel;
    if (panelEl) panelEl.style.display = active ? 'block' : 'none';
    if (btnEl) {
      btnEl.style.background = active ? 'var(--bg-raised)' : 'transparent';
      btnEl.style.color = active ? 'var(--primary)' : 'var(--primary-light)';
      btnEl.style.boxShadow = active ? '0 2px 6px rgba(12, 47, 58, 0.08)' : 'none';
    }
  });

  const info = QUEST_PANELS[panel];
  const bandPhoto = document.getElementById('quest-band-photo');
  const bandEyebrow = document.getElementById('quest-band-eyebrow');
  const bandTitle = document.getElementById('quest-band-title');
  if (bandPhoto && info) bandPhoto.src = info.band;
  if (bandEyebrow && info) bandEyebrow.textContent = info.eyebrow;
  if (bandTitle && info) bandTitle.textContent = info.title;

  if (panel === 'classement' && typeof renderClassement === 'function') renderClassement();
}
let currentQuestPanel = 'quetes';

function switchTab(tab) {
  // Sauvegarder le tab COURANT comme previousTab AVANT de changer
  if (document.querySelector('.tab-content.active')) {
    const currentActiveTab = document.querySelector('.tab-content.active').id;
    if (currentActiveTab && currentActiveTab !== 'home' && currentActiveTab !== tab) {
      previousTab = currentActiveTab;
    }
  }
  
  setCurrentTab(tab);
  document.querySelectorAll('.tab-content').forEach(t => {
    t.classList.remove('active');
    t.style.display = 'none';
  });
  const el = document.getElementById(tab);
  if (el) {
    el.classList.add('active');
    el.style.display = 'block';
  }
  
  // Render approprié selon l'onglet
  if (tab === 'home') renderHome();
  if (tab === 'planning') renderPlanning();
  if (tab === 'challenges') { renderChallenges(); renderTresor(); renderMysteryPhoto(); }
  if (tab === 'inscriptions') renderInscriptions();
  if (tab === 'gallery') renderGallery();
  if (tab === 'polls') renderPolls();
  if (tab === 'expenses') renderExpenses();
  if (tab === 'shopping') renderShopping();
  if (tab === 'feed') renderFeed();
  if (tab === 'profile') showMyProfile();
  // Corvées: PAS d'appel automatique - attend le clic SPIN!
  if (tab === 'settings') renderSettings();
  if (tab === 'vie-pratique') renderViePratique();
  
  document.getElementById('backBtn').style.display = tab !== 'home' ? 'inline-block' : 'none';
  const homeBtnEl = document.getElementById('homeBtn');
  if (homeBtnEl) homeBtnEl.style.display = tab !== 'home' ? 'inline-block' : 'none';
}

function setCurrentTab(tabName) {
  // Ne rien faire ici - previousTab est maintenant géré dans switchTab
}

function goHome() {
  switchTab('home');
  renderHome();
}

// ✅ Retourne l'index du jour du séjour (0..9) pour une date donnée, ou null si hors séjour
function getTripDayIndex(date) {
  const tripStart = new Date(2026, 7, 21);
  tripStart.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - tripStart) / 86400000);
  if (diffDays < 0 || diffDays >= planningData.length) return null;
  return diffDays;
}

// ✅ AVION DU JOUR — mappe planningData[0..9] sur J1..J10 réels (départ Vendredi 21 août 2026)
function updateTodayPlaneBanner() {
  const banner = document.getElementById('today-plane-banner');
  if (!banner) return;

  const tripStart = new Date(2026, 7, 21); // 21 août 2026 (mois 0-indexé : 7 = août)
  tripStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today - tripStart) / 86400000);
  const flagEl = banner.querySelector('.tow-flag');

  if (diffDays >= planningData.length) {
    banner.style.display = 'none';
    return;
  }

  if (diffDays < 0) {
    // Avant le départ : compte à rebours
    if (flagEl) {
      const n = -diffDays;
      flagEl.textContent = `✈️ J-${n} avant le grand départ !`;
    }
    banner.style.display = 'block';
    return;
  }

  const day = planningData[diffDays];
  const activity = day.activities[0];
  if (flagEl) {
    flagEl.textContent = `${activity.emoji || ''} Aujourd'hui : ${activity.nom}`.trim();
  }
  banner.style.display = 'block';
}

// ⚠️ Alerte activités à inscription sans aucun inscrit
function renderHomeInscriptionAlert() {
  const container = document.getElementById('home-inscriptions-alert');
  if (!container) return;

  const emptyOnes = activitiesInscription.filter(act => {
    return !PARTICIPANTS.some(p => inscriptions[`${p.id}-${act.dayIdx}-${act.actIdx}`] === true);
  });

  if (emptyOnes.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="card" onclick="goToInscriptions()" style="cursor: pointer; background: linear-gradient(135deg, rgba(224, 122, 150, 0.15) 0%, rgba(224, 122, 150, 0.05) 100%); padding: 16px; margin-bottom: 20px; box-shadow: inset 4px 0 0 var(--accent-pink), 0 4px 12px rgba(224, 122, 150, 0.15);">
      <div style="font-weight: 800; font-size: 13px; color: var(--accent-pink); margin-bottom: 6px;">⚠️ PERSONNE INSCRIT(E) POUR :</div>
      <div style="font-size: 13px; line-height: 1.5;">${emptyOnes.map(a => `${a.emoji || ''} ${a.nom}`).join(' · ')}</div>
      <div style="font-size: 11px; color: var(--primary-light); margin-top: 6px;">👉 Touche pour t'inscrire</div>
    </div>
  `;
}

function goToInscriptions() {
  switchTab('inscriptions');
}

// ✅ Avatar cliquable dans le header (photo réelle si envoyée, sinon initiale) —
// raccourci permanent vers "Mon Profil" depuis n'importe quelle page.

// ✅ Couleur par défaut distincte par personne (au lieu du même dégradé bleu-cyan partout) —
// utile tant que tout le monde n'a pas encore reposté sa photo de profil.
const PERSON_DEFAULT_COLORS = [
  ['#1D5FA8', '#1690A3'], ['#e35b2e', '#f4b942'], ['#2fae6e', '#7fe0ea'],
  ['#c23d52', '#ff9bab'], ['#7b2fd6', '#c98bf0'], ['#0e7a90', '#7fe0ea'],
  ['#c9821f', '#ffd873'], ['#1c7d4c', '#6fe0a0'], ['#a9741f', '#f2d79a'],
];
function getPersonGradient(personId) {
  const idx = PARTICIPANTS.findIndex(p => p.id === personId);
  const [c1, c2] = PERSON_DEFAULT_COLORS[(idx >= 0 ? idx : personId) % PERSON_DEFAULT_COLORS.length];
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

// ✅ Proverbe du jour : même proverbe pour tout le monde le même jour (calculé à
// partir de la date calendaire, pas aléatoire), affiché une seule fois par jour et
// par appareil en générique plein écran façon Star Wars.
function getTodayProverb() {
  const today = new Date();
  const daysSinceEpoch = Math.floor(today.getTime() / 86400000);
  const idx = ((daysSinceEpoch % PROVERBS.length) + PROVERBS.length) % PROVERBS.length;
  return PROVERBS[idx];
}

function maybeShowProverbCrawl() {
  // ✅ Pas le jour de l'installation : la personne est déjà en train de découvrir
  // l'app et de renseigner ses infos (onboarding) — lui montrer aussi le générique
  // le même jour fait doublon, ce n'est pas agréable.
  if (!localStorage.getItem('saraillon_onboarding_seen')) return;

  const todayStr = new Date().toDateString();
  const lastShown = localStorage.getItem('saraillon_proverb_last_shown');
  if (lastShown === todayStr) return; // déjà vu aujourd'hui sur cet appareil

  const proverb = getTodayProverb();
  document.getElementById('proverb-crawl-body').textContent = proverb.text;
  document.getElementById('proverb-crawl-origin').textContent = `— ${proverb.origin} —`;
  document.getElementById('proverb-crawl-overlay').style.display = 'block';
  document.getElementById('proverb-crawl-next-btn').style.display = 'none';

  // ✅ Le texte défile puis reste figé (lisible) — le bouton "Suivant" n'apparaît
  // qu'une fois l'animation terminée, pour laisser le temps de lire avant de fermer.
  setTimeout(() => {
    const btn = document.getElementById('proverb-crawl-next-btn');
    if (btn) btn.style.display = 'block';
  }, 3400);

  localStorage.setItem('saraillon_proverb_last_shown', todayStr);
}

function closeProverbCrawl() {
  document.getElementById('proverb-crawl-overlay').style.display = 'none';
}

// ✅ Depuis le fil d'activité : navigue vers l'élément précis concerné (photo,
// commentaire, défi, trésor, activité inscrite...) plutôt que de rester sur place.
function openFeedEntry(refType, refId) {
  const id = parseInt(refId, 10);
  if (refType === 'gallery') openGalleryNotification(id, false);
  else if (refType === 'gallery-comment') openGalleryNotification(id, true);
  else if (refType === 'challenge') openChallengeNotification(id);
  else if (refType === 'tresor') openTresorNotification(id);
  else if (refType === 'profile') showPublicProfile(id);
  else if (refType === 'planning') {
    const [dayIdx, actIdx] = String(refId).split(':').map(n => parseInt(n, 10));
    switchTab('planning');
    setTimeout(() => { if (typeof openPlanningDay === 'function') openPlanningDay(dayIdx); }, 100);
  }
  else if (refType === 'polls') switchTab('polls');
  else if (refType === 'expenses') switchTab('expenses');
  else if (refType === 'corvees') switchTab('corvees');
}

function renderHeaderAvatar() {
  const el = document.getElementById('headerAvatarContent');
  if (!el || !currentUser) return;
  const raw = (personalsData[currentUser.id] && personalsData[currentUser.id].avatar) || null;
  const photo = (raw && raw.startsWith('data:image')) ? raw : null;
  if (photo) {
    el.innerHTML = `<img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
    el.style.background = 'none';
  } else {
    el.textContent = (currentUser.name || '?')[0].toUpperCase();
    el.style.background = getPersonGradient(currentUser.id);
  }
}

function renderHome() {
  renderHeaderAvatar();
  // Greeting
  const user = currentUser;
  const greeting = document.getElementById('home-greeting');
  if (greeting) {
    greeting.textContent = user.pseudo ? `Bienvenue, ${user.name} (${user.pseudo})!` : `Bienvenue, ${user.name}!`;
  }

  updateTodayPlaneBanner();
  renderSyncStatus();
  renderSecretMission();
  renderHomeGroupSpirit();
  renderWeatherBanner();
  renderCountdownBanner();
  renderTripRecap();
  renderHomeMemoryOfDay();
  renderHomePackingProgress();
  renderHomeHud();
  renderHomeFeaturedRow();
  renderHomeMenuTiles();

  // Render feed
  const feedContainer = document.getElementById('home-feed');
  if (!feedContainer) return;

  // Récupérer les derniers mouvements du feed
  const feedItems = feed.slice(-8).reverse();  // Derniers 8, inversés pour le plus récent d'abord
  
  if (feedItems.length === 0) {
    feedContainer.innerHTML = '<div style="font-size: 13px; color: var(--primary-light); text-align: center; padding: 12px;">Aucune activité pour le moment</div>';
    return;
  }

  let html = '';
  feedItems.forEach(item => {
    const timeago = getTimeAgo(item.timestamp);
    // 🐛 CORRECTIF : la ligne était déjà cliquable techniquement (onclick présent)
    // quand item.refType existe, mais sans AUCUN indice visuel — pas de texte,
    // pas de flèche. Sur mobile (pas de survol), impossible de deviner que c'est
    // tapable. On ajoute le même repère "Voir →" que dans la vue "Actualité" complète.
    html += `
      <div ${item.refType ? `onclick="openFeedEntry('${item.refType}', '${escapeHtml(String(item.refId))}')" style="cursor: pointer;` : `style="`}padding: 10px 12px; background: var(--bg-sunken); border-radius: 12px; box-shadow: inset 4px 0 0 var(--accent-cyan); font-size: 13px; line-height: 1.4;">
        <strong>${item.emoji || ''} ${escapeHtml(item.user)}</strong> ${escapeHtml(item.message)}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
          <div style="color: var(--primary-light); font-size: 11px;">${timeago}</div>
          ${item.refType ? `<div style="font-size: 11px; font-weight: 700; color: var(--accent-sand);">Voir →</div>` : ''}
        </div>
      </div>
    `;
  });
  
  feedContainer.innerHTML = html;
}

// ✅ SOUVENIR DU JOUR — une photo de la galerie tirée au sort, mais fixe pour la journée
// et identique pour tout le monde (pas un tirage aléatoire à chaque ouverture) :
// c'est une surprise ponctuelle et partagée, pas un mécanisme pour faire revenir sans cesse.
function renderHomeMemoryOfDay() {
  const container = document.getElementById('home-memory');
  if (!container) return;

  if (!galleryItems || galleryItems.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Seed déterministe basé sur la date du jour (YYYY-MM-DD) : même photo pour tout le monde,
  // change automatiquement le lendemain
  const todayKey = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < todayKey.length; i++) seed = (seed * 31 + todayKey.charCodeAt(i)) % 100000;
  const photo = galleryItems[seed % galleryItems.length];
  const imgSrc = photo.src || photo.image_url;
  if (!imgSrc) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden; cursor: pointer;" onclick="switchTab('gallery')">
      <div style="position: relative;">
        <img src="${imgSrc}" style="width: 100%; height: 180px; object-fit: cover; display: block;">
        <div style="position: absolute; top: 10px; left: 10px; background: rgba(10,14,22,0.6); backdrop-filter: blur(4px); color: white; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 999px; letter-spacing: 0.3px;">✨ Souvenir du jour</div>
      </div>
      <div style="padding: 12px 14px; font-size: 12px; color: var(--primary-light);">
        Par ${photo.creator || 'quelqu\'un du groupe'} — <span style="color: var(--accent-cyan); font-weight: 600;">voir la galerie →</span>
      </div>
    </div>
  `;
}

// ✅ ICÔNES 3D "maison" (SVG vectoriel, palette Méditerranée) pour la grille Explorer
const EXPLORE_ICONS_3D = {
  planning: `<svg viewBox="0 0 100 100"><defs><linearGradient id="pl-b" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7fe0ea"/><stop offset="1" stop-color="#1fb6c9"/></linearGradient><radialGradient id="pl-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="18" y="26" width="64" height="58" rx="12" fill="url(#pl-b)"/><rect x="18" y="26" width="64" height="18" rx="12" fill="#0e7a90"/><rect x="18" y="38" width="64" height="8" fill="#0e7a90"/><rect x="30" y="16" width="9" height="20" rx="4.5" fill="#a9741f"/><rect x="61" y="16" width="9" height="20" rx="4.5" fill="#a9741f"/><circle cx="34.5" cy="18" r="5.5" fill="#f4b942"/><circle cx="65.5" cy="18" r="5.5" fill="#f4b942"/><g fill="#fff"><rect x="28" y="54" width="10" height="9" rx="2.5"/><rect x="45" y="54" width="10" height="9" rx="2.5"/><rect x="62" y="54" width="10" height="9" rx="2.5"/><rect x="28" y="68" width="10" height="9" rx="2.5" opacity="0.7"/><rect x="45" y="68" width="10" height="9" rx="2.5" fill="#f4b942"/></g><ellipse cx="40" cy="46" rx="26" ry="12" fill="url(#pl-gl)"/></svg>`,
  quetes: `<svg viewBox="0 0 100 100"><defs><linearGradient id="q-c" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#c9821f"/></linearGradient><radialGradient id="q-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M30 24 h40 v14 a20 20 0 0 1 -40 0 z" fill="url(#q-c)"/><path d="M30 28 h-8 a8 8 0 0 0 8 12 z" fill="#f4b942"/><path d="M70 28 h8 a8 8 0 0 1 -8 12 z" fill="#f4b942"/><rect x="45" y="56" width="10" height="12" fill="#c9821f"/><rect x="34" y="66" width="32" height="9" rx="4" fill="#d9a44c"/><rect x="30" y="74" width="40" height="9" rx="4" fill="#a9741f"/><ellipse cx="44" cy="34" rx="12" ry="9" fill="url(#q-gl)"/><path d="M44 32 l3 6 6 .6 -4.5 4.2 1.3 6.2 -5.8-3.2 -5.8 3.2 1.3-6.2 -4.5-4.2 6-.6z" fill="#fff" opacity="0.85"/></svg>`,
  courses: `<svg viewBox="0 0 100 100"><defs><linearGradient id="co-b" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7fe0ea"/><stop offset="1" stop-color="#0e7a90"/></linearGradient><radialGradient id="co-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M26 40 h48 l-5 42 a6 6 0 0 1 -6 5 H37 a6 6 0 0 1 -6 -5 z" fill="url(#co-b)"/><path d="M38 40 v-6 a12 12 0 0 1 24 0 v6" fill="none" stroke="#a9741f" stroke-width="6" stroke-linecap="round"/><rect x="26" y="52" width="48" height="9" fill="#f4b942"/><rect x="26" y="52" width="48" height="9" fill="#fff" opacity="0.25"/><ellipse cx="44" cy="48" rx="18" ry="7" fill="url(#co-gl)"/></svg>`,
  corvees: `<svg viewBox="0 0 100 100"><defs><linearGradient id="cv-b" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#c9821f"/></linearGradient></defs><path d="M56 12 L28 54 h16 l-8 34 32 -46 H50 z" fill="url(#cv-b)" stroke="#a9741f" stroke-width="2.5" stroke-linejoin="round"/><path d="M52 20 L36 46 h10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/></svg>`,
  surprises: `<svg viewBox="0 0 100 100"><defs><linearGradient id="s-box" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ff9bab"/><stop offset="1" stop-color="#c23d52"/></linearGradient><linearGradient id="s-lid" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ef6a7c"/><stop offset="1" stop-color="#c23d52"/></linearGradient><radialGradient id="s-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="24" y="46" width="52" height="38" rx="6" fill="url(#s-box)"/><rect x="20" y="36" width="60" height="16" rx="6" fill="url(#s-lid)"/><rect x="44" y="36" width="12" height="48" fill="#f4b942"/><rect x="20" y="42" width="60" height="4" fill="#fff" opacity="0.3"/><path d="M50 36 C40 20 24 30 50 36 C60 20 76 30 50 36" fill="#f4b942"/><circle cx="50" cy="34" r="4" fill="#c9821f"/><ellipse cx="40" cy="42" rx="16" ry="5" fill="url(#s-gl)"/></svg>`,
  galerie: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-c" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#6fe0a0"/><stop offset="1" stop-color="#1c7d4c"/></linearGradient><radialGradient id="g-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="16" y="34" width="68" height="48" rx="12" fill="url(#g-c)"/><path d="M38 34 l4 -8 h16 l4 8 z" fill="#1c7d4c"/><circle cx="50" cy="58" r="17" fill="#0e7a90"/><circle cx="50" cy="58" r="11" fill="#1fb6c9"/><circle cx="50" cy="58" r="5" fill="#7fe0ea"/><circle cx="45" cy="53" r="3.5" fill="#fff" opacity="0.8"/><rect x="68" y="40" width="9" height="6" rx="2" fill="#f4b942"/><ellipse cx="36" cy="44" rx="16" ry="6" fill="url(#g-gl)"/></svg>`,
  sondages: `<svg viewBox="0 0 100 100"><defs><linearGradient id="so-1" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7fe0ea"/><stop offset="1" stop-color="#0e7a90"/></linearGradient><linearGradient id="so-2" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#c9821f"/></linearGradient><linearGradient id="so-3" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ff9bab"/><stop offset="1" stop-color="#c23d52"/></linearGradient></defs><rect x="20" y="78" width="60" height="8" rx="4" fill="#a9741f"/><rect x="26" y="52" width="14" height="28" rx="5" fill="url(#so-1)"/><rect x="43" y="38" width="14" height="42" rx="5" fill="url(#so-2)"/><rect x="60" y="60" width="14" height="20" rx="5" fill="url(#so-3)"/><rect x="28" y="54" width="4" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="45" y="40" width="4" height="26" rx="2" fill="#fff" opacity="0.5"/></svg>`,
  depenses: `<svg viewBox="0 0 100 100"><defs><linearGradient id="d-w" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#f2d79a"/><stop offset="1" stop-color="#a9741f"/></linearGradient><linearGradient id="d-f" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#f4b942"/><stop offset="1" stop-color="#c9821f"/></linearGradient><radialGradient id="d-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect x="18" y="34" width="64" height="50" rx="12" fill="url(#d-w)"/><path d="M18 46 h64 v26 a6 6 0 0 1 -6 6 H24 a6 6 0 0 1 -6 -6 z" fill="url(#d-f)"/><rect x="60" y="52" width="26" height="16" rx="5" fill="#0e7a90"/><circle cx="68" cy="60" r="4.5" fill="#ffd873"/><circle cx="68" cy="60" r="2" fill="#c9821f"/><ellipse cx="40" cy="42" rx="20" ry="6" fill="url(#d-gl)"/></svg>`,
  meteo: `<svg viewBox="0 0 100 100"><defs><linearGradient id="mt-sun" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#e8891f"/></linearGradient><linearGradient id="mt-cloud" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7d2d8"/></linearGradient><radialGradient id="mt-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="62" cy="38" r="20" fill="url(#mt-sun)"/><path d="M28 74 c-12 0 -20 -9 -20 -19 c0 -9 6.5 -16.5 15 -18.5 c2 -12 12.5 -21 25 -21 c12 0 22 8 24.5 19.5 c9 1 16 8.5 16 17.5 c0 11 -9 21.5 -20.5 21.5 z" fill="url(#mt-cloud)"/><ellipse cx="40" cy="46" rx="22" ry="9" fill="url(#mt-gl)"/></svg>`,
  parametres: `<svg viewBox="0 0 100 100"><defs><linearGradient id="pa-g1" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#c98bf0"/><stop offset="1" stop-color="#7b2fd6"/></linearGradient><linearGradient id="pa-g2" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7fe0ea"/><stop offset="1" stop-color="#0e7a90"/></linearGradient><radialGradient id="pa-gl" cx="0.35" cy="0.25" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><g transform="translate(42,52)"><g fill="url(#pa-g1)"><circle cx="0" cy="0" r="19"/><rect x="-4" y="-27" width="8" height="14" rx="3"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(45)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(90)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(135)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(180)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(225)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(270)"/><rect x="-4" y="-27" width="8" height="14" rx="3" transform="rotate(315)"/></g><circle cx="0" cy="0" r="9" fill="#fff"/></g><g transform="translate(68,68)"><g fill="url(#pa-g2)"><circle cx="0" cy="0" r="13"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5" transform="rotate(60)"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5" transform="rotate(120)"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5" transform="rotate(180)"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5" transform="rotate(240)"/><rect x="-3.5" y="-20" width="7" height="10" rx="2.5" transform="rotate(300)"/></g><circle cx="0" cy="0" r="6" fill="#fff"/></g><ellipse cx="34" cy="38" rx="14" ry="6" fill="url(#pa-gl)"/></svg>`
};

// ✅ Explorer : 4 destinations seulement (Planning / Défis / Galerie / Vie pratique),
// au lieu de l'ancienne liste + accordéon "Vie pratique" replié par défaut.
// "Vie pratique" ouvre désormais un vrai onglet dédié (voir renderViePratique) qui
// regroupe Dépenses, Valise, Grand Tirage, Courses et Sondages avec un aperçu chiffré.
function renderHomeMenuTiles() {
  const container = document.getElementById('home-menu-tiles');
  if (!container) return;

  const tiles = [
    { tab: 'planning', label: 'Planning', icon: EXPLORE_ICONS_3D.planning },
    { tab: 'challenges', label: 'Défis', icon: EXPLORE_ICONS_3D.quetes },
    { tab: 'gallery', label: 'Galerie', icon: EXPLORE_ICONS_3D.galerie },
    { tab: 'vie-pratique', label: 'Vie pratique', icon: EXPLORE_ICONS_3D.courses },
  ];

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
      ${tiles.map(t => `
        <div onclick="switchTab('${t.tab}')" style="cursor: pointer; background: var(--bg-raised); border-radius: 14px; padding: 12px 4px; text-align: center; box-shadow: 0 2px 10px rgba(12, 47, 58, 0.07);">
          <div style="width: 34px; height: 34px; margin: 0 auto;">${t.icon}</div>
          <div style="font-size: 10px; font-weight: 700; color: var(--primary); margin-top: 6px;">${t.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ✅ Depuis la carte "Ma valise" de Vie pratique : ouvre directement le sous-onglet Valise du profil.
function goToValiseFromPratique() {
  switchTab('profile');
  setTimeout(() => { if (typeof showMyProfileTab === 'function') showMyProfileTab('valise'); }, 50);
}

// ✅ Onglet "Vie pratique" — regroupe Dépenses / Valise / Grand Tirage / Courses / Sondages
// avec un aperçu chiffré réel sur chaque carte (montant, %, corvée du jour, nb d'articles),
// pour ne pas avoir à ouvrir chaque outil juste pour savoir où on en est.
function renderViePratique() {
  const container = document.getElementById('vie-pratique-cards');
  if (!container) return;

  // Dépenses : total dépensé par le groupe
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Valise : réutilise le même regroupement dédoublonné que l'onglet Profil > Valise
  // (objets "à apporter" agrégés depuis toutes les activités du planning).
  const grouped = {};
  planningData.forEach(day => {
    day.activities.forEach(activity => {
      const list = Array.isArray(activity.apporter) ? activity.apporter : [];
      list.forEach(itemName => {
        const norm = String(itemName || '').trim().toLowerCase();
        if (!norm) return;
        grouped[norm] = grouped[norm] || `pack:${norm}`;
      });
    });
  });
  const valiseKeys = Object.values(grouped);
  const valisePacked = valiseKeys.filter(k => checklistValise[k]).length;
  const valisePct = valiseKeys.length ? Math.round((valisePacked / valiseKeys.length) * 100) : 0;

  // Grand Tirage : corvée du jour assignée à la personne courante (si tirée)
  const dayIdx = getTripDayIndex(new Date());
  const myChoreToday = (typeof cloudChoreAssignments !== 'undefined' ? cloudChoreAssignments : [])
    .find(r => r.day_idx === dayIdx && String(r.person_id) === String(currentUser.id));

  // Courses : articles restant à acheter
  const shoppingLeft = shoppingList.filter(i => !i.done).length;

  // Sondages en cours
  const pollsCount = polls.length;

  const cards = [
    {
      tab: 'expenses', icon: '💰', bg: 'linear-gradient(135deg,#fdeccf,#f4b942)',
      title: 'Dépenses', detail: `${expenses.length} dépense${expenses.length > 1 ? 's' : ''} enregistrée${expenses.length > 1 ? 's' : ''}`,
      right: `${totalSpent.toFixed(0)} €`
    },
    {
      tab: 'profile', direct: 'goToValiseFromPratique()',
      icon: '🧳', bg: 'linear-gradient(135deg,#dff0f2,#1fb6c9)',
      title: 'Ma valise', detail: `${valiseKeys.length ? `${valisePct}% prêt` : 'Rien à préparer pour l\'instant'} <span style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; background:var(--bg-sunken); color:var(--primary-soft); padding:2px 7px; border-radius:8px; margin-left:4px;">🔒 Personnel</span>`,
      right: valiseKeys.length ? `${valisePct}%` : '—'
    },
    {
      tab: 'corvees', icon: '🎡', bg: 'linear-gradient(135deg,#fdeccf,#e35b2e)',
      title: 'Le Grand Tirage', detail: myChoreToday ? `Aujourd'hui : ${myChoreToday.emoji || ''} ${escapeHtml(myChoreToday.chore_name)}` : "Pas encore de tirage pour aujourd'hui",
      right: '→'
    },
    {
      tab: 'shopping', icon: '🛒', bg: 'linear-gradient(135deg,#e3ecd8,#6fe0a0)',
      title: 'Courses', detail: `${shoppingLeft} article${shoppingLeft > 1 ? 's' : ''} à acheter`,
      right: '→'
    },
    {
      tab: 'polls', icon: '🗳️', bg: 'linear-gradient(135deg,#f4dbe0,#ef6a7c)',
      title: 'Sondages', detail: `${pollsCount} sondage${pollsCount > 1 ? 's' : ''} en cours`,
      right: 'Voter'
    },
  ];

  container.innerHTML = cards.map(c => `
    <div onclick="${c.direct || `switchTab('${c.tab}')`}" style="cursor: pointer; display: flex; align-items: center; gap: 12px; background: var(--bg-raised); border-radius: 16px; padding: 14px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(12, 47, 58, 0.07);">
      <div style="width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; background: ${c.bg};">${c.icon}</div>
      <div style="flex: 1; min-width: 0;">
        <div class="title-serif" style="font-size: 13.5px;">${c.title}</div>
        <div style="font-size: 11px; color: var(--primary-soft); margin-top: 2px;">${c.detail}</div>
      </div>
      <div style="font-size: 11px; font-weight: 700; color: var(--accent-sand); flex-shrink: 0;">${c.right}</div>
    </div>
  `).join('');
}

function renderHomeFeaturedRow() {
  const container = document.getElementById('home-featured-row');
  if (!container) return;

  const tripStart = new Date(2026, 7, 21);
  tripStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - tripStart) / 86400000);
  const startIdx = Math.max(0, Math.min(diffDays < 0 ? 0 : diffDays, planningData.length - 3));

  const upcoming = planningData.slice(startIdx, startIdx + 4);
  const palettes = [
    ['#5fd6df', '#0e7a90'], ['#f4b942', '#c99a3f'], ['#1fb6c9', '#0e7a90'], ['#ef6a7c', '#c94f70']
  ];

  container.innerHTML = upcoming.map((day, i) => {
    const realIdx = startIdx + i;
    const act = day.activities[0];
    const [c1, c2] = palettes[i % palettes.length];
    return `
      <div onclick="switchTab('planning'); openPlanningDay(${realIdx});" style="cursor: pointer; flex-shrink: 0; width: 150px; height: 180px; border-radius: 20px; background: linear-gradient(160deg, ${c1} 0%, ${c2} 100%); position: relative; overflow: hidden; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
        <span style="align-self: flex-start; background: rgba(255,255,255,0.9); color: var(--primary); font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">${day.date ? day.date.split(' ')[0] : ''}</span>
        <div style="color: white;">
          <div style="font-size: 22px; margin-bottom: 4px;">${act.emoji || '📌'}</div>
          <div style="font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px;">${day.jour}</div>
          <div style="font-size: 14px; font-weight: 700; line-height: 1.25;">${act.nom}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHomePackingProgress() {
  const el = document.getElementById('home-hud-valise');
  if (!el) return;

  let total = 0;
  let checked = 0;
  planningData.forEach((day, dayIdx) => {
    day.activities.forEach((activity, actIdx) => {
      const list = Array.isArray(activity.apporter) ? activity.apporter : [];
      list.forEach((item, itemIdx) => {
        total++;
        const key = `${dayIdx}-${actIdx}-${itemIdx}`;
        if (checklistValise[key]) checked++;
      });
    });
  });

  el.textContent = total === 0 ? '—' : `${Math.round((checked / total) * 100)}%`;
}

function renderHomeHud() {
  // XP de l'utilisateur courant
  const xpEl = document.getElementById('home-hud-xp');
  if (xpEl) {
    const ranking = computeXpLeaderboard();
    const mine = ranking.find(r => r.p.id === currentUser.id);
    xpEl.textContent = `${mine ? mine.xp : 0} XP`;
  }

  // Jours avant le départ / jour du séjour
  const daysEl = document.getElementById('home-hud-days');
  if (daysEl) {
    const tripStart = new Date(2026, 7, 21);
    tripStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - tripStart) / 86400000);
    if (diffDays < 0) {
      daysEl.textContent = `J-${-diffDays}`;
    } else if (diffDays < planningData.length) {
      daysEl.textContent = `J${diffDays + 1}/${planningData.length}`;
    } else {
      daysEl.textContent = '🏁';
    }
  }
}

// ✅ Jauge "esprit de groupe" : progression collective mêlant défis/quêtes relevés
// par tout le monde et corvées faites, affichée sur l'accueil. But : donner un
// signal visible de dynamique de groupe, pas une compétition entre individus.
// ✅ Petit indicateur discret "synchronisé à HH:MM" — rassure que les données
// sont bien à jour, et signale le nombre d'actions en attente si hors ligne.
function renderSyncStatus() {
  const container = document.getElementById('home-sync-status');
  if (!container) return;

  const queueLen = window.__syncQueueLength || 0;
  const online = navigator.onLine;

  let text, color, dot;
  if (!online) {
    text = queueLen > 0 ? `Hors ligne · ${queueLen} action${queueLen > 1 ? 's' : ''} en attente` : 'Hors ligne';
    color = 'var(--accent-red)';
    dot = '●';
  } else if (queueLen > 0) {
    text = `Resynchronisation en cours · ${queueLen} en attente`;
    color = 'var(--accent-gold)';
    dot = '●';
  } else if (window.lastSyncSuccess) {
    const hh = String(window.lastSyncSuccess.getHours()).padStart(2, '0');
    const mm = String(window.lastSyncSuccess.getMinutes()).padStart(2, '0');
    text = `Synchronisé à ${hh}:${mm}`;
    color = 'var(--accent-green)';
    dot = '●';
  } else {
    text = 'En attente de synchronisation...';
    color = 'var(--primary-light)';
    dot = '●';
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 10.5px; color: var(--primary-light);">
      <span style="color: ${color}; font-size: 8px;">${dot}</span>${text}
    </div>
  `;
}
setInterval(renderSyncStatus, 15000);

function renderHomeGroupSpirit() {
  const container = document.getElementById('home-group-spirit');
  if (!container) return;

  const totalQuestSlots = challenges.length * PARTICIPANTS.length;
  const doneQuestSlots = challenges.reduce((sum, ch) => sum + ((ch.completedBy || []).length), 0);

  const totalChoreSlots = cloudChoreAssignments.length;
  const doneChoreSlots = cloudChoreAssignments.filter(r => r.done).length;

  const totalSlots = totalQuestSlots + totalChoreSlots;
  const doneSlots = doneQuestSlots + doneChoreSlots;

  if (totalSlots === 0) {
    container.innerHTML = '';
    return;
  }

  const pct = Math.round((doneSlots / totalSlots) * 100);

  let msg;
  if (pct === 0) msg = "L'aventure commence, personne n'a encore coché de défi ou de corvée !";
  else if (pct < 30) msg = 'Le groupe démarre en douceur.';
  else if (pct < 60) msg = 'Belle dynamique de groupe !';
  else if (pct < 90) msg = 'Le groupe est très soudé, ça avance fort !';
  else msg = 'Esprit de groupe au top, bravo à tous !';

  container.innerHTML = `
    <div class="card-luxe">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
        <span class="eyebrow" style="margin-bottom: 0;">Esprit de groupe</span>
        <span class="title-serif" style="font-size: 16px; color: var(--accent-sand);">${pct}%</span>
      </div>
      <div style="height: 8px; border-radius: 6px; background: var(--bg-sunken); overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; border-radius: 6px; background: linear-gradient(90deg, var(--accent-gold), var(--accent-sand)); transition: width 0.6s ease;"></div>
      </div>
      <div style="font-size: 11.5px; color: var(--primary-light); margin-top: 8px; font-style: italic;">${msg}</div>
    </div>
  `;
}

function getTimeAgo(timestamp) {
  // ✅ Robuste face aux différents formats : objet Date, string ISO (Supabase), ou string locale (toLocaleString)
  let ts;
  if (timestamp instanceof Date) {
    ts = timestamp.getTime();
  } else {
    ts = new Date(timestamp).getTime();
  }
  // Si le parsing échoue (NaN), on retombe sur "maintenant" plutôt que d'afficher NaNj/NaNh
  if (isNaN(ts)) {
    return 'à l\'instant';
  }

  const now = Date.now();
  const diff = Math.max(0, now - ts); // ✅ Évite les diffs négatifs si l'horloge locale est légèrement décalée
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
}

function goBack() {
  goBackToPreviousTab();
}

function goBackToPreviousTab() {
  if (previousTab) {
    switchTab(previousTab);
  } else {
    goHome();
  }
}

function switchToTab(tabName, evt) {
  // Map bottom tab bar tabs to actual tabs
  let actualTab = tabName;
  
  switch(tabName) {
    case 'home':
      actualTab = 'home';
      break;
    case 'explore':
      // For now, show gallery - later will be custom explore view
      actualTab = 'gallery';
      break;
    case 'gallery':
      actualTab = 'gallery';
      break;
    case 'moments':
      // For now, show surprises - later will be custom moments view
      actualTab = 'surprises';
      break;
    case 'profile':
      actualTab = 'profile';
      break;
    case 'menu':
      // For now, show settings - later will be hamburger menu
      actualTab = 'settings';
      break;
    default:
      actualTab = 'home';
  }
  
  // Update bottom tab bar active state
  document.querySelectorAll('.tab-item').forEach(item => {
    item.classList.remove('active');
  });
  if (evt && evt.target) evt.target.closest('.tab-item').classList.add('active');
  
  // Switch the actual tab
  switchTab(actualTab);
}

function showConfirmation(message, onConfirm) {
  const confirmId = Date.now();
  const modal = document.createElement('div');
  modal.id = `confirm-modal-${confirmId}`;
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 9999;';
  
  modal.innerHTML = `
    <div style="background: var(--bg-raised); padding: 24px; border-radius: 12px; width: 90%; max-width: 350px; box-shadow: 0 0 0 2px var(--border), 0 20px 50px rgba(0,0,0,0.35); text-align: center;">
      <div style="font-size: 16px; font-weight: 700; color: var(--primary); margin-bottom: 16px;">⚠️ Confirmation</div>
      <div style="font-size: 14px; color: var(--primary-soft); margin-bottom: 20px; line-height: 1.5;">${escapeHtml(message)}</div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-primary" style="flex: 1;" onclick="confirmConfirmation(${confirmId}, true)">✅ Confirmer</button>
        <button class="btn" style="flex: 1; background: var(--bg-sunken); color: var(--primary);" onclick="confirmConfirmation(${confirmId}, false)">❌ Annuler</button>
      </div>
    </div>
  `;
  
  // Stocker le callback
  window[`confirmCallback_${confirmId}`] = onConfirm;
  
  document.body.appendChild(modal);
}

function confirmConfirmation(id, confirmed) {
  const modal = document.getElementById(`confirm-modal-${id}`);
  if (modal) modal.remove();
  
  if (confirmed && typeof window[`confirmCallback_${id}`] === 'function') {
    window[`confirmCallback_${id}`]();
  }
  
  delete window[`confirmCallback_${id}`];
}

function showNotification(msg, type = 'success') {
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.textContent = msg;
  document.getElementById('notificationsContainer').appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function addNotification(msg, emoji = '📌', type = 'general', sync = true, refId = null) {
  const notif = {
    id: Date.now(),
    message: msg,
    emoji: emoji,
    type: type,
    refId: refId,
    timestamp: new Date(),
    read: false
  };
  notifications.unshift(notif);
  if (notifications.length > 50) notifications.pop();
  updateNotifBadge();
  renderNotifications();
  saveAllData();
  sendPushNotification(msg, emoji);

  // ✅ Synchroniser vers Supabase pour que les autres appareils reçoivent la notification
  // (sauf les notifications personnalisées comme "vous a mentionné", qui n'ont de sens que localement)
  if (sync && window.supabaseReady && window.syncToSupabase) {
    window.syncToSupabase('notifications', {
      id: notif.id,
      message: notif.message,
      emoji: notif.emoji,
      type: notif.type,
      ref_id: refId,
      author_id: currentUser ? currentUser.id : null,
      // 🐛 CORRECTIF : jamais envoyée jusqu'ici — sans cette date explicite, une
      // notification affichait "maintenant" à chaque rechargement (25s, autre
      // téléphone...) au lieu de sa vraie date/heure d'origine.
      timestamp: notif.timestamp instanceof Date ? notif.timestamp.toISOString() : notif.timestamp
    }).catch(err => console.error('Sync Supabase échouée:', err));
  }
}

// ✅ Messages privés (voir sendPrivateMessage dans app-social.js, réservé au profil
// de Marine) : contrairement à addNotification (broadcast), on ne va chercher QUE
// les messages où currentUser est le destinataire — jamais ceux des autres. Un
// message n'est récupéré qu'une fois envoyé (colonne "sent", gérée par la tâche
// planifiée send-private-message une fois l'heure programmée atteinte), et n'est
// jamais rejoué deux fois grâce au dédup local (comme checkGalleryMentions).
async function checkPrivateMessages() {
  if (!currentUser || !window.supabaseReady) return;
  const notifiedKey = 'notifiedPrivateMessageIds';
  let notifiedIds = [];
  try { notifiedIds = JSON.parse(localStorage.getItem(notifiedKey) || '[]'); } catch (e) { notifiedIds = []; }

  const { data, error } = await window.supabase
    .from('private_messages')
    .select('*')
    .eq('target_id', currentUser.id)
    .eq('sent', true);

  if (error || !data) return;

  const newlyNotified = [];
  data.forEach(msg => {
    if (!notifiedIds.includes(msg.id)) {
      // sync=false : cette notif est strictement locale au destinataire, jamais
      // renvoyée vers Supabase ni visible par les autres.
      addNotification(msg.message, msg.emoji || '❤️', 'private', false);
      newlyNotified.push(msg.id);
    }
  });

  if (newlyNotified.length > 0) {
    localStorage.setItem(notifiedKey, JSON.stringify([...notifiedIds, ...newlyNotified]));
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showNotification('🔔 Notifications activées !', 'success');
      }
    });
  }
}

function sendPushNotification(msg, emoji = '📌') {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification('🎮 SARAILLON', { body: `${emoji} ${msg}`, tag: 'saraillon-notif' });
    } catch (e) { /* silently ignore if browser blocks it */ }
  }
}

function updateNotifBadge() {
  const unread = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  if (unread > 0) {
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleNotifications() {
  document.getElementById('notifPanel').classList.toggle('open');
  renderNotifications();
}

function renderNotifications() {
  const html = notifications.slice(0, 30).map(n => {
    let navAction = "switchTab('home');";
    // ✅ Quand on connaît l'élément précis concerné (refId), on y va directement au
    // lieu de juste ouvrir l'onglet général — avant, une notif "X a commenté ta photo"
    // ouvrait la Galerie mais fallait chercher soi-même la bonne photo.
    if (n.type === 'gallery') {
      // ✅ Un like mène juste à la photo ; un commentaire ou une mention doit aussi
      // ouvrir le modal des commentaires, sinon on ne voit jamais le commentaire lui-même.
      const isComment = /comment|mentionné/i.test(n.message);
      navAction = n.refId ? `openGalleryNotification(${n.refId}, ${isComment});` : "switchTab('gallery');";
    }
    else if (n.type === 'feed') navAction = "switchTab('feed');";
    else if (n.type === 'challenge') navAction = n.refId ? `openChallengeNotification(${n.refId});` : "switchTab('challenges');";
    else if (n.type === 'tresor') navAction = n.refId ? `openTresorNotification(${n.refId});` : "switchTab('challenges'); switchQuestPanel('tresor');";
    else if (n.type === 'shopping') navAction = "switchTab('shopping');";
    else if (n.type === 'planning') navAction = "switchTab('planning');";
    else if (n.type === 'corvees') navAction = "switchTab('corvees');";
    else if (n.type === 'inscriptions') navAction = "switchTab('inscriptions');";
    else if (n.type === 'surprises') navAction = "switchTab('surprises');";
    
    return `
    <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="markRead(${n.id}); ${navAction}" style="cursor: pointer;">
      <div style="font-size: 12px; color: var(--primary);">${n.emoji} ${escapeHtml(n.message)}</div>
      <div class="notif-time">${new Date(n.timestamp).toLocaleTimeString('fr-FR')}</div>
    </div>
  `;
  }).join('');
  document.getElementById('notif-content').innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--primary-light);">Aucune notification</div>';
}

// ✅ Depuis une notification de Galerie (like/commentaire/mention) : ouvre la Galerie
// en mode Fil, défile jusqu'à la photo précise concernée, et ouvre directement le
// modal des commentaires si la notif concerne un commentaire ou une mention — sinon
// on n'aurait retrouvé que la photo, pas le commentaire lui-même.
function openGalleryNotification(itemId, openComments = false) {
  toggleNotifications();
  switchTab('gallery');
  if (typeof setGalleryViewMode === 'function') setGalleryViewMode('feed');
  setTimeout(() => {
    const el = document.getElementById(`gal-item-${itemId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (openComments) setTimeout(() => toggleGalleryComments(itemId), 350);
  }, 100);
}

// ✅ Depuis une notification de Trésor trouvé : ouvre Défis > Trésor et défile
// jusqu'à l'objet précis concerné.
function openTresorNotification(itemId) {
  toggleNotifications();
  switchTab('challenges');
  switchQuestPanel('tresor');
  setTimeout(() => {
    const el = document.getElementById(`tresor-item-${itemId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

// ✅ Depuis une notification de Défi relevé : ouvre Défis et déplie directement la
// carte du défi concerné, au lieu d'atterrir sur la liste générale.
function openChallengeNotification(challengeId) {
  toggleNotifications();
  switchTab('challenges');
  setTimeout(() => {
    const el = document.getElementById(`ch-detail-${challengeId}`);
    if (el) {
      el.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (el.style.display === 'none' && typeof toggleChallengeDetail === 'function') toggleChallengeDetail(challengeId);
    }
  }, 100);
}

function markRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) notif.read = true;
  updateNotifBadge();
  renderNotifications();
  saveAllData();
}
