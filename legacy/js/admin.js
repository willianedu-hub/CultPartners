// ============================================================
//  admin.js — CRUD de configurações (admin only)
//  Status do funil, Parceiros (com edição), Produtos
// ============================================================

function openCad(type) {
  g('logsSection').style.display = 'none';
  g('cfgHint').style.display = '';
  const titles = { status: '🏷️ Status do Funil', parceiros: '🤝 Parceiros', produtos: '📦 Produtos / Serviços' };
  g('mCadTitle').textContent = titles[type] || type;
  const body = g('mCadBody');
  if      (type === 'status')    { body.innerHTML = _statusHTML();   openM('mCad'); _renderStatusTbl();   }
  else if (type === 'parceiros') { body.innerHTML = _partnersHTML(); openM('mCad'); _renderPartnersTbl(); }
  else                           { body.innerHTML = _productsHTML(); openM('mCad'); _renderProductsTbl(); }
}

// ── Helpers de tabela CRUD ────────────────────────────────────
function _th(heads) {
  return `<tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

// ════════════════════════════════════════
//  STATUS
// ════════════════════════════════════════
function _statusHTML() {
  return `
  <div style="display:flex;gap:20px;flex-wrap:wrap">
    <div style="flex:1;min-width:230px">
      <div class="crud-section-title">➕ Novo Status</div>
      <div class="fg"><label class="fl">Nome *</label><input class="fc" id="sNome" placeholder="Ex: Em Avaliação"></div>
      <div class="fg"><label class="fl">Cor</label><input type="color" class="fc" id="sCor" value="#7c3aed" style="height:36px;padding:3px 7px;cursor:pointer"></div>
      <div class="fg"><label class="fl">Ordem</label><input class="fc" id="sOrdem" type="number" placeholder="7" min="1"></div>
      <button class="btn btn-brand btn-sm" onclick="saveStatus()" style="margin-top:4px">Salvar</button>
    </div>
    <div style="flex:2;min-width:260px">
      <div class="crud-section-title">Cadastrados</div>
      <table class="ctable"><thead id="sTH"></thead><tbody id="sTB"></tbody></table>
    </div>
  </div>`;
}

async function saveStatus() {
  const nome = g('sNome')?.value.trim();
  if (!nome) { toast('⚠️ Nome obrigatório!', 'warn'); return; }
  loadingShow(true);
  try {
    await DB.createStatus({ nome, cor: g('sCor').value, ordem: +g('sOrdem').value || 99 });
    g('sNome').value = ''; g('sOrdem').value = '';
    APP.statusList = await DB.loadStatusList();
    _renderStatusTbl();
    toast('✅ Status salvo!');
  } catch (e) { toast('Erro: ' + e.message, 'bad'); }
  finally { loadingShow(false); }
}

function _renderStatusTbl() {
  const th = g('sTH'), tb = g('sTB');
  if (!th) return;
  th.innerHTML = _th(['Nome', 'Cor', 'Ordem', '']);
  tb.innerHTML = APP.statusList.map(s => `<tr>
    <td><strong style="color:var(--text)">${esc(s.nome)}</strong></td>
    <td><span style="width:18px;height:18px;border-radius:4px;background:${esc(s.cor)};display:inline-block;vertical-align:middle"></span></td>
    <td style="color:var(--text3)">${s.ordem}</td>
    <td><button class="btn btn-bad btn-xs" onclick="delStatus(${s.id})">🗑</button></td>
  </tr>`).join('');
}

async function delStatus(id) {
  const ok = await confirmDialog('Desativar este status? Oportunidades vinculadas serão mantidas.');
  if (!ok) return;
  loadingShow(true);
  try {
    await DB.deleteStatus(id);
    APP.statusList = await DB.loadStatusList();
    _renderStatusTbl();
    toast('🗑 Status desativado.', 'bad');
  } catch (e) { toast('Erro: ' + e.message, 'bad'); }
  finally { loadingShow(false); }
}

// ════════════════════════════════════════
//  PARCEIROS (com edição)
// ════════════════════════════════════════
let _editPartnerId = null;

function _partnersHTML() {
  return `
  <div style="display:flex;gap:20px;flex-wrap:wrap">
    <div style="flex:1;min-width:240px">
      <div class="crud-section-title" id="pFormTitle">➕ Novo Parceiro</div>
      <input type="hidden" id="pEditId">
      <div class="fg"><label class="fl">Nome *</label><input class="fc" id="pNome" placeholder="Razão social"></div>
      <div class="fg"><label class="fl">CNPJ</label><input class="fc" id="pCnpj" placeholder="00.000.000/0001-00" oninput="maskCnpj(this)"></div>
      <div class="fg"><label class="fl">Site</label><input class="fc" id="pSite" placeholder="https://parceiro.com.br"></div>
      <div class="fg"><label class="fl">Login *</label><input class="fc" id="pLogin" placeholder="login.parceiro"></div>
      <div class="fg">
        <label class="fl">Senha <span id="pSenhaHint" style="color:var(--text4);font-size:10px;display:none">(em branco = manter atual)</span></label>
        <input class="fc" id="pSenha" type="password" placeholder="Mínimo 6 caracteres">
      </div>
      <div class="fg" style="margin-bottom:14px"><label class="fl">E-mail</label><input class="fc" id="pEmail" placeholder="email@parceiro.com.br"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-brand btn-sm" onclick="savePartner()">Salvar</button>
        <button class="btn btn-ghost btn-sm" id="pCancelBtn" style="display:none" onclick="cancelPartnerEdit()">Cancelar edição</button>
      </div>
    </div>
    <div style="flex:2;min-width:260px">
      <div class="crud-section-title">Cadastrados</div>
      <table class="ctable"><thead id="pTH"></thead><tbody id="pTB"></tbody></table>
    </div>
  </div>`;
}

async function savePartner() {
  const nome  = g('pNome')?.value.trim();
  const login = g('pLogin')?.value.trim();
  const senha = g('pSenha')?.value.trim();
  const isEdit = !!g('pEditId')?.value;

  if (!nome || !login)           { toast('⚠️ Nome e login são obrigatórios!', 'warn'); return; }
  if (!isEdit && !senha)         { toast('⚠️ Senha obrigatória para novo parceiro!', 'warn'); return; }
  if (senha && senha.length < 6) { toast('⚠️ Senha mínimo 6 caracteres!', 'warn'); return; }

  const payload = {
    nome,
    cnpj:  g('pCnpj')?.value  || null,
    site:  g('pSite')?.value  || null,
    login,
    email: g('pEmail')?.value || null,
    senha: senha || null,
  };

  loadingShow(true);
  try {
    if (isEdit) {
      await DB.updatePartner(+g('pEditId').value, payload);
      toast('✅ Parceiro atualizado!');
    } else {
      await DB.createPartner(payload);
      toast('✅ Parceiro cadastrado!');
    }
    cancelPartnerEdit();
    APP.partners = await DB.loadPartners();
    _renderPartnersTbl();
  } catch (e) {
    const msg = e.message.includes('23505') ? 'Login já existe.' : e.message;
    toast('Erro: ' + msg, 'bad');
  } finally {
    loadingShow(false);
  }
}

function loadPartnerEdit(id) {
  const p = APP.partners.find(x => x.id === id);
  if (!p) return;
  _editPartnerId = id;
  g('pEditId').value = id;
  g('pFormTitle').textContent = '✏️ Editar Parceiro';
  g('pNome').value  = p.nome  || '';
  g('pCnpj').value  = p.cnpj  || '';
  g('pSite').value  = p.site  || '';
  g('pLogin').value = p.login || '';
  g('pSenha').value = '';
  g('pEmail').value = p.email || '';
  g('pSenhaHint').style.display = '';
  g('pCancelBtn').style.display = '';
  g('pNome').focus();
}

function cancelPartnerEdit() {
  _editPartnerId = null;
  if (g('pEditId'))   g('pEditId').value = '';
  if (g('pFormTitle')) g('pFormTitle').textContent = '➕ Novo Parceiro';
  ['pNome','pCnpj','pSite','pLogin','pSenha','pEmail'].forEach(id => {
    const el = g(id); if (el) el.value = '';
  });
  if (g('pSenhaHint')) g('pSenhaHint').style.display = 'none';
  if (g('pCancelBtn')) g('pCancelBtn').style.display = 'none';
}

function _renderPartnersTbl() {
  const th = g('pTH'), tb = g('pTB');
  if (!th) return;
  th.innerHTML = _th(['Nome', 'Login', 'E-mail', 'Ações']);
  tb.innerHTML = APP.partners.map(p => `<tr>
    <td><span class="ename">${logoImg(p.site, p.nome)}<strong style="color:var(--text)">${esc(p.nome)}</strong></span></td>
    <td><code style="background:var(--surface2);padding:1px 6px;border-radius:4px;font-size:11px;color:var(--text2)">${esc(p.login)}</code></td>
    <td style="color:var(--text3)">${esc(p.email || '—')}</td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn-icon" onclick="loadPartnerEdit(${p.id})" title="Editar">✏️</button>
        <button class="btn-icon bad" onclick="delPartner(${p.id})" title="Remover">🗑</button>
      </div>
    </td>
  </tr>`).join('');
}

async function delPartner(id) {
  const ok = await confirmDialog('Remover este parceiro? As oportunidades vinculadas serão mantidas.');
  if (!ok) return;
  loadingShow(true);
  try {
    await DB.softDeletePartner(id);
    APP.partners = await DB.loadPartners();
    _renderPartnersTbl();
    toast('🗑 Parceiro removido.', 'bad');
  } catch (e) { toast('Erro: ' + e.message, 'bad'); }
  finally { loadingShow(false); }
}

// ════════════════════════════════════════
//  PRODUTOS
// ════════════════════════════════════════
function _productsHTML() {
  return `
  <div style="display:flex;gap:20px;flex-wrap:wrap">
    <div style="flex:1;min-width:230px">
      <div class="crud-section-title">➕ Novo Produto</div>
      <div class="fg"><label class="fl">Nome *</label><input class="fc" id="prNome" placeholder="Ex: Conscientização Avançada"></div>
      <div class="fg"><label class="fl">Categoria</label><input class="fc" id="prCat" placeholder="Treinamento, Consultoria…"></div>
      <div class="fg" style="margin-bottom:14px"><label class="fl">Descrição</label><textarea class="fc" id="prDesc" rows="2"></textarea></div>
      <button class="btn btn-brand btn-sm" onclick="saveProduct()">Salvar</button>
    </div>
    <div style="flex:2;min-width:260px">
      <div class="crud-section-title">Cadastrados</div>
      <table class="ctable"><thead id="prTH"></thead><tbody id="prTB"></tbody></table>
    </div>
  </div>`;
}

async function saveProduct() {
  const nome = g('prNome')?.value.trim();
  if (!nome) { toast('⚠️ Nome obrigatório!', 'warn'); return; }
  loadingShow(true);
  try {
    await DB.createProduct({ nome, categoria: g('prCat')?.value || null, descricao: g('prDesc')?.value || null });
    ['prNome','prCat','prDesc'].forEach(id => { const el = g(id); if (el) el.value = ''; });
    APP.products = await DB.loadProducts();
    _renderProductsTbl();
    toast('✅ Produto salvo!');
  } catch (e) { toast('Erro: ' + e.message, 'bad'); }
  finally { loadingShow(false); }
}

function _renderProductsTbl() {
  const th = g('prTH'), tb = g('prTB');
  if (!th) return;
  th.innerHTML = _th(['Nome', 'Categoria', '']);
  tb.innerHTML = APP.products.map(p => `<tr>
    <td><strong style="color:var(--text)">${esc(p.nome)}</strong></td>
    <td><span style="background:var(--primary-light);color:var(--primary);padding:1px 8px;border-radius:4px;font-size:10px;font-weight:600">${esc(p.categoria || '—')}</span></td>
    <td><button class="btn btn-bad btn-xs" onclick="delProduct(${p.id})">🗑</button></td>
  </tr>`).join('');
}

async function delProduct(id) {
  const ok = await confirmDialog('Desativar este produto?');
  if (!ok) return;
  loadingShow(true);
  try {
    await DB.deleteProduct(id);
    APP.products = await DB.loadProducts();
    _renderProductsTbl();
    toast('🗑 Produto desativado.', 'bad');
  } catch (e) { toast('Erro: ' + e.message, 'bad'); }
  finally { loadingShow(false); }
}

// ════════════════════════════════════════
//  LOG DE ATIVIDADES (admin only)
// ════════════════════════════════════════
let _logData = [], _logPage = 0, _logPs = 30;

async function openLogs() {
  g('cfgHint').style.display = 'none';
  const sec = g('logsSection');
  sec.style.display = 'block';
  sec.innerHTML = `<div class="log-wrap">
    <div class="log-header">
      <div class="log-title">🗂️ Log de Atividades</div>
      <div class="log-filters">
        <input  class="fi" id="logSrch"   type="text"    placeholder="🔍 Buscar usuário…" oninput="logFilter()" style="width:175px">
        <select class="fi" id="logTabela" onchange="logFilter()">
          <option value="">Todas as tabelas</option>
          <option>oportunidades</option><option>parceiros</option><option>tarefas</option>
          <option>status_funil</option><option>produtos</option>
        </select>
        <select class="fi" id="logAcao" onchange="logFilter()">
          <option value="">Todas as ações</option>
          <option>INSERT</option><option>UPDATE</option><option>DELETE</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="openLogs()">↻ Atualizar</button>
      </div>
    </div>
    <div class="tbl-wrap"><div class="tbl-scroll">
      <table><thead id="logHead"></thead><tbody id="logBody"></tbody></table>
    </div></div>
    <div id="logPager"></div>
  </div>`;

  loadingShow(true);
  try {
    _logData = await DB.loadAuditLog();
    _logPage = 0;
    _renderLogsTbl();
  } catch (e) {
    toast('Erro ao carregar logs: ' + e.message, 'bad');
  } finally {
    loadingShow(false);
  }
}

function logFilter() {
  _logPage = 0;
  _renderLogsTbl();
}

function logGoPage(n) {
  _logPage = n;
  _renderLogsTbl();
}

function logSetSize(n) {
  _logPs = n;
  _logPage = 0;
  _renderLogsTbl();
}

function _renderLogsTbl() {
  const srch   = (g('logSrch')?.value   || '').toLowerCase();
  const tabela = g('logTabela')?.value  || '';
  const acao   = g('logAcao')?.value    || '';

  const partnerNames = new Set(APP.partners.map(p => p.nome));

  let list = _logData;
  if (srch)   list = list.filter(r => (r.usuario || '').toLowerCase().includes(srch));
  if (tabela) list = list.filter(r => r.tabela === tabela);
  if (acao)   list = list.filter(r => r.acao === acao);

  const total = list.length;
  const start = _logPage * _logPs;
  const page  = list.slice(start, start + _logPs);

  const headEl = g('logHead'), bodyEl = g('logBody');
  if (!headEl) return;

  headEl.innerHTML = `<tr>
    <th style="width:140px">Data/Hora</th>
    <th>Tabela</th>
    <th style="width:80px">Ação</th>
    <th style="width:60px">ID</th>
    <th>Usuário</th>
    <th>Detalhes</th>
  </tr>`;

  if (!total) {
    bodyEl.innerHTML = `<tr><td colspan="6"><div class="empty-st"><div class="empty-ic">🔍</div>Nenhum registro encontrado</div></td></tr>`;
    g('logPager').innerHTML = '';
    return;
  }

  bodyEl.innerHTML = page.map(r => {
    const isPartner = partnerNames.has(r.usuario);
    const rowCls    = isPartner ? 'log-partner' : 'log-admin';
    const acaoCls   = r.acao === 'DELETE' ? 'log-del' : r.acao === 'INSERT' ? 'log-ins' : 'log-upd';
    const details   = _logDetails(r);
    return `<tr class="${rowCls}">
      <td style="font-size:11px;color:var(--text3);white-space:nowrap">${fmtDateTime(r.created_at)}</td>
      <td><code style="font-size:11px">${esc(r.tabela || '—')}</code></td>
      <td><span class="log-badge ${acaoCls}">${esc(r.acao || '—')}</span></td>
      <td style="color:var(--text3);font-size:12px">${r.registro_id || '—'}</td>
      <td>
        <span style="font-size:12px;font-weight:600;color:${isPartner ? 'var(--primary)' : 'var(--accent)'}">${esc(r.usuario || '—')}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:4px">${isPartner ? 'Parceiro' : 'Admin'}</span>
      </td>
      <td style="font-size:11px;color:var(--text2);max-width:300px">${details}</td>
    </tr>`;
  }).join('');

  g('logPager').innerHTML = buildPagerHTML(total, _logPage, _logPs, 'logGoPage', 'logSetSize');
}

function _logDetails(r) {
  try {
    const after  = r.dados_depois ? (typeof r.dados_depois === 'string' ? JSON.parse(r.dados_depois) : r.dados_depois) : null;
    const before = r.dados_antes  ? (typeof r.dados_antes  === 'string' ? JSON.parse(r.dados_antes)  : r.dados_antes)  : null;
    const src    = after || before;
    if (!src) return '—';
    const keys = ['empresa','nome','aprovacao','status','motivo_rejeicao'];
    const parts = keys.filter(k => src[k] != null).map(k => `<b>${k}:</b> ${esc(String(src[k]))}`);
    return parts.length ? parts.join(' · ') : esc(JSON.stringify(src).slice(0, 80));
  } catch { return '—'; }
}
