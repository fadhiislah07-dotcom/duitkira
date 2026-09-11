/* storage.js
   Everything related to reading/writing app data in localStorage.
   No UI code lives here — other modules call these functions
   and re-render themselves.
*/

const STORAGE_KEYS = {
  transactions: 'mst_transactions',
  goals: 'mst_goals',
  categoryBudgets: 'mst_category_budgets',
  ptptnPlans: 'mst_ptptn_plans',
  recurring: 'mst_recurring',
  settings: 'mst_settings',
};

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food', 'Transportation', 'Study / Academic', 'Accommodation',
  'Phone / Internet', 'Personal', 'Entertainment', 'Shopping',
  'Health', 'Emergency', 'K-pop / Hobby', 'Other',
];

const DEFAULT_INCOME_SOURCES = [
  'PTPTN', 'Scholarship', 'Family', 'Part-time job', 'Other',
];

const PAYMENT_METHODS = ['Cash', 'Debit card', 'Bank transfer', 'E-wallet'];

const DEFAULT_SETTINGS = {
  currentSemester: 'Semester 1',
  semesters: ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4'],
  semesterDates: {}, // { 'Semester 1': { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } }
  monthlyBudget: 0,
  semesterBudgets: {}, // { 'Semester 1': amount }
  currency: 'RM',
  darkMode: false,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES.slice(),
  incomeSources: DEFAULT_INCOME_SOURCES.slice(),
};

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.error('Failed to read', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to write', key, e);
    return false;
  }
}

const Store = {
  // ---------- Settings ----------
  getSettings() {
    const s = readJSON(STORAGE_KEYS.settings, null);
    if (!s) {
      writeJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    // merge in any new default keys added by future versions
    return { ...DEFAULT_SETTINGS, ...s };
  },
  saveSettings(partial) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    writeJSON(STORAGE_KEYS.settings, updated);
    return updated;
  },

  // ---------- Transactions ----------
  getTransactions() {
    return readJSON(STORAGE_KEYS.transactions, []);
  },
  addTransaction(tx) {
    const list = this.getTransactions();
    const record = { id: uid(), ...tx };
    list.push(record);
    writeJSON(STORAGE_KEYS.transactions, list);
    return record;
  },
  updateTransaction(id, patch) {
    const list = this.getTransactions();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    writeJSON(STORAGE_KEYS.transactions, list);
    return list[idx];
  },
  deleteTransaction(id) {
    const list = this.getTransactions().filter((t) => t.id !== id);
    writeJSON(STORAGE_KEYS.transactions, list);
  },

  // ---------- Category budgets (recurring monthly per category) ----------
  getCategoryBudgets() {
    return readJSON(STORAGE_KEYS.categoryBudgets, []);
  },
  setCategoryBudget(category, amount) {
    const list = this.getCategoryBudgets();
    const idx = list.findIndex((b) => b.category === category);
    if (amount === null || amount === undefined || amount === '') {
      if (idx !== -1) list.splice(idx, 1);
    } else if (idx === -1) {
      list.push({ id: uid(), category, amount: Number(amount) });
    } else {
      list[idx].amount = Number(amount);
    }
    writeJSON(STORAGE_KEYS.categoryBudgets, list);
    return list;
  },

  // ---------- Goals ----------
  getGoals() {
    return readJSON(STORAGE_KEYS.goals, []);
  },
  addGoal(goal) {
    const list = this.getGoals();
    const record = { id: uid(), saved: 0, ...goal };
    list.push(record);
    writeJSON(STORAGE_KEYS.goals, list);
    return record;
  },
  updateGoal(id, patch) {
    const list = this.getGoals();
    const idx = list.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    writeJSON(STORAGE_KEYS.goals, list);
    return list[idx];
  },
  deleteGoal(id) {
    const list = this.getGoals().filter((g) => g.id !== id);
    writeJSON(STORAGE_KEYS.goals, list);
  },

  // ---------- PTPTN plans ----------
  getPtptnPlans() {
    return readJSON(STORAGE_KEYS.ptptnPlans, []);
  },
  addPtptnPlan(plan) {
    const list = this.getPtptnPlans();
    const record = { id: uid(), allocations: {}, ...plan };
    list.push(record);
    writeJSON(STORAGE_KEYS.ptptnPlans, list);
    return record;
  },
  updatePtptnPlan(id, patch) {
    const list = this.getPtptnPlans();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    writeJSON(STORAGE_KEYS.ptptnPlans, list);
    return list[idx];
  },
  deletePtptnPlan(id) {
    const list = this.getPtptnPlans().filter((p) => p.id !== id);
    writeJSON(STORAGE_KEYS.ptptnPlans, list);
  },

  // ---------- Recurring expenses ----------
  getRecurring() {
    return readJSON(STORAGE_KEYS.recurring, []);
  },
  addRecurring(item) {
    const list = this.getRecurring();
    const record = { id: uid(), ...item };
    list.push(record);
    writeJSON(STORAGE_KEYS.recurring, list);
    return record;
  },
  updateRecurring(id, patch) {
    const list = this.getRecurring();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    writeJSON(STORAGE_KEYS.recurring, list);
    return list[idx];
  },
  deleteRecurring(id) {
    const list = this.getRecurring().filter((r) => r.id !== id);
    writeJSON(STORAGE_KEYS.recurring, list);
  },

  // ---------- Bulk / data management ----------
  exportAll() {
    return {
      transactions: this.getTransactions(),
      categoryBudgets: this.getCategoryBudgets(),
      goals: this.getGoals(),
      ptptnPlans: this.getPtptnPlans(),
      recurring: this.getRecurring(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
  },
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
    if (Array.isArray(data.transactions)) writeJSON(STORAGE_KEYS.transactions, data.transactions);
    if (Array.isArray(data.categoryBudgets)) writeJSON(STORAGE_KEYS.categoryBudgets, data.categoryBudgets);
    if (Array.isArray(data.goals)) writeJSON(STORAGE_KEYS.goals, data.goals);
    if (Array.isArray(data.ptptnPlans)) writeJSON(STORAGE_KEYS.ptptnPlans, data.ptptnPlans);
    if (Array.isArray(data.recurring)) writeJSON(STORAGE_KEYS.recurring, data.recurring);
    if (data.settings && typeof data.settings === 'object') {
      writeJSON(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, ...data.settings });
    }
  },
  clearAll() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
