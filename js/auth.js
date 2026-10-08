/**
 * Auth — Login only (tài khoản tạo trong Firebase Console)
 * User đăng nhập đầu tiên → admin
 * Firestore lỗi vẫn cho vào game (fallback local)
 */
import { firebaseConfig, FIREBASE_ENABLED, COLLECTIONS } from './firebase-config.js';

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let authReady = null;

const LOCAL_USERS_KEY = 'fm_local_users_v1';
const LOCAL_SESSION_KEY = 'fm_session_v1';
const LOCAL_ADMIN_CLAIM = 'fm_first_admin_uid';

function mapFirebaseError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'Email không hợp lệ',
    'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa',
    'auth/user-not-found': 'Không tìm thấy tài khoản. Kiểm tra email hoặc tạo user trong Firebase Console → Authentication',
    'auth/wrong-password': 'Sai mật khẩu',
    'auth/invalid-credential': 'Sai email hoặc mật khẩu',
    'auth/too-many-requests': 'Thử quá nhiều lần. Đợi vài phút rồi thử lại',
    'auth/network-request-failed': 'Lỗi mạng. Kiểm tra kết nối internet',
    'auth/operation-not-allowed': 'Email/Password chưa bật trong Firebase Console → Authentication → Sign-in method',
    'auth/invalid-api-key': 'API key Firebase sai',
    'auth/unauthorized-domain': 'Domain chưa được thêm vào Authorized domains (Firebase → Authentication → Settings)',
  };
  return map[code] || err?.message || 'Đăng nhập thất bại';
}

export async function initAuth() {
  if (!FIREBASE_ENABLED) {
    const session = localStorage.getItem(LOCAL_SESSION_KEY);
    if (session) {
      try { currentUser = JSON.parse(session); } catch { currentUser = null; }
    }
    return currentUser;
  }

  if (authReady) return authReady;

  authReady = (async () => {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js');
      const { getAuth, onAuthStateChanged } =
        await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
      const { getFirestore } =
        await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      auth = getAuth(app);
      try {
        db = getFirestore(app);
      } catch (e) {
        console.warn('Firestore init failed', e);
        db = null;
      }

      return await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
          unsub();
          if (user) {
            try {
              currentUser = await ensureUserProfile(user);
            } catch (e) {
              console.warn('ensureUserProfile', e);
              currentUser = fallbackProfile(user);
            }
          } else {
            currentUser = null;
          }
          resolve(currentUser);
        });
      });
    } catch (e) {
      console.error('initAuth failed', e);
      return null;
    }
  })();

  return authReady;
}

function fallbackProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  // First successful Firebase login on this browser can be admin if none marked
  let role = 'player';
  const claimed = localStorage.getItem(LOCAL_ADMIN_CLAIM);
  if (!claimed) {
    localStorage.setItem(LOCAL_ADMIN_CLAIM, uid);
    role = 'admin';
  } else if (claimed === uid) {
    role = 'admin';
  }
  return {
    uid,
    email,
    displayName: email.split('@')[0] || 'HLV',
    role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    clubMode: null,
    clubId: null,
    customClubId: null,
    banned: false,
    _fallback: true,
  };
}

async function ensureUserProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';

  if (!FIREBASE_ENABLED || !db) {
    return fallbackProfile(firebaseUser);
  }

  try {
    const { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, limit } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

    const ref = doc(db, COLLECTIONS.users, uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      try {
        await updateDoc(ref, { lastLogin: new Date().toISOString() });
      } catch (_) { /* ignore */ }
      return { uid, email, ...data };
    }

    let isAdminUser = false;
    try {
      const q = query(collection(db, COLLECTIONS.users), limit(1));
      const existing = await getDocs(q);
      isAdminUser = existing.empty;
    } catch (_) {
      // list denied → treat as first if no local claim
      const claimed = localStorage.getItem(LOCAL_ADMIN_CLAIM);
      isAdminUser = !claimed;
    }

    if (isAdminUser) {
      localStorage.setItem(LOCAL_ADMIN_CLAIM, uid);
    }

    const profile = {
      email,
      displayName: email.split('@')[0] || 'HLV',
      role: isAdminUser ? 'admin' : 'player',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      clubMode: null,
      clubId: null,
      customClubId: null,
      banned: false,
    };

    try {
      await setDoc(ref, profile);
    } catch (e) {
      console.warn('setDoc users failed (check Firestore rules)', e);
      // still return profile so login works
    }
    return { uid, email, ...profile };
  } catch (e) {
    console.warn('ensureUserProfile fallback', e);
    return fallbackProfile(firebaseUser);
  }
}

export async function login(email, password) {
  email = (email || '').trim().toLowerCase();
  if (!email || !password) throw new Error('Vui lòng nhập email và mật khẩu');

  if (!FIREBASE_ENABLED) {
    throw new Error('Firebase chưa bật. Kiểm tra js/firebase-config.js');
  }

  await initAuth();
  if (!auth) throw new Error('Không khởi tạo được Firebase Auth. Kiểm tra config và domain.');

  try {
    const { signInWithEmailAndPassword } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = await ensureUserProfile(cred.user);
    if (currentUser.banned) {
      await logout();
      throw new Error('Tài khoản đã bị khóa. Liên hệ admin.');
    }
    return currentUser;
  } catch (err) {
    if (err.message && err.message.includes('khóa')) throw err;
    throw new Error(mapFirebaseError(err));
  }
}

