/* ========== SISTEMA DE RECORDATORIOS ========== */
/* Recordatorios locales que suenan cuando el usuario está inactivo.
   Almacenados en localStorage (no se sincronizan entre dispositivos). */

const REMINDERS_KEY = 'reminders';
const REMINDER_ACK_PREFIX = 'reminder_ack_';
const REMINDER_SNOOZE_PREFIX = 'reminder_snooze_';
let _reminderCheckInterval = null;
let _alarmActive = false;
let _alarmIntervalId = null;
let _alarmRafId = null;
let _currentAlarmCtx = null;
let _currentAlarmReminder = null;

/* ========== SONIDOS (distintos entre sí) ========== */
const REMINDER_SOUNDS = {
  chime:  { name: 'Campana',        type: 'sine',     freqs: [880, 1100, 1320], dur: 0.2,  desc: 'Agudo ascendente' },
  bell:   { name: 'Campana profunda', type: 'sine',   freqs: [185],             dur: 2.0,  desc: 'Grave con sustain' },
  gentle: { name: 'Bip bip',        type: 'square',   freqs: [440, 880],        dur: 0.12, desc: 'Robótico seco' },
  warm:   { name: 'Acorde',         type: 'triangle', freqs: [262, 330, 392],   dur: 1.0,  desc: 'Cálido y suave' },
  calm:   { name: 'Melodía',        type: 'sine',     freqs: [659, 523, 392, 523], dur: 0.2, desc: '4 notas suaves' },
};

function playReminderSound(soundId, volume) {
  const sound = REMINDER_SOUNDS[soundId] || REMINDER_SOUNDS.chime;
  const vol = (volume || 0.7) * 0.35;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    _currentAlarmCtx = ctx;
    const now = ctx.currentTime;
    const isChord = soundId === 'warm';
    if (isChord) {
      sound.freqs.forEach(function(f) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = sound.type;
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol / sound.freqs.length, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + sound.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sound.dur);
      });
    } else {
      sound.freqs.forEach(function(f, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = sound.type;
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + sound.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * (sound.dur + 0.05));
        osc.stop(now + i * (sound.dur + 0.05) + sound.dur);
      });
    }
  } catch (_) {}
}

function stopReminderSound() {
  if (_currentAlarmCtx) {
    try { _currentAlarmCtx.close(); } catch (_) {}
    _currentAlarmCtx = null;
  }
  if (_alarmIntervalId) {
    clearInterval(_alarmIntervalId);
    _alarmIntervalId = null;
  }
  if (_alarmRafId) {
    cancelAnimationFrame(_alarmRafId);
    _alarmRafId = null;
  }
  _alarmActive = false;
  _currentAlarmReminder = null;
}

/* ========== ALMACENAMIENTO ========== */
function getReminders() {
  try { return JSON.parse(localStorage.getItem(REMINDERS_KEY)) || []; }
  catch (_) { return []; }
}

function saveReminders(list) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
}

function isAckedToday(reminderId) {
  var today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(REMINDER_ACK_PREFIX + reminderId + '_' + today) === '1';
}

function ackToday(reminderId) {
  var today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(REMINDER_ACK_PREFIX + reminderId + '_' + today, '1');
}

function isSnoozed(reminderId) {
  var val = localStorage.getItem(REMINDER_SNOOZE_PREFIX + reminderId);
  if (!val) return false;
  return Date.now() < parseInt(val, 10);
}

function snoozeAlarm(reminderId) {
  localStorage.setItem(REMINDER_SNOOZE_PREFIX + reminderId, String(Date.now() + 600000));
}

function generateReminderId() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ========== CUSTOM-SELECT HELPERS ========== */
function initCustomSelectSingle(wrapSel, btnSel, menuSel, on_change) {
  var wrap = qs(wrapSel);
  var btn = qs(btnSel);
  var menu = qs(menuSel);
  if (!wrap || !btn || !menu) return;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var wasOpen = wrap.classList.contains('open');
    closeAllCustomSelects();
    if (!wasOpen) wrap.classList.add('open');
  });

  menu.querySelectorAll('button').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      menu.querySelectorAll('button').forEach(function(b) { b.classList.remove('selected'); });
      item.classList.add('selected');
      btn.querySelector('.custom-select-value').textContent = item.textContent;
      wrap.classList.remove('open');
      if (on_change) on_change(item.dataset.value || item.dataset.day);
    });
  });
}

