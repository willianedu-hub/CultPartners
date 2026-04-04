// ============================================================
//  ops.js — CRUD de Oportunidades + Tarefas
// ============================================================

// ── Duplicate check (debounced) ──────────────────────────────
let _dupeTimer;
function checkDupe() {
  clearTimeout(_dupeTimer);
  _dupeTimer = setTimeout(async () => {
    const emp  = g('fEmp')?.value.trim() || '';
    const cnpj = (g('fCnpj')?.value || '').replace(/\D/g, '');
    const box  = g('dupeBox');
    if (!emp && cnpj.length < 14) { box.style.display = 'none'; return; }
    try {
      const dupe = await DB.checkDuplicate(emp, cnpj, APP.editId);
      if (dupe) {
        const par = APP.partners.find(p => p.id === dupe.parceiro_id) || { nome: '—' };
        g('dupeMsg').textContent = `"${dupe.empresa}" já registrada para "${par.nome}".`;
        box.style.display = 'block';
      } else {
        box.style.display = 'none';
      }
    } catch { /* silencia erros de rede no check */ }
  }, 600);
}

// ── Selects do modal ─────────────────────────────────────────
function _popSelects() {
  g('fProd').innerHTML = '<option value="">Selecione...</option>' +
    APP.products.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');

  g('fStOp').innerHTML = APP.statusList
    .slice().sort((a, b) => a.ordem - b.ordem)
    .map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');

  g('fParOp').innerHTML = APP.partners
    .map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
}

// ── Abrir modal — nova oportunidade ─────────────────────────
function openOpModal() {
  APP.editId    = null;
  APP.editTasks = [];
  _popSelects();
  g('mOpTitle').textContent = 'Nova Oportunidade';
  ['fEmp','fCnpj','fSiteEmp','fCont','fCargo','fObs'].forEach(id => {
    const el = g(id); if (el) el.value = '';
  });
  g('fProd').value  = '';
  g('fFech').value  = '';
  g('dupeBox').style.display     = 'none';
  g('mOpApprBar').style.display  = 'none';
  g('mOpStatus').innerHTML       = '';
  g('fParWrap').style.display    = APP.cu.role === 'admin' ? '' : 'none';
  g('tasksSec').style.display    = 'none';
  openM('mOp');
}

// ── Abrir modal — editar oportunidade ────────────────────────
function editOp(id) {
  const o = APP.opps.find(x => x.id === id);
  if (!o) return;

  APP.editId    = id;
  APP.editTasks = (o.tarefas || []).map(t => ({ ...t })); // cópia

  _popSelects();
  g('mOpTitle').textContent = 'Editar Oportunidade';
  g('fEmp').value     = o.empresa       || '';
  g('fCnpj').value    = o.cnpj          || '';
  g('fSiteEmp').value = o.site_empresa  || '';
  g('fCont').value    = o.contato       || '';
  g('fCargo').value   = o.cargo         || '';
  g('fProd').value    = o.produto_id    || '';
  g('fStOp').value    = o.status_id     || '';
  g('fFech').value    = dateToMonth(o.fechamento);
  g('fObs').value     = o.obs           || '';
  g('fParOp').value   = o.parceiro_id   || '';
  g('dupeBox').style.display  = 'none';
  g('fParWrap').style.display = APP.cu.role === 'admin' ? '' : 'none';

  // Info de aprovação/rejeição
  const si = g('mOpStatus');
  if (o.aprovacao === 'Rejeitado' && o.motivo_rejeicao) {
    si.innerHTML = `<div class="rej-box">
      🚫 <strong>Rejeitada:</strong> ${esc(o.motivo_rejeicao)}
      <div class="rej-date">📅 ${fmtDateTime(o.rejected_at)} — por ${esc(o.rejeitado_por || '—')}</div>
    </div>`;
  } else if (o.aprovacao === 'Aprovado' && o.approved_at) {
    si.innerHTML = `<div class="appr-date-box">
      ✅ <strong>Aprovada em</strong> ${fmtDateTime(o.approved_at)} — por ${esc(o.aprovado_por || '—')}
    </div>`;
  } else {
    si.innerHTML = '';
  }

  // Barra de aprovação — admin pode aprovar Pendente e reverter Rejeitado
  const ab = g('mOpApprBar');
  if (APP.cu.role === 'admin' && (o.aprovacao === 'Pendente' || o.aprovacao === 'Rejeitado')) {
    ab.style.display = 'block';
    ab.innerHTML = `<div class="appr-box">
      <div class="appr-msg">⏳ ${o.aprovacao === 'Pendente' ? 'Aguardando sua aprovação' : 'Rejeição pode ser revertida'}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ok btn-sm" onclick="approveOp(${id});closeM('mOp')">✅ Aprovar</button>
        ${o.aprovacao === 'Pendente'
          ? `<button class="btn btn-bad btn-sm" onclick="openReject(${id});closeM('mOp')">❌ Rejeitar</button>`
          : ''}
      </div>
    </div>`;
  } else {
    ab.style.display = 'none';
  }

  // Tarefas
  g('tasksSec').style.display   = '';
  g('taskFormBox').style.display = 'none';
  g('taskWarn').style.display   = needsTaskWarning(o) ? 'flex' : 'none';
  renderTaskList();
  openM('mOp');
}

