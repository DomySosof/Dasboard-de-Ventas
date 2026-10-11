const BackupView = (() => {
  const NOMBRES_TABLA = {
    asociados: 'Asociados',
    aliados: 'Aliados',
    tipos_servicio: 'Tipos de servicio',
    tipos_pago: 'Tipos de pago',
    pos_config: 'Bancos / POS',
    metas: 'Metas',
    folios: 'Ventas (folios)',
    pagos: 'Pagos recibidos',
    folio_asociados: 'Pagos a asociados',
    folio_gastos: 'Gastos con aliados',
  };

  let resumenRoot = null;

  function descargar(url) {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function tarjeta(titulo, descripcion, boton) {
    return UI.el('div', { class: 'backup-card' }, [
      UI.el('div', { class: 'backup-card-title' }, titulo),
      UI.el('div', { class: 'help-text', style: 'margin:0 0 12px' }, descripcion),
      boton,
    ]);
  }

  function inputArchivo(accept) {
    return UI.el('input', { type: 'file', accept, style: 'display:none' });
  }

  // ---- Resumen de lo que hay guardado ----
  async function renderResumen() {
    if (!resumenRoot) return;
    resumenRoot.innerHTML = '<div class="empty-state">Contando registros…</div>';
    let data;
    try {
      data = await Api.backup.resumen();
    } catch (e) {
      resumenRoot.innerHTML = `<div class="empty-state">No se pudo leer el resumen: ${e.message}</div>`;
      return;
    }
    resumenRoot.innerHTML = '';
    resumenRoot.appendChild(UI.el('div', { class: 'grid grid-stats' },
      Object.keys(NOMBRES_TABLA).map(t => UI.el('div', { class: 'stat-card' }, [
        UI.el('div', { class: 'label' }, NOMBRES_TABLA[t]),
        UI.el('div', { class: 'value' }, UI.fmtNum(data.tablas[t] || 0)),
      ]))
    ));
  }

  // ---- Exportar ----
  function panelExportar() {
    const excelBtn = UI.el('button', { class: 'btn', type: 'button', onclick: () => descargar(Api.datos.exportarUrl()) }, 'Descargar Excel (.xlsx)');
    const jsonBtn = UI.el('button', { class: 'btn', type: 'button', onclick: () => descargar(Api.backup.jsonUrl()) }, 'Descargar respaldo JSON (.json)');

    return UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Exportar / respaldar'),
      UI.el('div', { class: 'help-text', style: 'margin:0 0 14px' },
        'Descarga una copia de todo lo registrado. El JSON es el respaldo completo (incluye asociados, aliados, catálogos, metas, ventas, pagos y gastos) y sirve para restaurar el sistema tal cual quedó. El Excel es una versión en hojas para revisar o editar a mano.'),
      UI.el('div', { class: 'backup-grid' }, [
        tarjeta('Respaldo completo (JSON)',
          'Un solo archivo con absolutamente todos los datos. Ideal para guardar una copia de seguridad o mover la información a otra computadora.',
          jsonBtn),
        tarjeta('Excel (.xlsx)',
          'Hojas separadas de Asociados, Aliados, Ventas, Pagos a asociados, Gastos con aliados y los ajustes (Tipos de servicio, Tipos de pago, Bancos/POS y Metas). Cómodo para revisar, imprimir, editar en Excel o cargar en una instalación limpia.',
          excelBtn),
      ]),
    ]);
  }

  // ---- Importar ----
  function panelImportar() {
    // Excel
    const fileExcel = inputArchivo('.xlsx,.xls');
    fileExcel.addEventListener('change', async () => {
      const file = fileExcel.files[0];
      fileExcel.value = '';
      if (!file) return;
      if (!confirm('Vas a importar un Excel. Los datos se AGREGAN a lo que ya existe (no se borra nada). ¿Continuar?')) return;
      try {
        const r = await Api.datos.importar(file);
        const partes = [
          r.asociados_creados ? `${r.asociados_creados} asociados` : null,
          r.aliados_creados ? `${r.aliados_creados} aliados` : null,
          r.ventas_procesadas ? `${r.ventas_procesadas} pagos de venta` : null,
          r.pagos_asociados_procesados ? `${r.pagos_asociados_procesados} pagos a asociados` : null,
          r.gastos_aliados_procesados ? `${r.gastos_aliados_procesados} gastos con aliados` : null,
        ].filter(Boolean).join(', ');
        UI.toast(`Excel importado: ${partes || 'sin cambios'}${r.errores.length ? ` · ${r.errores.length} fila(s) con error` : ''}`, r.errores.length > 0);
        if (r.errores.length) console.warn('Errores de importación:', r.errores);
      } catch (e) {
        UI.toast(e.message || 'No se pudo importar el Excel', true);
      }
      await renderResumen();
    });
    const btnExcel = UI.el('button', { class: 'btn secondary', type: 'button', onclick: () => fileExcel.click() }, 'Elegir Excel…');

    // JSON
    const fileJson = inputArchivo('.json,application/json');
    fileJson.addEventListener('change', async () => {
      const file = fileJson.files[0];
      fileJson.value = '';
      if (!file) return;
      if (!confirm('ATENCIÓN: restaurar un respaldo JSON REEMPLAZA todos los datos actuales por los del archivo. Esta acción no se puede deshacer.\n\n¿Seguro que quieres continuar?')) return;
      try {
        const r = await Api.backup.importarJson(file);
        const total = Object.values(r.tablas || {}).reduce((s, n) => s + n, 0);
        const extra = r.copia_seguridad ? ` Se guardó una copia del estado anterior en data/backups/${r.copia_seguridad}.` : '';
        UI.toast(`Respaldo restaurado: ${UI.fmtNum(total)} registro(s).${extra} Recarga la página para ver todo actualizado.`);
      } catch (e) {
        UI.toast(e.message || 'No se pudo restaurar el respaldo', true);
      }
      await renderResumen();
    });
    const btnJson = UI.el('button', { class: 'btn secondary', type: 'button', onclick: () => fileJson.click() }, 'Elegir respaldo JSON…');

    return UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Importar / restaurar'),
      UI.el('div', { class: 'help-text', style: 'margin:0 0 14px' },
        'Restaura desde un archivo descargado antes. El Excel AGREGA datos (útil para carga masiva) y el JSON REEMPLAZA todo por el contenido del respaldo.'),
      UI.el('div', { class: 'backup-grid' }, [
        tarjeta('Restaurar respaldo (JSON)',
          'Reemplaza todos los datos por los del archivo. Úsalo para recuperar el sistema después de un daño o para pasarlo a otra máquina.',
          btnJson),
        tarjeta('Importar planilla Excel (.xlsx)',
          'Suma ventas, asociados, aliados, pagos y gastos desde una hoja. No borra lo existente.',
          btnExcel),
        fileJson,
        fileExcel,
      ]),
    ]);
  }

  // ---- Borrar datos (zona peligrosa) ----
  function panelBorrar() {
    const caja = UI.el('div', { style: 'display:none; margin-top:14px; border-top:1px solid rgba(255,255,255,.12); padding-top:14px' });
    const btnAbrir = UI.el('button', { class: 'btn secondary', type: 'button', onclick: () => { caja.style.display = 'block'; btnAbrir.style.display = 'none'; } }, 'Eliminar datos…');

    function cerrar() { caja.style.display = 'none'; btnAbrir.style.display = ''; }

    async function ejecutar(modo, etiqueta) {
      const aviso = modo === 'todo'
        ? 'Vas a ELIMINAR TODO (ajustes incluidos): asociados, aliados, tipos de servicio, tipos de pago, bancos/POS, metas y todas las ventas.\n\nSolo se restablecerán los tipos de pago y bancos por defecto para poder seguir registrando ventas. El resto quedará vacío.\n\nEsta acción no se puede deshacer. ¿Continuar?'
        : 'Vas a borrar todas las VENTAS (folios, pagos, gastos con aliados y pagos a asociados). Los ajustes (asociados, aliados, tipos, bancos/POS y metas) se conservan.\n\nSe guardará una copia de seguridad automática antes de borrar. ¿Continuar?';
      if (!confirm(aviso)) return;
      try {
        const r = await Api.backup.borrar(modo);
        const total = Object.values(r.borrado || {}).reduce((s, n) => s + n, 0);
        const extra = r.copia_seguridad ? ` Copia del estado anterior: data/backups/${r.copia_seguridad}.` : '';
        UI.toast(`${etiqueta}: ${UI.fmtNum(total)} registro(s) borrado(s).${extra} Recarga la página para ver todo actualizado.`);
        cerrar();
      } catch (e) {
        UI.toast(e.message || 'No se pudieron borrar los datos', true);
      }
      await renderResumen();
    }

    const btnMov = UI.el('button', { class: 'btn secondary', type: 'button', onclick: () => ejecutar('movimientos', 'Movimientos borrados') },
      'Borrar solo movimientos (conservar ajustes)');
    const btnTodo = UI.el('button', { class: 'btn', type: 'button', style: 'background:#c1443c; border-color:#c1443c', onclick: () => ejecutar('todo', 'Todo borrado') },
      'Eliminar absolutamente todo');
    const btnCancelar = UI.el('button', { class: 'btn secondary', type: 'button', onclick: cerrar }, 'Cancelar');

    caja.append(
      UI.el('div', { class: 'help-text', style: 'margin:0 0 10px' }, 'Elige qué borrar:'),
      UI.el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap' }, [btnMov, btnTodo, btnCancelar])
    );

    return UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Zona peligrosa'),
      UI.el('div', { class: 'help-text', style: 'margin:0 0 12px' },
        'Borra datos registrados. Antes de borrar se guarda automáticamente una copia de seguridad en data/backups. Puedes conservar los ajustes (bancos/POS, tipos, metas y aliados) o eliminarlo absolutamente todo.'),
      btnAbrir,
      caja,
    ]);
  }

  async function mount(root) {
    root.innerHTML = '';
    resumenRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Contenido actual'),
      resumenRoot,
    ]));
    root.appendChild(panelExportar());
    root.appendChild(panelImportar());
    root.appendChild(panelBorrar());
    await renderResumen();
  }

  function destroy() {
    resumenRoot = null;
  }

  return { mount, destroy };
})();
