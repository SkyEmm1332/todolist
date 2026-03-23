/**
 * MesTâches — Logique applicative principale
 * Stockage : localStorage pour qu'il soit spécifique à chaque session
 */

(() => {
  'use strict';


  /* ──────────────────────────────────────────────────────────────
     CONFIGURATION
  ────────────────────────────────────────────────────────────── */

  const CONFIG = {
    storageKey : 'taskly_tasks_v1',
    maxLength  : 150,
    animDelay  : 200,
  };

  const PRIORITY_META = {
    low    : { label: 'Basse',   color: '#16A34A', bg: '#F0FDF4' },
    medium : { label: 'Moyenne', color: '#D97706', bg: '#FFFBEB' },
    high   : { label: 'Haute',   color: '#DC2626', bg: '#FEF2F2' },
  };

  const LIST_META = {
    work  : { label: 'Travail',   icon: SVG_WORK   },
    perso : { label: 'Personnel', icon: SVG_HOME   },
    ideas : { label: 'Idées',     icon: SVG_IDEA   },
  };

  // SVG inline pour les badges de liste (14×14)
  function SVG_WORK() {
    return `<svg width="11" height="11" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:3px"><rect x="1.5" y="4.5" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 4.5V3.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }
  function SVG_HOME() {
    return `<svg width="11" height="11" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:3px"><path d="M7 1.5L2 5v7.5h3.5V9h3v3.5H12V5L7 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }
  function SVG_IDEA() {
    return `<svg width="11" height="11" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:3px"><path d="M7 1.5a4 4 0 011.5 7.7V11H5.5V9.2A4 4 0 017 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }

  const VIEW_TITLES = {
    all    : 'Toutes les tâches',
    active : 'Tâches en cours',
    done   : 'Tâches terminées',
    high   : 'Priorité haute',
    work   : 'Travail',
    perso  : 'Personnel',
    ideas  : 'Idées',
  };


  /* ──────────────────────────────────────────────────────────────
     LES ETATS
  ────────────────────────────────────────────────────────────── */

  const state = {
    tasks           : [],
    activeView      : 'all',
    activeTab       : 'all',
    activePriority  : 'low',
    editingId       : null,
    sortDescending  : true,
  };


  /* ──────────────────────────────────────────────────────────────
     UTILITAIRES
  ────────────────────────────────────────────────────────────── */

  const $ = id => document.getElementById(id);

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const escapeHtml = str =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');


  /* ──────────────────────────────────────────────────────────────
     SAUVEGARDE & CHARGEMENT
  ────────────────────────────────────────────────────────────── */

  const saveToStorage = () => {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.tasks));
  };

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      state.tasks = raw ? JSON.parse(raw) : [];
    } catch {
      state.tasks = [];
    }
  };


  /* ──────────────────────────────────────────────────────────────
     SÉLECTION & FILTRAGE
  ────────────────────────────────────────────────────────────── */

  const getTasksForView = () => {
    const { tasks, activeView } = state;
    switch (activeView) {
      case 'all'    : return tasks;
      case 'active' : return tasks.filter(t => !t.done);
      case 'done'   : return tasks.filter(t =>  t.done);
      case 'high'   : return tasks.filter(t => t.priority === 'high' && !t.done);
      default       : return tasks.filter(t => t.list === activeView);
    }
  };

  const applyTabFilter = list => {
    switch (state.activeTab) {
      case 'active' : return list.filter(t => !t.done);
      case 'done'   : return list.filter(t =>  t.done);
      default       : return list;
    }
  };

  const sortTasks = list =>
    [...list].sort((a, b) =>
      state.sortDescending ? b.created - a.created : a.created - b.created
    );


  /* ──────────────────────────────────────────────────────────────
     RENDU
  ────────────────────────────────────────────────────────────── */

  const render = () => {
    const viewTasks     = getTasksForView();
    const filteredTasks = applyTabFilter(sortTasks(viewTasks));

    renderTaskList(filteredTasks);
    updateCounters(viewTasks);
    updateProgress(viewTasks);
    saveToStorage();
  };

  const renderTaskList = (tasks) => {
    const container = $('tasks-list');

    if (tasks.length === 0) {
      container.innerHTML = buildEmptyState();
      return;
    }

    container.innerHTML = tasks.map(buildTaskHTML).join('');
    tasks.forEach(task => attachTaskEvents(task));
  };

  const buildTaskHTML = (task) => {
    const priority  = PRIORITY_META[task.priority] ?? PRIORITY_META.low;
    const listInfo  = LIST_META[task.list];
    const isEditing = state.editingId === task.id;

    const textContent = isEditing
      ? `<input
           class="task-edit-input"
           value="${escapeHtml(task.text)}"
           maxlength="${CONFIG.maxLength}"
           aria-label="Modifier la tâche"
         />`
      : `<div class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</div>`;

    // Badge de liste — icône SVG + label
    const listBadge = listInfo
      ? `<span class="task-tag">${listInfo.icon()} ${listInfo.label}</span>`
      : '';

    // Badge de priorité (uniquement si non "basse")
    const priorityBadge = task.priority !== 'low'
      ? `<span class="task-tag" style="color:${priority.color};background:${priority.bg};border-color:transparent">
           <svg width="9" height="9" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:2px">
             <path d="M7 2.5l1.5 3.5h3.5L9.5 8.5l1 3.5L7 10l-3.5 2 1-3.5L2 6h3.5L7 2.5z"
               stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
           </svg>${priority.label}
         </span>`
      : '';

    return `
      <li class="task-item" data-id="${task.id}" role="listitem">

        <button
          class="task-checkbox ${task.done ? 'checked' : ''}"
          data-action="toggle"
          aria-label="${task.done ? 'Marquer comme non terminée' : 'Marquer comme terminée'}"
          aria-pressed="${task.done}"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div
          class="priority-indicator"
          style="background-color:${priority.color}"
          title="Priorité ${priority.label}"
          aria-label="Priorité : ${priority.label}"
        ></div>

        <div class="task-body">
          ${textContent}
          <div class="task-meta">
            ${listBadge}
            ${priorityBadge}
          </div>
        </div>

        <div class="task-actions" role="group" aria-label="Actions">
          <button
            class="task-action-btn"
            data-action="edit"
            title="Modifier"
            aria-label="Modifier la tâche"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            class="task-action-btn delete"
            data-action="delete"
            title="Supprimer"
            aria-label="Supprimer la tâche"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 3.5h10M5.5 3.5V2.5h3V3.5M3.5 3.5l.7 8h5.6l.7-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

      </li>`;
  };

  const attachTaskEvents = (task) => {
    const el = document.querySelector(`[data-id="${task.id}"]`);
    if (!el) return;

    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'toggle') toggleTask(task.id);
      if (action === 'edit')   startEdit(task.id);
      if (action === 'delete') removeTask(task.id);
    });

    el.querySelector('.task-text')?.addEventListener('dblclick', () => {
      startEdit(task.id);
    });

    if (state.editingId === task.id) {
      const input = el.querySelector('.task-edit-input');
      if (!input) return;

      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  commitEdit(task.id, input.value);
        if (e.key === 'Escape') cancelEdit();
      });

      input.addEventListener('blur', () => commitEdit(task.id, input.value));
    }
  };

  const buildEmptyState = () => {
    // Icônes SVG pour chaque état vide
    const icons = {
      done: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" stroke="currentColor" stroke-width="2"/><path d="M13 20l5 5 9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      active: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" stroke="currentColor" stroke-width="2"/><path d="M20 13v7l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      default: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="8" y="10" width="24" height="22" rx="3" stroke="currentColor" stroke-width="2"/><path d="M14 16h12M14 22h8M14 28h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    };
    const messages = {
      done    : { icon: icons.done,    title: 'Aucune tâche terminée',    sub: 'Complétez des tâches pour les voir apparaître ici.' },
      active  : { icon: icons.active,  title: 'Tout est à jour',          sub: 'Aucune tâche en cours — beau travail.' },
      default : { icon: icons.default, title: 'Aucune tâche',             sub: 'Utilisez le champ ci-dessus pour en créer une.' },
    };
    const msg = messages[state.activeTab] ?? messages.default;
    return `
      <li class="empty-state" role="listitem" aria-live="polite">
        <div class="empty-icon">${msg.icon}</div>
        <p class="empty-title">${msg.title}</p>
        <p class="empty-subtitle">${msg.sub}</p>
      </li>`;
  };


  /* ──────────────────────────────────────────────────────────────
     MISE À JOUR DE L'INTERFACE
  ────────────────────────────────────────────────────────────── */

  const updateCounters = (viewTasks) => {
    const { tasks } = state;

    $('cnt-all').textContent    = tasks.length;
    $('cnt-active').textContent = tasks.filter(t => !t.done).length;
    $('cnt-done').textContent   = tasks.filter(t =>  t.done).length;
    $('cnt-high').textContent   = tasks.filter(t => t.priority === 'high' && !t.done).length;

    Object.keys(LIST_META).forEach(listKey => {
      const el = $(`cnt-${listKey}`);
      if (el) el.textContent = tasks.filter(t => t.list === listKey && !t.done).length;
    });

    $('tab-all').textContent    = viewTasks.length;
    $('tab-active').textContent = viewTasks.filter(t => !t.done).length;
    $('tab-done').textContent   = viewTasks.filter(t =>  t.done).length;
  };

  const updateProgress = (viewTasks) => {
    const total = viewTasks.length;
    const done  = viewTasks.filter(t => t.done).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    $('progress-fill').style.width = `${pct}%`;
    $('progress-bar').setAttribute('aria-valuenow', pct);

    if (total === 0) {
      $('progress-label').textContent = 'Aucune tâche';
    } else {
      $('progress-label').textContent = `${done} / ${total} terminée${done > 1 ? 's' : ''}`;
    }
  };

  const updateViewTitle = (view) => {
    $('view-title').textContent = VIEW_TITLES[view] ?? view;
  };


  /* ──────────────────────────────────────────────────────────────
     ACTIONS SUR LES TÂCHES
  ────────────────────────────────────────────────────────────── */

  const addTask = (text) => {
    const sanitized = text.trim();
    if (!sanitized) return;

    state.tasks.unshift({
      id       : uid(),
      text     : sanitized,
      done     : false,
      priority : state.activePriority,
      list     : $('list-select').value || 'work',
      created  : Date.now(),
    });

    render();
  };

  const toggleTask = (id) => {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      task.done = !task.done;
      render();
    }
  };

  const removeTask = (id) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('task-exit');
      setTimeout(() => {
        state.tasks = state.tasks.filter(t => t.id !== id);
        render();
      }, CONFIG.animDelay);
    }
  };

  const startEdit = (id) => {
    state.editingId = id;
    render();
  };

  const commitEdit = (id, newText) => {
    const trimmed = newText.trim();
    const task    = state.tasks.find(t => t.id === id);
    if (task && trimmed) {
      task.text = trimmed;
    }
    state.editingId = null;
    render();
  };

  const cancelEdit = () => {
    state.editingId = null;
    render();
  };

  const clearCompletedTasks = () => {
    state.tasks = state.tasks.filter(t => !t.done);
    render();
  };


  /* ──────────────────────────────────────────────────────────────
     NAVIGATION
  ────────────────────────────────────────────────────────────── */

  const setActiveView = (view, el) => {
    state.activeView = view;
    state.activeTab  = 'all';

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === 'all');
      tab.setAttribute('aria-selected', tab.dataset.tab === 'all' ? 'true' : 'false');
    });

    if (['work', 'perso', 'ideas'].includes(view)) {
      $('list-select').value = view;
    }

    updateViewTitle(view);
    render();
  };

  const setActiveTab = (tab, el) => {
    state.activeTab = tab;
    document.querySelectorAll('.tab').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
  };


  /* ──────────────────────────────────────────────────────────────
     INITIALISATION & LISTENERS
  ────────────────────────────────────────────────────────────── */

  const initDateDisplay = () => {
    const now = new Date();
    const formatted = now.toLocaleDateString('fr-FR', {
      weekday : 'long',
      day     : 'numeric',
      month   : 'long',
      year    : 'numeric',
    });
    const el = $('view-date');
    el.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    el.setAttribute('datetime', now.toISOString().split('T')[0]);
  };

  const bindEvents = () => {

    // Ajout de tâche
    $('add-btn').addEventListener('click', () => {
      addTask($('task-input').value);
      $('task-input').value = '';
    });

    $('task-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        addTask($('task-input').value);
        $('task-input').value = '';
      }
    });

    // Actions topbar
    $('clear-btn').addEventListener('click', clearCompletedTasks);

    $('sort-btn').addEventListener('click', () => {
      state.sortDescending = !state.sortDescending;
      render();
    });

    // Sélecteur de priorité
    document.querySelectorAll('.priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activePriority = btn.dataset.p;
        document.querySelectorAll('.priority-btn').forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    // Navigation sidebar — vues
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => setActiveView(el.dataset.view, el));
    });

    // Navigation sidebar — listes
    document.querySelectorAll('[data-list]').forEach(el => {
      el.addEventListener('click', () => setActiveView(el.dataset.list, el));
    });

    // Onglets de filtre
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab, btn));
    });

  };

  const init = () => {
    loadFromStorage();
    initDateDisplay();
    bindEvents();
    render();
  };

  init();

})();