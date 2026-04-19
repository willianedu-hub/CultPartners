// ============================================================
//  nav.js — Navegação entre views
// ============================================================

const VIEW_TITLES = {
  dashboard:      'Dashboard <span>Geral</span>',
  oportunidades:  'Oportunidades <span>Registradas</span>',
  pipeline:       'Pipeline <span>de Vendas</span>',
  relatorios:     'Relatórios <span>&amp; Análises</span>',
  configuracoes:  'Configurações <span>do Sistema</span>',
};

async function nav(page) {
  closeMobileSidebar();
  // Troca view ativa
  qsa('.view').forEach(v => v.classList.remove('active'));
  const view = g('v-' + page);
  if (view) view.classList.add('active');

  // Destaca item do menu
  qsa('.nav-btn').forEach(b => b.classList.remove('active'));
  qsa('.nav-btn').forEach(b => {
    if ((b.getAttribute('onclick') || '').includes(`'${page}'`)) b.classList.add('active');
  });

  // Título
  g('pgTitle').innerHTML = VIEW_TITLES[page] || page;

  // Botões da topbar
  const isOpps = page === 'oportunidades';
  g('btnNew').style.display = isOpps ? 'flex' : 'none';
  g('btnExp').style.display = isOpps ? 'flex' : 'none';

  // Fecha dropdowns abertos
  g('umDrop')?.classList.remove('open');

  // Renderiza a view
  loadingShow(true);
  try {
    switch (page) {
      case 'dashboard':
        APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
        renderDash();
        break;
      case 'oportunidades':
        APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
        buildFilters();
        buildColPicker();
        renderTable();
        break;
      case 'pipeline':
        APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
        renderKanban();
        break;
      case 'relatorios':
        APP.opps = await DB.loadOpps(APP.cu.role === 'partner' ? APP.cu.pid : null);
        renderReports();
        break;
      case 'configuracoes':
        // Sem fetch extra — só renderiza os blocos de config
        break;
    }
  } catch (e) {
    toast('Erro ao carregar página: ' + e.message, 'bad');
    console.error(e);
  } finally {
    loadingShow(false);
  }
}
