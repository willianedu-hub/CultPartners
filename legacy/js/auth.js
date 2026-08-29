// ============================================================
//  auth.js — Autenticação e gestão de sessão
// ============================================================

const SESSION_KEY = 'cp_session_v2';

async function boot() {
  loadingShow(true);
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      APP.cu = JSON.parse(saved);
      await loadBaseData();
      startApp();
    } else {
      loadingShow(false);
      g('loginScreen').style.display = 'flex';
    }
  } catch (e) {
    console.error('Boot error:', e);
    loadingShow(false);
    g('loginScreen').style.display = 'flex';
  }
}

async function doLogin() {
  const login = g('loginUser').value.trim();
  const senha = g('loginPass').value;
  const errEl = g('loginErr');
  errEl.style.display = 'none';

  if (!login || !senha) {
    errEl.textContent = 'Preencha usuário e senha.';
    errEl.style.display = 'block';
    return;
  }

  loadingShow(true);
  try {
    // Tenta admin primeiro
    const admin = await DB.loginAdmin(login, senha);
    if (admin) {
      APP.cu = { role: 'admin', pid: admin.id, name: admin.nome, ini: _initials(admin.nome), site: null, login };
      localStorage.setItem(SESSION_KEY, JSON.stringify(APP.cu));
      await loadBaseData();
      startApp();
      return;
    }
    // Tenta parceiro
    const parceiro = await DB.loginParceiro(login, senha);
    if (parceiro) {
      APP.cu = { role: 'partner', pid: parceiro.id, name: parceiro.nome, ini: _initials(parceiro.nome), site: parceiro.site || null, login };
      localStorage.setItem(SESSION_KEY, JSON.stringify(APP.cu));
      await loadBaseData();
      startApp();
      return;
    }
    errEl.textContent = 'Usuário ou senha incorretos.';
    errEl.style.display = 'block';
  } catch (e) {
    errEl.textContent = 'Erro de conexão: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    loadingShow(false);
  }
}

async function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  APP.cu = null; APP.opps = []; APP.statusList = []; APP.partners = []; APP.products = [];
  g('app').style.display = 'none';
  g('loginScreen').style.display = 'flex';
  g('loginUser').value = '';
  g('loginPass').value = '';
  g('loginErr').style.display = 'none';
  g('umDrop')?.classList.remove('open');
}

async function loadBaseData() {
  const [sl, pa, pr] = await Promise.all([
    DB.loadStatusList(),
    DB.loadPartners(),
    DB.loadProducts(),
  ]);
  APP.statusList = sl;
  APP.partners   = pa;
  APP.products   = pr;
  // Carrega preferência de colunas
  const key = APP.cu.role === 'admin' ? 'admin' : String(APP.cu.pid);
  const saved = await DB.loadColPrefs(key);
  APP.visCols = saved || ALL_COLS.map(c => c.k);
}

function startApp() {
  loadingShow(false);
  g('loginScreen').style.display = 'none';
  g('app').style.display = 'block';
  g('topbar').style.left = 'var(--sidebar-w)';

  // Topbar / user menu
  const { ini, name, role } = APP.cu;
  ['umAv', 'umDropAv'].forEach(id => { const el = g(id); if (el) el.textContent = ini; });
  if (g('umName'))     g('umName').textContent     = name;
  if (g('umDropName')) g('umDropName').textContent = name;
  if (g('umDropRole')) g('umDropRole').textContent = role === 'admin' ? 'Admin CULTSEC' : 'Parceiro';

  const isAdmin = role === 'admin';
  ['adSep', 'adLbl', 'navCfg', 'umCfg'].forEach(id => {
    const el = g(id);
    if (el) el.style.display = isAdmin ? '' : 'none';
  });
  nav('dashboard');
}

// Enter no formulário de login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && g('loginScreen')?.style.display === 'flex') doLogin();
});

// ── Trocar senha ─────────────────────────────────────────────
function openSenha() {
  if (!APP.cu.login) {
    toast('Faça logout e login novamente para trocar a senha.', 'warn');
    return;
  }
  ['sAtual','sNova','sConf'].forEach(id => { const el = g(id); if (el) el.value = ''; });
  if (g('senhaStr')) g('senhaStr').innerHTML = '';
  g('umDrop')?.classList.remove('open');
  openM('mSenha');
}

function checkSenhaStr() {
  const s = g('sNova')?.value || '';
  const checks = [
    { ok: s.length >= 8,              msg: '8+ caracteres' },
    { ok: /[A-Z]/.test(s),            msg: 'Maiúscula' },
    { ok: /[0-9]/.test(s),            msg: 'Número' },
    { ok: /[^A-Za-z0-9]/.test(s),     msg: 'Especial' },
  ];
  if (g('senhaStr')) g('senhaStr').innerHTML = checks.map(c =>
    `<span style="color:${c.ok ? 'var(--green)' : 'var(--text3)'};margin-right:10px">${c.ok ? '✓' : '○'} ${c.msg}</span>`
  ).join('');
}

async function saveSenha() {
  const atual = g('sAtual')?.value || '';
  const nova  = g('sNova')?.value  || '';
  const conf  = g('sConf')?.value  || '';

  if (!atual) { toast('⚠️ Informe a senha atual!', 'warn'); return; }

  const senhaErr = _validSenha(nova);
  if (senhaErr) { toast('⚠️ ' + senhaErr, 'warn'); return; }
  if (nova !== conf) { toast('⚠️ As senhas não coincidem!', 'warn'); return; }

  loadingShow(true);
  try {
    const valid = APP.cu.role === 'admin'
      ? await DB.loginAdmin(APP.cu.login, atual)
      : await DB.loginParceiro(APP.cu.login, atual);
    if (!valid) { toast('❌ Senha atual incorreta!', 'bad'); return; }

    await DB.changePassword(APP.cu.role, APP.cu.pid, nova);
    closeM('mSenha');
    toast('✅ Senha alterada com sucesso!');
  } catch (e) {
    toast('Erro: ' + e.message, 'bad');
    console.error(e);
  } finally {
    loadingShow(false);
  }
}

function _validSenha(s) {
  if (s.length < 8)               return 'Mínimo 8 caracteres.';
  if (!/[A-Z]/.test(s))           return 'Precisa de pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(s))           return 'Precisa de pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(s))    return 'Precisa de pelo menos um caractere especial (!@#$…).';
  return null;
}

// ── Helpers internos ─────────────────────────────────────────
function _initials(nome) {
  return (nome || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
