/**
 * BRUTELOG — Frontend Script
 * Vanilla JS, no frameworks
 */

'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = window.BRUTELOG_API || 'https://your-backend.onrender.com';

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const state = {
  selectedDate: todayStr(),      // 'YYYY-MM-DD'
  currentWeekOffset: 0,          // weeks relative to today
  entries: [],                   // entries for selected date
  entryDates: new Set(),         // dates that have entries (dot indicators)
  selectedCategory: 'PERSONAL',
  isModalOpen: false,
  isSubmitting: false,
};

/* ══════════════════════════════════════
   DATE HELPERS
══════════════════════════════════════ */
function todayStr() {
  return localDateStr(new Date());
}

function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDisplayDate(dateStr) {
  const date = parseLocalDate(dateStr);
  const today = parseLocalDate(todayStr());
  const yesterday = parseLocalDate(todayStr());
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = parseLocalDate(todayStr());
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === todayStr()) return 'TODAY';
  if (dateStr === localDateStr(yesterday)) return 'YESTERDAY';
  if (dateStr === localDateStr(tomorrow)) return 'TOMORROW';

  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  }).toUpperCase().replace(',', '');
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

function getDayAbbrev(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/* ══════════════════════════════════════
   API
══════════════════════════════════════ */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchEntries(date) {
  return apiFetch(`/entries?date=${date}`);
}

async function createEntry(payload) {
  return apiFetch('/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function deleteEntry(id) {
  return apiFetch(`/entries/${id}`, { method: 'DELETE' });
}

async function fetchEntryDates() {
  try {
    const data = await apiFetch('/entries/dates');
    state.entryDates = new Set(data.dates || []);
  } catch (_) {
    // non-critical
  }
}

/* ══════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════ */
const $ = id => document.getElementById(id);

const dom = {
  calendarStrip:     $('calendarStrip'),
  monthLabel:        $('monthLabel'),
  prevWeek:          $('prevWeek'),
  nextWeek:          $('nextWeek'),
  selectedDateLabel: $('selectedDateLabel'),
  entryCount:        $('entryCount'),
  entriesList:       $('entriesList'),
  loadingState:      $('loadingState'),
  emptyState:        $('emptyState'),
  errorState:        $('errorState'),
  errorMessage:      $('errorMessage'),
  retryBtn:          $('retryBtn'),
  emptyAddBtn:       $('emptyAddBtn'),
  fabBtn:            $('fabBtn'),
  modalOverlay:      $('modalOverlay'),
  modal:             $('modal'),
  modalClose:        $('modalClose'),
  cancelBtn:         $('cancelBtn'),
  submitBtn:         $('submitBtn'),
  submitLabel:       $('submitLabel'),
  submitSpinner:     $('submitSpinner'),
  entryTitle:        $('entryTitle'),
  entryDesc:         $('entryDesc'),
  entryDate:         $('entryDate'),
  entryTime:         $('entryTime'),
  charCount:         $('charCount'),
  todayBadge:        $('todayBadge'),
  toast:             $('toast'),
  titleError:        $('titleError'),
  dateError:         $('dateError'),
  timeError:         $('timeError'),
};

/* ══════════════════════════════════════
   CALENDAR RENDERING
══════════════════════════════════════ */
function renderCalendar() {
  const today = new Date();
  const baseDate = addDays(today, state.currentWeekOffset * 7);

  // Show a window of 21 days centred around the week offset
  const startDate = addDays(baseDate, -10);

  dom.monthLabel.textContent = formatMonthYear(baseDate);
  dom.calendarStrip.innerHTML = '';

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 21; i++) {
    const date = addDays(startDate, i);
    const dateStr = localDateStr(date);
    const isToday = dateStr === todayStr();
    const isSelected = dateStr === state.selectedDate;
    const hasEntries = state.entryDates.has(dateStr);

    const card = document.createElement('button');
    card.className = [
      'date-card',
      isToday    ? 'date-card--today' : '',
      isSelected ? 'date-card--selected' : '',
      hasEntries ? 'date-card--has-entries' : '',
    ].filter(Boolean).join(' ');
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(isSelected));
    card.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    card.dataset.date = dateStr;

    card.innerHTML = `
      <span class="date-card__day">${getDayAbbrev(date)}</span>
      <span class="date-card__num">${date.getDate()}</span>
      <span class="date-card__dot"></span>
    `;

    card.addEventListener('click', () => selectDate(dateStr));
    fragment.appendChild(card);
  }

  dom.calendarStrip.appendChild(fragment);

  // Scroll selected card into view
  requestAnimationFrame(() => {
    const selected = dom.calendarStrip.querySelector('.date-card--selected');
    if (selected) {
      selected.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    }
  });
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderCalendar();
  loadEntries(dateStr);
}

