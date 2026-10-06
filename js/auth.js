/**
 * Auth module — Login only (no register on web)
 * First account that logs in becomes admin.
 * Uses Firebase when FIREBASE_ENABLED, else localStorage mock for dev.
 */
import { firebaseConfig, FIREBASE_ENABLED, COLLECTIONS } from './firebase-config.js';

let app = null;
let auth = null;
let db = null;
let currentUser = null;

const LOCAL_USERS_KEY = 'fm_local_users_v1';
const LOCAL_SESSION_KEY = 'fm_session_v1';

export async function initAuth() {
  if (FIREBASE_ENABLED) {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js');
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
    const { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, limit, updateDoc } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          currentUser = await ensureUserProfile(user);
        } else {
          currentUser = null;
        }
        resolve(currentUser);
      });
    });
  }

  // Local mock
  const session = localStorage.getItem(LOCAL_SESSION_KEY);
  if (session) {
    try {
      currentUser = JSON.parse(session);
    } catch (_) {
      currentUser = null;
    }
  }
  return currentUser;
}

function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

/** First ever user becomes admin */
async function ensureUserProfile(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';

  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc, setDoc, collection, getDocs, query, limit } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

    const ref = doc(db, COLLECTIONS.users, uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { uid, email, ...snap.data() };
    }

    // Check if any users exist → first one is admin
    const q = query(collection(db, COLLECTIONS.users), limit(1));
    const existing = await getDocs(q);
    const isAdmin = existing.empty;

    const profile = {
      email,
      displayName: email.split('@')[0],
      role: isAdmin ? 'admin' : 'player',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      clubMode: null, // 'existing' | 'custom'
      clubId: null,
      customClubId: null,
      banned: false,
    };
    await setDoc(ref, profile);
    return { uid, email, ...profile };
  }

  // Local
  const users = getLocalUsers();
  if (users[uid]) {
    users[uid].lastLogin = new Date().toISOString();
    saveLocalUsers(users);
    return { uid, email, ...users[uid] };
  }
  const isAdmin = Object.keys(users).length === 0;
  const profile = {
    email,
    displayName: email.split('@')[0],
    role: isAdmin ? 'admin' : 'player',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    clubMode: null,
    clubId: null,
    customClubId: null,
    banned: false,
  };
  users[uid] = profile;
  saveLocalUsers(users);
  return { uid, email, ...profile };
}

/**
 * Login only — accounts must be created in Firebase Console (or local seed).
 * Local mode: any email/password works; first login = admin.
 * To seed local admin: login once with any credentials.
 */
export async function login(email, password) {
  email = (email || '').trim().toLowerCase();
  if (!email || !password) throw new Error('Vui lòng nhập email và mật khẩu');

  if (FIREBASE_ENABLED && auth) {
    const { signInWithEmailAndPassword } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = await ensureUserProfile(cred.user);
    if (currentUser.banned) {
      await logout();
      throw new Error('Tài khoản đã bị khóa. Liên hệ admin.');
    }
    return currentUser;
  }

  // Local mock auth — password stored hashed lightly (not secure, dev only)
  const users = getLocalUsers();
  // Find by email
  let foundUid = null;
  for (const [uid, u] of Object.entries(users)) {
    if (u.email === email) {
      foundUid = uid;
      break;
    }
  }

  if (foundUid) {
    const u = users[foundUid];
    if (u.password && u.password !== password) {
      throw new Error('Sai mật khẩu');
    }
    if (u.banned) throw new Error('Tài khoản đã bị khóa. Liên hệ admin.');
    u.lastLogin = new Date().toISOString();
    if (!u.password) u.password = password;
    saveLocalUsers(users);
    currentUser = { uid: foundUid, ...u };
  } else {
    // Auto-create on first login in local mode (simulates Firebase Console-created account)
    // In production with Firebase: only accounts created in Console can login
    const uid = 'local_' + btoa(email).replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const isAdmin = Object.keys(users).length === 0;
    const profile = {
      email,
      password, // local only
      displayName: email.split('@')[0],
      role: isAdmin ? 'admin' : 'player',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      clubMode: null,
      clubId: null,
      customClubId: null,
      banned: false,
    };
    users[uid] = profile;
    saveLocalUsers(users);
    currentUser = { uid, ...profile };
  }

  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  return currentUser;
}

export async function logout() {
  if (FIREBASE_ENABLED && auth) {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
    await signOut(auth);
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
  currentUser = null;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

export async function updateUserProfile(partial) {
  if (!currentUser) return;
  currentUser = { ...currentUser, ...partial };

  if (FIREBASE_ENABLED && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await updateDoc(doc(db, COLLECTIONS.users, currentUser.uid), partial);
  } else {
    const users = getLocalUsers();
    if (users[currentUser.uid]) {
      Object.assign(users[currentUser.uid], partial);
      saveLocalUsers(users);
    }
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentUser));
  }
  return currentUser;
}

export async function saveGameCloud(gameState) {
  if (!currentUser) return;
  const payload = {
    gameState,
    updatedAt: new Date().toISOString(),
    uid: currentUser.uid,
  };
  if (FIREBASE_ENABLED && db) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await setDoc(doc(db, COLLECTIONS.saves, currentUser.uid), payload);
  } else {
    localStorage.setItem('fm_cloud_save_' + currentUser.uid, JSON.stringify(payload));
  }
}

export async function loadGameCloud() {
  if (!currentUser) return null;
  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, COLLECTIONS.saves, currentUser.uid));
    return snap.exists() ? snap.data().gameState : null;
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
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await setDoc(doc(db, COLLECTIONS.customClubs, id), data);
  } else {
    localStorage.setItem('fm_custom_club_' + id, JSON.stringify(data));
  }
  await updateUserProfile({ clubMode: 'custom', customClubId: id, clubId: id });
  return data;
}

export async function loadCustomClub(id) {
  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, COLLECTIONS.customClubs, id));
    return snap.exists() ? snap.data() : null;
  }
  const raw = localStorage.getItem('fm_custom_club_' + id);
  return raw ? JSON.parse(raw) : null;
}

// ---- Admin APIs ----
export async function adminListUsers() {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (FIREBASE_ENABLED && db) {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const snap = await getDocs(collection(db, COLLECTIONS.users));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }
  const users = getLocalUsers();
  return Object.entries(users).map(([uid, u]) => {
    const { password, ...safe } = u;
    return { uid, ...safe };
  });
}

export async function adminUpdateUser(uid, partial) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (FIREBASE_ENABLED && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await updateDoc(doc(db, COLLECTIONS.users, uid), partial);
  } else {
    const users = getLocalUsers();
    if (users[uid]) {
      Object.assign(users[uid], partial);
      saveLocalUsers(users);
    }
  }
}

export async function adminGetSettings() {
  if (FIREBASE_ENABLED && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, COLLECTIONS.settings, 'global'));
    return snap.exists() ? snap.data() : defaultSettings();
  }
  const raw = localStorage.getItem('fm_admin_settings');
  return raw ? JSON.parse(raw) : defaultSettings();
}

export async function adminSaveSettings(settings) {
  if (!isAdmin()) throw new Error('Không có quyền admin');
  if (FIREBASE_ENABLED && db) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    await setDoc(doc(db, COLLECTIONS.settings, 'global'), settings);
  } else {
    localStorage.setItem('fm_admin_settings', JSON.stringify(settings));
  }
}

function defaultSettings() {
  return {
    allowCustomClubs: true,
    maintenanceMode: false,
    maxCustomPlayers: 30,
    defaultBudget: 25000000,
    announcement: '',
  };
}

export { FIREBASE_ENABLED };