export async function logout() {
  if (FIREBASE_ENABLED && auth) {
    try {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
      await signOut(auth);
    } catch (_) {}
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
  currentUser = null;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAdmin() {
  return !!(currentUser && currentUser.role === 'admin');
}

export async function updateUserProfile(partial) {
  if (!currentUser) return;
  currentUser = { ...currentUser, ...partial };

  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      await setDoc(doc(db, COLLECTIONS.users, currentUser.uid), currentUser, { merge: true });
    } catch (e) {
      console.warn('updateUserProfile', e);
    }
  } else {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  }
  return currentUser;
}

export async function saveGameCloud(gameState) {
  if (!currentUser) return;
  // Không lưu full transferMarket (quá nặng) — regenerate khi load
  let slim = gameState;
  try {
    slim = { ...gameState };
    if (Array.isArray(slim.transferMarket) && slim.transferMarket.length > 30) {
      slim.transferMarket = slim.transferMarket.slice(0, 30);
      slim._marketTrimmed = true;
    }
  } catch (_) { slim = gameState; }
  const payload = {
    gameState: slim,
    updatedAt: new Date().toISOString(),
    uid: currentUser.uid,
    version: '1.3.5',
  };
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      await setDoc(doc(db, COLLECTIONS.saves, currentUser.uid), payload);
    } catch (e) {
      console.warn('saveGameCloud', e);
      localStorage.setItem('fm_cloud_save_' + currentUser.uid, JSON.stringify(payload));
    }
  } else {
    localStorage.setItem('fm_cloud_save_' + currentUser.uid, JSON.stringify(payload));
  }
}

export async function loadGameCloud() {
  if (!currentUser) return null;
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const snap = await getDoc(doc(db, COLLECTIONS.saves, currentUser.uid));
      if (snap.exists()) return snap.data().gameState;
    } catch (e) {
      console.warn('loadGameCloud', e);
    }
  }
  const raw = localStorage.getItem('fm_cloud_save_' + currentUser.uid);
  if (!raw) return null;
  try {
    return JSON.parse(raw).gameState;
  } catch {
    return null;
  }
}

export async function saveCustomClub(clubData) {
  if (!currentUser) throw new Error('Chưa đăng nhập');
  const id = clubData.id || ('custom_' + currentUser.uid);
  const data = { ...clubData, id, ownerUid: currentUser.uid, updatedAt: new Date().toISOString() };

  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      await setDoc(doc(db, COLLECTIONS.customClubs, id), data);
    } catch (e) {
      console.warn('saveCustomClub', e);
      localStorage.setItem('fm_custom_club_' + id, JSON.stringify(data));
    }
  } else {
    localStorage.setItem('fm_custom_club_' + id, JSON.stringify(data));
  }
  await updateUserProfile({ clubMode: 'custom', customClubId: id, clubId: id });
  return data;
}

export async function loadCustomClub(id) {
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const snap = await getDoc(doc(db, COLLECTIONS.customClubs, id));
      if (snap.exists()) return snap.data();
    } catch (_) {}
  }
  const raw = localStorage.getItem('fm_custom_club_' + id);
  return raw ? JSON.parse(raw) : null;
}

// ---- Admin APIs ----

export async function adminListCustomClubs() {
  const items = [];
  const seen = new Set();
  // 1) Firestore collection
  if (FIREBASE_ENABLED && db) {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const snap = await getDocs(collection(db, COLLECTIONS.customClubs));
      snap.forEach(d => {
        const data = { id: d.id, ...d.data() };
        items.push(data);
        seen.add(data.id || d.id);
      });
    } catch (e) {
      console.warn('adminListCustomClubs firestore', e);
    }
  }
  // 2) localStorage keys
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fm_custom_club_')) {
        try {
          const data = JSON.parse(localStorage.getItem(k));
          if (data && !seen.has(data.id)) {
            items.push(data);
            seen.add(data.id);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  // 3) users with clubMode custom + their save
  if (FIREBASE_ENABLED && db) {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const usersSnap = await getDocs(collection(db, COLLECTIONS.users));
      for (const u of usersSnap.docs) {
        const ud = u.data() || {};
        if (ud.clubMode === 'custom' || (ud.clubId && String(ud.clubId).startsWith('custom_'))) {
          if (seen.has(ud.clubId || ud.customClubId)) continue;
          // try load save for more info
          let clubName = ud.displayName || 'CLB custom';
          let ovr = null;
          try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
            const saveSnap = await getDoc(doc(db, COLLECTIONS.saves, u.id));
            if (saveSnap.exists()) {
              const s = saveSnap.data();
              if (s.clubName) clubName = s.clubName;
              if (s.squad && s.squad.length) {
                const avg = s.squad.reduce((a, p) => a + (p.rating || 70), 0) / s.squad.length;
                ovr = Math.round(avg);
              }
            }
          } catch (_) {}
          const id = ud.customClubId || ud.clubId || ('custom_' + u.id);
          if (!seen.has(id)) {
            items.push({
              id,
              name: clubName,
              ownerUid: u.id,
              ownerEmail: ud.email || '',
              ownerName: ud.displayName || '',
              ovr,
              clubMode: 'custom',
              fromUserProfile: true
            });
            seen.add(id);
          }
        }
      }
    } catch (e) {
      console.warn('adminListCustomClubs users', e);
    }
  }
  return items;
}