/* ══════════════════════════════════════
   ENTRIES RENDERING
══════════════════════════════════════ */
function showState(name) {
  dom.loadingState.hidden = name !== 'loading';
  dom.emptyState.hidden   = name !== 'empty';
  dom.errorState.hidden   = name !== 'error';
  dom.entriesList.hidden  = name !== 'entries';
}

async function loadEntries(date) {
  dom.selectedDateLabel.textContent = formatDisplayDate(date);
  showState('loading');

  try {
    const data = await fetchEntries(date);
    state.entries = data.entries || [];
    renderEntries();

    // Mark this date if it has entries
    if (state.entries.length > 0) {
      state.entryDates.add(date);
    } else {
      state.entryDates.delete(date);
    }
    renderCalendar(); // refresh dots
  } catch (err) {
    dom.errorMessage.textContent = err.message || 'COULD NOT REACH SERVER.';
    showState('error');
  }
}

function renderEntries() {
  const entries = state.entries;
  dom.entryCount.textContent = `${entries.length} ${entries.length === 1 ? 'ENTRY' : 'ENTRIES'}`;

  if (entries.length === 0) {
    showState('empty');
    return;
  }

  showState('entries');
  dom.entriesList.innerHTML = '';

  // Sort by time ascending
  const sorted = [...entries].sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });

  const fragment = document.createDocumentFragment();

  sorted.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'entry-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-cat', entry.category || '');

    const descHtml = entry.description
      ? `<p class="entry-card__desc">${escapeHtml(entry.description)}</p>`
      : '';

    const catClass = entry.category ? `cat--${entry.category}` : '';

    card.innerHTML = `
      <div class="entry-card__topbar">
        <h3 class="entry-card__title">${escapeHtml(entry.title)}</h3>
        <span class="entry-card__time">${formatTime(entry.time)}</span>
      </div>
      ${descHtml}
      <div class="entry-card__footer">
        ${entry.category ? `<span class="entry-card__cat ${catClass}">${entry.category}</span>` : ''}
        <button class="entry-card__delete" data-id="${entry.id}" aria-label="Delete entry">DEL</button>
      </div>
    `;

    card.querySelector('.entry-card__delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDeleteEntry(entry.id);
    });

    fragment.appendChild(card);
  });

  dom.entriesList.appendChild(fragment);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

