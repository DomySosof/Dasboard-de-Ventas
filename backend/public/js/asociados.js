const AsociadosView = (() => {
  let tableRoot = null;
  let summaryRoot = null;

  function buildForm() {
    const nombre = UI.el('input', { type: 'text', placeholder: 'Nombre completo', required: 'required' });
    const genero = UI.el('select', {}, [
      UI.el('option', { value: '' }, '— Género —'),
      UI.el('option', { value: 'hombre' }, 'Hombre'),
      UI.el('option', { value: 'mujer' }, 'Mujer'),
      UI.el('option', { value: 'otro' }, 'Otro'),
    ]);
    const fechaNacimiento = UI.el('input', { type: 'date' });
    const empresa = UI.el('input', { type: 'text', placeholder: 'Empresa (opcional)' });
    const especialidad = UI.el('input', { type: 'text', placeholder: 'Especialidad / servicio' });
    const regimen = UI.el('select', {}, [
      UI.el('option', { value: 'Pequeño Contribuyente' }, 'Pequeño Contribuyente'),
      UI.el('option', { value: 'General' }, 'Régimen General (IVA recuperable)'),
    ]);

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Nombre'), nombre]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Género'), genero]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Fecha de nacimiento'), fechaNacimiento]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Empresa'), empresa]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Especialidad'), especialidad]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Régimen fiscal'), regimen]),
      ]),
      UI.el('div', { class: 'help-text' }, 'La edad y la clasificación (Joven / Adulto) se calculan automáticamente a partir de la fecha de nacimiento. Si es Régimen General, el IVA de lo que se le paga se recupera automáticamente en el dashboard.'),
      UI.el('div', { class: 'form-actions' }, [
        UI.el('button', { class: 'btn', type: 'submit' }, 'Guardar asociado'),
      ]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nombre.value) { UI.toast('El nombre es obligatorio', true); return; }
      const body = {
        nombre: nombre.value, genero: genero.value, fecha_nacimiento: fechaNacimiento.value || null,
        empresa: empresa.value, especialidad: especialidad.value, regimen: regimen.value,
      };
      try {
        await Api.asociados.create(body);
        UI.toast('Asociado guardado');
      } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
      nombre.value = ''; genero.value = ''; fechaNacimiento.value = ''; empresa.value = ''; especialidad.value = '';
      await renderTabla();
    });

    return form;
  }

  function generoLabel(g) {
    if (g === 'hombre') return 'Hombre';
    if (g === 'mujer') return 'Mujer';
    if (g === 'otro') return 'Otro';
    return '—';
  }

  function fila(a) {
    const tr = UI.el('tr');
    const editar = () => {
      tr.innerHTML = '';
      const nombreI = UI.el('input', { type: 'text', value: a.nombre });
      const generoI = UI.el('select', {}, [
        UI.el('option', { value: 'hombre', ...(a.genero === 'hombre' ? { selected: 'selected' } : {}) }, 'Hombre'),
        UI.el('option', { value: 'mujer', ...(a.genero === 'mujer' ? { selected: 'selected' } : {}) }, 'Mujer'),
        UI.el('option', { value: 'otro', ...(a.genero === 'otro' ? { selected: 'selected' } : {}) }, 'Otro'),
      ]);
      const empresaI = UI.el('input', { type: 'text', value: a.empresa || '', placeholder: 'Empresa' });
      const especialidadI = UI.el('input', { type: 'text', value: a.especialidad || '', placeholder: 'Especialidad', style: 'margin-top:6px' });
      const fechaI = UI.el('input', { type: 'date', value: a.fecha_nacimiento || '' });
      const regimenI = UI.el('select', {}, [
        UI.el('option', { value: 'Pequeño Contribuyente', ...(a.regimen !== 'General' ? { selected: 'selected' } : {}) }, 'Pequeño Contribuyente'),
        UI.el('option', { value: 'General', ...(a.regimen === 'General' ? { selected: 'selected' } : {}) }, 'General'),
      ]);
      const guardar = UI.el('button', {
        class: 'btn small', type: 'button',
        onclick: async () => {
          try {
            await Api.asociados.update(a.id, {
              nombre: nombreI.value, genero: generoI.value, empresa: empresaI.value, especialidad: especialidadI.value,
              fecha_nacimiento: fechaI.value || null, regimen: regimenI.value,
            });
            UI.toast('Actualizado');
          } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Guardar');
      tr.appendChild(UI.el('td', {}, nombreI));
      tr.appendChild(UI.el('td', {}, generoI));
      tr.appendChild(UI.el('td', {}, [empresaI, especialidadI]));
      tr.appendChild(UI.el('td', {}, regimenI));
      tr.appendChild(UI.el('td', {}, fechaI));
      tr.appendChild(UI.el('td', {}, '—'));
      tr.appendChild(UI.el('td', {}, '—'));
      tr.appendChild(UI.el('td', {}, guardar));
    };

    tr.appendChild(UI.el('td', {}, a.nombre));
    tr.appendChild(UI.el('td', {}, UI.el('span', { class: `pill ${a.genero === 'mujer' ? 'ochre' : a.genero === 'hombre' ? '' : 'clay'}` }, generoLabel(a.genero))));
    tr.appendChild(UI.el('td', {}, [a.empresa || '', a.especialidad ? UI.el('div', { class: 'muted' }, a.especialidad) : null]));
    tr.appendChild(UI.el('td', {}, UI.el('span', { class: `pill ${a.regimen === 'General' ? 'green' : ''}` }, a.regimen)));
    tr.appendChild(UI.el('td', {}, a.fecha_nacimiento || '—'));
    tr.appendChild(UI.el('td', {}, a.edad === null ? '—' : String(a.edad)));
    tr.appendChild(UI.el('td', {}, a.clasificacion || '—'));
    tr.appendChild(UI.el('td', {}, [
      UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
      ' ',
      UI.el('button', {
        class: 'btn danger small', type: 'button',
        onclick: async () => {
          if (!confirm(`¿Eliminar a ${a.nombre}? Los pagos históricos que ya se le hicieron se conservan.`)) return;
          try { await Api.asociados.remove(a.id); UI.toast('Eliminado'); } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
          await renderTabla();
        },
      }, 'Eliminar'),
    ]));
    return tr;
  }

  function renderResumen(rows) {
    const hombres = rows.filter(r => r.genero === 'hombre').length;
    const mujeres = rows.filter(r => r.genero === 'mujer').length;
    const otros = rows.filter(r => r.genero !== 'hombre' && r.genero !== 'mujer').length;
    const jovenes = rows.filter(r => (r.clasificacion || '').startsWith('Joven'));
    const mayores = rows.filter(r => (r.clasificacion || '').startsWith('Adulto'));
    const jovenesHombres = jovenes.filter(r => r.genero === 'hombre').length;
    const jovenesMujeres = jovenes.filter(r => r.genero === 'mujer').length;
    const mayoresHombres = mayores.filter(r => r.genero === 'hombre').length;
    const mayoresMujeres = mayores.filter(r => r.genero === 'mujer').length;
    summaryRoot.innerHTML = '';
    summaryRoot.appendChild(UI.el('div', { class: 'stat-inline' }, [
      UI.el('span', { class: 'chip' }, `${rows.length} asociados en total`),
      UI.el('span', { class: 'chip men' }, `${hombres} hombres`),
      UI.el('span', { class: 'chip women' }, `${mujeres} mujeres`),
      otros ? UI.el('span', { class: 'chip' }, `${otros} sin especificar`) : null,
    ]));
    summaryRoot.appendChild(UI.el('div', { class: 'stat-inline', style: 'margin-top:8px' }, [
      UI.el('span', { class: 'chip' }, `${jovenes.length} jóvenes en total`),
      UI.el('span', { class: 'chip men' }, `${jovenesHombres} jóvenes hombres`),
      UI.el('span', { class: 'chip women' }, `${jovenesMujeres} jóvenes mujeres`),
      UI.el('span', { class: 'chip' }, `${mayores.length} adultos en total`),
      UI.el('span', { class: 'chip men' }, `${mayoresHombres} adultos hombres`),
      UI.el('span', { class: 'chip women' }, `${mayoresMujeres} adultas mujeres`),
    ]));
  }

  async function renderTabla() {
    tableRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const rows = await Api.asociados.list();
    tableRoot.innerHTML = '';
    renderResumen(rows);
    if (!rows.length) { tableRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'No hay asociados registrados.')); return; }
    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [
        UI.el('th', {}, 'Nombre'), UI.el('th', {}, 'Género'), UI.el('th', {}, 'Empresa / especialidad'), UI.el('th', {}, 'Régimen'),
        UI.el('th', {}, 'Nacimiento'), UI.el('th', {}, 'Edad'), UI.el('th', {}, 'Clasificación'), UI.el('th', {}, ''),
      ])),
    ]);
    const tbody = UI.el('tbody');
    rows.forEach(a => tbody.appendChild(fila(a)));
    table.appendChild(tbody);
    tableRoot.appendChild(UI.el('div', { class: 'table-wrap' }, table));
  }

  async function mount(root) {
    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Nuevo asociado'),
      buildForm(),
    ]));
    summaryRoot = UI.el('div', { style: 'margin-top:18px' });
    root.appendChild(summaryRoot);
    tableRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:10px' }, [
      UI.el('div', { class: 'panel-title' }, 'Asociados registrados'),
      tableRoot,
    ]));
    await renderTabla();
  }

  function destroy() { tableRoot = null; summaryRoot = null; }

  return { mount, destroy };
})();
