// ============================================================
//  dashboard.js — Renderização do Dashboard
// ============================================================

function renderDash() {
  const ops = APP.opps;
  const tot  = ops.length;
  const atv  = ops.filter(o => !['Ganho', 'Perdido'].includes(o.status)).length;
  const gnh  = ops.filter(o => o.status === 'Ganho').length;
  const pnd  = ops.filter(o => o.aprovacao === 'Pendente').length;

  _renderStatCards(ops, tot, atv, gnh, pnd);
  _renderAlerts(ops);
  _renderDonut(ops);
  _renderBarPartner(ops);
  _renderLine(ops);
}

// ── Stat cards ───────────────────────────────────────────────
function _renderStatCards(ops, tot, atv, gnh, pnd) {
  const defs = [
    { l: 'Total',              v: tot, s: 'Todas as etapas',                            ico: '🎯', c: '#7c3aed', bg: '#f5f3ff', f: null },
    { l: 'Em Andamento',       v: atv, s: 'Pipeline ativo',                             ico: '⚡', c: '#c026d3', bg: '#fce7ff', f: o => !['Ganho','Perdido'].includes(o.status) },
    { l: 'Ganhos',             v: gnh, s: `Taxa: ${tot ? Math.round(gnh/tot*100) : 0}%`,ico: '✅', c: '#059669', bg: '#ecfdf5', f: o => o.status === 'Ganho' },
    { l: 'Aguard. Aprovação',  v: pnd, s: 'Revisão necessária',                         ico: '⏳', c: '#d97706', bg: '#fffbeb', f: o => o.aprovacao === 'Pendente' },
  ];
  const grid = g('statsGrid');
  grid.innerHTML = '';
  defs.forEach(d => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-card-accent" style="background:${d.c}"></div>
      <div class="stat-card-icon" style="background:${d.bg}">${d.ico}</div>
      <div class="stat-label">${esc(d.l)}</div>
      <div class="stat-val" style="color:${d.c}">${d.v}</div>
      <div class="stat-sub">${esc(d.s)}</div>`;
    if (d.f) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => drill(d.l, ops.filter(d.f)));
    } else {
      card.style.cursor = 'default';
    }
    grid.appendChild(card);
  });
}

// ── Alerts (60 dias sem tarefa) ──────────────────────────────
function _renderAlerts(ops) {
  const warns = ops.filter(needsTaskWarning);
  g('dashAlerts').innerHTML = warns.length
    ? `<div class="alert alert-warn" style="margin-bottom:16px">
        ⚠️ <strong>${warns.length} oportunidade(s)</strong> aprovada(s) há mais de 60 dias sem tarefa ativa:
        ${warns.map(o => `<b>${esc(o.empresa)}</b>`).join(', ')}.
       </div>`
    : '';
}

// ── Donut ────────────────────────────────────────────────────
function _renderDonut(ops) {
  const tot = ops.length || 1;
  const svgEl = g('donutSvg');
  const lgd   = g('donutLgd');
  svgEl.innerHTML = '';
  lgd.innerHTML   = '';

  let offset = 0;
  APP.statusList.forEach(st => {
    const cnt = ops.filter(o => o.status === st.nome).length;
    if (!cnt) return;
    const angle = cnt / tot * 360;
    const r = 42, cx = 60, cy = 60;
    const sa = (offset - 90) * Math.PI / 180;
    const ea = sa + angle * Math.PI / 180;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${angle > 180 ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`);
    path.setAttribute('fill', st.cor);
    path.setAttribute('opacity', '.88');
    path.style.cursor = 'pointer';
    path.title = `${st.nome}: ${cnt}`;
    path.addEventListener('click', () => drill(st.nome, ops.filter(o => o.status === st.nome)));
    svgEl.appendChild(path);
    offset += angle;

    // Legend item
    const li = document.createElement('div');
    li.className = 'dleg-item';
    li.innerHTML = `<div class="dleg-dot" style="background:${st.cor}"></div>
      <span class="dleg-name">${esc(st.nome)}</span>
      <span class="dleg-val">${cnt}</span>`;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => drill(st.nome, ops.filter(o => o.status === st.nome)));
    lgd.appendChild(li);
  });

  // Centro
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', 60); circle.setAttribute('cy', 60); circle.setAttribute('r', 26);
  circle.setAttribute('fill', 'white'); circle.setAttribute('stroke', 'var(--border)'); circle.setAttribute('stroke-width', '1.5');
  svgEl.appendChild(circle);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', 60); txt.setAttribute('y', 65); txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', 'var(--text)'); txt.setAttribute('font-size', '15');
  txt.setAttribute('font-family', 'Rajdhani'); txt.setAttribute('font-weight', '700');
  txt.textContent = ops.length;
  svgEl.appendChild(txt);
}

