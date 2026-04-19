// ============================================================
//  ui.js — Utilitários de interface
//  Helpers de DOM, toast, modal, badges, logo, formatters
// ============================================================

// ── DOM ─────────────────────────────────────────────────────
const g   = id => document.getElementById(id);
const qs  = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

// ── Loading overlay ─────────────────────────────────────────
function loadingShow(on) {
  g('loadingOverlay').style.display = on ? 'flex' : 'none';
}

// ── Toast ────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'ok') {
  const icons = { ok: '✅', warn: '⚠️', bad: '❌' };
  g('toastIco').textContent = icons[type] || '✅';
  g('toastMsg').textContent = msg;
  const el = g('toast');
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

// ── Modals ───────────────────────────────────────────────────
function openM(id) {
  const el = g(id);
  if (el) el.classList.add('open');
}
function closeM(id) {
  const el = g(id);
  if (!el) return;
  el.classList.remove('open');
  // Modais criados dinamicamente (ex: rejeição) são removidos do DOM
  const PERSISTENT = ['mOp', 'mCad', 'mDrill', 'mSenha'];
  if (!PERSISTENT.includes(id)) el.remove();
}
// Fecha ao clicar no backdrop
['mOp', 'mCad', 'mDrill', 'mSenha'].forEach(id => {
  const el = g(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) closeM(id); });
});
// Fecha dropdowns ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('#umBtn')      && !e.target.closest('#umDrop'))
    g('umDrop')?.classList.remove('open');
  if (!e.target.closest('.col-picker-wrap'))
    g('colPicker')?.classList.remove('open');
});

// ── Badge CSS class ──────────────────────────────────────────
function badgeCls(s) {
  const map = {
    Prospect:    'b-prospect',
    Qualificado: 'b-qualificado',
    Proposta:    'b-proposta',
    'Negociação':'b-negociacao',
    Ganho:       'b-ganho',
    Perdido:     'b-perdido',
    Pendente:    'b-pendente',
    Aprovado:    'b-aprovado',
    Rejeitado:   'b-rejeitado',
  };
  return map[s] || 'b-prospect';
}

// ── Logo automático via Google S2 ────────────────────────────
function logoUrl(site) {
  if (!site || !site.trim()) return null;
  try {
    const h = site.replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '');
    return h ? `https://www.google.com/s2/favicons?sz=32&domain=${h}` : null;
  } catch { return null; }
}
function logoImg(site, alt = '') {
  const u = logoUrl(site);
  if (!u) return '';
  return `<img class="elogo" src="${u}" alt="${alt}" onerror="this.style.display='none'">`;
}

// ── Formatadores ─────────────────────────────────────────────
/**
 * Converte "2025-06-01" ou "2025-06" → "Jun/25"
 */
function fmtMonth(val) {
  if (!val) return '—';
  const [y, m] = val.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[+m - 1]}/${y.slice(2)}`;
}

/**
 * "2025-06" (input[type=month]) → "2025-06-01" (DATE para o banco)
 */
function monthToDate(ym) {
  if (!ym) return null;
  return ym.length === 7 ? `${ym}-01` : ym;
}

/**
 * "2025-06-01" (DATE do banco) → "2025-06" (input[type=month])
 */
function dateToMonth(d) {
  if (!d) return '';
  return d.slice(0, 7);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${y}`;
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Misc ─────────────────────────────────────────────────────
function daysSince(ds) {
  if (!ds) return 0;
  return Math.floor((Date.now() - new Date(ds).getTime()) / 86_400_000);
}

function needsTaskWarning(op) {
  if (op.aprovacao !== 'Aprovado') return false;
  if (op.status === 'Ganho') return false;
  if ((op.tarefas || []).filter(t => !t.concluida).length > 0) return false;
  return daysSince(op.approved_at) > 60;
}

function maskCnpj(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 14);
  v = v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
  el.value = v;
}

// Sanitize: evita XSS ao exibir texto do usuário
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sidebar toggle ───────────────────────────────────────────
let _sbColl = false;
function toggleSidebar() {
  _sbColl = !_sbColl;
  g('sidebar').classList.toggle('coll', _sbColl);
  g('main').classList.toggle('coll', _sbColl);
  g('topbar').style.left = _sbColl ? 'var(--sidebar-col)' : 'var(--sidebar-w)';
  g('sbBtn').textContent = _sbColl ? '▶' : '◀';
}

function toggleMobileSidebar() {
  g('sidebar').classList.toggle('mobile-open');
  g('sidebarOverlay').classList.toggle('active');
}
function closeMobileSidebar() {
  g('sidebar').classList.remove('mobile-open');
  g('sidebarOverlay').classList.remove('active');
}

// ── User menu toggle ─────────────────────────────────────────
function toggleUM() {
  g('umDrop').classList.toggle('open');
}

// ── Confirm dialog (Promise-based, substitui browser confirm) ─
function confirmDialog(msg) {
  return new Promise(resolve => {
    // Por ora usa o confirm nativo; pode ser substituído por modal custom
    resolve(window.confirm(msg));
  });
}
