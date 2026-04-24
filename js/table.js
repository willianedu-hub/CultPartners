// ============================================================
//  table.js — Tabela de oportunidades
//  Filtros, ordenação, seleção de colunas, exportação CSV
// ============================================================

// ── Filtros ──────────────────────────────────────────────────
function buildFilters() {
  g('fSt').innerHTML = '<option value="">Todos os status</option>' +
    APP.statusList.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');

  const fp = g('fPar');
  if (APP.cu.role === 'admin') {
    fp.innerHTML = '<option value="">Todos os parceiros</option>' +
      APP.partners.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    fp.style.display = '';
  } else {
    fp.innerHTML = '';
    fp.style.display = 'none';
  }

  g('fApv').style.display = APP.cu.role === 'admin' ? '' : 'none';
}

// ── Column picker ─────────────────────────────────────────────
function toggleColPicker() {
  g('colPicker').classList.toggle('open');
}

function buildColPicker() {
  g('cpItems').innerHTML = ALL_COLS.map(c => `
    <label class="cp-item">
      <input type="checkbox"
        ${APP.visCols.includes(c.k) ? 'checked' : ''}
        ${c.req ? 'disabled' : ''}
        onchange="toggleCol('${c.k}', this.checked)">
      ${c.l}${c.req ? ' <span style="color:var(--text4);font-size:10px">(fixo)</span>' : ''}
    </label>`).join('');
}

async function toggleCol(k, visible) {
  if (visible && !APP.visCols.includes(k)) APP.visCols.push(k);
  else if (!visible) APP.visCols = APP.visCols.filter(x => x !== k);
  renderTable();
  const key = APP.cu.role === 'admin' ? 'admin' : String(APP.cu.pid);
  await DB.saveColPrefs(key, APP.visCols);
}

// ── Filtro + ordenação ────────────────────────────────────────
function _filteredOpps() {
  const srch = (g('srch')?.value || '').toLowerCase();
  const stId = g('fSt')?.value;
  const parId = g('fPar')?.value;
  const apv  = g('fApv')?.value;

  let list = [...APP.opps];
  if (srch)  list = list.filter(o => o.empresa.toLowerCase().includes(srch) || (o.cnpj || '').includes(srch));
  if (stId)  list = list.filter(o => o.status_id  === +stId);
  if (parId) list = list.filter(o => o.parceiro_id === +parId);
  if (apv)   list = list.filter(o => o.aprovacao   === apv);

  const { col, dir } = APP.tSort;
  list.sort((a, b) => {
    let va, vb;
    if (col === 'parceiro') { va = a.parceiro_nome || ''; vb = b.parceiro_nome || ''; }
    else                    { va = a[col] || '';          vb = b[col] || '';          }
    return dir === 'asc'
      ? va.toString().localeCompare(vb.toString())
      : vb.toString().localeCompare(va.toString());
  });
  return list;
}

function tableFilter() {
  APP.tPage = 0;
  renderTable();
}

function goPage(n) {
  APP.tPage = n;
  renderTable();
}

function setPageSize(n) {
  APP.tPageSize = n;
  APP.tPage = 0;
  renderTable();
}

function sortBy(col) {
  if (APP.tSort.col === col) {
    APP.tSort.dir = APP.tSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    APP.tSort.col = col;
    APP.tSort.dir = 'asc';
  }
  APP.tPage = 0;
  renderTable();
}

// ── Pagination HTML builder (also used by drill-down) ─────────
function buildPagerHTML(total, page, ps, goFn, sizeFn) {
  const pages = Math.ceil(total / ps);
  if (pages <= 1 && total <= ps) return '';
  const from = page * ps + 1;
  const to   = Math.min((page + 1) * ps, total);

  const sizeOpts = [10, 30, 50, 100]
    .map(n => `<option value="${n}"${ps === n ? ' selected' : ''}>${n} / pág</option>`)
    .join('');

  // Smart page number list
  let nums = [];
  if (pages <= 7) {
    nums = Array.from({ length: pages }, (_, i) => i);
  } else if (page < 4) {
    nums = [0, 1, 2, 3, 4, -1, pages - 1];
  } else if (page > pages - 5) {
    nums = [0, -1, pages - 5, pages - 4, pages - 3, pages - 2, pages - 1];
  } else {
    nums = [0, -1, page - 1, page, page + 1, -1, pages - 1];
  }

  const btns = nums.map(p =>
    p === -1
      ? `<span class="pager-ellipsis">…</span>`
      : `<button class="pager-btn${p === page ? ' active' : ''}" onclick="${goFn}(${p})">${p + 1}</button>`
  ).join('');

  return `<div class="pager">
    <span class="pager-info">${from}–${to} de ${total}</span>
    <button class="pager-btn" onclick="${goFn}(${page - 1})"${page === 0 ? ' disabled' : ''}>‹</button>
    ${btns}
    <button class="pager-btn" onclick="${goFn}(${page + 1})"${page >= pages - 1 ? ' disabled' : ''}>›</button>
    <select class="pager-size" onchange="${sizeFn}(+this.value)">${sizeOpts}</select>
  </div>`;
}

