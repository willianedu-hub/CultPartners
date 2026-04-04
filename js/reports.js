// ============================================================
//  reports.js — Página de Relatórios & Análises
// ============================================================

function renderReports() {
  const ops = APP.opps;
  const gnh  = ops.filter(o => o.status === 'Ganho').length;
  const perd = ops.filter(o => o.status === 'Perdido').length;
  const taxa = ops.length ? Math.round(gnh / ops.length * 100) : 0;

  _renderRepStats(ops, gnh, perd, taxa);
  _renderProductBar(ops);
  _renderConversionBar(ops);
  _renderStatusTiles(ops);
}

// ── Stat cards ────────────────────────────────────────────────
function _renderRepStats(ops, gnh, perd, taxa) {
  const el = g('repStats');
  el.innerHTML = '';
  const defs = [
    { l: 'Ganhos',     v: gnh,      s: 'Negócios fechados',   c: '#059669', f: o => o.status === 'Ganho'   },
    { l: 'Perdidos',   v: perd,     s: 'Não convertidos',     c: '#dc2626', f: o => o.status === 'Perdido' },
    { l: 'Conversão',  v: taxa+'%', s: 'Ganhos / total',       c: '#7c3aed', f: null                        },
  ];
  defs.forEach(d => {
    const card = document.createElement('div');
    card.className = 'rep-stat';
    card.style.borderTopColor = d.c;
    card.innerHTML = `
      <div class="rep-stat-label">${esc(d.l)}</div>
      <div class="rep-stat-val" style="color:${d.c}">${d.v}</div>
      <div class="rep-stat-sub">${esc(d.s)}</div>`;
    if (d.f) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => drill(d.l, ops.filter(d.f)));
    } else {
      card.style.cursor = 'default';
    }
    el.appendChild(card);
  });
}

// ── Bar: por produto ──────────────────────────────────────────
function _renderProductBar(ops) {
  const el = g('barProd');
  el.innerHTML = '';
  const pc = {};
  APP.products.forEach(p => { pc[p.nome] = ops.filter(o => o.produto === p.nome).length; });
  const sorted = Object.entries(pc).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  sorted.forEach(([nome, v], i) => {
    const row = document.createElement('div');
    row.className    = 'bar-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div class="bar-lbl">${esc(nome)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
      <div class="bar-num">${v}</div>`;
    row.addEventListener('click', () => drill('Produto: ' + nome, ops.filter(o => o.produto === nome)));
    el.appendChild(row);
  });
}

// ── Bar: conversão por parceiro ───────────────────────────────
function _renderConversionBar(ops) {
  const el = g('barConv');
  el.innerHTML = '';

  APP.partners.forEach((p, i) => {
    const total = ops.filter(o => o.parceiro_id === p.id).length;
    const ganhos = ops.filter(o => o.parceiro_id === p.id && o.status === 'Ganho').length;
    const pct = total ? Math.round(ganhos / total * 100) : 0;

    const row = document.createElement('div');
    row.className    = 'bar-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div class="bar-lbl">${logoImg(p.site, p.nome)}${esc(p.nome.split(' ')[0])}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
      <div class="bar-num">${pct}%</div>`;
    row.addEventListener('click', () => drill('Parceiro: ' + p.nome, ops.filter(o => o.parceiro_id === p.id)));
    el.appendChild(row);
  });
}

// ── Status tiles ──────────────────────────────────────────────
function _renderStatusTiles(ops) {
  const el = g('stTiles');
  el.innerHTML = '';

  APP.statusList.forEach(st => {
    const cnt = ops.filter(o => o.status === st.nome).length;
    const pct = ops.length ? Math.round(cnt / ops.length * 100) : 0;

    const tile = document.createElement('div');
    tile.className        = 'status-tile';
    tile.style.borderTopColor = st.cor;
    tile.style.cursor     = 'pointer';
    tile.innerHTML = `
      <div class="st-name" style="color:${esc(st.cor)}">${esc(st.nome)}</div>
      <div class="st-val">${cnt}</div>
      <div class="st-pct">${pct}% do total</div>`;

    tile.addEventListener('mouseenter', () => { tile.style.transform = 'translateY(-2px)'; tile.style.boxShadow = 'var(--shadow-md)'; });
    tile.addEventListener('mouseleave', () => { tile.style.transform = '';                  tile.style.boxShadow = '';                 });
    tile.addEventListener('click',      () => drill(st.nome, ops.filter(o => o.status === st.nome)));

    el.appendChild(tile);
  });
}
