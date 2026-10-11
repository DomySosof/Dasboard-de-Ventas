const TiposServicioView = (() => {
  let tableRoot = null;

  function buildForm() {
    const nombre = UI.el('input', { type: 'text', placeholder: 'Ej. Tour de aves, Kayak, Clase de cocina…', required: 'required' });
    const color = UI.el('input', { type: 'color', value: '#14161a' });

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Nombre del tipo de servicio'), nombre]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Color en las gráficas'), color]),
      ]),
      UI.el('div', { class: 'help-text' }, 'Este catálogo alimenta el selector "Tipo de servicio" en Datos de venta. El color que elijas aquí es el que se usa para la gráfica de ese paquete en el Dashboard.'),
      UI.el('div', { class: 'form-actions' }, [UI.el('button', { class: 'btn', type: 'submit' }, 'Agregar tipo de servicio')]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nombre.value) { UI.toast('El nombre es obligatorio', true); return; }
      try {
        await Api.catalogos.addTipoServicio(nombre.value, color.value);
        UI.toast('Tipo de servicio agregado');
      } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
      nombre.value = ''; color.value = '#14161a';
      await renderTabla();
    });

    return form;
  }

  function fila(t) {
    const tr = UI.el('tr');
    const editar = () => {
      tr.innerHTML = '';
      const nombreI = UI.el('input', { type: 'text', value: t.nombre });
      const colorI = UI.el('input', { type: 'color', value: t.color });
      const guardar = UI.el('button', {
        class: 'btn small', type: 'button',
        onclick: async () => {
          try {
            await Api.catalogos.updateTipoServicio(t.id, { nombre: nombreI.value, color: colorI.value });
            UI.toast('Actualizado');
          } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Guardar');
      tr.appendChild(UI.el('td', {}, colorI));
      tr.appendChild(UI.el('td', {}, nombreI));
      tr.appendChild(UI.el('td', {}, guardar));
    };

    tr.appendChild(UI.el('td', {}, UI.el('span', { style: `display:inline-block;width:18px;height:18px;border-radius:5px;background:${t.color};border:1px solid var(--line)` })));
    tr.appendChild(UI.el('td', {}, t.nombre));
    tr.appendChild(UI.el('td', {}, [
      UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
      ' ',
      UI.el('button', {
        class: 'btn danger small', type: 'button',
        onclick: async () => {
          if (!confirm(`¿Eliminar el tipo de servicio "${t.nombre}"? Las ventas ya registradas con este tipo conservan el texto.`)) return;
          try { await Api.catalogos.removeTipoServicio(t.id); UI.toast('Eliminado'); } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Eliminar'),
    ]));
    return tr;
  }

  async function renderTabla() {
    tableRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const rows = await Api.catalogos.tiposServicio();
    tableRoot.innerHTML = '';
    if (!rows.length) { tableRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'No hay tipos de servicio registrados.')); return; }
    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Color'), UI.el('th', {}, 'Nombre'), UI.el('th', {}, '')])),
    ]);
    const tbody = UI.el('tbody');
    rows.forEach(t => tbody.appendChild(fila(t)));
    table.appendChild(tbody);
    tableRoot.appendChild(UI.el('div', { class: 'table-wrap' }, table));
  }

  async function mount(root) {
    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Nuevo tipo de servicio'),
      buildForm(),
    ]));
    tableRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Tipos de servicio registrados'),
      tableRoot,
    ]));
    await renderTabla();
  }

  function destroy() { tableRoot = null; }

  return { mount, destroy };
})();