// ── Salvar oportunidade ───────────────────────────────────────
async function saveOp() {
  if (g('dupeBox').style.display !== 'none') {
    toast('Resolva a duplicata antes de salvar.', 'warn'); return;
  }
  const emp  = g('fEmp').value.trim();
  const cont = g('fCont').value.trim();
  const prod = g('fProd').value;
  const stOp = g('fStOp').value;
  if (!emp || !cont || !prod || !stOp) {
    toast('⚠️ Preencha os campos obrigatórios!', 'warn'); return;
  }

  const payload = {
    empresa:     emp,
    cnpj:        g('fCnpj').value    || null,
    site_empresa:g('fSiteEmp').value || null,
    contato:     cont,
    cargo:       g('fCargo').value   || null,
    produto_id:  +prod,
    status_id:   +stOp,
    fechamento:  monthToDate(g('fFech').value),
    parceiro_id: APP.cu.role === 'admin' ? +g('fParOp').value : APP.cu.pid,
    obs:         g('fObs').value     || null,
  };

  loadingShow(true);
  try {
    if (APP.editId) {
      await DB.updateOpp(APP.editId, payload);
      await DB.saveTasks(APP.editId, APP.editTasks);
      toast('✅ Oportunidade atualizada!');
    } else {
      const created = await DB.createOpp({ ...payload, aprovacao: 'Pendente' });
      await DB.saveTasks(created.id, APP.editTasks);
      toast('✅ Registrada! Aguardando aprovação.');
    }
    closeM('mOp');
    APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
    renderTable();
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'bad');
    console.error(e);
  } finally {
    loadingShow(false);
  }
}

// ── Aprovação / Rejeição ──────────────────────────────────────
async function approveOp(id) {
  loadingShow(true);
  try {
    await DB.approveOpp(id, APP.cu.pid);
    APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
    renderTable();
    toast('✅ Oportunidade aprovada!');
  } catch (e) {
    toast('Erro: ' + e.message, 'bad');
  } finally {
    loadingShow(false);
  }
}