export async function adminListUsers() {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (FIREBASE_ENABLED && db) {
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const snap = await getDocs(collection(db, COLLECTIONS.users));
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.warn('adminListUsers', e);
      // fallback: only current user
      return currentUser ? [{ uid: currentUser.uid, ...currentUser }] : [];
    }
  }
  return currentUser ? [{ uid: currentUser.uid, ...currentUser }] : [];
}

export async function adminUpdateUser(uid, partial) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (FIREBASE_ENABLED && db) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await setDoc(doc(db, COLLECTIONS.users, uid), partial, { merge: true });
  }
}

export async function adminGetSettings() {
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      const snap = await getDoc(doc(db, COLLECTIONS.settings, 'global'));
      return snap.exists() ? snap.data() : defaultSettings();
    } catch {
      return defaultSettings();
    }
  }
  const raw = localStorage.getItem('fm_admin_settings');
  return raw ? JSON.parse(raw) : defaultSettings();
}

export async function adminSaveSettings(settings) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  // Luôn ghi local để game đọc tỉ lệ ghép ngay
  try {
    localStorage.setItem('fm_admin_settings', JSON.stringify(settings));
    if (settings && settings.mergeRates) {
      localStorage.setItem('fm_merge_rates', JSON.stringify(settings.mergeRates));
    }
  } catch (_) {}
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      await setDoc(doc(db, COLLECTIONS.settings, 'global'), settings);
    } catch (e) {
      console.warn('adminSaveSettings', e);
    }
  }
}

function defaultSettings() {
  return {
    allowCustomClubs: true,
    maintenanceMode: false,
    maxCustomPlayers: 30,
    defaultBudget: 25000000,
    announcement: '',
    mergeRates: {
      0: 90, 1: 84, 2: 78, 3: 72, 4: 66,
      5: 60, 6: 54, 7: 48, 8: 42, 9: 36,
    },
  };
}


export async function adminGiftMoney(uid, amount) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error('Số tiền không hợp lệ');
  const key = 'fm_pending_gifts_' + uid;
  let gifts = { money: 0, players: [] };
  try {
    const raw = localStorage.getItem(key);
    if (raw) gifts = JSON.parse(raw);
  } catch (_) {}
  gifts.money = (Number(gifts.money) || 0) + amount;

  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const ref = doc(db, COLLECTIONS.users, uid);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? (snap.data().pendingGifts || {}) : {};
    const next = {
      money: (Number(prev.money) || 0) + amount,
      players: Array.isArray(prev.players) ? prev.players : [],
    };
    await setDoc(ref, { pendingGifts: next }, { merge: true });
    gifts = next;
  }
  localStorage.setItem(key, JSON.stringify(gifts));
  return gifts;
}

export async function adminGiftPlayer(uid, player) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (!player || !player.name) throw new Error('Thiếu thông tin cầu thủ');
  const key = 'fm_pending_gifts_' + uid;
  let gifts = { money: 0, players: [] };
  try {
    const raw = localStorage.getItem(key);
    if (raw) gifts = JSON.parse(raw);
  } catch (_) {}
  if (!Array.isArray(gifts.players)) gifts.players = [];
  gifts.players.push({
    name: player.name,
    pos: player.pos || 'CM',
    rating: player.rating || 75,
    age: player.age || 24,
    image: player.image || null,
  });

  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const ref = doc(db, COLLECTIONS.users, uid);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? (snap.data().pendingGifts || {}) : {};
    const next = {
      money: Number(prev.money) || 0,
      players: Array.isArray(prev.players) ? prev.players.slice() : [],
    };
    next.players.push(gifts.players[gifts.players.length - 1]);
    await setDoc(ref, { pendingGifts: next }, { merge: true });
    gifts = next;
  }
  localStorage.setItem(key, JSON.stringify(gifts));
  return gifts;
}

export async function clearPendingGifts() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  localStorage.removeItem('fm_pending_gifts_' + uid);
  if (FIREBASE_ENABLED && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
      await setDoc(doc(db, COLLECTIONS.users, uid), { pendingGifts: { money: 0, players: [] } }, { merge: true });
      if (currentUser) currentUser.pendingGifts = { money: 0, players: [] };
    } catch (e) { console.warn(e); }
  }
}


export { FIREBASE_ENABLED };
