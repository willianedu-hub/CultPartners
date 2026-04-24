// ============================================================
//  kanban.js — Pipeline Kanban com drag & drop
// ============================================================

function renderKanban() {
  const board = g('kBoard');
  board.innerHTML = '';

  APP.statusList
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .forEach(st => {
      const cards = APP.opps.filter(o => o.status_id === st.id);
      const col   = _buildCol(st, cards);
      board.appendChild(col);
    });
}

function _buildCol(st, cards) {
  const col = document.createElement('div');
  col.className    = 'k-col';
  col.dataset.stId = st.id;

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'k-col-head';
  hdr.innerHTML = `
    <div class="k-col-title" style="color:${esc(st.cor)}">${esc(st.nome)}</div>
    <div class="k-col-cnt">${cards.length}</div>`;
  col.appendChild(hdr);

  // Drop zone events
  col.addEventListener('dragover',  _onDragOver);
  col.addEventListener('dragleave', _onDragLeave);
  col.addEventListener('drop',      e => _onDrop(e, st));

  if (!cards.length) {
    const empty = document.createElement('div');
    empty.className = 'k-empty';
    empty.textContent = '—';
    col.appendChild(empty);
  } else {
    cards.forEach(o => col.appendChild(_buildCard(o, st)));
  }

  return col;
}

function _buildCard(o, st) {
  const rej  = o.aprovacao === 'Rejeitado';
  const warn = needsTaskWarning(o);
  const par  = APP.partners.find(p => p.id === o.parceiro_id) || { nome: '—', site: null };
  const pend = o.tarefas_pendentes || 0;

  const card = document.createElement('div');
  card.className  = 'k-card' + (rej ? ' rej-card' : '');
  card.draggable  = true;
  card.dataset.id = o.id;
  card.style.borderLeftColor = st.cor;

  card.innerHTML = `
    <div class="k-company">${logoImg(o.site_empresa, o.empresa)}${esc(o.empresa)}${rej ? ' 🚫' : ''}</div>
    <div class="k-partner">${logoImg(par.site, par.nome)}${esc(par.nome)}</div>
    <span class="k-product">${esc(o.produtos_nomes || o.produto || '')}</span>
    <div class="k-meta">
      ${o.fechamento ? `<span>📅 ${fmtMonth(o.fechamento)}</span>` : ''}
      ${pend         ? `<span>📋 ${pend}</span>`                    : ''}
      ${o.aprovacao === 'Pendente'
        ? `<span class="badge b-pendente" style="font-size:9px">Pendente</span>`
        : ''}
    </div>
    ${warn ? '<div class="k-warn">⚠ +60d sem tarefa</div>' : ''}`;

  // Drag events
  card.addEventListener('dragstart', e => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(o.id));
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    qsa('.k-col').forEach(c => c.classList.remove('over'));
  });

  // Click para editar
  card.addEventListener('click', () => editOp(o.id));

  return card;
}

// ── Drag & Drop handlers ─────────────────────────────────────
function _onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('over');
}

function _onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('over');
  }
}

async function _onDrop(e, targetStatus) {
  e.preventDefault();
  qsa('.k-col').forEach(c => c.classList.remove('over'));

  const id = parseInt(e.dataTransfer.getData('text/plain'));
  if (!id || isNaN(id)) return;

  const op = APP.opps.find(o => o.id === id);
  if (!op || op.status_id === targetStatus.id) return;

  // Atualização otimista
  const prevStatusId  = op.status_id;
  const prevStatusNom = op.status;
  op.status_id = targetStatus.id;
  op.status    = targetStatus.nome;
  renderKanban();

  try {
    await DB.moveOppStatus(id, targetStatus.id);
    toast(`✅ "${esc(op.empresa)}" → ${esc(targetStatus.nome)}`);
  } catch (err) {
    // Reverte em caso de erro
    op.status_id = prevStatusId;
    op.status    = prevStatusNom;
    renderKanban();
    toast('Erro ao mover: ' + err.message, 'bad');
  }
}