function initCustomSelectMulti(wrapSel, btnSel, menuSel, on_change) {
  var wrap = qs(wrapSel);
  var btn = qs(btnSel);
  var menu = qs(menuSel);
  if (!wrap || !btn || !menu) return;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var wasOpen = wrap.classList.contains('open');
    closeAllCustomSelects();
    if (!wasOpen) wrap.classList.add('open');
  });

  menu.querySelectorAll('button').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      item.classList.toggle('selected');
      var check = item.querySelector('.nf');
      if (check) check.style.display = item.classList.contains('selected') ? '' : 'none';
      updateDaysLabel();
      if (on_change) on_change(getSelectedDays());
    });
  });
}

function getSelectedDays() {
  var menu = qs(SEL.reminderDaysMenu);
  if (!menu) return [];
  var days = [];
  menu.querySelectorAll('button.selected').forEach(function(b) {
    days.push(parseInt(b.dataset.day, 10));
  });
  return days;
}

function setSelectedDays(days) {
  var menu = qs(SEL.reminderDaysMenu);
  if (!menu) return;
  menu.querySelectorAll('button').forEach(function(b) {
    var d = parseInt(b.dataset.day, 10);
    b.classList.toggle('selected', days.includes(d));
    var check = b.querySelector('.nf');
    if (check) check.style.display = days.includes(d) ? '' : 'none';
  });
  updateDaysLabel();
}

function updateDaysLabel() {
  var btn = qs(SEL.reminderDaysBtn);
  if (!btn) return;
  var days = getSelectedDays();
  var label = formatDays(days);
  btn.querySelector('.custom-select-value').textContent = label;
}

function getSelectedSound() {
  var menu = qs(SEL.reminderSoundMenu);
  if (!menu) return 'chime';
  var sel = menu.querySelector('button.selected');
  return sel ? sel.dataset.value : 'chime';
}

function setSelectedSound(soundId) {
  var menu = qs(SEL.reminderSoundMenu);
  var btn = qs(SEL.reminderSoundBtn);
  if (!menu || !btn) return;
  menu.querySelectorAll('button').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.value === soundId);
  });
  var sound = REMINDER_SOUNDS[soundId] || REMINDER_SOUNDS.chime;
  btn.querySelector('.custom-select-value').textContent = sound.name;
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select.open').forEach(function(w) {
    w.classList.remove('open');
  });
}

