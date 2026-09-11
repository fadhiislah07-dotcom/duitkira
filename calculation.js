/* calculations.js
   Pure functions only — take data in, return numbers/objects out.
   No DOM access, no localStorage access. Keeps logic testable
   and easy to reuse across dashboard/budget/analytics/runway.
*/

const Calc = {
  safeNumber(n) {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  },

  sum(transactions, type) {
    return transactions
      .filter((t) => t.type === type)
      .reduce((acc, t) => acc + this.safeNumber(t.amount), 0);
  },

  totalIncome(transactions) {
    return this.sum(transactions, 'income');
  },
  totalExpense(transactions) {
    return this.sum(transactions, 'expense');
  },
  balance(transactions) {
    return this.totalIncome(transactions) - this.totalExpense(transactions);
  },

  monthKey(dateStr) {
    // 'YYYY-MM-DD' -> 'YYYY-MM'
    return typeof dateStr === 'string' && dateStr.length >= 7 ? dateStr.slice(0, 7) : '';
  },

  inMonth(t, monthKey) {
    return this.monthKey(t.date) === monthKey;
  },

  inSemester(t, semester) {
    return t.semester === semester;
  },

  filterByMonth(transactions, monthKey) {
    return transactions.filter((t) => this.inMonth(t, monthKey));
  },
  filterBySemester(transactions, semester) {
    return transactions.filter((t) => this.inSemester(t, semester));
  },

  currentMonthKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },

  daysInMonth(monthKey) {
    if (!monthKey) return 30;
    const [y, m] = monthKey.split('-').map(Number);
    if (!y || !m) return 30;
    return new Date(y, m, 0).getDate();
  },

  daysRemainingInMonth(monthKey, today = new Date()) {
    const total = this.daysInMonth(monthKey);
    if (this.currentMonthKey(today) !== monthKey) return 0;
    return Math.max(total - today.getDate() + 1, 0);
  },

  averageDailySpending(transactions, sinceDate, today = new Date()) {
    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) return 0;
    const dates = expenses.map((t) => new Date(t.date)).filter((d) => !isNaN(d));
    if (dates.length === 0) return 0;
    let earliest = sinceDate ? new Date(sinceDate) : new Date(Math.min(...dates));
    if (isNaN(earliest)) earliest = new Date(Math.min(...dates));
    const msPerDay = 1000 * 60 * 60 * 24;
    const daySpan = Math.max(Math.round((today - earliest) / msPerDay) + 1, 1);
    const total = this.totalExpense(expenses);
    return total / daySpan;
  },

  budgetUsagePercent(spent, budget) {
    const b = this.safeNumber(budget);
    if (b <= 0) return spent > 0 ? 100 : 0;
    return Math.round((this.safeNumber(spent) / b) * 100);
  },

  dailySpendingLimit(remainingBudget, daysRemaining) {
    if (daysRemaining <= 0) return null; // no days left to spend
    if (remainingBudget <= 0) return 0;
    return remainingBudget / daysRemaining;
  },

  savingsProgressPercent(saved, target) {
    const t = this.safeNumber(target);
    if (t <= 0) return 0;
    return Math.min(Math.round((this.safeNumber(saved) / t) * 100), 100);
  },

  daysBetween(startDate, endDate) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) return null;
    return Math.round((end - start) / msPerDay);
  },

  moneyRunway({ semesterStart, semesterEnd, currentBalance, avgDailySpending, today = new Date() }) {
    const result = {
      daysRemaining: null,
      avgDailySpending: this.safeNumber(avgDailySpending),
      suggestedMaxDaily: null,
      estimatedSpendUntilEnd: null,
      estimatedEndBalance: null,
      status: 'unknown', // 'on-track' | 'careful' | 'at-risk' | 'unknown'
    };
    if (!semesterStart || !semesterEnd) return result;

    const end = new Date(semesterEnd);
    const start = new Date(semesterStart);
    if (isNaN(end) || isNaN(start)) return result;

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.max(Math.round((end - today) / msPerDay), 0);
    result.daysRemaining = daysRemaining;

    const balance = this.safeNumber(currentBalance);
    result.suggestedMaxDaily = daysRemaining > 0 ? balance / daysRemaining : 0;

    const spend = this.safeNumber(avgDailySpending) * daysRemaining;
    result.estimatedSpendUntilEnd = spend;
    result.estimatedEndBalance = balance - spend;

    if (daysRemaining <= 0) {
      result.status = 'unknown';
    } else if (result.estimatedEndBalance >= balance * 0.15 || result.estimatedEndBalance >= 0 && avgDailySpending <= result.suggestedMaxDaily) {
      result.status = 'on-track';
    } else if (result.estimatedEndBalance >= 0) {
      result.status = 'careful';
    } else {
      result.status = 'at-risk';
    }
    return result;
  },

  categoryTotals(transactions, type = 'expense') {
    const totals = {};
    transactions
      .filter((t) => t.type === type)
      .forEach((t) => {
        const cat = t.category || 'Other';
        totals[cat] = (totals[cat] || 0) + this.safeNumber(t.amount);
      });
    return totals;
  },

  highestCategory(totals) {
    let best = null;
    let bestVal = -Infinity;
    Object.entries(totals).forEach(([cat, val]) => {
      if (val > bestVal) {
        bestVal = val;
        best = cat;
      }
    });
    return best ? { category: best, amount: bestVal } : null;
  },

  monthlyTotals(transactions, type = 'expense') {
    const totals = {};
    transactions
      .filter((t) => t.type === type)
      .forEach((t) => {
        const key = this.monthKey(t.date);
        if (!key) return;
        totals[key] = (totals[key] || 0) + this.safeNumber(t.amount);
      });
    return totals;
  },

  formatMoney(amount, currency = 'RM') {
    const n = this.safeNumber(amount);
    const sign = n < 0 ? '-' : '';
    return `${sign}${currency} ${Math.abs(n).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  },
};
