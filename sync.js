/* cloud-sync.js
   ============================================================
   Wraps Firebase Auth (Google sign-in) + Firestore so the rest of
   the app can stay almost untouched. Everything here is OPTIONAL:

   - If js/firebase-config.js still has placeholder values, or the
     Firebase SDK scripts didn't load, CloudSync.enabled stays false
     and the whole app behaves exactly like the local-only version.
   - Once configured, signing in loads/creates the user's data under
     users/{uid}/... in Firestore and keeps it in sync in real time.
   - localStorage is still always written to first — it's the local
     cache the rest of the app reads from — so the UI never blocks
     on a network round trip and still works offline.

   Firestore layout (see README for the security rules that match it):
     users/{uid}/transactions/{id}
     users/{uid}/budgets/{id}        (category budgets)
     users/{uid}/goals/{id}
     users/{uid}/ptptnPlans/{id}
     users/{uid}/recurring/{id}
     users/{uid}/settings/main
   ============================================================ */

const COLLECTION_MAP = {
  transactions: 'transactions',
  categoryBudgets: 'budgets',
  goals: 'goals',
  ptptnPlans: 'ptptnPlans',
  recurring: 'recurring',
};

const CloudSync = {
  enabled: false,
  ready: false, // true once the first auth check has resolved
  app: null,
  auth: null,
  db: null,
  user: null,
  status: 'signed-out', // 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'
  listeners: {},
  _applyingRemote: false,

  // callbacks the UI layer (app.js) fills in
  onAuthChange: null,
  onRemoteChange: null,
  onStatusChange: null,

  isConfigured() {
    try {
      return (
        typeof FIREBASE_CONFIG !== 'undefined' &&
        typeof firebase !== 'undefined' &&
        !!FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_') &&
        !!FIREBASE_CONFIG.projectId && !FIREBASE_CONFIG.projectId.includes('YOUR_')
      );
    } catch (e) {
      return false;
    }
  },

  init() {
    this.enabled = this.isConfigured();
    if (!this.enabled) {
      this.ready = true;
      return false;
    }
    try {
      this.app = firebase.initializeApp(FIREBASE_CONFIG);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.db.settings({ ignoreUndefinedProperties: true });
      try {
        this.db.enablePersistence({ synchronizeTabs: true }).catch(() => {
          // multiple tabs open, or browser doesn't support it — fine,
          // sync still works, just without offline cache persistence
        });
      } catch (e) { /* enablePersistence not available — non-fatal */ }

      window.addEventListener('online', () => {
        if (this.user) this.setStatus('syncing');
      });
      window.addEventListener('offline', () => this.setStatus('offline'));

      // finishes a signInWithRedirect() flow, if one was in progress
      this.auth.getRedirectResult().catch((err) => {
        console.error('Redirect sign-in failed', err);
      });

      this.auth.onAuthStateChanged((user) => this.handleAuthChange(user));
    } catch (e) {
      console.error('Firebase init failed', e);
      this.enabled = false;
      this.ready = true;
    }
    return this.enabled;
  },

  setStatus(status) {
    this.status = status;
    if (this.onStatusChange) this.onStatusChange(status);
  },

  handleAuthChange(user) {
    this.user = user;
    this.ready = true;
    this.teardownListeners();
    if (user) {
      this.setStatus(navigator.onLine ? 'syncing' : 'offline');
      // NOTE: listeners are attached later, by the caller, via attachListeners() —
      // not here. If we attached them immediately, a first-time sign-in with an
      // empty cloud account could overwrite the local cache with an empty
      // snapshot before the "import your existing data?" decision is made.
    } else {
      this.setStatus('signed-out');
    }
    if (this.onAuthChange) this.onAuthChange(user);
  },

  async signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await this.auth.signInWithPopup(provider);
      return { ok: true };
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { ok: false, cancelled: true };
      }
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await this.auth.signInWithRedirect(provider);
          return { ok: true, redirecting: true };
        } catch (redirectErr) {
          return { ok: false, error: redirectErr };
        }
      }
      return { ok: false, error: err };
    }
  },

  async signOutUser() {
    this.teardownListeners();
    await this.auth.signOut();
  },

  // ---------- Firestore live listeners (cloud → local cache) ----------
  attachListeners() {
    const uid = this.user.uid;
    const userRef = this.db.collection('users').doc(uid);

    Object.entries(COLLECTION_MAP).forEach(([localKey, remoteName]) => {
      this.listeners[localKey] = userRef.collection(remoteName).onSnapshot(
        (snap) => {
          const items = [];
          snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
          this._applyingRemote = true;
          Store.replaceCollection(localKey, items);
          this._applyingRemote = false;
          if (this.onRemoteChange) this.onRemoteChange(localKey);
          this.setStatus(snap.metadata.hasPendingWrites ? 'syncing' : 'synced');
        },
        (err) => {
          console.error('Firestore listener error:', remoteName, err);
          this.setStatus('error');
        }
      );
    });

    this.listeners.settings = userRef.collection('settings').doc('main').onSnapshot(
      (doc) => {
        if (doc.exists) {
          this._applyingRemote = true;
          Store.replaceSettingsFromCloud(doc.data());
          this._applyingRemote = false;
          if (this.onRemoteChange) this.onRemoteChange('settings');
        }
        this.setStatus(doc.metadata && doc.metadata.hasPendingWrites ? 'syncing' : 'synced');
      },
      (err) => {
        console.error('Firestore settings listener error:', err);
        this.setStatus('error');
      }
    );
  },

  teardownListeners() {
    Object.values(this.listeners).forEach((unsub) => {
      if (typeof unsub === 'function') unsub();
    });
    this.listeners = {};
  },

  // ---------- local → cloud pushes (called by storage.js after a local write) ----------
  pushDoc(localKey, id, data) {
    if (!this.enabled || !this.user || this._applyingRemote) return;
    const remoteName = COLLECTION_MAP[localKey];
    if (!remoteName) return;
    this.setStatus('syncing');
    this.db.collection('users').doc(this.user.uid).collection(remoteName).doc(id).set(data)
      .catch((err) => { console.error('Cloud push failed', localKey, err); this.setStatus('error'); });
  },

  deleteDoc(localKey, id) {
    if (!this.enabled || !this.user || this._applyingRemote) return;
    const remoteName = COLLECTION_MAP[localKey];
    if (!remoteName) return;
    this.setStatus('syncing');
    this.db.collection('users').doc(this.user.uid).collection(remoteName).doc(id).delete()
      .catch((err) => { console.error('Cloud delete failed', localKey, err); this.setStatus('error'); });
  },

  pushSettings(settings) {
    if (!this.enabled || !this.user || this._applyingRemote) return;
    this.setStatus('syncing');
    this.db.collection('users').doc(this.user.uid).collection('settings').doc('main').set(settings, { merge: true })
      .catch((err) => { console.error('Cloud settings push failed', err); this.setStatus('error'); });
  },

  // ---------- migration ----------
  async cloudHasAnyData() {
    const uid = this.user.uid;
    const userRef = this.db.collection('users').doc(uid);
    for (const remoteName of Object.values(COLLECTION_MAP)) {
      const snap = await userRef.collection(remoteName).limit(1).get();
      if (!snap.empty) return true;
    }
    const settingsDoc = await userRef.collection('settings').doc('main').get();
    return settingsDoc.exists;
  },

  async migrateLocalToCloud(bundle) {
    const uid = this.user.uid;
    const userRef = this.db.collection('users').doc(uid);
    for (const [localKey, remoteName] of Object.entries(COLLECTION_MAP)) {
      const items = bundle[localKey] || [];
      for (let i = 0; i < items.length; i += 400) {
        const batch = this.db.batch();
        items.slice(i, i + 400).forEach((item) => {
          const { id, ...rest } = item;
          batch.set(userRef.collection(remoteName).doc(id), rest);
        });
        await batch.commit();
      }
    }
    if (bundle.settings) {
      await userRef.collection('settings').doc('main').set(bundle.settings, { merge: true });
    }
  },

  // ---------- delete all cloud data (settings page "delete cloud data") ----------
  async deleteAllCloudData() {
    const uid = this.user.uid;
    const userRef = this.db.collection('users').doc(uid);
    for (const remoteName of Object.values(COLLECTION_MAP)) {
      const snap = await userRef.collection(remoteName).get();
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = this.db.batch();
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await userRef.collection('settings').doc('main').delete().catch(() => {});
  },
};
