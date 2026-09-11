/* app.js
   Application controller: routing between pages, rendering each
   page's HTML from current data, and wiring up forms/buttons.
*/

const CATEGORY_ICONS = {
  'Food': '🍜', 'Transportation': '🚌', 'Study / Academic': '📚',
  'Accommodation': '🏠', 'Phone / Internet': '📱', 'Personal': '🧴',
  'Entertainment': '🎬', 'Shopping': '🛍️', 'Health': '💊',
  'Emergency': '🚨', 'K-pop / Hobby': '🎤', 'Other': '🗂️',
};
const SOURCE_ICONS = {
  'PTPTN': '🎓', 'Scholarship': '🏅', 'Family': '👪',
  'Part-time job': '💼', 'Other': '💰',
};

const App = {
  state: {
    page: 'dashboard',
    txFilters: { search: '', category: 'all', month: 'all', semester: 'all', sort: 'date-desc', type: 'all' },
    analyticsFilters: { month: 'all', semester: 'all', category: 'all' },
  },

  el: null,

  init() {
    this.el = document.getElementById('page-content');
    UI.init();
    this.applyDarkMode(Store.getSettings().darkMode);
    this.populateSemesterSelect();
    this.bindGlobalEvents();
    this.navigate('dashboard');
  },

  // ---------------- navigation ----------------
  bindGlobalEvents() {
    document.querySelectorAll('.navlink, .bottom-nav__link').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });

    document.getElementById('darkmode-toggle').addEventListener('click', () => {
      const isDark = !document.body.classList.contains('dark-mode');
      this.applyDarkMode(isDark);
      Store.saveSettings({ darkMode: isDark });
      this.renderCurrentPage();
    });

    document.getElementById('modal-close').addEventListener('click', () => UI.closeModal());

    const semSelect = document.getElementById('global-semester-select');
    semSelect.addEventListener('change', () => {
      Store.saveSettings({ currentSemester: semSelect.value });
      this.renderCurrentPage();
    });

    const fab = document.getElementById('fab-add');
    const fabMenu = document.getElementById('fab-menu');
    fab.addEventListener('click', () => {
      fabMenu.hidden = !fabMenu.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target) && !fabMenu.contains(e.target)) fabMenu.hidden = true;
    });
    fabMenu.querySelectorAll('[data-fab-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fabMenu.hidden = true;
        this.openTransactionForm(btn.dataset.fabAction);
      });
    });
  },

  applyDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    document.getElementById('darkmode-toggle').setAttribute('aria-pressed', String(isDark));
    document.getElementById('darkmode-icon').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('darkmode-label').textContent = isDark ? 'Light mode' : 'Dark mode';
  },

  populateSemesterSelect() {
    const settings = Store.getSettings();
    const select = document.getElementById('global-semester-select');
    select.innerHTML = settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}">${UI.escapeHtml(s)}</option>`).join('');
    select.value = settings.currentSemester;
  },

  navigate(page) {
    this.state.page = page;
    document.querySelectorAll('.navlink, .bottom-nav__link').forEach((btn) => {
      if (btn.dataset.page === page) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    const titles = {
      dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budget Planner',
      ptptn: 'PTPTN Planning', savings: 'Savings Goals', analytics: 'Analytics', settings: 'Settings',
    };
    document.getElementById('page-title').textContent = titles[page] || 'Duit Kira';
    this.renderCurrentPage();
    this.el.focus();
    window.scrollTo({ top: 0, behavior: 'auto' });
  },

  renderCurrentPage() {
    Charts.destroyAll();
    const renderers = {
      dashboard: () => this.renderDashboard(),
      transactions: () => this.renderTransactions(),
      budget: () => this.renderBudget(),
      ptptn: () => this.renderPtptn(),
      savings: () => this.renderSavings(),
      analytics: () => this.renderAnalytics(),
      settings: () => this.renderSettings(),
    };
    (renderers[this.state.page] || renderers.dashboard)();
  },

  // ================================================================
  // DASHBOARD
  // ================================================================
  renderDashboard() {
    const settings = Store.getSettings();
    const all = Store.getTransactions();
    const currentSemester = settings.currentSemester;
    const monthKey = Calc.currentMonthKey();

    const totalIncome = Calc.totalIncome(all);
    const totalExpense = Calc.totalExpense(all);
    const balance = totalIncome - totalExpense;

    const monthTx = Calc.filterByMonth(all, monthKey);
    const monthSpent = Calc.totalExpense(monthTx);
    const monthBudget = Calc.safeNumber(settings.monthlyBudget);
    const remainingMonthBudget = monthBudget - monthSpent;

    const semTx = Calc.filterBySemester(all, currentSemester);
    const semesterBalance = Calc.totalIncome(semTx) - Calc.totalExpense(semTx);

    const avgDaily = Calc.averageDailySpending(all);
    const txCount = all.length;

    this.el.innerHTML = `
      <div class="card-grid">
        ${this.statCard('Total balance', Calc.formatMoney(balance), balance < 0 ? 'expense' : '')}
        ${this.statCard('Total received', Calc.formatMoney(totalIncome), 'income')}
        ${this.statCard('Total spent', Calc.formatMoney(totalExpense), 'expense')}
        ${this.statCard('Remaining monthly budget', Calc.formatMoney(remainingMonthBudget), remainingMonthBudget < 0 ? 'expense' : '')}
        ${this.statCard("This month's spending", Calc.formatMoney(monthSpent))}
        ${this.statCard("This month's budget", Calc.formatMoney(monthBudget))}
        ${this.statCard(`${UI.escapeHtml(currentSemester)} balance`, Calc.formatMoney(semesterBalance), semesterBalance < 0 ? 'expense' : '')}
        ${this.statCard('Average daily spending', Calc.formatMoney(avgDaily))}
        ${this.statCard('Transactions', String(txCount))}
      </div>

      <div class="btn-row">
        <button class="btn btn--primary" id="dash-add-expense">➖ Add expense</button>
        <button class="btn btn--secondary" id="dash-add-income">➕ Add income</button>
      </div>

      <div class="section-title"><h2>💸 Money Runway</h2></div>
      <div class="card" id="runway-card"></div>

      <div class="two-col" style="margin-top:20px;">
        <div class="card chart-card">
          <h3>Spending overview (last 6 months)</h3>
          <div class="chart-card__canvas-wrap"><canvas id="chart-overview"></canvas></div>
        </div>
        <div class="card chart-card">
          <h3>Spending by category (this month)</h3>
          <div class="chart-card__canvas-wrap"><canvas id="chart-category"></canvas></div>
        </div>
      </div>

      <div class="section-title"><h2>⚠️ Smart warnings</h2></div>
      <div id="warnings-wrap"></div>

      <div class="section-title"><h2>📅 Budget progress</h2></div>
      <div class="card" id="dash-budget-progress"></div>

      <div class="section-title">
        <h2>Recent transactions</h2>
        <button class="btn btn--ghost btn--sm" id="dash-see-all">See all</button>
      </div>
      <div class="card"><div class="tx-list" id="dash-recent-list"></div></div>
    `;

    document.getElementById('dash-add-expense').addEventListener('click', () => this.openTransactionForm('expense'));
    document.getElementById('dash-add-income').addEventListener('click', () => this.openTransactionForm('income'));
    document.getElementById('dash-see-all').addEventListener('click', () => this.navigate('transactions'));

    this.renderRunwayCard(document.getElementById('runway-card'), settings, all, currentSemester);
    this.renderWarnings(document.getElementById('warnings-wrap'), settings, all, monthKey);
    this.renderDashboardBudgetProgress(document.getElementById('dash-budget-progress'), settings, all, monthKey);

    // recent transactions
    const recentList = document.getElementById('dash-recent-list');
    const recent = [...all].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    if (recent.length === 0) {
      recentList.appendChild(UI.emptyState('No transactions yet. Add your first expense to start tracking.', 'Add expense', () => this.openTransactionForm('expense')));
    } else {
      recentList.innerHTML = recent.map((t) => this.txRowHtml(t)).join('');
    }

    // charts
    this.renderOverviewChart(all);
    this.renderCategoryChartForMonth(all, monthKey);
  },

  statCard(label, value, tone) {
    const valClass = tone === 'income' ? 'stat-card__value--income' : tone === 'expense' ? 'stat-card__value--expense' : '';
    return `
      <div class="card stat-card">
        <span class="stat-card__label">${UI.escapeHtml(label)}</span>
        <span class="stat-card__value ${valClass}">${value}</span>
      </div>
    `;
  },

  renderRunwayCard(container, settings, all, currentSemester) {
    const dates = settings.semesterDates[currentSemester];
    if (!dates || !dates.start || !dates.end) {
      container.innerHTML = `
        <p class="form-hint">Set your semester start/end dates to see your money runway.</p>
        <button class="btn btn--soft btn--sm" id="runway-set-dates">Set semester dates</button>
      `;
      container.querySelector('#runway-set-dates').addEventListener('click', () => this.openSemesterDatesForm(currentSemester));
      return;
    }
    const semTx = Calc.filterBySemester(all, currentSemester);
    const balance = Calc.totalIncome(semTx) - Calc.totalExpense(semTx);
    const avgDaily = Calc.averageDailySpending(semTx, dates.start);
    const runway = Calc.moneyRunway({
      semesterStart: dates.start, semesterEnd: dates.end,
      currentBalance: balance, avgDailySpending: avgDaily,
    });

    const statusLabel = { 'on-track': 'On track', 'careful': 'Be careful', 'at-risk': 'At risk', 'unknown': 'Not enough data' }[runway.status];

    const today = new Date();
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    let pct = 50;
    if (!isNaN(start) && !isNaN(end) && end > start) {
      pct = Math.min(Math.max(((today - start) / (end - start)) * 100, 0), 100);
    }

    container.innerHTML = `
      <div class="runway-status">
        <span class="runway-status__dot runway-status__dot--${runway.status}"></span>
        <strong>${statusLabel}</strong>
        <span class="form-hint">${runway.daysRemaining !== null ? `${runway.daysRemaining} days left in ${UI.escapeHtml(currentSemester)}` : ''}</span>
      </div>
      <div class="card-grid" style="margin-bottom:6px;">
        ${this.statCard('Current avg. daily spending', Calc.formatMoney(runway.avgDailySpending))}
        ${this.statCard('Suggested max daily spending', runway.suggestedMaxDaily !== null ? Calc.formatMoney(runway.suggestedMaxDaily) : '—')}
        ${this.statCard('Estimated balance at semester end', runway.estimatedEndBalance !== null ? Calc.formatMoney(runway.estimatedEndBalance) : '—', runway.estimatedEndBalance < 0 ? 'expense' : '')}
      </div>
      <div class="timeline">
        <div class="timeline__track"></div>
        <div class="timeline__fill" style="width:${pct}%"></div>
        <div class="timeline__point" style="left:0%"></div>
        <div class="timeline__label" style="left:0%">Start</div>
        <div class="timeline__point timeline__point--today" style="left:${pct}%"></div>
        <div class="timeline__label" style="left:${pct}%">Today</div>
        <div class="timeline__point" style="left:100%"></div>
        <div class="timeline__label" style="left:100%; transform: translateX(-100%);">End</div>
      </div>
      <button class="btn btn--ghost btn--sm" id="runway-edit-dates" style="margin-top:10px;">Edit semester dates</button>
    `;
    container.querySelector('#runway-edit-dates').addEventListener('click', () => this.openSemesterDatesForm(currentSemester));
  },

  renderWarnings(container, settings, all, monthKey) {
    const warnings = this.computeWarnings(settings, all, monthKey);
    if (warnings.length === 0) {
      container.innerHTML = `<div class="card"><p class="form-hint" style="margin:0;">No warnings right now — you're on top of your spending. 🎉</p></div>`;
      return;
    }
    container.innerHTML = warnings.map((w) => `<div class="warning-item ${w.tone === 'info' ? 'warning-item--info' : ''}">${w.icon} <span>${w.text}</span></div>`).join('');
  },

  computeWarnings(settings, all, monthKey) {
    const warnings = [];
    const catBudgets = Store.getCategoryBudgets();
    const monthTx = Calc.filterByMonth(all, monthKey);
    const catTotalsThisMonth = Calc.categoryTotals(monthTx, 'expense');

    catBudgets.forEach((b) => {
      const spent = catTotalsThisMonth[b.category] || 0;
      const pct = Calc.budgetUsagePercent(spent, b.amount);
      if (pct >= 100) {
        warnings.push({ icon: '🚨', tone: 'warn', text: `You are over your ${UI.escapeHtml(b.category)} budget (${pct}% used).` });
      } else if (pct >= 80) {
        warnings.push({ icon: '⚠️', tone: 'warn', text: `You have used ${pct}% of your ${UI.escapeHtml(b.category)} budget.` });
      }
    });

    // overall monthly budget
    const monthSpent = Calc.totalExpense(monthTx);
    if (Calc.safeNumber(settings.monthlyBudget) > 0) {
      const pct = Calc.budgetUsagePercent(monthSpent, settings.monthlyBudget);
      if (pct >= 100) warnings.push({ icon: '🚨', tone: 'warn', text: 'You are over your monthly budget.' });
      else if (pct >= 85) warnings.push({ icon: '⚠️', tone: 'warn', text: `You have used ${pct}% of your monthly budget.` });
    }

    // compare to last month
    const d = new Date();
    const lastMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastMonthKey = Calc.currentMonthKey(lastMonthDate);
    const lastMonthSpent = Calc.totalExpense(Calc.filterByMonth(all, lastMonthKey));
    if (lastMonthSpent > 0 && monthSpent > lastMonthSpent) {
      warnings.push({ icon: 'ℹ️', tone: 'info', text: 'Your spending this month is higher than last month.' });
    }

    // vs planned daily average using monthly budget
    const daysRemaining = Calc.daysRemainingInMonth(monthKey);
    const remaining = Calc.safeNumber(settings.monthlyBudget) - monthSpent;
    const suggestedLimit = Calc.dailySpendingLimit(remaining, daysRemaining);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySpent = Calc.totalExpense(monthTx.filter((t) => t.date === todayStr));
    if (suggestedLimit !== null && Calc.safeNumber(settings.monthlyBudget) > 0 && todaySpent > suggestedLimit) {
      warnings.push({ icon: '⚠️', tone: 'warn', text: 'You are spending more today than your suggested daily average.' });
    }

    return warnings;
  },

  renderDashboardBudgetProgress(container, settings, all, monthKey) {
    const catBudgets = Store.getCategoryBudgets();
    const monthTx = Calc.filterByMonth(all, monthKey);
    const spentByCat = Calc.categoryTotals(monthTx, 'expense');
    const monthBudget = Calc.safeNumber(settings.monthlyBudget);
    const monthSpent = Calc.totalExpense(monthTx);

    let html = this.budgetBarHtml('Overall monthly budget', monthSpent, monthBudget);
    if (catBudgets.length === 0) {
      html += `<p class="form-hint" style="margin-top:10px;">Set category budgets on the Budget page to see detailed progress here.</p>`;
    } else {
      html += catBudgets.map((b) => this.budgetBarHtml(b.category, spentByCat[b.category] || 0, b.amount)).join('');
    }
    container.innerHTML = html;
  },

  budgetBarHtml(name, spent, budget) {
    const pct = Calc.budgetUsagePercent(spent, budget);
    let cls = 'progress-fill--ok';
    if (pct >= 100) cls = 'progress-fill--over';
    else if (pct >= 80) cls = 'progress-fill--high';
    else if (pct >= 50) cls = 'progress-fill--mid';
    const barWidth = Math.min(pct, 100);
    return `
      <div class="budget-item">
        <div class="budget-item__top">
          <span class="budget-item__name">${UI.escapeHtml(name)}</span>
          <span class="budget-item__figures">${Calc.formatMoney(spent)} / ${budget > 0 ? Calc.formatMoney(budget) : 'no budget set'}</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${cls}" style="width:${barWidth}%"></div></div>
        <div class="budget-item__pct">${pct}% used${pct >= 100 ? ' · over budget' : ''}</div>
      </div>
    `;
  },

  renderOverviewChart(all) {
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(Calc.currentMonthKey(dt));
    }
    const labels = months.map((m) => {
      const [y, mo] = m.split('-');
      return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-MY', { month: 'short' });
    });
    const incomeData = months.map((m) => Calc.totalIncome(Calc.filterByMonth(all, m)));
    const expenseData = months.map((m) => Calc.totalExpense(Calc.filterByMonth(all, m)));
    Charts.spendingOverviewChart('chart-overview', labels, incomeData, expenseData);
  },

  renderCategoryChartForMonth(all, monthKey) {
    const monthTx = Calc.filterByMonth(all, monthKey);
    const totals = Calc.categoryTotals(monthTx, 'expense');
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      document.getElementById('chart-category').closest('.chart-card__canvas-wrap').innerHTML = '<p class="form-hint">No expenses recorded this month yet.</p>';
      return;
    }
    Charts.categoryDoughnutChart('chart-category', entries.map((e) => e[0]), entries.map((e) => e[1]));
  },

  // ================================================================
  // TRANSACTIONS
  // ================================================================
  renderTransactions() {
    const settings = Store.getSettings();
    const all = Store.getTransactions();
    const f = this.state.txFilters;

    const months = [...new Set(all.map((t) => Calc.monthKey(t.date)).filter(Boolean))].sort().reverse();
    const categories = [...new Set(all.map((t) => t.category).filter(Boolean))].sort();

    this.el.innerHTML = `
      <div class="btn-row">
        <button class="btn btn--primary" id="tx-add-expense">➖ Add expense</button>
        <button class="btn btn--secondary" id="tx-add-income">➕ Add income</button>
      </div>
      <div class="filters-bar">
        <input type="search" id="tx-search" placeholder="Search description, category, notes…" value="${UI.escapeHtml(f.search)}" aria-label="Search transactions" />
        <select id="tx-filter-type" aria-label="Filter by type">
          <option value="all">All types</option>
          <option value="income">Income only</option>
          <option value="expense">Expenses only</option>
        </select>
        <select id="tx-filter-category" aria-label="Filter by category">
          <option value="all">All categories</option>
          ${categories.map((c) => `<option value="${UI.escapeHtml(c)}">${UI.escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="tx-filter-month" aria-label="Filter by month">
          <option value="all">All months</option>
          ${months.map((m) => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <select id="tx-filter-semester" aria-label="Filter by semester">
          <option value="all">All semesters</option>
          ${settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}">${UI.escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="tx-sort" aria-label="Sort transactions">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Highest amount</option>
          <option value="amount-asc">Lowest amount</option>
        </select>
      </div>
      <div class="card"><div class="table-wrap" id="tx-table-wrap"></div></div>
    `;

    document.getElementById('tx-add-expense').addEventListener('click', () => this.openTransactionForm('expense'));
    document.getElementById('tx-add-income').addEventListener('click', () => this.openTransactionForm('income'));

    const searchEl = document.getElementById('tx-search');
    searchEl.addEventListener('input', () => { f.search = searchEl.value; this.renderTxTable(); });
    document.getElementById('tx-filter-type').value = f.type;
    document.getElementById('tx-filter-type').addEventListener('change', (e) => { f.type = e.target.value; this.renderTxTable(); });
    document.getElementById('tx-filter-category').value = f.category;
    document.getElementById('tx-filter-category').addEventListener('change', (e) => { f.category = e.target.value; this.renderTxTable(); });
    document.getElementById('tx-filter-month').value = f.month;
    document.getElementById('tx-filter-month').addEventListener('change', (e) => { f.month = e.target.value; this.renderTxTable(); });
    document.getElementById('tx-filter-semester').value = f.semester;
    document.getElementById('tx-filter-semester').addEventListener('change', (e) => { f.semester = e.target.value; this.renderTxTable(); });
    document.getElementById('tx-sort').value = f.sort;
    document.getElementById('tx-sort').addEventListener('change', (e) => { f.sort = e.target.value; this.renderTxTable(); });

    this.renderTxTable();
  },

  getFilteredTransactions() {
    const all = Store.getTransactions();
    const f = this.state.txFilters;
    let list = all.filter((t) => {
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.category !== 'all' && t.category !== f.category) return false;
      if (f.month !== 'all' && Calc.monthKey(t.date) !== f.month) return false;
      if (f.semester !== 'all' && t.semester !== f.semester) return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        const hay = `${t.description || ''} ${t.category || ''} ${t.notes || ''} ${t.paymentMethod || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const [sortKey, sortDir] = f.sort.split('-');
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = (a.date || '').localeCompare(b.date || '');
      else cmp = Calc.safeNumber(a.amount) - Calc.safeNumber(b.amount);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  },

  renderTxTable() {
    const wrap = document.getElementById('tx-table-wrap');
    if (!wrap) return;
    const list = this.getFilteredTransactions();
    if (list.length === 0) {
      wrap.innerHTML = '';
      wrap.appendChild(UI.emptyState('No transactions match your filters yet.', 'Add expense', () => this.openTransactionForm('expense')));
      return;
    }
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Method</th><th>Semester</th><th>Amount</th><th></th>
        </tr></thead>
        <tbody>
          ${list.map((t) => `
            <tr>
              <td>${Calc.formatDate(t.date)}</td>
              <td><span class="badge badge--${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
              <td>${UI.escapeHtml(t.category || '—')}</td>
              <td>${UI.escapeHtml(t.description || '—')}</td>
              <td>${UI.escapeHtml(t.paymentMethod || '—')}</td>
              <td>${UI.escapeHtml(t.semester || '—')}</td>
              <td class="amount-cell ${t.type}">${t.type === 'income' ? '+' : '-'}${Calc.formatMoney(t.amount)}</td>
              <td>
                <div class="row-actions">
                  <button type="button" data-edit="${t.id}" aria-label="Edit">✏️</button>
                  <button type="button" data-delete="${t.id}" aria-label="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    wrap.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tx = Store.getTransactions().find((t) => t.id === btn.dataset.edit);
        if (tx) this.openTransactionForm(tx.type, tx);
      });
    });
    wrap.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.confirm('Delete this transaction? This cannot be undone.', () => {
          Store.deleteTransaction(btn.dataset.delete);
          UI.toast('Transaction deleted', 'success');
          this.renderCurrentPage();
        });
      });
    });
  },

  txRowHtml(t) {
    const icon = t.type === 'income' ? (SOURCE_ICONS[t.category] || '💰') : (CATEGORY_ICONS[t.category] || '🗂️');
    return `
      <div class="tx-row">
        <div class="tx-row__left">
          <div class="tx-row__icon">${icon}</div>
          <div class="tx-row__info">
            <div class="tx-row__title">${UI.escapeHtml(t.description || t.category || 'Transaction')}</div>
            <div class="tx-row__meta">${UI.escapeHtml(t.category || '')} · ${Calc.formatDate(t.date)}</div>
          </div>
        </div>
        <div class="tx-row__amount ${t.type}">${t.type === 'income' ? '+' : '-'}${Calc.formatMoney(t.amount)}</div>
      </div>
    `;
  },

  // ---- transaction form ----
  openTransactionForm(type, existing) {
    const settings = Store.getSettings();
    const isEdit = !!existing;
    const categories = type === 'income' ? settings.incomeSources : settings.expenseCategories;

    const body = `
      <form id="tx-form">
        <div class="type-toggle">
          <button type="button" data-type="expense" class="${type === 'expense' ? 'is-active type-expense' : ''}">➖ Expense</button>
          <button type="button" data-type="income" class="${type === 'income' ? 'is-active type-income' : ''}">➕ Income</button>
        </div>
        <input type="hidden" id="tx-type" value="${type}" />
        <div class="form-grid">
          <div class="form-field">
            <label for="tx-amount">Amount (RM)</label>
            <input type="number" id="tx-amount" min="0" step="0.01" inputmode="decimal" value="${existing ? existing.amount : ''}" required />
          </div>
          <div class="form-field">
            <label for="tx-date">Date</label>
            <input type="date" id="tx-date" value="${existing ? existing.date : new Date().toISOString().slice(0, 10)}" required />
          </div>
          <div class="form-field form-field--full">
            <label for="tx-category" id="tx-category-label">${type === 'income' ? 'Source' : 'Category'}</label>
            <select id="tx-category"></select>
          </div>
          <div class="form-field form-field--full">
            <label for="tx-description">Description</label>
            <input type="text" id="tx-description" placeholder="e.g. Lunch at campus café" value="${existing ? UI.escapeHtml(existing.description || '') : ''}" />
          </div>
          <div class="form-field">
            <label for="tx-payment">Payment method</label>
            <select id="tx-payment">
              ${PAYMENT_METHODS.map((p) => `<option value="${p}" ${existing && existing.paymentMethod === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="tx-semester">Semester</label>
            <select id="tx-semester">
              ${settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}" ${existing ? (existing.semester === s ? 'selected' : '') : (settings.currentSemester === s ? 'selected' : '')}>${UI.escapeHtml(s)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label for="tx-notes">Notes</label>
            <textarea id="tx-notes">${existing ? UI.escapeHtml(existing.notes || '') : ''}</textarea>
          </div>
        </div>
        <p class="form-error" id="tx-form-error"></p>
        <div class="modal-actions">
          ${isEdit ? '<button type="button" class="btn btn--danger" id="tx-delete-btn">Delete</button>' : ''}
          <button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add transaction'}</button>
        </div>
      </form>
    `;
    UI.openModal(isEdit ? 'Edit transaction' : (type === 'income' ? 'Add income' : 'Add expense'), body);

    const form = document.getElementById('tx-form');
    const typeInput = document.getElementById('tx-type');
    const categorySelect = document.getElementById('tx-category');
    const categoryLabel = document.getElementById('tx-category-label');

    const fillCategories = (t) => {
      const list = t === 'income' ? settings.incomeSources : settings.expenseCategories;
      categoryLabel.textContent = t === 'income' ? 'Source' : 'Category';
      categorySelect.innerHTML = list.map((c) => `<option value="${UI.escapeHtml(c)}" ${existing && existing.category === c ? 'selected' : ''}>${UI.escapeHtml(c)}</option>`).join('');
    };
    fillCategories(type);

    form.querySelectorAll('.type-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        typeInput.value = t;
        form.querySelectorAll('.type-toggle button').forEach((b) => b.classList.remove('is-active', 'type-expense', 'type-income'));
        btn.classList.add('is-active', t === 'income' ? 'type-income' : 'type-expense');
        fillCategories(t);
      });
    });

    if (isEdit) {
      document.getElementById('tx-delete-btn').addEventListener('click', () => {
        UI.confirm('Delete this transaction? This cannot be undone.', () => {
          Store.deleteTransaction(existing.id);
          UI.closeModal();
          UI.toast('Transaction deleted', 'success');
          this.renderCurrentPage();
        });
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('tx-amount').value);
      const date = document.getElementById('tx-date').value;
      const errorEl = document.getElementById('tx-form-error');
      if (!amount || amount <= 0) { errorEl.textContent = 'Please enter an amount greater than 0.'; return; }
      if (!date) { errorEl.textContent = 'Please pick a date.'; return; }

      const record = {
        type: typeInput.value,
        amount,
        date,
        category: categorySelect.value,
        description: document.getElementById('tx-description').value.trim(),
        paymentMethod: document.getElementById('tx-payment').value,
        semester: document.getElementById('tx-semester').value,
        notes: document.getElementById('tx-notes').value.trim(),
      };

      if (isEdit) {
        Store.updateTransaction(existing.id, record);
        UI.toast('Transaction updated', 'success');
      } else {
        Store.addTransaction(record);
        UI.toast(`${record.type === 'income' ? 'Income' : 'Expense'} added`, 'success');
      }
      UI.closeModal();
      this.renderCurrentPage();
    });
  },

  // ================================================================
  // BUDGET PLANNER
  // ================================================================
  renderBudget() {
    const settings = Store.getSettings();
    const all = Store.getTransactions();
    const monthKey = Calc.currentMonthKey();
    const monthTx = Calc.filterByMonth(all, monthKey);
    const monthSpent = Calc.totalExpense(monthTx);
    const spentByCat = Calc.categoryTotals(monthTx, 'expense');
    const catBudgets = Store.getCategoryBudgets();
    const semTx = Calc.filterBySemester(all, settings.currentSemester);
    const semSpent = Calc.totalExpense(semTx);
    const semBudget = Calc.safeNumber(settings.semesterBudgets[settings.currentSemester]);

    this.el.innerHTML = `
      <div class="two-col">
        <div class="card">
          <div class="section-title" style="margin-top:0;"><h2>Monthly budget</h2>
            <button class="btn btn--soft btn--sm" id="edit-monthly-budget">Edit</button>
          </div>
          ${this.budgetBarHtml('This month', monthSpent, Calc.safeNumber(settings.monthlyBudget))}
        </div>
        <div class="card">
          <div class="section-title" style="margin-top:0;"><h2>${UI.escapeHtml(settings.currentSemester)} budget</h2>
            <button class="btn btn--soft btn--sm" id="edit-semester-budget">Edit</button>
          </div>
          ${this.budgetBarHtml(settings.currentSemester, semSpent, semBudget)}
        </div>
      </div>

      <div class="section-title">
        <h2>Category budgets (monthly)</h2>
        <button class="btn btn--primary btn--sm" id="add-category-budget">+ Set category budget</button>
      </div>
      <div class="card" id="category-budgets-wrap"></div>
    `;

    document.getElementById('edit-monthly-budget').addEventListener('click', () => this.openMonthlyBudgetForm());
    document.getElementById('edit-semester-budget').addEventListener('click', () => this.openSemesterBudgetForm(settings.currentSemester));
    document.getElementById('add-category-budget').addEventListener('click', () => this.openCategoryBudgetForm());

    const wrap = document.getElementById('category-budgets-wrap');
    if (catBudgets.length === 0) {
      wrap.appendChild(UI.emptyState('No category budgets yet. Set one for Food, Transport, or any category you want to control.', 'Set category budget', () => this.openCategoryBudgetForm()));
    } else {
      wrap.innerHTML = catBudgets
        .slice()
        .sort((a, b) => a.category.localeCompare(b.category))
        .map((b) => {
          const spent = spentByCat[b.category] || 0;
          const pct = Calc.budgetUsagePercent(spent, b.amount);
          let cls = 'progress-fill--ok';
          if (pct >= 100) cls = 'progress-fill--over';
          else if (pct >= 80) cls = 'progress-fill--high';
          else if (pct >= 50) cls = 'progress-fill--mid';
          return `
            <div class="budget-item">
              <div class="budget-item__top">
                <span class="budget-item__name">${CATEGORY_ICONS[b.category] || '🗂️'} ${UI.escapeHtml(b.category)}</span>
                <div class="row-actions">
                  <button type="button" data-edit-budget="${UI.escapeHtml(b.category)}" aria-label="Edit">✏️</button>
                  <button type="button" data-delete-budget="${UI.escapeHtml(b.category)}" aria-label="Delete">🗑️</button>
                </div>
              </div>
              <div class="budget-item__figures">${Calc.formatMoney(spent)} / ${Calc.formatMoney(b.amount)}</div>
              <div class="progress-track"><div class="progress-fill ${cls}" style="width:${Math.min(pct, 100)}%"></div></div>
              <div class="budget-item__pct">${pct}% used${pct >= 100 ? ' · over budget' : ''}</div>
            </div>
          `;
        }).join('');
      wrap.querySelectorAll('[data-edit-budget]').forEach((btn) => {
        btn.addEventListener('click', () => this.openCategoryBudgetForm(btn.dataset.editBudget));
      });
      wrap.querySelectorAll('[data-delete-budget]').forEach((btn) => {
        btn.addEventListener('click', () => {
          UI.confirm(`Remove the budget for ${btn.dataset.deleteBudget}?`, () => {
            Store.setCategoryBudget(btn.dataset.deleteBudget, null);
            UI.toast('Category budget removed', 'success');
            this.renderCurrentPage();
          });
        });
      });
    }
  },

  openMonthlyBudgetForm() {
    const settings = Store.getSettings();
    const body = `
      <form id="budget-form">
        <div class="form-field">
          <label for="budget-amount">Monthly budget (RM)</label>
          <input type="number" id="budget-amount" min="0" step="0.01" value="${settings.monthlyBudget || ''}" required />
        </div>
        <p class="form-hint">This is your overall spending limit, separate from income you receive. It won't be confused with income tracking.</p>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    `;
    UI.openModal('Edit monthly budget', body);
    document.getElementById('budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('budget-amount').value) || 0;
      Store.saveSettings({ monthlyBudget: amount });
      UI.closeModal();
      UI.toast('Monthly budget updated', 'success');
      this.renderCurrentPage();
    });
  },

  openSemesterBudgetForm(semester) {
    const settings = Store.getSettings();
    const body = `
      <form id="sem-budget-form">
        <div class="form-field">
          <label for="sem-budget-amount">${UI.escapeHtml(semester)} budget (RM)</label>
          <input type="number" id="sem-budget-amount" min="0" step="0.01" value="${settings.semesterBudgets[semester] || ''}" required />
        </div>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    `;
    UI.openModal(`Edit ${semester} budget`, body);
    document.getElementById('sem-budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('sem-budget-amount').value) || 0;
      const semesterBudgets = { ...settings.semesterBudgets, [semester]: amount };
      Store.saveSettings({ semesterBudgets });
      UI.closeModal();
      UI.toast('Semester budget updated', 'success');
      this.renderCurrentPage();
    });
  },

  openCategoryBudgetForm(existingCategory) {
    const settings = Store.getSettings();
    const catBudgets = Store.getCategoryBudgets();
    const existing = existingCategory ? catBudgets.find((b) => b.category === existingCategory) : null;
    const usedCats = catBudgets.map((b) => b.category);
    const available = existing ? settings.expenseCategories : settings.expenseCategories.filter((c) => !usedCats.includes(c));

    if (available.length === 0 && !existing) {
      UI.openModal('All set', '<p>Every category already has a budget. Edit or delete an existing one instead.</p>');
      return;
    }

    const body = `
      <form id="cat-budget-form">
        <div class="form-field">
          <label for="cat-budget-category">Category</label>
          <select id="cat-budget-category" ${existing ? 'disabled' : ''}>
            ${available.map((c) => `<option value="${UI.escapeHtml(c)}" ${existing && existing.category === c ? 'selected' : ''}>${UI.escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="cat-budget-amount">Monthly budget (RM)</label>
          <input type="number" id="cat-budget-amount" min="0" step="0.01" value="${existing ? existing.amount : ''}" required />
        </div>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    `;
    UI.openModal(existing ? `Edit ${existing.category} budget` : 'Set category budget', body);
    document.getElementById('cat-budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const category = existing ? existing.category : document.getElementById('cat-budget-category').value;
      const amount = Number(document.getElementById('cat-budget-amount').value) || 0;
      Store.setCategoryBudget(category, amount);
      UI.closeModal();
      UI.toast('Category budget saved', 'success');
      this.renderCurrentPage();
    });
  },

  // ================================================================
  // PTPTN PLANNING
  // ================================================================
  renderPtptn() {
    const settings = Store.getSettings();
    const plans = Store.getPtptnPlans().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    this.el.innerHTML = `
      <div class="section-title" style="margin-top:0;">
        <h2>Your PTPTN plans</h2>
        <button class="btn btn--primary btn--sm" id="add-ptptn-plan">+ Add PTPTN received</button>
      </div>
      <div id="ptptn-list"></div>
    `;
    document.getElementById('add-ptptn-plan').addEventListener('click', () => this.openPtptnForm());

    const listEl = document.getElementById('ptptn-list');
    if (plans.length === 0) {
      listEl.appendChild(UI.emptyState('No PTPTN plans yet. Record what you received and plan how to allocate it.', 'Add PTPTN received', () => this.openPtptnForm()));
      return;
    }

    listEl.innerHTML = plans.map((p) => {
      const allocated = Object.values(p.allocations || {}).reduce((a, b) => a + Calc.safeNumber(b), 0);
      const unallocated = Calc.safeNumber(p.amount) - allocated;
      const pct = Calc.safeNumber(p.amount) > 0 ? Math.round((allocated / p.amount) * 100) : 0;
      return `
        <div class="card" style="margin-bottom:14px;">
          <div class="budget-item__top">
            <div>
              <strong>${Calc.formatMoney(p.amount)}</strong> received on ${Calc.formatDate(p.date)}
              <div class="form-hint">${UI.escapeHtml(p.semester || '')}</div>
            </div>
            <div class="row-actions">
              <button type="button" data-allocate="${p.id}" class="btn btn--soft btn--sm">Allocate</button>
              <button type="button" data-edit-ptptn="${p.id}" aria-label="Edit">✏️</button>
              <button type="button" data-delete-ptptn="${p.id}" aria-label="Delete">🗑️</button>
            </div>
          </div>
          <div class="progress-track"><div class="progress-fill ${pct > 100 ? 'progress-fill--over' : 'progress-fill--ok'}" style="width:${Math.min(pct, 100)}%"></div></div>
          <div class="budget-item__figures" style="margin-top:6px;">Allocated: ${Calc.formatMoney(allocated)} (${pct}%) · Unallocated: ${Calc.formatMoney(unallocated)}</div>
          ${unallocated < 0 ? `<div class="warning-item" style="margin-top:8px;">⚠️ You've allocated more than you received by ${Calc.formatMoney(-unallocated)}.</div>` : ''}
          ${Object.keys(p.allocations || {}).length > 0 ? `
            <div style="margin-top:10px;">
              ${Object.entries(p.allocations).map(([cat, amt]) => `
                <div class="tx-row" style="padding:8px 0;">
                  <span>${CATEGORY_ICONS[cat] || '🗂️'} ${UI.escapeHtml(cat)}</span>
                  <span>${Calc.formatMoney(amt)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="form-hint" style="margin-top:8px;">Not allocated yet — this money isn\'t counted as spending until you record actual expenses.</p>'}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-allocate]').forEach((btn) => {
      btn.addEventListener('click', () => this.openPtptnAllocationForm(btn.dataset.allocate));
    });
    listEl.querySelectorAll('[data-edit-ptptn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const plan = Store.getPtptnPlans().find((p) => p.id === btn.dataset.editPtptn);
        if (plan) this.openPtptnForm(plan);
      });
    });
    listEl.querySelectorAll('[data-delete-ptptn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.confirm('Delete this PTPTN plan? Its allocations will also be removed.', () => {
          Store.deletePtptnPlan(btn.dataset.deletePtptn);
          UI.toast('PTPTN plan deleted', 'success');
          this.renderCurrentPage();
        });
      });
    });
  },

  openPtptnForm(existing) {
    const settings = Store.getSettings();
    const isEdit = !!existing;
    const body = `
      <form id="ptptn-form">
        <div class="form-field">
          <label for="ptptn-amount">Amount received (RM)</label>
          <input type="number" id="ptptn-amount" min="0" step="0.01" value="${existing ? existing.amount : ''}" required />
        </div>
        <div class="form-field">
          <label for="ptptn-date">Date received</label>
          <input type="date" id="ptptn-date" value="${existing ? existing.date : new Date().toISOString().slice(0, 10)}" required />
        </div>
        <div class="form-field">
          <label for="ptptn-semester">Semester</label>
          <select id="ptptn-semester">
            ${settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}" ${existing ? (existing.semester === s ? 'selected' : '') : (settings.currentSemester === s ? 'selected' : '')}>${UI.escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <p class="form-hint">This just records the money received. You can also log it as income under Transactions so it counts toward your balance.</p>
        <div class="modal-actions">
          ${isEdit ? '<button type="button" class="btn btn--danger" id="ptptn-delete-btn">Delete</button>' : ''}
          <button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add plan'}</button>
        </div>
      </form>
    `;
    UI.openModal(isEdit ? 'Edit PTPTN plan' : 'Add PTPTN received', body);

    if (isEdit) {
      document.getElementById('ptptn-delete-btn').addEventListener('click', () => {
        UI.confirm('Delete this PTPTN plan?', () => {
          Store.deletePtptnPlan(existing.id);
          UI.closeModal();
          UI.toast('PTPTN plan deleted', 'success');
          this.renderCurrentPage();
        });
      });
    }

    document.getElementById('ptptn-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('ptptn-amount').value);
      if (!amount || amount <= 0) return;
      const record = {
        amount,
        date: document.getElementById('ptptn-date').value,
        semester: document.getElementById('ptptn-semester').value,
      };
      if (isEdit) {
        Store.updatePtptnPlan(existing.id, record);
        UI.toast('PTPTN plan updated', 'success');
      } else {
        Store.addPtptnPlan({ ...record, allocations: {} });
        UI.toast('PTPTN plan added', 'success');
      }
      UI.closeModal();
      this.renderCurrentPage();
    });
  },

  openPtptnAllocationForm(planId) {
    const settings = Store.getSettings();
    const plan = Store.getPtptnPlans().find((p) => p.id === planId);
    if (!plan) return;
    const allocations = { ...(plan.allocations || {}) };

    const body = `
      <form id="alloc-form">
        <p class="form-hint">Total received: <strong>${Calc.formatMoney(plan.amount)}</strong>. This is a plan only — it won't be counted as spending.</p>
        ${settings.expenseCategories.concat(['Savings']).map((cat) => `
          <div class="alloc-row">
            <span class="alloc-row__label">${CATEGORY_ICONS[cat] || '🐷'} ${UI.escapeHtml(cat)}</span>
            <input type="number" min="0" step="0.01" data-alloc-cat="${UI.escapeHtml(cat)}" value="${allocations[cat] || ''}" placeholder="0.00" />
          </div>
        `).join('')}
        <p class="form-error" id="alloc-error"></p>
        <p id="alloc-summary" class="form-hint"></p>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Save allocation</button></div>
      </form>
    `;
    UI.openModal('Allocate PTPTN money', body);

    const form = document.getElementById('alloc-form');
    const inputs = form.querySelectorAll('[data-alloc-cat]');
    const summaryEl = document.getElementById('alloc-summary');
    const updateSummary = () => {
      let total = 0;
      inputs.forEach((i) => { total += Number(i.value) || 0; });
      const remaining = Calc.safeNumber(plan.amount) - total;
      summaryEl.textContent = `Allocated: ${Calc.formatMoney(total)} · Remaining: ${Calc.formatMoney(remaining)}`;
      summaryEl.style.color = remaining < 0 ? 'var(--expense)' : '';
    };
    inputs.forEach((i) => i.addEventListener('input', updateSummary));
    updateSummary();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newAllocations = {};
      let total = 0;
      inputs.forEach((i) => {
        const val = Number(i.value) || 0;
        if (val > 0) newAllocations[i.dataset.allocCat] = val;
        total += val;
      });
      if (total > plan.amount) {
        document.getElementById('alloc-error').textContent = `You've allocated ${Calc.formatMoney(total - plan.amount)} more than you received.`;
        return;
      }
      Store.updatePtptnPlan(plan.id, { allocations: newAllocations });
      UI.closeModal();
      UI.toast('Allocation saved', 'success');
      this.renderCurrentPage();
    });
  },

  // ================================================================
  // SAVINGS GOALS
  // ================================================================
  renderSavings() {
    const goals = Store.getGoals();
    this.el.innerHTML = `
      <div class="section-title" style="margin-top:0;">
        <h2>Savings goals</h2>
        <button class="btn btn--primary btn--sm" id="add-goal">+ New goal</button>
      </div>
      <div class="card-grid" id="goals-wrap"></div>
    `;
    document.getElementById('add-goal').addEventListener('click', () => this.openGoalForm());

    const wrap = document.getElementById('goals-wrap');
    wrap.className = '';
    if (goals.length === 0) {
      wrap.appendChild(UI.emptyState('No savings goals yet. Try an Emergency Fund of RM500 to get started.', 'Add goal', () => this.openGoalForm()));
      return;
    }
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    wrap.style.gap = '14px';

    wrap.innerHTML = goals.map((g) => {
      const pct = Calc.savingsProgressPercent(g.saved, g.target);
      const remaining = Math.max(Calc.safeNumber(g.target) - Calc.safeNumber(g.saved), 0);
      return `
        <div class="card">
          <div class="budget-item__top">
            <span class="budget-item__name">🐷 ${UI.escapeHtml(g.name)}</span>
            <div class="row-actions">
              <button type="button" data-edit-goal="${g.id}" aria-label="Edit">✏️</button>
              <button type="button" data-delete-goal="${g.id}" aria-label="Delete">🗑️</button>
            </div>
          </div>
          <div class="budget-item__figures">${Calc.formatMoney(g.saved)} of ${Calc.formatMoney(g.target)}</div>
          <div class="progress-track"><div class="progress-fill ${pct >= 100 ? 'progress-fill--ok' : 'progress-fill--mid'}" style="width:${pct}%"></div></div>
          <div class="budget-item__pct">${pct}% complete · ${Calc.formatMoney(remaining)} to go</div>
          ${g.deadline ? `<p class="form-hint" style="margin-top:6px;">Deadline: ${Calc.formatDate(g.deadline)}</p>` : ''}
          ${g.notes ? `<p class="form-hint">${UI.escapeHtml(g.notes)}</p>` : ''}
          <button type="button" class="btn btn--soft btn--sm" style="margin-top:8px;" data-add-money="${g.id}">+ Add money</button>
        </div>
      `;
    }).join('');

    wrap.querySelectorAll('[data-edit-goal]').forEach((btn) => {
      btn.addEventListener('click', () => this.openGoalForm(Store.getGoals().find((g) => g.id === btn.dataset.editGoal)));
    });
    wrap.querySelectorAll('[data-delete-goal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.confirm('Delete this savings goal?', () => {
          Store.deleteGoal(btn.dataset.deleteGoal);
          UI.toast('Goal deleted', 'success');
          this.renderCurrentPage();
        });
      });
    });
    wrap.querySelectorAll('[data-add-money]').forEach((btn) => {
      btn.addEventListener('click', () => this.openAddMoneyForm(btn.dataset.addMoney));
    });
  },

  openGoalForm(existing) {
    const isEdit = !!existing;
    const body = `
      <form id="goal-form">
        <div class="form-field">
          <label for="goal-name">Goal name</label>
          <input type="text" id="goal-name" value="${existing ? UI.escapeHtml(existing.name) : ''}" placeholder="e.g. Emergency Fund" required />
        </div>
        <div class="form-field">
          <label for="goal-target">Target amount (RM)</label>
          <input type="number" id="goal-target" min="0" step="0.01" value="${existing ? existing.target : ''}" required />
        </div>
        <div class="form-field">
          <label for="goal-saved">Current saved amount (RM)</label>
          <input type="number" id="goal-saved" min="0" step="0.01" value="${existing ? existing.saved : '0'}" />
        </div>
        <div class="form-field">
          <label for="goal-deadline">Deadline (optional)</label>
          <input type="date" id="goal-deadline" value="${existing && existing.deadline ? existing.deadline : ''}" />
        </div>
        <div class="form-field">
          <label for="goal-notes">Notes</label>
          <textarea id="goal-notes">${existing ? UI.escapeHtml(existing.notes || '') : ''}</textarea>
        </div>
        <div class="modal-actions">
          ${isEdit ? '<button type="button" class="btn btn--danger" id="goal-delete-btn">Delete</button>' : ''}
          <button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add goal'}</button>
        </div>
      </form>
    `;
    UI.openModal(isEdit ? 'Edit savings goal' : 'New savings goal', body);

    if (isEdit) {
      document.getElementById('goal-delete-btn').addEventListener('click', () => {
        UI.confirm('Delete this savings goal?', () => {
          Store.deleteGoal(existing.id);
          UI.closeModal();
          UI.toast('Goal deleted', 'success');
          this.renderCurrentPage();
        });
      });
    }

    document.getElementById('goal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const record = {
        name: document.getElementById('goal-name').value.trim(),
        target: Number(document.getElementById('goal-target').value) || 0,
        saved: Number(document.getElementById('goal-saved').value) || 0,
        deadline: document.getElementById('goal-deadline').value || null,
        notes: document.getElementById('goal-notes').value.trim(),
      };
      if (!record.name) return;
      if (isEdit) {
        Store.updateGoal(existing.id, record);
        UI.toast('Goal updated', 'success');
      } else {
        Store.addGoal(record);
        UI.toast('Goal added', 'success');
      }
      UI.closeModal();
      this.renderCurrentPage();
    });
  },

  openAddMoneyForm(goalId) {
    const goal = Store.getGoals().find((g) => g.id === goalId);
    if (!goal) return;
    const body = `
      <form id="add-money-form">
        <div class="form-field">
          <label for="add-money-amount">Amount to add (RM)</label>
          <input type="number" id="add-money-amount" min="0.01" step="0.01" required />
        </div>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Add</button></div>
      </form>
    `;
    UI.openModal(`Add money to ${goal.name}`, body);
    document.getElementById('add-money-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('add-money-amount').value) || 0;
      if (amount <= 0) return;
      Store.updateGoal(goal.id, { saved: Calc.safeNumber(goal.saved) + amount });
      UI.closeModal();
      UI.toast('Added to goal', 'success');
      this.renderCurrentPage();
    });
  },

  // ================================================================
  // ANALYTICS
  // ================================================================
  renderAnalytics() {
    const settings = Store.getSettings();
    const all = Store.getTransactions();
    const f = this.state.analyticsFilters;

    const months = [...new Set(all.map((t) => Calc.monthKey(t.date)).filter(Boolean))].sort().reverse();
    const categories = [...new Set(all.filter((t) => t.type === 'expense').map((t) => t.category).filter(Boolean))].sort();

    this.el.innerHTML = `
      <div class="filters-bar">
        <select id="an-filter-month"><option value="all">All months</option>${months.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
        <select id="an-filter-semester"><option value="all">All semesters</option>${settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}">${UI.escapeHtml(s)}</option>`).join('')}</select>
        <select id="an-filter-category"><option value="all">All categories</option>${categories.map((c) => `<option value="${UI.escapeHtml(c)}">${UI.escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <div class="card-grid" id="an-stats"></div>
      <div class="two-col">
        <div class="card chart-card">
          <h3>Monthly spending</h3>
          <div class="chart-card__canvas-wrap"><canvas id="an-chart-monthly"></canvas></div>
        </div>
        <div class="card chart-card">
          <h3>Spending by category</h3>
          <div class="chart-card__canvas-wrap"><canvas id="an-chart-category"></canvas></div>
        </div>
      </div>
      <div class="card chart-card" style="margin-top:16px;">
        <h3>Income vs expenses</h3>
        <div class="chart-card__canvas-wrap"><canvas id="an-chart-income-expense"></canvas></div>
      </div>
    `;

    document.getElementById('an-filter-month').value = f.month;
    document.getElementById('an-filter-month').addEventListener('change', (e) => { f.month = e.target.value; this.renderAnalytics(); });
    document.getElementById('an-filter-semester').value = f.semester;
    document.getElementById('an-filter-semester').addEventListener('change', (e) => { f.semester = e.target.value; this.renderAnalytics(); });
    document.getElementById('an-filter-category').value = f.category;
    document.getElementById('an-filter-category').addEventListener('change', (e) => { f.category = e.target.value; this.renderAnalytics(); });

    let filtered = all;
    if (f.month !== 'all') filtered = filtered.filter((t) => Calc.monthKey(t.date) === f.month);
    if (f.semester !== 'all') filtered = filtered.filter((t) => t.semester === f.semester);
    if (f.category !== 'all') filtered = filtered.filter((t) => t.category === f.category);

    const expenseTx = filtered.filter((t) => t.type === 'expense');
    const catTotals = Calc.categoryTotals(filtered, 'expense');
    const topCat = Calc.highestCategory(catTotals);
    const monthTotals = Calc.monthlyTotals(filtered, 'expense');
    const monthEntries = Object.entries(monthTotals).sort((a, b) => a[0].localeCompare(b[0]));
    const topMonth = monthEntries.reduce((best, cur) => (!best || cur[1] > best[1] ? cur : best), null);
    const avgDaily = Calc.averageDailySpending(filtered);
    const avgMonthly = monthEntries.length > 0 ? monthEntries.reduce((a, [, v]) => a + v, 0) / monthEntries.length : 0;

    document.getElementById('an-stats').innerHTML = [
      this.statCard('Total spending', Calc.formatMoney(Calc.totalExpense(filtered)), 'expense'),
      this.statCard('Total income', Calc.formatMoney(Calc.totalIncome(filtered)), 'income'),
      this.statCard('Highest category', topCat ? `${topCat.category} (${Calc.formatMoney(topCat.amount)})` : '—'),
      this.statCard('Highest month', topMonth ? topMonth[0] : '—'),
      this.statCard('Average daily spending', Calc.formatMoney(avgDaily)),
      this.statCard('Average monthly spending', Calc.formatMoney(avgMonthly)),
    ].join('');

    // monthly bar chart
    if (monthEntries.length === 0) {
      document.getElementById('an-chart-monthly').closest('.chart-card__canvas-wrap').innerHTML = '<p class="form-hint">No spending data for this filter yet.</p>';
    } else {
      Charts.monthlyBarChart('an-chart-monthly', monthEntries.map((e) => e[0]), monthEntries.map((e) => e[1]));
    }

    // category doughnut
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (catEntries.length === 0) {
      document.getElementById('an-chart-category').closest('.chart-card__canvas-wrap').innerHTML = '<p class="form-hint">No expenses recorded for this filter yet.</p>';
    } else {
      Charts.categoryDoughnutChart('an-chart-category', catEntries.map((e) => e[0]), catEntries.map((e) => e[1]));
    }

    // income vs expense by month (last 6 available or filtered months)
    const ieMonths = monthEntries.length > 0 ? monthEntries.map((e) => e[0]) : [];
    if (ieMonths.length === 0) {
      document.getElementById('an-chart-income-expense').closest('.chart-card__canvas-wrap').innerHTML = '<p class="form-hint">No data for this filter yet.</p>';
    } else {
      const incomeByMonth = ieMonths.map((m) => Calc.totalIncome(filtered.filter((t) => Calc.monthKey(t.date) === m)));
      const expenseByMonth = ieMonths.map((m) => Calc.totalExpense(filtered.filter((t) => Calc.monthKey(t.date) === m)));
      Charts.incomeVsExpenseChart('an-chart-income-expense', ieMonths, incomeByMonth, expenseByMonth);
    }
  },

  // update statCard signature usage with optional sub value
  // (kept backward compatible: 3rd arg tone, 4th arg sub-line)

  // ================================================================
  // SETTINGS
  // ================================================================
  renderSettings() {
    const settings = Store.getSettings();
    const recurring = Store.getRecurring();

    this.el.innerHTML = `
      <div class="section-title" style="margin-top:0;"><h2>Semester management</h2></div>
      <div class="card" id="semester-mgmt"></div>

      <div class="section-title"><h2>🔁 Recurring expenses</h2>
        <button class="btn btn--primary btn--sm" id="add-recurring">+ Add recurring</button>
      </div>
      <div class="card" id="recurring-wrap"></div>

      <div class="section-title"><h2>Data management</h2></div>
      <div class="card">
        <div class="btn-row">
          <button class="btn btn--secondary" id="export-json">Export data (JSON)</button>
          <button class="btn btn--secondary" id="export-csv">Export transactions (CSV)</button>
          <label class="btn btn--soft" for="import-json-input" style="cursor:pointer;">Import backup (JSON)</label>
          <input type="file" id="import-json-input" accept="application/json" hidden />
          <button class="btn btn--danger" id="clear-all-data">Clear all data</button>
        </div>
        <p class="form-hint">All your data lives only in this browser's storage — nothing is sent anywhere. Export regularly to keep a backup.</p>
      </div>

      <div class="section-title"><h2>Preferences</h2></div>
      <div class="card">
        <div class="form-field">
          <label for="default-semester-select">Default / current semester</label>
          <select id="default-semester-select">
            ${settings.semesters.map((s) => `<option value="${UI.escapeHtml(s)}" ${settings.currentSemester === s ? 'selected' : ''}>${UI.escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <p class="form-hint">Category and income-source lists can be customised directly in <code>js/storage.js</code> (DEFAULT_EXPENSE_CATEGORIES / DEFAULT_INCOME_SOURCES).</p>
      </div>
    `;

    // semester management
    const semWrap = document.getElementById('semester-mgmt');
    const all = Store.getTransactions();
    semWrap.innerHTML = settings.semesters.map((s) => {
      const tx = Calc.filterBySemester(all, s);
      const income = Calc.totalIncome(tx);
      const expense = Calc.totalExpense(tx);
      const budget = Calc.safeNumber(settings.semesterBudgets[s]);
      const dates = settings.semesterDates[s];
      const monthsSpan = dates && dates.start && dates.end ? Math.max(Math.round((Calc.daysBetween(dates.start, dates.end) || 30) / 30), 1) : null;
      const avgMonthly = monthsSpan ? expense / monthsSpan : null;
      return `
        <div class="budget-item">
          <div class="budget-item__top">
            <span class="budget-item__name">${s === settings.currentSemester ? '⭐ ' : ''}${UI.escapeHtml(s)}</span>
            <div class="row-actions">
              <button type="button" class="btn btn--ghost btn--sm" data-set-current="${UI.escapeHtml(s)}">Set current</button>
              <button type="button" class="btn btn--ghost btn--sm" data-edit-dates="${UI.escapeHtml(s)}">Dates</button>
            </div>
          </div>
          <div class="budget-item__figures">
            Income: ${Calc.formatMoney(income)} · Expenses: ${Calc.formatMoney(expense)} · Remaining: ${Calc.formatMoney(income - expense)}<br/>
            Budget: ${budget > 0 ? Calc.formatMoney(budget) : 'not set'} ${avgMonthly !== null ? `· Avg monthly spending: ${Calc.formatMoney(avgMonthly)}` : ''}
            ${dates && dates.start && dates.end ? `<br/>${Calc.formatDate(dates.start)} → ${Calc.formatDate(dates.end)}` : ''}
          </div>
        </div>
      `;
    }).join('');
    semWrap.querySelectorAll('[data-set-current]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Store.saveSettings({ currentSemester: btn.dataset.setCurrent });
        this.populateSemesterSelect();
        UI.toast(`Current semester set to ${btn.dataset.setCurrent}`, 'success');
        this.renderCurrentPage();
      });
    });
    semWrap.querySelectorAll('[data-edit-dates]').forEach((btn) => {
      btn.addEventListener('click', () => this.openSemesterDatesForm(btn.dataset.editDates));
    });

    // recurring expenses
    document.getElementById('add-recurring').addEventListener('click', () => this.openRecurringForm());
    const recWrap = document.getElementById('recurring-wrap');
    if (recurring.length === 0) {
      recWrap.appendChild(UI.emptyState('No recurring expenses yet — add your phone bill, internet, or subscriptions.', 'Add recurring', () => this.openRecurringForm()));
    } else {
      recWrap.innerHTML = recurring.map((r) => `
        <div class="tx-row">
          <div class="tx-row__left">
            <div class="tx-row__icon">${CATEGORY_ICONS[r.category] || '🔁'}</div>
            <div class="tx-row__info">
              <div class="tx-row__title">${UI.escapeHtml(r.name)}</div>
              <div class="tx-row__meta">${UI.escapeHtml(r.frequency)} · ${UI.escapeHtml(r.category)} · from ${Calc.formatDate(r.startDate)}${r.endDate ? ` to ${Calc.formatDate(r.endDate)}` : ''}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="tx-row__amount expense">${Calc.formatMoney(r.amount)}</span>
            <div class="row-actions">
              <button type="button" data-edit-recurring="${r.id}" aria-label="Edit">✏️</button>
              <button type="button" data-delete-recurring="${r.id}" aria-label="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `).join('');
      recWrap.querySelectorAll('[data-edit-recurring]').forEach((btn) => {
        btn.addEventListener('click', () => this.openRecurringForm(Store.getRecurring().find((r) => r.id === btn.dataset.editRecurring)));
      });
      recWrap.querySelectorAll('[data-delete-recurring]').forEach((btn) => {
        btn.addEventListener('click', () => {
          UI.confirm('Delete this recurring expense?', () => {
            Store.deleteRecurring(btn.dataset.deleteRecurring);
            UI.toast('Recurring expense deleted', 'success');
            this.renderCurrentPage();
          });
        });
      });
    }

    // data management
    document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
    document.getElementById('import-json-input').addEventListener('change', (e) => this.importJSON(e));
    document.getElementById('clear-all-data').addEventListener('click', () => {
      UI.confirm('This will permanently delete ALL your transactions, budgets, goals and settings from this browser. This cannot be undone.', () => {
        Store.clearAll();
        UI.toast('All data cleared', 'success');
        this.populateSemesterSelect();
        this.navigate('dashboard');
      }, { title: 'Clear all data?', confirmLabel: 'Clear everything' });
    });

    document.getElementById('default-semester-select').addEventListener('change', (e) => {
      Store.saveSettings({ currentSemester: e.target.value });
      this.populateSemesterSelect();
      UI.toast('Current semester updated', 'success');
    });
  },

  openSemesterDatesForm(semester) {
    const settings = Store.getSettings();
    const dates = settings.semesterDates[semester] || {};
    const body = `
      <form id="sem-dates-form">
        <div class="form-field">
          <label for="sem-start">${UI.escapeHtml(semester)} start date</label>
          <input type="date" id="sem-start" value="${dates.start || ''}" required />
        </div>
        <div class="form-field">
          <label for="sem-end">${UI.escapeHtml(semester)} end date</label>
          <input type="date" id="sem-end" value="${dates.end || ''}" required />
        </div>
        <p class="form-error" id="sem-dates-error"></p>
        <div class="modal-actions"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    `;
    UI.openModal(`${semester} dates`, body);
    document.getElementById('sem-dates-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const start = document.getElementById('sem-start').value;
      const end = document.getElementById('sem-end').value;
      if (new Date(end) <= new Date(start)) {
        document.getElementById('sem-dates-error').textContent = 'End date must be after the start date.';
        return;
      }
      const semesterDates = { ...settings.semesterDates, [semester]: { start, end } };
      Store.saveSettings({ semesterDates });
      UI.closeModal();
      UI.toast('Semester dates saved', 'success');
      this.renderCurrentPage();
    });
  },

  openRecurringForm(existing) {
    const settings = Store.getSettings();
    const isEdit = !!existing;
    const body = `
      <form id="recurring-form">
        <div class="form-field">
          <label for="rec-name">Name</label>
          <input type="text" id="rec-name" value="${existing ? UI.escapeHtml(existing.name) : ''}" placeholder="e.g. Phone bill" required />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label for="rec-amount">Amount (RM)</label>
            <input type="number" id="rec-amount" min="0" step="0.01" value="${existing ? existing.amount : ''}" required />
          </div>
          <div class="form-field">
            <label for="rec-frequency">Frequency</label>
            <select id="rec-frequency">
              ${['Weekly', 'Monthly', 'Semester'].map((f) => `<option value="${f}" ${existing && existing.frequency === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--full">
            <label for="rec-category">Category</label>
            <select id="rec-category">
              ${settings.expenseCategories.map((c) => `<option value="${UI.escapeHtml(c)}" ${existing && existing.category === c ? 'selected' : ''}>${UI.escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="rec-start">Start date</label>
            <input type="date" id="rec-start" value="${existing ? existing.startDate : new Date().toISOString().slice(0, 10)}" required />
          </div>
          <div class="form-field">
            <label for="rec-end">End date (optional)</label>
            <input type="date" id="rec-end" value="${existing && existing.endDate ? existing.endDate : ''}" />
          </div>
        </div>
        <div class="modal-actions">
          ${isEdit ? '<button type="button" class="btn btn--danger" id="rec-delete-btn">Delete</button>' : ''}
          <button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add recurring'}</button>
        </div>
      </form>
    `;
    UI.openModal(isEdit ? 'Edit recurring expense' : 'Add recurring expense', body);

    if (isEdit) {
      document.getElementById('rec-delete-btn').addEventListener('click', () => {
        UI.confirm('Delete this recurring expense?', () => {
          Store.deleteRecurring(existing.id);
          UI.closeModal();
          UI.toast('Recurring expense deleted', 'success');
          this.renderCurrentPage();
        });
      });
    }

    document.getElementById('recurring-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const record = {
        name: document.getElementById('rec-name').value.trim(),
        amount: Number(document.getElementById('rec-amount').value) || 0,
        frequency: document.getElementById('rec-frequency').value,
        category: document.getElementById('rec-category').value,
        startDate: document.getElementById('rec-start').value,
        endDate: document.getElementById('rec-end').value || null,
      };
      if (!record.name || record.amount <= 0) return;
      if (isEdit) {
        Store.updateRecurring(existing.id, record);
        UI.toast('Recurring expense updated', 'success');
      } else {
        Store.addRecurring(record);
        UI.toast('Recurring expense added', 'success');
      }
      UI.closeModal();
      this.renderCurrentPage();
    });
  },

  // ---- data management actions ----
  exportJSON() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `duit-kira-backup-${new Date().toISOString().slice(0, 10)}.json`);
    UI.toast('Backup exported', 'success');
  },

  exportCSV() {
    const all = Store.getTransactions();
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Description', 'Payment Method', 'Semester', 'Notes'];
    const rows = all.map((t) => [
      t.date, t.type, t.amount, t.category, t.description || '', t.paymentMethod || '', t.semester || '', t.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, `duit-kira-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    UI.toast('Transactions exported as CSV', 'success');
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Store.importAll(data);
        UI.toast('Backup imported successfully', 'success');
        this.applyDarkMode(Store.getSettings().darkMode);
        this.populateSemesterSelect();
        this.navigate('dashboard');
      } catch (err) {
        console.error(err);
        UI.toast('Could not read that file — is it a valid backup?', 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
