/* ========== REPORTS ========== */
let reportPage = 1;

function renderReportPagination(total) {
  const el = qs(SEL.reportPagination);
  if (!el) return;
  const totalPages = Math.ceil(total / REPORT_PAGE_SIZE);
  if (totalPages <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  qs(SEL.reportPrevBtn).disabled = reportPage <= 1;
  qs(SEL.reportNextBtn).disabled = reportPage >= totalPages;
  qs(SEL.reportPageInfo).textContent = 'P\u00e1gina ' + reportPage + ' de ' + totalPages + ' (' + total + ' ventas)';
}

function buildReportFilter(withPagination) {
  const filter = {
    start_date: qs(SEL.reportStartDate).value + START_OF_DAY_SUFFIX,
    end_date: qs(SEL.reportEndDate).value + END_OF_DAY_SUFFIX,
    producto_codigo: qs(SEL.reportProductFilter).value.trim() || null,
    username: qs(SEL.reportVendorFilter).value.trim() || null,
  };
  if (withPagination) {
    filter.page = reportPage;
    filter.page_size = REPORT_PAGE_SIZE;
  }
  return filter;
}

async function loadReports(resetPage) {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  if (resetPage) reportPage = 1;
  const searchBtn = qs(SEL.reportSearchBtn);
  const btnHtml = searchBtn.innerHTML;
  try {
    showLoading(searchBtn);
    const result = await invoke('get_sales_report', { filter: buildReportFilter(true) });
    qs(SEL.reportTotalCount).textContent = result.total_ventas;
    qs(SEL.reportTotalUsd).textContent = formatUSD(result.total_usd);
    qs(SEL.reportTotalCosto).textContent = formatUSD(result.total_costo_usd || 0);
    qs(SEL.reportTotalGanancia).textContent = formatUSD(result.total_ganancia_usd || 0);
    qs(SEL.reportTotalBs).textContent = formatBS(result.total_bs);

    renderReportPagination(result.total_ventas);

    const tbody = qs(SEL.reportSalesBody);
    tbody.innerHTML = '';
    if (!result.ventas || result.ventas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10">' + emptyState('<i class="nf nf-fa-bar_chart"></i>', 'Sin ventas en el per\u00edodo', '') + '</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      result.ventas.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = createReportRow(item);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { searchBtn.innerHTML = btnHtml; }
}

async function loadReportsAndTopProducts(resetPage) {
  await loadReports(resetPage);
  await loadTopProducts();
  await loadVendorSales();
}

async function loadVendorSales() {
  const section = qs(SEL.vendorSalesSection);
  const tbody = qs(SEL.vendorSalesBody);
  if (!section || !tbody) return;
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { section.style.display = 'none'; return; }
  try {
    const items = await invoke('get_sales_by_vendor', {
      startDate: startDate + START_OF_DAY_SUFFIX,
      endDate: endDate + END_OF_DAY_SUFFIX
    });
    if (!items || items.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    tbody.innerHTML = '';
    items.forEach(function(v) {
      var tr = document.createElement('tr');
      tr.innerHTML = createVendorSalesRow(v);
      tbody.appendChild(tr);
    });
  } catch (e) { section.style.display = 'none'; }
}

async function loadTopProducts() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  const section = qs(SEL.topProductsSection);
  const grid = qs(SEL.topProductsGrid);
  if (!section || !grid) return;
  if (!startDate || !endDate) { section.style.display = 'none'; return; }
  const limit = parseInt(qs(SEL.topProductsLimit)?.value || '10');
  try {
    const products = await invoke('get_top_products', {
      startDate: startDate + START_OF_DAY_SUFFIX,
      endDate: endDate,
      limit: limit
    });
    if (!products || products.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    grid.innerHTML = '';
    products.forEach(function(p) {
      const card = document.createElement('div');
      card.className = 'top-product-card';
      card.innerHTML = '<div class="top-product-rank"><i class="nf nf-fa-cube"></i></div><div class="top-product-info"><div class="top-product-name">' + escapeHtml(p.nombre) + '</div><div class="top-product-meta">' + p.cantidad_vendida + ' vendidos &middot; ' + formatUSD(p.total_usd) + '</div></div>';
      grid.appendChild(card);
    });
  } catch (e) { /* silently ignore */ section.style.display = 'none'; }
}

let dashboardChartType = 'bar';

async function loadDashboard() {
  const body = qs(SEL.dashboardBody);
  if (!body) return;
  try {
    const data = await invoke('get_dashboard_summary');
    var paymentMethods = null;
    if (dashboardChartType === 'pie') {
      paymentMethods = await tryCatch(() => invoke('get_dashboard_payment_methods', { period: piePeriod }));
    }
    const periodColors = [cssVar('--primary'), cssVar('--accent'), cssVar('--inari')];
    const periods = [
      { label: 'Hoy', icon: 'calendar_day', key: 'today', color: periodColors[0] },
      { label: '\u00daltimos 7 d\u00edas', icon: 'calendar_week', key: 'week', color: periodColors[1] },
      { label: 'Este mes', icon: 'calendar', key: 'month', color: periodColors[2] }
    ];
      body.innerHTML =
        '<div class="dashboard-chart-toggle">' +
          '<button class="btn btn-sm ' + (dashboardChartType === 'bar' ? 'btn-primary' : 'btn-outline') + '" data-chart="bar"><i class="nf nf-fa-bar_chart"></i> Barras</button>' +
          '<button class="btn btn-sm ' + (dashboardChartType === 'pie' ? 'btn-primary' : 'btn-outline') + '" data-chart="pie"><i class="nf nf-fa-chart_pie"></i> Pastel</button>' +
          '<button class="btn btn-sm ' + (dashboardChartType === 'line' ? 'btn-primary' : 'btn-outline') + '" data-chart="line"><i class="nf nf-fa-line_chart"></i> Ganancias</button>' +
        '</div>' +
        '<div class="dashboard-chart-container"><canvas id="dashboard-canvas" width="' + CHART.CANVAS_MAX_WIDTH + '" height="' + CHART.BAR_HEIGHT + '"></canvas></div>' +
        '<div class="dashboard-grid">' +
          periods.map(function(p) {
            var d = data[p.key];
            return '<div class="dashboard-period" style="border-left: 4px solid ' + p.color + '">' +
              '<div class="dashboard-period-title"><i class="nf nf-fa-' + p.icon + '"></i> ' + p.label + '</div>' +
              '<div class="dashboard-stat"><span>Ventas</span><strong data-count="' + d.total_ventas + '" data-fmt="int">' + d.total_ventas + '</strong></div>' +
              '<div class="dashboard-stat"><span>Total USD</span><strong data-count="' + d.total_usd + '" data-fmt="usd">' + formatUSD(d.total_usd) + '</strong></div>' +
              '<div class="dashboard-stat"><span>Costo</span><strong data-count="' + (d.total_costo_usd || 0) + '" data-fmt="usd">' + formatUSD(d.total_costo_usd || 0) + '</strong></div>' +
              '<div class="dashboard-stat"><span>Ganancia</span><strong data-count="' + (d.total_ganancia_usd || 0) + '" data-fmt="usd">' + formatUSD(d.total_ganancia_usd || 0) + '</strong></div>' +
              '<div class="dashboard-stat"><span>Total Bs.</span><strong data-count="' + d.total_bs + '" data-fmt="bs">' + formatBS(d.total_bs) + '</strong></div>' +
            '</div>';
          }).join('') +
        '</div>';
    runCountUps(body);
    var toggleBtns = body.querySelectorAll('.dashboard-chart-toggle button');
    for (var i = 0; i < toggleBtns.length; i++) {
      toggleBtns[i].addEventListener('click', function() {
        dashboardChartType = this.dataset.chart;
        if (dashboardChartType === 'pie') piePeriod = 'day';
        loadDashboard();
      });
    }
    if (dashboardChartType === 'pie') {
      requestAnimationFrame(function() { drawDashboardPieChart(body, paymentMethods); });
    } else if (dashboardChartType === 'line') {
      requestAnimationFrame(function() { drawProfitLineChart(body); });
    } else {
      requestAnimationFrame(function() { drawDashboardBarChart(body, data, periods); });
    }
  } catch (e) { body.innerHTML = '<p class="text-muted">Error al cargar dashboard</p>'; }
}

var piePeriod = 'day';

function showChartTooltip(clientX, clientY, text) {
  var el = qs(SEL.chartTooltip);
  if (!el) {
    el = document.createElement('div');
    el.id = 'chart-tooltip';
    el.style.cssText = 'position:fixed;pointer-events:none;background:rgba(0,0,0,0.85);color:#fff;padding:6px 10px;border-radius:4px;font-size:13px;z-index:9999;white-space:nowrap;display:none;';
    document.body.appendChild(el);
  }
  if (text) {
    el.textContent = text;
    el.style.display = 'block';
    el.style.left = Math.min(clientX + 12, window.innerWidth - el.offsetWidth - 8) + 'px';
    el.style.top = Math.max(clientY - el.offsetHeight - 8, 4) + 'px';
  } else {
    el.style.display = 'none';
  }
}

function hideChartTooltip() {
  var el = qs(SEL.chartTooltip);
  if (el) el.style.display = 'none';
}

/* ========== BAR CHART ========== */
function drawDashboardBarChart(body, data, periods) {
  const canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const isMobile = rect.width < BREAKPOINT.MOBILE;
  const w = Math.min(rect.width - 16, CHART.CANVAS_MAX_WIDTH);
  const h = isMobile ? CHART.BAR_HEIGHT_MOBILE : CHART.BAR_HEIGHT;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const textColor = cssVar('--text', '#e0d8e8');
  const textLight = cssVar('--text-light', '#a098b8');
  const pad = isMobile ? { top: 12, right: 8, bottom: 28, left: 40 } : { top: 20, right: 20, bottom: 35, left: 55 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const metrics = [
    { label: 'Ventas', key: 'total_ventas', values: [data.today.total_ventas, data.week.total_ventas, data.month.total_ventas] },
    { label: 'USD', key: 'total_usd', values: [data.today.total_usd, data.week.total_usd, data.month.total_usd] }
  ];

  const barColors = [cssVar('--primary'), cssVar('--accent'), cssVar('--inari')];
  const periodLabels = ['Hoy', '7 d\u00edas', 'Mes'];
  const groupW = chartW / metrics.length;
  const barW = Math.min(groupW * (isMobile ? 0.24 : 0.28), isMobile ? 28 : 36);
  const gap = (groupW - barW * 3) / 4;
  const yMaxes = metrics.map(function(m) { return Math.max.apply(null, m.values) * 1.15 || 1; });

  let bars = [];
  let startTime = null;
  const duration = CHART.BAR_ANIM_MS;

  function drawBase(ease) {
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.stroke();

    ctx.strokeStyle = '#e5e7eb';
    ctx.setLineDash([4, 4]);
    const gridLines = isMobile ? 3 : 4;
    for (let gi = 1; gi <= gridLines; gi++) {
      const gy = pad.top + chartH * (1 - gi / (gridLines + 1));
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + chartW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = textLight;
    ctx.font = isMobile ? '9px sans-serif' : '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let yi = 0; yi <= gridLines + 1; yi++) {
      ctx.fillText(Math.round(yi * 100 / (gridLines + 1)) + '%', pad.left - (isMobile ? 4 : 8), pad.top + chartH * (1 - yi / (gridLines + 1)));
    }

    bars = [];
    for (let mi = 0; mi < metrics.length; mi++) {
      const gx = pad.left + mi * groupW + gap;
      for (let bi = 0; bi < 3; bi++) {
        const barH = Math.max(1, (metrics[mi].values[bi] / yMaxes[mi]) * chartH * ease);
        const bx = gx + bi * (barW + gap);
        const by = pad.top + chartH - barH;
        bars.push({ x: bx, y: by, w: barW, h: barH, metric: metrics[mi].label, period: periodLabels[bi] });
        ctx.fillStyle = barColors[bi];
        ctx.fillRect(bx, by, barW, barH);
        if (barH > (isMobile ? 10 : 15)) {
          ctx.fillStyle = textColor;
          ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(mi === 0 ? String(Number(metrics[mi].values[bi])) : '$' + Number(metrics[mi].values[bi]).toFixed(1), bx + barW / 2, by - 2);
        }
      }
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '10px' : '12px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(metrics[mi].label, gx + groupW / 2, pad.top + chartH + 8);
    }

    const legendX = w - (isMobile ? 130 : 160), legendY = isMobile ? 4 : 6;
    const lSize = isMobile ? 8 : 10;
    for (let li = 0; li < 3; li++) {
      ctx.fillStyle = barColors[li];
      ctx.fillRect(legendX + li * (isMobile ? 44 : 52), legendY, lSize, lSize);
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(periodLabels[li], legendX + li * (isMobile ? 44 : 52) + lSize + 3, legendY);
    }
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachChartHover(canvas, bars, dpr); }
  }
  requestAnimationFrame(animate);
}

/* ========== PIE CHART ========== */
function drawDashboardPieChart(body, paymentMethods) {
  const periodLabels = { day: 'Hoy', week: 'Semana', month: 'Mes' };
  const periodBar = document.createElement('div');
  periodBar.className = 'dashboard-chart-toggle';
  periodBar.innerHTML = Object.keys(periodLabels).map(function(k) {
    return '<button class="btn btn-sm ' + (piePeriod === k ? 'btn-primary' : 'btn-outline') + '" data-pie-period="' + k + '">' + periodLabels[k] + '</button>';
  }).join('');
  const container = body.querySelector('.dashboard-chart-container');
  if (container) body.insertBefore(periodBar, container);
  const periodBtns = periodBar.querySelectorAll('[data-pie-period]');
  for (let pi = 0; pi < periodBtns.length; pi++) {
    periodBtns[pi].addEventListener('click', function() {
      piePeriod = this.dataset.piePeriod;
      loadDashboard();
    });
  }

  const canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const isMobile = rect.width < BREAKPOINT.MOBILE;
  const w = Math.min(rect.width - 16, CHART.CANVAS_MAX_WIDTH);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = CHART.BAR_HEIGHT * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = CHART.BAR_HEIGHT + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const h = CHART.BAR_HEIGHT;

  const textColor = cssVar('--text', '#e0d8e8');
  const textLight = cssVar('--text-light', '#a098b8');
  const cardColor = cssVar('--card', '#1f2937');

  const pieColors = [cssVar('--primary'), cssVar('--accent'), cssVar('--inari'), cssVar('--primary-dark'), cssVar('--accent-dark'), cssVar('--danger')];
  const methodLabels = {
    efectivo: 'Efectivo',
    punto: 'Punto',
    pago_movil: 'Pago M\u00f3vil',
    mixto: 'Mixto',
    credito: 'Cr\u00e9dito',
    efectivo_usd: 'Efectivo USD'
  };

  const slices = [];
  if (paymentMethods && paymentMethods.length) {
    paymentMethods.forEach(function(m, i) {
      if (m.total_usd > 0) {
        slices.push({ label: methodLabels[m.metodo] || m.metodo, value: m.total_usd, color: pieColors[i % pieColors.length] });
      }
    });
  }
  if (slices.length === 0) {
    slices.push({ label: 'Sin datos', value: 1, color: cssVar('--text-light') });
  }

  const total = slices.reduce(function(s, sl) { return s + sl.value; }, 0);

  const legendW = isMobile ? 90 : 130;
  const chartW = w - legendW;
  const cx = chartW / 2;
  const cy = h / 2;
  const radius = Math.min(chartW, h) / 2 - (isMobile ? 20 : 40);

  let acc = 0;
  const angles = slices.map(function(sl) {
    const a = (sl.value / total) * Math.PI * 2;
    const seg = { start: acc, end: acc + a, slice: sl };
    acc += a;
    return seg;
  });

  const duration = CHART.PIE_ANIM_MS;
  let startTime = null;

  function drawBase(ease) {
    ctx.clearRect(0, 0, w, h);

    for (let si = 0; si < angles.length; si++) {
      const seg = angles[si];
      const sweep = (seg.end - seg.start) * ease;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, seg.start, seg.start + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.slice.color;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = cardColor;
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold ' + (isMobile ? '13px' : '16px') + ' sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + total.toFixed(1), cx, cy - 6);
    ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
    ctx.fillStyle = textLight;
    ctx.fillText(periodLabels[piePeriod] || 'Total', cx, cy + 14);

    const legX = chartW + (isMobile ? 6 : 12);
    let legY = 24;
    const sq = isMobile ? 10 : 12;
    for (let li = 0; li < slices.length; li++) {
      ctx.fillStyle = slices[li].color;
      ctx.fillRect(legX, legY, sq, sq);
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '10px' : '12px') + ' sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(slices[li].label, legX + sq + (isMobile ? 4 : 6), legY);
      const pct = ((slices[li].value / total) * 100).toFixed(1);
      ctx.fillStyle = textLight;
      ctx.font = (isMobile ? '8px' : '11px') + ' sans-serif';
      ctx.fillText('$' + slices[li].value.toFixed(1) + ' (' + pct + '%)', legX + sq + (isMobile ? 4 : 6), legY + sq + 2);
      legY += (isMobile ? 34 : 50);
    }
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachPieHover(canvas, angles, cx, cy, radius, dpr); }
  }
  requestAnimationFrame(animate);
}

function attachChartHover(canvas, bars, dpr) {
  function onMove(e) {
    const cr = canvas.getBoundingClientRect();
    const mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr;
    const my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr;
    for (let i = 0; i < bars.length; i++) {
      if (mx >= bars[i].x && mx <= bars[i].x + bars[i].w && my >= bars[i].y && my <= bars[i].y + bars[i].h) {
        showChartTooltip(e.clientX, e.clientY, bars[i].period + ' - ' + bars[i].metric);
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    hideChartTooltip();
    canvas.style.cursor = 'default';
  }
  function onOut() { hideChartTooltip(); canvas.style.cursor = 'default'; }
  function onTouch(e) {
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

function attachPieHover(canvas, angles, cx, cy, radius, dpr) {
  function onMove(e) {
    const cr = canvas.getBoundingClientRect();
    const mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr - cx;
    const my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    const innerR = radius * 0.45;
    if (dist < innerR || dist > radius) {
      hideChartTooltip();
      canvas.style.cursor = 'default';
      return;
    }
    let angle = Math.atan2(my, mx);
    if (angle < 0) angle += Math.PI * 2;
    for (let i = 0; i < angles.length; i++) {
      if (angle >= angles[i].start && angle < angles[i].end) {
        showChartTooltip(e.clientX, e.clientY, angles[i].slice.label + ' - $' + angles[i].slice.value.toFixed(1));
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    hideChartTooltip();
    canvas.style.cursor = 'default';
  }
  function onOut() { hideChartTooltip(); canvas.style.cursor = 'default'; }
  function onTouch(e) {
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

/* ========== PROFIT LINE CHART ========== */
async function drawProfitLineChart(body) {
  var canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var container = canvas.parentElement;
  var rect = container.getBoundingClientRect();
  var w = rect.width || CHART.CANVAS_MAX_WIDTH;
  var maxW = CHART.CANVAS_MAX_WIDTH;
  if (w > maxW) w = maxW;
  var h = CHART.BAR_HEIGHT;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var now = new Date();
  var endDate = now.toISOString().slice(0, 10);
  var startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    var points = await invoke('get_profit_series', {
      filter: { start_date: startDate, end_date: endDate }
    });
    if (!points || points.length < 2) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#999';
      ctx.textAlign = 'center';
      ctx.fillText('Datos insuficientes para el gr\u00e1fico de ganancias', w / 2, h / 2);
      return;
    }

    var css = getComputedStyle(document.documentElement);
    var textColor = css.getPropertyValue('--text').trim() || '#e0e0e0';
    var mutedColor = css.getPropertyValue('--text-secondary').trim() || '#888';
    var lineColor = css.getPropertyValue('--primary').trim() || '#7E6B90';
    var fillColor = lineColor + '33';
    var gridColor = css.getPropertyValue('--border').trim() || '#3A3450';

    var padding = { top: 20, right: 20, bottom: 40, left: 60 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var maxVal = 0;
    var minVal = Infinity;
    points.forEach(function(p) {
      if (p.profit_usd > maxVal) maxVal = p.profit_usd;
      if (p.profit_usd < minVal) minVal = p.profit_usd;
    });
    var range = maxVal - minVal || 1;
    var yPad = range * 0.1;
    maxVal += yPad;
    minVal = Math.max(0, minVal - yPad);
    range = maxVal - minVal || 1;

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    var gridLines = 5;
    for (var i = 0; i <= gridLines; i++) {
      var y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      var val = maxVal - (range / gridLines) * i;
      ctx.fillStyle = mutedColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + val.toFixed(1), padding.left - 5, y + 4);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    var step = Math.max(1, Math.floor(points.length / 10));
    points.forEach(function(p, idx) {
      if (idx % step !== 0 && idx !== points.length - 1) return;
      var x = padding.left + (idx / (points.length - 1)) * chartW;
      ctx.fillStyle = mutedColor;
      ctx.fillText(p.date.slice(5), x, h - padding.bottom + 15);
    });

    // Area fill
    ctx.beginPath();
    var firstX = padding.left;
    var firstY = padding.top + chartH - ((points[0].profit_usd - minVal) / range) * chartH;
    ctx.moveTo(firstX, padding.top + chartH);
    ctx.lineTo(firstX, firstY);
    for (var j = 1; j < points.length; j++) {
      var x = padding.left + (j / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((points[j].profit_usd - minVal) / range) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (var k = 0; k < points.length; k++) {
      var x = padding.left + (k / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((points[k].profit_usd - minVal) / range) * chartH;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    points.forEach(function(p, idx) {
      var x = padding.left + (idx / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((p.profit_usd - minVal) / range) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = mutedColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u00daltimos ' + points.length + ' d\u00edas', w / 2, 14);

    // Hover tooltips
    var profitPoints = points;
    var hoverData = {
      padding: padding, chartW: chartW, chartH: chartH,
      minVal: minVal, range: range, points: points
    };
    attachLineHover(canvas, dpr, hoverData);

  } catch (e) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = cssVar('--danger');
    ctx.textAlign = 'center';
    ctx.fillText('Error: ' + e.message || e, w / 2, h / 2);
  }
}

function attachLineHover(canvas, dpr, data) {
  function onMove(e) {
    var cr = canvas.getBoundingClientRect();
    var mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr;
    for (var i = 0; i < data.points.length; i++) {
      var x = data.padding.left + (i / (data.points.length - 1)) * data.chartW;
      if (Math.abs(mx - x) < 10) {
        var p = data.points[i];
        showChartTooltip(e.clientX, e.clientY,
          p.date + ' | Ingreso: $' + p.revenue_usd.toFixed(2) +
          ' | Costo: $' + p.cost_usd.toFixed(2) +
          ' | Ganancia: $' + p.profit_usd.toFixed(2));
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    hideChartTooltip();
    canvas.style.cursor = 'default';
  }
  function onOut() { hideChartTooltip(); canvas.style.cursor = 'default'; }
  function onTouch(e) {
    var t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

/* ========== PRODUCT HISTORY ========== */
async function showProductHistory(codigo, nombre) {
  const title = qs(SEL.productHistoryTitle);
  const tbody = qs(SEL.productHistoryBody);
  if (title) title.textContent = 'Producto: ' + escapeHtml(nombre) + ' (C\u00f3digo: ' + escapeHtml(codigo) + ')';
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    showModal(qs(SEL.productHistoryModal));
    try {
      const items = await invoke('get_product_history', { productoCodigo: codigo });
      tbody.innerHTML = '';
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">' + emptyState('<i class="nf nf-fa-history"></i>', 'Sin ventas registradas', 'El historial de movimientos aparecer\u00e1 aqu\u00ed') + '</td></tr>';
      } else {
        items.forEach(function(item) {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + item.venta_id + '</td><td>' + escapeHtml(item.fecha_hora) + '</td><td>' + item.cantidad + '</td><td>' + formatUSD(item.precio_usd_unitario) + '</td><td>' + formatUSD(item.subtotal_usd) + '</td><td>' + escapeHtml(item.metodo_pago) + '</td><td>' + escapeHtml(item.username) + '</td>';
          tbody.appendChild(tr);
        });
      }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7">Error: ' + escapeHtml(e) + '</td></tr>'; }
  } else {
    showModal(qs(SEL.productHistoryModal));
  }
}

/* ========== EXPORT REPORT ========== */
async function handleExportReport() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  try {
    const b64 = await invoke('export_report_xlsx', { filter: buildReportFilter(false) });
    var url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_ventas_' + startDate + '_' + endDate + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Reporte exportado');
  } catch (e) { showToast('Error al exportar: ' + e, 'error'); }
}

async function handleExportReportPdf() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  try {
    const b64 = await invoke('export_report_pdf', { filter: buildReportFilter(false) });
    var url = 'data:application/pdf;base64,' + b64;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_ventas_' + startDate + '_' + endDate + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Reporte PDF exportado');
  } catch (e) { showToast('Error al exportar PDF: ' + e, 'error'); }
}

/* ========== VOID SALE ========== */
async function handleVoidSale(ventaId, btn) {
  if (btn) btn.disabled = true;
  try {
    const ok = await confirmModal('\u00bfEst\u00e1 seguro de anular la venta #' + ventaId + '? Se devolver\u00e1 el stock al inventario.', 'Anular Venta', 'S\u00ed, anular');
    if (!ok) return;
    const nota = await promptModal('Indique el motivo de la anulaci\u00f3n de la venta #' + ventaId + ':', 'Motivo de Anulaci\u00f3n', 'Anular venta');
    if (!nota) return;
    const msg = await invoke('void_sale', { ventaId, nota });
    showToast(msg);
    playSound('remove');
    haptic([50, 50, 50]);
    if (qs(SEL.viewCashier)?.classList.contains('active')) loadDailySummary();
    if (qs(SEL.viewReports)?.classList.contains('active')) loadReportsAndTopProducts();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

/* ========== SALE DETAIL MODAL + PARTIAL VOID ========== */
async function showSaleDetail(ventaId, btn) {
  try {
    const detalles = await invoke('get_sale_detail', { ventaId });
    qs(SEL.saleDetailId).textContent = ventaId;
    const notaWrap = qs(SEL.saleDetailNotaWrap);
    const notaEl = qs(SEL.saleDetailNota);
    if (btn) {
      qs(SEL.saleDetailTotal).textContent = formatUSD(parseFloat(btn.dataset.total));
      qs(SEL.saleDetailMetodo).textContent = btn.dataset.metodo;
      qs(SEL.saleDetailUsuario).textContent = btn.dataset.usuario;
      qs(SEL.saleDetailFecha).textContent = btn.dataset.fecha;
      const nota = btn.dataset.nota || '';
      if (nota) {
        notaEl.textContent = nota;
        notaWrap.style.display = 'block';
      } else {
        notaEl.textContent = '';
        notaWrap.style.display = 'none';
      }
      const obsEl = qs(SEL.saleDetailObs);
      const obsWrap = qs(SEL.saleDetailObsWrap);
      const obs = btn.dataset.obs || '';
      if (obs) {
        obsEl.textContent = obs;
        obsWrap.style.display = 'block';
      } else {
        obsEl.textContent = '';
        obsWrap.style.display = 'none';
      }
    }
    const list = qs(SEL.saleDetailList);
    list.innerHTML = '';
    if (detalles.length === 0) {
      list.innerHTML = emptyState('<i class="nf nf-fa-receipt"></i>', 'No hay detalles', 'Los productos de la venta aparecer\u00e1n aqu\u00ed');
      showModal(qs(SEL.saleDetailModal));
      return;
    }
    const allVoided = detalles.every(function(d) { return d.anulado; });
    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = '<thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Estado</th><th>Acci\u00f3n</th></tr></thead>';
    const tbody = document.createElement('tbody');
    detalles.forEach(function(d) {
      const tr = document.createElement('tr');
      if (d.anulado) tr.style.textDecoration = 'line-through';
      const voidBtn = d.anulado
        ? ''
        : '<button class="btn btn-sm btn-danger void-item-btn" data-detalle-id="' + d.id + '" data-venta-id="' + ventaId + '" ' + (allVoided ? 'disabled' : '') + '>Anular</button>';
      const statusBadge = d.anulado
        ? '<span class="badge badge-danger">Anulado</span>'
        : '<span class="badge badge-success">Activo</span>';
      tr.innerHTML = '<td>' + escapeHtml(d.producto_nombre || d.producto_codigo) + '</td><td>' + d.cantidad + '</td><td>' + formatUSD(d.precio_usd_unitario) + '</td><td>' + formatUSD(d.subtotal_usd) + '</td><td>' + statusBadge + '</td><td>' + voidBtn + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    list.appendChild(table);
    qs(SEL.saleDetailShareBtn).style.display = 'inline-flex';
    qs(SEL.saleDetailShareBtn).dataset.ventaId = ventaId;
    showModal(qs(SEL.saleDetailModal));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleVoidItem(ventaId, detalleId) {
  const ok = await confirmModal('\u00bfAnular este \u00edtem de la venta? Se devolver\u00e1 el stock al inventario.', 'Anular \u00cdtem', 'S\u00ed, anular');
  if (!ok) return;
  const nota = await promptModal('Indique el motivo de la anulaci\u00f3n de este \u00edtem:', 'Motivo de Anulaci\u00f3n', 'Anular \u00edtem');
  if (!nota) return;
  try {
    await invoke('void_sale_items', { request: { venta_id: ventaId, detalle_ids: [detalleId], nota } });
    showToast('Item anulado correctamente');
    playSound('remove');
    showSaleDetail(ventaId);
    if (qs(SEL.viewCashier)?.classList.contains('active')) loadDailySummary();
    if (qs(SEL.viewReports)?.classList.contains('active')) loadReportsAndTopProducts();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}