// ── Bar chart (parceiros) ────────────────────────────────────
function _renderBarPartner(ops) {
  const el = g('barPartner');
  el.innerHTML = '';
  const sorted = [...APP.partners].sort(
    (a, b) => ops.filter(o => o.parceiro_id === b.id).length - ops.filter(o => o.parceiro_id === a.id).length
  );
  const max = Math.max(...APP.partners.map(p => ops.filter(o => o.parceiro_id === p.id).length), 1);
  sorted.forEach((p, i) => {
    const v = ops.filter(o => o.parceiro_id === p.id).length;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-lbl">${logoImg(p.site, p.nome)}${esc(p.nome.split(' ')[0])}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%;background:${CHART_FILLS[i % CHART_FILLS.length]}"></div></div>
      <div class="bar-num">${v}</div>`;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => drill('Parceiro: ' + p.nome, ops.filter(o => o.parceiro_id === p.id)));
    el.appendChild(row);
  });
}

// ── Line chart (fechamento por mês) ─────────────────────────
function _renderLine(ops) {
  const svgEl = g('lineSvg');
  svgEl.innerHTML = '';
  const months = {};
  ops.forEach(o => {
    if (!o.fechamento) return;
    const ym = o.fechamento.slice(0, 7); // YYYY-MM
    months[ym] = (months[ym] || 0) + 1;
  });
  const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
  if (!sorted.length) return;

  const max = Math.max(...sorted.map(s => s[1]));
  const W = 600, H = 130, PX = 30, PT = 18, PB = 24;
  const pts = sorted.map((s, i) => ({
    x:   PX + (i / (sorted.length - 1 || 1)) * (W - PX * 2),
    y:   PT + (1 - s[1] / max) * (H - PT - PB),
    lbl: fmtMonth(s[0] + '-01'),
    val: s[1],
    ym:  s[0],
  }));

  const path = pts.map((p, i) => (i ? 'L' : 'M') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = path + ` L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z`;

  // Gradient fill
  svgEl.innerHTML = `<defs>
    <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#7c3aed" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="${area}" fill="url(#lg1)"/>
  <path d="${path}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  pts.forEach(p => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#7c3aed'); dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => drill('Fechamento: ' + p.lbl, APP.opps.filter(o => o.fechamento?.startsWith(p.ym))));
    svgEl.appendChild(dot);

    _svgText(svgEl, p.x, p.y - 10, String(p.val), 'var(--text)', '11', 'Rajdhani', '700');
    _svgText(svgEl, p.x, H - 4, p.lbl, 'var(--text3)', '9.5', 'Plus Jakarta Sans', '400');
  });
}

function _svgText(svg, x, y, txt, fill, size, family, weight) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('x', x); el.setAttribute('y', y);
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('fill', fill); el.setAttribute('font-size', size);
  el.setAttribute('font-family', family); el.setAttribute('font-weight', weight);
  el.textContent = txt;
  svg.appendChild(el);
}

// ── Drill-down (shared) ──────────────────────────────────────
function drill(title, list) {
  const safe  = list || [];
  const cols  = ['empresa','cnpj','contato','produto','status','fechamento','parceiro','aprovacao'];
  const label = { empresa:'Empresa',cnpj:'CNPJ',contato:'Contato',produto:'Produto',status:'Etapa',fechamento:'Fechamento',parceiro:'Parceiro',aprovacao:'Aprovação' };
  let _page = 0;
  let _ps   = APP.tPageSize;

  g('drillHead').innerHTML = `<tr>${cols.map(c => `<th>${label[c]}</th>`).join('')}</tr>`;

  window._drillGoPage = function(n) { _page = n; _render(); };
  window._drillSetSize = function(n) { _ps = n; _page = 0; _render(); };

  function _render() {
    const total = safe.length;
    const start = _page * _ps;
    g('mDrillTitle').textContent = `🔍 ${title} (${total})`;
    g('drillBody').innerHTML = safe.slice(start, start + _ps).map(o => {
      const par = APP.partners.find(p => p.id === o.parceiro_id) || { nome: '—', site: null };
      const rej = o.aprovacao === 'Rejeitado';
      return `<tr class="${rej ? 'rej-row' : ''}">
        <td class="td-main"><span class="ename">${logoImg(o.site_empresa, o.empresa)}${esc(o.empresa)}${rej ? ' 🚫' : ''}</span></td>
        <td>${esc(o.cnpj || '—')}</td>
        <td>${esc(o.contato || '')}</td>
        <td>${esc(o.produto || '')}</td>
        <td><span class="badge ${badgeCls(o.status)}">${esc(o.status)}</span></td>
        <td>${fmtMonth(o.fechamento)}</td>
        <td><span class="ename">${logoImg(par.site, par.nome)}${esc(par.nome)}</span></td>
        <td><span class="badge ${badgeCls(o.aprovacao)}">${esc(o.aprovacao)}</span></td>
      </tr>`;
    }).join('');
    g('drillPager').innerHTML = buildPagerHTML(total, _page, _ps, '_drillGoPage', '_drillSetSize');
  }

  _render();
  openM('mDrill');
}
