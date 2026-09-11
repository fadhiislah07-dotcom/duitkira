/* charts.js
   All Chart.js instance creation/updating lives here.
   Charts are re-created on each render call (destroy then re-init)
   to keep things simple and always in sync with current data.
*/

const Charts = {
  instances: {},

  palette: {
    navy: '#172B4D',
    babyBlue: '#A9D6F5',
    softBlue: '#6FA8C9',
    cream: '#F5EBDD',
    paleBlue: '#DCEFFA',
    darkText: '#202A36',
    mutedGrey: '#7B8490',
  },

  categoryColors: [
    '#172B4D', '#A9D6F5', '#6FA8C9', '#F5EBDD', '#DCEFFA',
    '#8FA6C2', '#C9DCE8', '#5E7A99', '#B8CBDC', '#3E5578',
  ],

  destroy(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      delete this.instances[key];
    }
  },

  destroyAll() {
    Object.keys(this.instances).forEach((k) => this.destroy(k));
  },

  isDark() {
    return document.body.classList.contains('dark-mode');
  },

  gridColor() {
    return this.isDark() ? 'rgba(248,250,252,0.08)' : 'rgba(32,42,54,0.08)';
  },

  textColor() {
    return this.isDark() ? '#A8B1BC' : this.palette.mutedGrey;
  },

  spendingOverviewChart(canvasId, labels, incomeData, expenseData) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            borderColor: this.palette.softBlue,
            backgroundColor: 'rgba(111,168,201,0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
          {
            label: 'Expenses',
            data: expenseData,
            borderColor: this.palette.navy,
            backgroundColor: 'rgba(23,43,77,0.10)',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: this.baseOptions(),
    });
  },

  categoryDoughnutChart(canvasId, labels, data) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => this.categoryColors[i % this.categoryColors.length]),
          borderWidth: 2,
          borderColor: this.isDark() ? '#1E293B' : '#FAF9F6',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: this.textColor(), padding: 14, font: { size: 12 } },
          },
        },
        cutout: '62%',
      },
    });
  },

  monthlyBarChart(canvasId, labels, data) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Spending',
          data,
          backgroundColor: this.palette.babyBlue,
          borderRadius: 6,
          maxBarThickness: 36,
        }],
      },
      options: this.baseOptions(),
    });
  },

  incomeVsExpenseChart(canvasId, labels, incomeData, expenseData) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: incomeData, backgroundColor: this.palette.softBlue, borderRadius: 6, maxBarThickness: 28 },
          { label: 'Expenses', data: expenseData, backgroundColor: this.palette.navy, borderRadius: 6, maxBarThickness: 28 },
        ],
      },
      options: this.baseOptions(),
    });
  },

  baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: this.textColor(), padding: 14, font: { size: 12 } },
        },
      },
      scales: {
        x: {
          grid: { color: this.gridColor(), drawBorder: false },
          ticks: { color: this.textColor(), font: { size: 11 } },
        },
        y: {
          grid: { color: this.gridColor(), drawBorder: false },
          ticks: { color: this.textColor(), font: { size: 11 } },
          beginAtZero: true,
        },
      },
    };
  },
};