/* ========== UI: LISTA ========== */
function renderRemindersList() {
  var container = qs(SEL.remindersList);
  if (!container) return;
  var reminders = getReminders();
  if (reminders.length === 0) {
    container.innerHTML = '<div class="reminder-empty">No hay recordatorios configurados</div>';
    return;
  }
  container.innerHTML = reminders.map(function(r) {
    var time = String(r.hour).padStart(2, '0') + ':' + String(r.minute).padStart(2, '0');
    var soundName = (REMINDER_SOUNDS[r.sound] || REMINDER_SOUNDS.chime).name;
    var daysText = formatDays(r.days);
    return '<div class="reminder-list-item" data-id="' + r.id + '">' +
      '<label class="toggle-switch reminder-toggle">' +
        '<input type="checkbox" ' + (r.enabled ? 'checked' : '') + ' data-action="toggle-reminder">' +
        '<span class="toggle-slider"></span>' +
      '</label>' +
      '<div class="reminder-info">' +
        '<span class="reminder-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="reminder-meta">' + time + ' · ' + escapeHtml(soundName) + ' · ' + daysText + '</span>' +
      '</div>' +
      '<div class="reminder-actions">' +
        '<button class="btn btn-sm btn-outline" data-action="edit-reminder" title="Editar"><i class="nf nf-fa-pencil"></i></button>' +
        '<button class="btn btn-sm btn-outline btn-danger" data-action="delete-reminder" title="Eliminar"><i class="nf nf-fa-trash"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function formatDays(days) {
  if (!days || days.length === 7) return 'Todos los días';
  if (days.length === 0) return 'Nunca';
  var fullNames = {1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo'};
  if (days.length === 1) return fullNames[days[0]];
  if (days.length === 2) return fullNames[days[0]] + ' y ' + fullNames[days[1]];
  return days.map(function(d) { return fullNames[d]; }).join(', ');
}

/* ========== UI: MODAL DE RECORDATORIO ========== */
function openReminderModal(reminder) {
  var isEdit = !!reminder;
  var modal = qs(SEL.reminderModal);
  if (!modal) return;

  qs(SEL.reminderName).value = isEdit ? reminder.name : '';
  qs(SEL.reminderTime).value = isEdit
    ? String(reminder.hour).padStart(2, '0') + ':' + String(reminder.minute).padStart(2, '0')
    : '19:30';
  qs(SEL.reminderEnabled).checked = isEdit ? reminder.enabled : true;

  var volRange = qs(SEL.reminderVolume);
  if (volRange) volRange.value = isEdit ? Math.round(reminder.volume * 100) : 70;
  var volLabel = qs(SEL.reminderVolumeLabel);
  if (volLabel) volLabel.textContent = (isEdit ? Math.round(reminder.volume * 100) : 70) + '%';

  var days = isEdit && reminder.days ? reminder.days : [1,2,3,4,5,6,7];
  setSelectedDays(days);

  var sound = isEdit ? (reminder.sound || 'chime') : 'chime';
  setSelectedSound(sound);

  modal.dataset.editId = isEdit ? reminder.id : '';
  showModal(modal);
}

function saveReminderFromModal() {
  var modal = qs(SEL.reminderModal);
  var name = qs(SEL.reminderName).value.trim();
  var time = qs(SEL.reminderTime).value;
  var enabled = qs(SEL.reminderEnabled).checked;
  var sound = getSelectedSound();
  var volume = parseInt(qs(SEL.reminderVolume).value) / 100;

  if (!name) { showToast('Escribe un nombre', 'error'); return; }
  if (!time) { showToast('Selecciona una hora', 'error'); return; }

  var parts = time.split(':').map(Number);
  var h = parts[0], m = parts[1];
  var days = getSelectedDays();
  if (days.length === 0) { showToast('Selecciona al menos un día', 'error'); return; }

  var reminders = getReminders();
  var editId = modal.dataset.editId;

  if (editId) {
    var idx = reminders.findIndex(function(r) { return r.id === editId; });
    if (idx >= 0) {
      reminders[idx] = Object.assign({}, reminders[idx], { name: name, hour: h, minute: m, enabled: enabled, sound: sound, volume: volume, days: days });
    }
  } else {
    reminders.push({ id: generateReminderId(), name: name, hour: h, minute: m, enabled: enabled, sound: sound, volume: volume, days: days });
  }

  saveReminders(reminders);
  renderRemindersList();
  closeModal(modal);
  showToast(editId ? 'Recordatorio actualizado' : 'Recordatorio creado');
}

function deleteReminder(id) {
  var reminders = getReminders().filter(function(r) { return r.id !== id; });
  saveReminders(reminders);
  renderRemindersList();
  showToast('Recordatorio eliminado');
}

/* ========== ALARMA: RELOJ SVG ========== */
function updateClockHands() {
  var handMin = qs(SEL.alarmHandMin);
  var handHr = qs(SEL.alarmHandHr);
  if (!handMin || !handHr) return;
  var now = new Date();
  var sec = now.getSeconds();
  var min = now.getMinutes() + sec / 60;
  var hr = (now.getHours() % 12) + min / 60;
  var minDeg = min * 6;
  var hrDeg = hr * 30;
  handMin.setAttribute('transform', 'rotate(' + minDeg + ' 50 50)');
  handHr.setAttribute('transform', 'rotate(' + hrDeg + ' 50 50)');
  _alarmRafId = requestAnimationFrame(updateClockHands);
}

/* ========== CHECK DE ALARMA ========== */
function checkReminders() {
  var now = new Date();
  var currentHour = now.getHours();
  var currentMinute = now.getMinutes();
  var currentDay = now.getDay() === 0 ? 7 : now.getDay();
  var reminders = getReminders();

  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];
    if (!r.enabled) continue;
    if (!r.days || !r.days.includes(currentDay)) continue;
    if (isAckedToday(r.id)) continue;
    if (isSnoozed(r.id)) continue;

    var reminderMinutes = r.hour * 60 + r.minute;
    var nowMinutes = currentHour * 60 + currentMinute;

    if (nowMinutes >= reminderMinutes) {
      var inactiveMs = Date.now() - (window.lastActivityAt || Date.now());
      var inactiveMinutes = inactiveMs / 60000;

      if (inactiveMinutes >= 5) {
        startAlarm(r);
        return;
      } else {
        showReminderToast(r);
        ackToday(r.id);
        return;
      }
    }
  }
}

function showReminderToast(reminder) {
  var time = String(reminder.hour).padStart(2, '0') + ':' + String(reminder.minute).padStart(2, '0');
  showToast('\u23F0 ' + escapeHtml(reminder.name) + ' (' + time + ')', 'info', 8000);
}

/* ========== ALARMA: MODAL ========== */
function startAlarm(reminder) {
  if (_alarmActive) return;
  _alarmActive = true;
  _currentAlarmReminder = reminder;

  var modal = qs(SEL.reminderAlarmModal);
  var timeText = qs(SEL.alarmTimeText);
  var nameText = qs(SEL.alarmNameText);

  var timeStr = String(reminder.hour).padStart(2, '0') + ':' + String(reminder.minute).padStart(2, '0');
  if (timeText) timeText.textContent = timeStr;
  if (nameText) nameText.textContent = reminder.name;

  if (modal) showModal(modal);
  updateClockHands();

  playReminderSound(reminder.sound, reminder.volume);

  _alarmIntervalId = setInterval(function() {
    playReminderSound(reminder.sound, reminder.volume);
    if (IS_ANDROID) {
      try { window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke('vibrate', { ms: 300 }); } catch (_) {}
    }
  }, 3000);
}

function dismissAlarm() {
  stopReminderSound();
  var modal = qs(SEL.reminderAlarmModal);
  if (modal) closeModal(modal);
}

function snoozeCurrentAlarm() {
  if (!_currentAlarmReminder) return;
  snoozeAlarm(_currentAlarmReminder.id);
  stopReminderSound();
  var modal = qs(SEL.reminderAlarmModal);
  if (modal) closeModal(modal);
  showToast('Recordatorio postergado 10 minutos', 'info');
}

/* ========== INICIALIZACIÓN ========== */
function initReminders() {
  var reminders = getReminders();
  if (reminders.length === 0) {
    saveReminders([{
      id: 'r_default', name: 'Cerrar el punto', hour: 19, minute: 30,
      enabled: true, sound: 'chime', volume: 0.7, days: [1,2,3,4,5,6,7],
    }]);
  }

  renderRemindersList();

  // Custom-select: sonido (single)
  initCustomSelectSingle(SEL.reminderSoundWrap, SEL.reminderSoundBtn, SEL.reminderSoundMenu);

  // Custom-select: días (multi)
  initCustomSelectMulti(SEL.reminderDaysWrap, SEL.reminderDaysBtn, SEL.reminderDaysMenu);

  // Botones
  var addBtn = qs(SEL.addReminderBtn);
  if (addBtn) addBtn.addEventListener('click', function() { openReminderModal(null); });

  var saveBtn = qs(SEL.reminderSave);
  if (saveBtn) saveBtn.addEventListener('click', saveReminderFromModal);

  var cancelBtn = qs(SEL.reminderCancel);
  if (cancelBtn) cancelBtn.addEventListener('click', function() { closeModal(qs(SEL.reminderModal)); });

  // Alarm modal buttons
  var dismissBtn = qs(SEL.alarmDismissBtn);
  if (dismissBtn) dismissBtn.addEventListener('click', function() {
    if (_currentAlarmReminder) ackToday(_currentAlarmReminder.id);
    dismissAlarm();
  });

  var snoozeBtn = qs(SEL.alarmSnoozeBtn);
  if (snoozeBtn) snoozeBtn.addEventListener('click', snoozeCurrentAlarm);

  // Preview de sonido
  var previewBtn = qs(SEL.reminderSoundPreview);
  if (previewBtn) previewBtn.addEventListener('click', function() {
    var soundId = getSelectedSound();
    var vol = parseInt(qs(SEL.reminderVolume).value || '70') / 100;
    playReminderSound(soundId, vol);
  });

  // Volumen
  var volRange = qs(SEL.reminderVolume);
  if (volRange) volRange.addEventListener('input', function() {
    var volEl = qs(SEL.reminderVolumeLabel);
    if (volEl) volEl.textContent = this.value + '%';
  });

  // Lista delegación
  var list = qs(SEL.remindersList);
  if (list) {
    list.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var item = target.closest('.reminder-list-item');
      var id = item && item.dataset.id;
      var action = target.dataset.action;
      if (action === 'edit-reminder') {
        var reminders = getReminders();
        var r = reminders.find(function(x) { return x.id === id; });
        if (r) openReminderModal(r);
      } else if (action === 'delete-reminder') {
        if (confirm('\u00BFEliminar este recordatorio?')) deleteReminder(id);
      }
    });
    list.addEventListener('change', function(e) {
      if (e.target.dataset.action === 'toggle-reminder') {
        var item = e.target.closest('.reminder-list-item');
        var id = item && item.dataset.id;
        var reminders = getReminders();
        var r = reminders.find(function(x) { return x.id === id; });
        if (r) { r.enabled = e.target.checked; saveReminders(reminders); renderRemindersList(); }
      }
    });
  }

  // Cerrar custom-selects al hacer click fuera
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select')) closeAllCustomSelects();
  });

  // Check interval
  if (_reminderCheckInterval) clearInterval(_reminderCheckInterval);
  _reminderCheckInterval = setInterval(checkReminders, 30000);
  checkReminders();
}

function stopReminders() {
  if (_reminderCheckInterval) { clearInterval(_reminderCheckInterval); _reminderCheckInterval = null; }
  stopReminderSound();
  var modal = qs(SEL.reminderAlarmModal);
  if (modal) closeModal(modal);
}