async function handleDeleteEntry(id) {
  try {
    await deleteEntry(id);
    state.entries = state.entries.filter(e => e.id !== id);
    renderEntries();
    if (state.entries.length === 0) state.entryDates.delete(state.selectedDate);
    renderCalendar();
    showToast('ENTRY DELETED', 'default');
  } catch (err) {
    showToast('DELETE FAILED: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   MODAL
══════════════════════════════════════ */
function openModal() {
  state.isModalOpen = true;
  dom.modalOverlay.hidden = false;
  dom.fabBtn.classList.add('fab--open');

  // Pre-fill date with selected date
  dom.entryDate.value = state.selectedDate;

  // Pre-fill time with current time
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  dom.entryTime.value = `${hh}:${mm}`;

  // Reset form
  dom.entryTitle.value = '';
  dom.entryDesc.value = '';
  dom.charCount.textContent = '0 / 1000';
  clearErrors();

  // Reset category
  selectCategory('PERSONAL');

  // Trap focus
  setTimeout(() => dom.entryTitle.focus(), 150);
  document.addEventListener('keydown', handleModalKeydown);
}

function closeModal() {
  state.isModalOpen = false;
  dom.modalOverlay.hidden = true;
  dom.fabBtn.classList.remove('fab--open');
  document.removeEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') closeModal();
}

function selectCategory(cat) {
  state.selectedCategory = cat;
  dom.modal.querySelectorAll('.pill').forEach(pill => {
    const isActive = pill.dataset.cat === cat;
    pill.setAttribute('aria-checked', String(isActive));
  });
}

function clearErrors() {
  dom.titleError.hidden = true;
  dom.dateError.hidden  = true;
  dom.timeError.hidden  = true;
  dom.entryTitle.style.borderColor = '';
  dom.entryDate.style.borderColor  = '';
  dom.entryTime.style.borderColor  = '';
}

function validateForm() {
  let valid = true;
  clearErrors();

  if (!dom.entryTitle.value.trim()) {
    dom.titleError.hidden = false;
    dom.entryTitle.style.borderColor = 'var(--red)';
    valid = false;
  }
  if (!dom.entryDate.value) {
    dom.dateError.hidden = false;
    dom.entryDate.style.borderColor = 'var(--red)';
    valid = false;
  }
  if (!dom.entryTime.value) {
    dom.timeError.hidden = false;
    dom.entryTime.style.borderColor = 'var(--red)';
    valid = false;
  }
  return valid;
}

async function handleSubmit() {
  if (state.isSubmitting) return;
  if (!validateForm()) return;

  state.isSubmitting = true;
  dom.submitBtn.disabled = true;
  dom.submitLabel.hidden = true;
  dom.submitSpinner.hidden = false;

  const payload = {
    title:       dom.entryTitle.value.trim(),
    description: dom.entryDesc.value.trim(),
    date:        dom.entryDate.value,
    time:        dom.entryTime.value,
    category:    state.selectedCategory,
  };

  try {
    const newEntry = await createEntry(payload);
    closeModal();

    // If entry date matches selected date, add to list
    if (payload.date === state.selectedDate) {
      state.entries.push(newEntry.entry || { ...payload, id: newEntry.id });
      renderEntries();
    }

    state.entryDates.add(payload.date);
    renderCalendar();
    showToast('ENTRY LOGGED ✓', 'success');
  } catch (err) {
    showToast('ERROR: ' + err.message, 'error');
  } finally {
    state.isSubmitting = false;
    dom.submitBtn.disabled = false;
    dom.submitLabel.hidden = false;
    dom.submitSpinner.hidden = true;
  }
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
let toastTimeout;

function showToast(msg, type = 'default') {
  clearTimeout(toastTimeout);
  dom.toast.textContent = msg;
  dom.toast.className = `toast toast--show ${type === 'error' ? 'toast--error' : type === 'success' ? 'toast--success' : ''}`;
  toastTimeout = setTimeout(() => {
    dom.toast.className = 'toast';
  }, 3000);
}

/* ══════════════════════════════════════
   HEADER BADGE
══════════════════════════════════════ */
function updateTodayBadge() {
  const now = new Date();
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  dom.todayBadge.textContent = now.toLocaleDateString('en-US', opts).toUpperCase();
}

/* ══════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════ */
function bindEvents() {
  // Calendar nav
  dom.prevWeek.addEventListener('click', () => {
    state.currentWeekOffset--;
    renderCalendar();
  });

  dom.nextWeek.addEventListener('click', () => {
    state.currentWeekOffset++;
    renderCalendar();
  });

  // FAB
  dom.fabBtn.addEventListener('click', () => {
    if (state.isModalOpen) closeModal();
    else openModal();
  });

  // Modal close
  dom.modalClose.addEventListener('click', closeModal);
  dom.cancelBtn.addEventListener('click', closeModal);

  // Overlay click to close
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Submit
  dom.submitBtn.addEventListener('click', handleSubmit);

  // Empty state add button
  dom.emptyAddBtn.addEventListener('click', openModal);

  // Retry
  dom.retryBtn.addEventListener('click', () => loadEntries(state.selectedDate));

  // Category pills
  dom.modal.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => selectCategory(pill.dataset.cat));
  });

  // Textarea char count
  dom.entryDesc.addEventListener('input', () => {
    dom.charCount.textContent = `${dom.entryDesc.value.length} / 1000`;
  });

  // Title enter key
  dom.entryTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.entryDesc.focus();
  });

  // Touch swipe on calendar for week navigation
  let touchStartX = null;
  dom.calendarStrip.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  dom.calendarStrip.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 80) {
      state.currentWeekOffset += diff > 0 ? 1 : -1;
      renderCalendar();
    }
    touchStartX = null;
  }, { passive: true });
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
async function init() {
  updateTodayBadge();
  await fetchEntryDates();
  renderCalendar();
  await loadEntries(state.selectedDate);
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
