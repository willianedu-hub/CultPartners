// ============================================================
//  reports.js — Página de Relatórios & Análises
// ============================================================

function renderReports() {
  const ops = APP.opps;
  const gnh  = ops.filter(o => o.status === 'Ganho').length;
  const perd = ops.filter(o => o.status === 'Perdido').length;
  const taxa = ops.length ? Math.round(gnh / ops.length * 100) : 0;

  _renderRepStats(ops, gnh, perd, taxa);
  _renderRepFinStats(ops);
  _renderProductBar(ops);
  _renderConversionBar(ops);
  _renderValorBar(ops);
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

// ── Financial stat cards ─────────────────────────────────────
function _renderRepFinStats(ops) {
  const el = g('repFinStats');
  if (!el) return;
  el.innerHTML = '';

  const withVal = ops.filter(o => o.valor_estimado > 0);
  const sumTot  = withVal.reduce((s, o) => s + +o.valor_estimado, 0);
  const sumGnh  = ops.filter(o => o.status === 'Ganho' && o.valor_estimado > 0)
                     .reduce((s, o) => s + +o.valor_estimado, 0);
  const sumPerd = ops.filter(o => o.status === 'Perdido' && o.valor_estimado > 0)
                     .reduce((s, o) => s + +o.valor_estimado, 0);
  const taxaVal = sumTot ? Math.round(sumGnh / sumTot * 100) : 0;

  const defs = [
    { l: 'Total Prospectado', v: fmtBRLShort(sumTot),  s: `${withVal.length} opp${withVal.length !== 1 ? 's' : ''} com valor informado`, c: '#7c3aed' },
    { l: 'Valor Ganhos',      v: fmtBRLShort(sumGnh),  s: 'Negócios convertidos',   c: '#059669' },
    { l: 'Valor Perdidos',    v: fmtBRLShort(sumPerd), s: 'Oportunidades perdidas',  c: '#dc2626' },
    { l: 'Conv. por Valor',   v: taxaVal + '%',         s: 'Ganhos / total prospectado', c: '#c026d3' },
  ];

  defs.forEach(d => {
    const card = document.createElement('div');
    card.className = 'rep-stat';
    card.style.cssText = `border-top-color:${d.c};cursor:default`;
    card.innerHTML = `
      <div class="rep-stat-label">${esc(d.l)}</div>
      <div class="rep-stat-val" style="color:${d.c};font-size:18px">${d.v}</div>
      <div class="rep-stat-sub">${esc(d.s)}</div>`;
    el.appendChild(card);
  });
}

// ── Bar: por produto ──────────────────────────────────────────
function _renderProductBar(ops) {
  const el = g('barProd');
  el.innerHTML = '';
  const sorted = APP.products
    .map(p => ({ id: p.id, nome: p.nome, v: ops.filter(o => (o.produtos_ids || []).includes(p.id)).length }))
    .filter(p => p.v > 0)
    .sort((a, b) => b.v - a.v);
  const max = sorted[0]?.v || 1;

  sorted.forEach(({ id: pid, nome, v }, i) => {
    const row = document.createElement('div');
    row.className    = 'bar-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div class="bar-lbl">${esc(nome)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
      <div class="bar-num">${v}</div>`;
    row.addEventListener('click', () => drill('Produto: ' + nome, ops.filter(o => (o.produtos_ids || []).includes(pid))));
    el.appendChild(row);
  });
}

// ── Bar: conversão por parceiro (admin) / por produto (parceiro) ─
function _renderConversionBar(ops) {
  const el = g('barConv');
  el.innerHTML = '';

  if (APP.cu.role === 'admin') {
    g('repConvTitle').textContent = 'Conversão por Parceiro';
    g('repConvSub').textContent   = '% ganhos — clique para detalhar';
    APP.partners.forEach((p, i) => {
      const total  = ops.filter(o => o.parceiro_id === p.id).length;
      const ganhos = ops.filter(o => o.parceiro_id === p.id && o.status === 'Ganho').length;
      const pct    = total ? Math.round(ganhos / total * 100) : 0;
      const row    = document.createElement('div');
      row.className    = 'bar-row';
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <div class="bar-lbl">${logoImg(p.site, p.nome)}${esc(p.nome.split(' ')[0])}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
        <div class="bar-num">${pct}%</div>`;
      row.addEventListener('click', () => drill('Parceiro: ' + p.nome, ops.filter(o => o.parceiro_id === p.id)));
      el.appendChild(row);
    });
  } else {
    g('repConvTitle').textContent = 'Minha Conversão por Produto';
    g('repConvSub').textContent   = '% ganhos por produto — clique para detalhar';
    const activeProds = APP.products.filter(p =>
      ops.some(o => (o.produtos_ids || []).includes(p.id))
    );
    activeProds.forEach((p, i) => {
      const total  = ops.filter(o => (o.produtos_ids || []).includes(p.id)).length;
      const ganhos = ops.filter(o => (o.produtos_ids || []).includes(p.id) && o.status === 'Ganho').length;
      const pct    = total ? Math.round(ganhos / total * 100) : 0;
      const row    = document.createElement('div');
      row.className    = 'bar-row';
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <div class="bar-lbl" style="max-width:130px;overflow:hidden;text-overflow:ellipsis">${esc(p.nome)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
        <div class="bar-num">${pct}%</div>`;
      row.addEventListener('click', () => drill('Produto: ' + p.nome, ops.filter(o => (o.produtos_ids || []).includes(p.id))));
      el.appendChild(row);
    });
  }
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

// ── Bar: valor por parceiro (admin) / por produto (partner) ──
function _renderValorBar(ops) {
  const el = g('barValor');
  if (!el) return;
  el.innerHTML = '';

  if (APP.cu.role === 'admin') {
    g('repValorTitle').textContent = 'Valor Estimado por Parceiro';
    g('repValorSub').textContent   = 'Soma dos valores — clique para detalhar';
    const items = APP.partners.map((p, i) => ({
      id: p.id, nome: p.nome.split(' ')[0], site: p.site,
      v: ops.filter(o => o.parceiro_id === p.id && o.valor_estimado > 0)
             .reduce((s, o) => s + +o.valor_estimado, 0),
      opps: ops.filter(o => o.parceiro_id === p.id),
    })).filter(p => p.v > 0).sort((a, b) => b.v - a.v);

    const max = items[0]?.v || 1;
    items.forEach(({ id, nome, site, v, opps: sub }, i) => {
      const row = document.createElement('div');
      row.className = 'bar-row'; row.style.cursor = 'pointer';
      row.innerHTML = `
        <div class="bar-lbl">${logoImg(site, nome)}${esc(nome)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
        <div class="bar-num" style="width:72px">${fmtBRLShort(v)}</div>`;
      row.addEventListener('click', () => drill('Parceiro: ' + nome, sub));
      el.appendChild(row);
    });
  } else {
    g('repValorTitle').textContent = 'Valor Estimado por Produto';
    g('repValorSub').textContent   = 'Soma dos valores — clique para detalhar';
    const items = APP.products
      .map((p, i) => ({
        id: p.id, nome: p.nome,
        v: ops.filter(o => (o.produtos_ids || []).includes(p.id) && o.valor_estimado > 0)
               .reduce((s, o) => s + +o.valor_estimado, 0),
        opps: ops.filter(o => (o.produtos_ids || []).includes(p.id)),
      }))
      .filter(p => p.v > 0)
      .sort((a, b) => b.v - a.v);

    const max = items[0]?.v || 1;
    items.forEach(({ id, nome, v, opps: sub }, i) => {
      const row = document.createElement('div');
      row.className = 'bar-row'; row.style.cursor = 'pointer';
      row.innerHTML = `
        <div class="bar-lbl">${esc(nome)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
        <div class="bar-num" style="width:72px">${fmtBRLShort(v)}</div>`;
      row.addEventListener('click', () => drill('Produto: ' + nome, sub));
      el.appendChild(row);
    });
  }

  if (!el.children.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Nenhuma oportunidade com valor estimado preenchido.</div>';
  }
}