// ── Render ────────────────────────────────────────────────────
function renderTable() {
  const full = _filteredOpps();
  const total = full.length;
  const start = APP.tPage * APP.tPageSize;
  const list  = full.slice(start, start + APP.tPageSize);
  const cols  = ALL_COLS.filter(c => APP.visCols.includes(c.k));

  const si = col => {
    const ic = APP.tSort.col === col ? (APP.tSort.dir === 'asc' ? '↑' : '↓') : '↕';
    return `<span class="sort-ic">${ic}</span>`;
  };

  g('tHead').innerHTML = `<tr>${cols.map(c => {
    const sticky   = c.k === 'empresa' ? 'td-sticky' : '';
    const sortable = !['tarefas', 'acoes'].includes(c.k);
    const sorted   = APP.tSort.col === c.k ? ' sorted' : '';
    return `<th class="${sticky}${sorted}"
      ${sortable ? `onclick="sortBy('${c.k}')" style="cursor:pointer"` : ''}>
      ${c.l}${sortable ? si(c.k) : ''}
    </th>`;
  }).join('')}</tr>`;

  const tbody = g('tBody');
  if (!total) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}">
      <div class="empty-st"><div class="empty-ic">🔍</div>Nenhuma oportunidade encontrada</div>
    </td></tr>`;
    g('tPager').innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map(o => {
    const par  = APP.partners.find(p => p.id === o.parceiro_id) || { nome: '—', site: null };
    const rej  = o.aprovacao === 'Rejeitado';
    const warn = needsTaskWarning(o);
    const pend = o.tarefas_pendentes || 0;
    const done = (o.tarefas_total || 0) - pend;

    const cells = cols.map(c => {
      switch (c.k) {
        case 'empresa':
          return `<td class="td-main td-sticky">
            <span class="ename">${logoImg(o.site_empresa, o.empresa)}${esc(o.empresa)}${rej ? ' 🚫' : ''}</span>
            ${warn ? '<br><span style="font-size:10px;color:var(--yellow)">⚠ +60d sem tarefa</span>' : ''}
          </td>`;
        case 'cnpj':
          return `<td>${esc(o.cnpj || '—')}</td>`;
        case 'contato':
          return `<td>${esc(o.contato || '')}${o.cargo ? `<br><span style="font-size:10px;color:var(--text3)">${esc(o.cargo)}</span>` : ''}</td>`;
        case 'cargo':
          return `<td>${esc(o.cargo || '—')}</td>`;
        case 'produto': {
          const pnames = (o.produtos_nomes || o.produto || '').split(', ');
          const tags   = pnames.filter(Boolean).map(n =>
            `<span style="background:var(--primary-light);color:var(--primary);padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap">${esc(n)}</span>`
          ).join(' ');
          return `<td><div style="display:flex;flex-wrap:wrap;gap:3px">${tags || '—'}</div></td>`;
        }
        case 'status':
          return `<td><span class="badge ${badgeCls(o.status)}">
            <span class="bdot" style="background:${esc(o.status_cor || '#64748b')}"></span>${esc(o.status)}
          </span></td>`;
        case 'fechamento':
          return `<td>${fmtMonth(o.fechamento)}</td>`;
        case 'parceiro':
          return `<td><span class="ename">${logoImg(par.site, par.nome)}${esc(par.nome)}</span></td>`;
        case 'aprovacao':
          return `<td><span class="badge ${badgeCls(o.aprovacao)}">${esc(o.aprovacao)}</span></td>`;
        case 'tarefas':
          return `<td><span style="font-size:11px">✅${done} 📋${pend}</span></td>`;
        case 'acoes':
          return `<td>
            <div style="display:flex;gap:4px">
              <button class="btn-icon" title="Editar" onclick="event.stopPropagation();editOp(${o.id})">✏️</button>
              ${APP.cu.role === 'admin' && o.aprovacao === 'Pendente'
                ? `<button class="btn-icon ok"  title="Aprovar"  onclick="event.stopPropagation();approveOp(${o.id})">✅</button>
                   <button class="btn-icon bad" title="Rejeitar" onclick="event.stopPropagation();openReject(${o.id})">❌</button>`
                : ''}
              ${APP.cu.role === 'admin' && o.aprovacao === 'Rejeitado'
                ? `<button class="btn-icon ok" title="Reverter aprovação" onclick="event.stopPropagation();approveOp(${o.id})">✅</button>`
                : ''}
              <button class="btn-icon bad" title="Excluir" onclick="event.stopPropagation();deleteOp(${o.id})">🗑</button>
            </div>
          </td>`;
        default:
          return '<td>—</td>';
      }
    });

    return `<tr class="${rej ? 'rej-row' : ''}" ondblclick="editOp(${o.id})">${cells.join('')}</tr>`;
  }).join('');

  g('tPager').innerHTML = buildPagerHTML(total, APP.tPage, APP.tPageSize, 'goPage', 'setPageSize');
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV() {
  const list = _filteredOpps();
  const headers = [
    'ID','Empresa','Site Empresa','CNPJ','Contato','Cargo',
    'Produto','Status','Fechamento','Parceiro',
    'Aprovação','Data Aprovação','Aprovado Por',
    'Motivo Rejeição','Data Rejeição',
    'Observações','Tarefas Total','Tarefas Pendentes',
    'Criado Em',
  ];
  const rows = list.map(o => {
    const par = APP.partners.find(p => p.id === o.parceiro_id) || { nome: '—' };
    return [
      o.id, o.empresa, o.site_empresa || '', o.cnpj || '',
      o.contato || '', o.cargo || '',
      o.produto || '', o.status,
      o.fechamento ? o.fechamento.slice(0, 7) : '',
      par.nome, o.aprovacao,
      o.approved_at ? fmtDateTime(o.approved_at) : '',
      o.aprovado_por || '',
      o.motivo_rejeicao || '',
      o.rejected_at ? fmtDateTime(o.rejected_at) : '',
      o.obs || '',
      o.tarefas_total || 0,
      o.tarefas_pendentes || 0,
      fmtDateTime(o.created_at),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv = '\uFEFF' + [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.join(',')),
  ].join('\r\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `cultpartners_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📥 CSV exportado com sucesso!');
}
