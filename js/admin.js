// ============================================================
//  admin.js — CRUD de configurações (admin only)
//  Status do funil, Parceiros (com edição), Produtos
// ============================================================

function openCad(type) {
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