let _rejId = null;
function openReject(id) {
  _rejId = id;
  const ov = document.createElement('div');
  ov.className = 'm-overlay';
  ov.id        = 'mRej';
  ov.innerHTML = `
    <div class="m-box" style="width:460px">
      <div class="m-head">
        <div class="m-title">❌ Rejeitar Oportunidade</div>
        <button class="m-close" onclick="closeM('mRej')">✕</button>
      </div>
      <div class="m-body">
        <div class="fg fg-full">
          <label class="fl">Motivo da Rejeição *</label>
          <textarea class="fc" id="rejReason" rows="3" placeholder="Descreva o motivo…"></textarea>
        </div>
      </div>
      <div class="m-foot">
        <button class="btn btn-ghost" onclick="closeM('mRej')">Cancelar</button>
        <button class="btn btn-bad"   onclick="confirmReject()">Confirmar Rejeição</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add('open'), 10);
  ov.addEventListener('click', e => { if (e.target === ov) closeM('mRej'); });
}

async function confirmReject() {
  const motivo = g('rejReason')?.value.trim();
  if (!motivo) { toast('⚠️ Informe o motivo!', 'warn'); return; }
  loadingShow(true);
  try {
    await DB.rejectOpp(_rejId, APP.cu.pid, motivo);
    closeM('mRej');
    APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
    renderTable();
    toast('❌ Oportunidade rejeitada.', 'bad');
  } catch (e) {
    toast('Erro: ' + e.message, 'bad');
  } finally {
    loadingShow(false);
  }
}

async function deleteOp(id) {
  const ok = await confirmDialog('Excluir esta oportunidade permanentemente?');
  if (!ok) return;
  loadingShow(true);
  try {
    await DB.deleteOpp(id, APP.cu.name);
    APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
    renderTable();
    toast('🗑 Oportunidade removida.', 'bad');
  } catch (e) {
    toast('Erro: ' + e.message, 'bad');
  } finally {
    loadingShow(false);
  }
}

// ── Tarefas ───────────────────────────────────────────────────
function toggleTF() {
  const b = g('taskFormBox');
  b.style.display = b.style.display === 'none' ? 'block' : 'none';
}

function addTask() {
  const desc = g('tDesc')?.value.trim();
  if (!desc) { toast('⚠️ Descreva a tarefa!', 'warn'); return; }
  APP.editTasks.push({
    id:          'new_' + Date.now(), // string = nova, number = existente no banco
    descricao:   desc,
    prazo:       g('tPrazo')?.value || null,
    responsavel: g('tResp')?.value  || null,
    concluida:   false,
  });
  g('tDesc').value  = '';
  g('tPrazo').value = '';
  g('tResp').value  = '';
  g('taskFormBox').style.display = 'none';
  g('taskWarn').style.display    = 'none';
  renderTaskList();
  toast('📋 Tarefa adicionada!');
}

function toggleDone(tid) {
  const t = APP.editTasks.find(x => String(x.id) === String(tid));
  if (t) t.concluida = !t.concluida;
  renderTaskList();
}

function removeTask(tid) {
  APP.editTasks = APP.editTasks.filter(x => String(x.id) !== String(tid));
  renderTaskList();
}

function renderTaskList() {
  const today = new Date().toISOString().slice(0, 10);
  const el    = g('taskList');
  if (!APP.editTasks.length) {
    el.innerHTML = `<div class="empty-st" style="padding:16px">
      <div style="font-size:13px;color:var(--text3)">Nenhuma tarefa cadastrada</div>
    </div>`;
    return;
  }
  el.innerHTML = APP.editTasks.map(t => {
    const overdue = t.prazo && t.prazo < today && !t.concluida;
    return `<div class="task-item">
      <div class="task-cb ${t.concluida ? 'done' : ''}" onclick="toggleDone('${t.id}')">${t.concluida ? '✓' : ''}</div>
      <div style="flex:1">
        <div class="task-text ${t.concluida ? 'done' : ''}">${esc(t.descricao || '')}</div>
        <div class="task-meta">
          ${t.prazo
            ? `<span ${overdue ? 'class="task-over"' : ''}>${overdue ? '⚠ Vencida: ' : '📅 '}${fmtDate(t.prazo)}</span>`
            : ''}
          ${t.responsavel ? `<span>👤 ${esc(t.responsavel)}</span>` : ''}
        </div>
      </div>
      <button class="btn-icon bad" onclick="removeTask('${t.id}')" title="Remover" style="flex-shrink:0">🗑</button>
    </div>`;
  }).join('');
}
