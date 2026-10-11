const AliadosView = (() => {
  let tableRoot = null;

  function buildForm() {
    const nombre = UI.el('input', { type: 'text', placeholder: 'Ej. Tuctuc Don Chepe, Cafetería El Lago', required: 'required' });
    const categoria = UI.el('input', { type: 'text', placeholder: 'Categoría (Transporte, Alimentos, etc.)' });

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Nombre del aliado'), nombre]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Categoría'), categoria]),
      ]),
      UI.el('div', { class: 'help-text' }, 'Los aliados son proveedores de gastos externos (tuctuc, café, combustible, almuerzos, etc.) que puedes seleccionar al registrar una venta, en vez de escribir el gasto a mano cada vez.'),
      UI.el('div', { class: 'form-actions' }, [UI.el('button', { class: 'btn', type: 'submit' }, 'Guardar aliado')]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nombre.value) { UI.toast('El nombre es obligatorio', true); return; }
      try {
        await Api.aliados.create({ nombre: nombre.value, categoria: categoria.value });
        UI.toast('Aliado guardado');
      } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
      nombre.value = ''; categoria.value = '';
      await renderTabla();
    });

    return form;
  }

  function fila(a) {
    const tr = UI.el('tr');
    const editar = () => {
      tr.innerHTML = '';
      const nombreI = UI.el('input', { type: 'text', value: a.nombre });
      const categoriaI = UI.el('input', { type: 'text', value: a.categoria || '' });
      const guardar = UI.el('button', {
        class: 'btn small', type: 'button',
        onclick: async () => {
          try {
            await Api.aliados.update(a.id, { nombre: nombreI.value, categoria: categoriaI.value });
            UI.toast('Actualizado');
          } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Guardar');
      tr.appendChild(UI.el('td', {}, nombreI));
      tr.appendChild(UI.el('td', {}, categoriaI));
      tr.appendChild(UI.el('td', {}, guardar));
    };

    tr.appendChild(UI.el('td', {}, a.nombre));
    tr.appendChild(UI.el('td', {}, a.categoria ? UI.el('span', { class: 'pill' }, a.categoria) : '—'));
    tr.appendChild(UI.el('td', {}, [
      UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
      ' ',
      UI.el('button', {
        class: 'btn danger small', type: 'button',
        onclick: async () => {
          if (!confirm(`¿Eliminar al aliado "${a.nombre}"? Los gastos históricos ya registrados se conservan.`)) return;
          try { await Api.aliados.remove(a.id); UI.toast('Eliminado'); } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Eliminar'),
    ]));
    return tr;
  }

  async function renderTabla() {
    tableRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const rows = await Api.aliados.list();
    tableRoot.innerHTML = '';
    if (!rows.length) { tableRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'No hay aliados registrados.')); return; }
    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Nombre'), UI.el('th', {}, 'Categoría'), UI.el('th', {}, '')])),
    ]);
    const tbody = UI.el('tbody');
    rows.forEach(a => tbody.appendChild(fila(a)));
    table.appendChild(tbody);
    tableRoot.appendChild(UI.el('div', { class: 'table-wrap' }, table));
  }

  async function mount(root) {
    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Nuevo aliado'),
      buildForm(),
    ]));
    tableRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Aliados registrados'),
      tableRoot,
    ]));
    await renderTabla();
  }

  function destroy() { tableRoot = null; }

  return { mount, destroy };
})();
