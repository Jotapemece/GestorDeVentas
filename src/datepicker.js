/* ========== CUSTOM DATEPICKER (reutilizable) ==========
 * Convierte inputs tipo date en un campo con calendario propio que:
 * - se cierra al hacer clic fuera (los type="date" nativos no lo hacen),
 * - navega meses (‹ ›) y permite ir a "Hoy",
 * - escribe el valor como YYYY-MM-DD y dispara 'change' (compat con listeners
 *   existentes de reportes/auditoría).
 * Uso: initDatePicker(inputEl, { min, max }). */

let _activeDatePicker = null;

function datePickerEl(input) {
  let wrap = input.parentElement;
  if (!wrap.classList.contains('dp-wrap')) {
    wrap = document.createElement('div');
    wrap.className = 'dp-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
  }
  let pop = wrap.querySelector('.dp-popup');
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'dp-popup hidden';
    pop.innerHTML =
      '<div class="dp-head">' +
      '<button type="button" class="dp-nav" data-dp="prev" title="Mes anterior"><i class="nf nf-fa-chevron_left"></i></button>' +
      '<span class="dp-month-label"></span>' +
      '<button type="button" class="dp-nav" data-dp="next" title="Mes siguiente"><i class="nf nf-fa-chevron_right"></i></button>' +
      '</div>' +
      '<div class="dp-weekdays"></div>' +
      '<div class="dp-grid"></div>' +
      '<div class="dp-foot">' +
      '<button type="button" class="btn btn-xs btn-outline dp-today" title="Ir a hoy"><i class="nf nf-fa-calendar_day"></i> Hoy</button>' +
      '<button type="button" class="btn btn-xs btn-outline dp-clear" title="Vaciar"><i class="nf nf-fa-eraser"></i> Limpiar</button>' +
      '</div>';
    wrap.appendChild(pop);
  }
  return { wrap, pop };
}

function dpToInputDate(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function dpParse(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
}

function buildDatePicker(input, opts) {
  const o = opts || {};
  if (!input || input.dataset.dpReady) return;
  input.dataset.dpReady = '1';
  // los inputs ya vienen como type="text" readonly (sin picker nativo);
  // el popup propio abre en focus/click.
  const { wrap, pop } = datePickerEl(input);
  wrap.classList.add('dp-wrap-ready');

  let viewYear = 0, viewMonth = 0, value = input.value;

  function clampToBounds(dateStr) {
    if (!dateStr) return dateStr;
    if (o.min && dateStr < o.min) return o.min;
    if (o.max && dateStr > o.max) return o.max;
    return dateStr;
  }
  function setValue(dateStr, fire) {
    const clamped = clampToBounds(dateStr || '');
    value = clamped;
    if (fire) {
      input.value = clamped;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function openStatics() {
    const now = new Date();
    const sel = dpParse(input.value);
    viewYear = sel ? sel.year : now.getFullYear();
    viewMonth = sel ? sel.month : now.getMonth() + 1;
  }
  function render() {
    const today = new Date();
    const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const firstDow = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // lun=0
    const sel = dpParse(input.value);

    const wdContainer = pop.querySelector('.dp-weekdays');
    wdContainer.innerHTML = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
      .map(function(n) { return '<span class="dp-wd">' + n + '</span>'; })
      .join('');

    const label = new Date(viewYear, viewMonth - 1, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    pop.querySelector('.dp-month-label').textContent = label;

    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<span class="dp-cell dp-empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const fechaStr = dpToInputDate(viewYear, viewMonth, d);
      const isToday = viewYear === ty && viewMonth === tm && d === td;
      const isSel = sel && viewYear === sel.year && viewMonth === sel.month && d === sel.day;
      let cls = 'dp-cell';
      if (isToday) cls += ' dp-today-cell';
      if (isSel) cls += ' dp-selected';
      let disabled = false;
      if ((o.min && fechaStr < o.min) || (o.max && fechaStr > o.max)) {
        cls += ' dp-disabled';
        disabled = true;
      }
      html += '<span class="' + cls + '" data-dp-day="' + fechaStr + '"' + (disabled ? ' aria-disabled="true"' : '') + '>' + d + '</span>';
    }
    pop.querySelector('.dp-grid').innerHTML = html;
  }
  function show() {
    if (_activeDatePicker && _activeDatePicker !== wrap) {
      const prev = _activeDatePicker.querySelector('.dp-popup');
      if (prev) prev.classList.add('hidden');
    }
    openStatics();
    render();
    pop.classList.remove('hidden');
    _activeDatePicker = wrap;
  }
  function hide() {
    pop.classList.add('hidden');
    if (_activeDatePicker === wrap) _activeDatePicker = null;
  }
  function toggle() {
    pop.classList.contains('hidden') ? show() : hide();
  }
  function move(delta) {
    viewMonth += delta;
    if (viewMonth < 1) { viewMonth = 12; viewYear--; }
    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
    render();
  }

  let openedByFocus = false;
  input.addEventListener('focus', function() {
    // El popup abre por focus (tab o el primer clic sobre el input); se marca
    // para que el click de ese mismo gesto no lo cierre al instante (parpadeo).
    openedByFocus = true;
    show();
  });
  input.addEventListener('click', function() {
    if (openedByFocus) { openedByFocus = false; return; }
    toggle();
  });
  input.addEventListener('input', function() { value = input.value; });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { e.stopPropagation(); hide(); }
    if (e.key === 'Tab') hide();
  });

  pop.querySelector('.dp-nav[data-dp="prev"]').addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); move(-1); });
  pop.querySelector('.dp-nav[data-dp="next"]').addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); move(1); });
  pop.querySelector('.dp-today').addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    const now = new Date();
    setValue(dpToInputDate(now.getFullYear(), now.getMonth() + 1, now.getDate()), true);
    hide();
  });
  pop.querySelector('.dp-clear').addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    setValue('', true);
    hide();
  });
  pop.querySelector('.dp-grid').addEventListener('click', function(e) {
    const cell = e.target.closest('[data-dp-day]');
    if (!cell || cell.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault(); e.stopPropagation();
    setValue(cell.dataset.dpDay, true);
    hide();
  });

  // click fuera cierra
  input.addEventListener('blur', function() {
    setTimeout(hide, 120);
  });
  pop.addEventListener('mousedown', function(e) { e.preventDefault(); });
}

function initDatePickers(selectors) {
  (selectors || ['#report-start-date', '#report-end-date', '#audit-start-date', '#audit-end-date', '#download-preview-ventas-desde', '#download-preview-ventas-hasta']).forEach(function(sel) {
    const el = qs(sel);
    if (el) buildDatePicker(el);
  });
  document.addEventListener('click', function(e) {
    if (!_activeDatePicker) return;
    const inside = _activeDatePicker.contains(e.target);
    if (!inside) {
      const pop = _activeDatePicker.querySelector('.dp-popup');
      if (pop) pop.classList.add('hidden');
      _activeDatePicker = null;
    }
  });
}