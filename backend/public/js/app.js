const App = (() => {
  const titles = {
    dashboard: 'Dashboard',
    ventas: 'Datos de venta',
    asociados: 'Asociados',
    aliados: 'Aliados',
    tiposervicio: 'Tipos de servicio',
    metas: 'Metas',
    pos: 'Bancos / POS',
    backup: 'Backup',
  };

  const modules = {
    dashboard: () => DashboardView,
    ventas: () => VentasView,
    asociados: () => AsociadosView,
    aliados: () => AliadosView,
    tiposervicio: () => TiposServicioView,
    metas: () => MetasView,
    pos: () => PosView,
    backup: () => BackupView,
  };

  let current = null;

  async function go(view) {
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    document.getElementById('view-title').textContent = titles[view] || view;
    document.getElementById('view-actions').innerHTML = '';
    const root = document.getElementById('view-root');
    root.innerHTML = '<div class="empty-state">Cargando…</div>';
    const mod = modules[view]();
    current = mod;
    location.hash = view;
    await mod.mount(root, document.getElementById('view-actions'));
  }

  function init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => go(btn.dataset.view));
    });

    Api.health().then(() => {
      document.getElementById('conn-status').classList.remove('bad');
    }).catch(() => {
      document.getElementById('conn-status').classList.add('bad');
      UI.toast('No se pudo conectar con el servidor', true);
    });

    const initial = (location.hash || '#dashboard').replace('#', '');
    go(titles[initial] ? initial : 'dashboard');
  }

  return { go, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
