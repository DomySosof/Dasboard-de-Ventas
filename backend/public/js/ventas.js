const VentasView = (() => {
  let asociadosCache = [];
  let aliadosCache = [];
  let posCache = [];
  let tiposServicioCache = [];
  let tiposPagoCache = [];
  let filaAsociadosContainer = null;
  let filaGastosContainer = null;
  let listaRoot = null;

  // ---------- Filas repetibles del formulario principal ----------

  function filaAsociado(pre = {}) {
    const asociadoSel = UI.el('select', { class: 'fa-asociado' },
      [UI.el('option', { value: '' }, '— Asociado —'),
        ...asociadosCache.map(a => UI.el('option', { value: a.id, ...(String(a.id) === String(pre.asociado_id) ? { selected: 'selected' } : {}) }, a.nombre))]);
    const servicioInput = UI.el('input', { type: 'text', class: 'fa-servicio', placeholder: 'Se autocompleta con la empresa del asociado', value: pre.servicio || '' });
    asociadoSel.addEventListener('change', () => {
      const a = asociadosCache.find(x => String(x.id) === asociadoSel.value);
      if (a) servicioInput.value = a.empresa || a.especialidad || '';
    });
    const montoInput = UI.el('input', { type: 'number', step: '0.01', min: '0', class: 'fa-monto', placeholder: 'Monto pagado', value: pre.monto_pagado || '' });
    const row = UI.el('div', { class: 'repeatable-row' }, [
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Asociado'), asociadoSel]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Servicio'), servicioInput]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Monto pagado'), montoInput]),
      UI.el('button', { class: 'btn danger small', type: 'button', onclick: () => row.remove() }, 'Quitar'),
    ]);
    return row;
  }

  function filaGasto(pre = {}) {
    const aliadoSel = UI.el('select', { class: 'fg-aliado' },
      [UI.el('option', { value: '' }, '— Aliado —'),
        ...aliadosCache.map(a => UI.el('option', { value: a.id, ...(String(a.id) === String(pre.aliado_id) ? { selected: 'selected' } : {}) }, a.nombre))]);
    const conceptoInput = UI.el('input', { type: 'text', class: 'fg-concepto', placeholder: 'Concepto (opcional)', value: pre.concepto || '' });
    const montoInput = UI.el('input', { type: 'number', step: '0.01', min: '0', class: 'fg-monto', placeholder: 'Monto', value: pre.monto || '' });
    const row = UI.el('div', { class: 'repeatable-row' }, [
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Aliado'), aliadoSel]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Concepto'), conceptoInput]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Monto'), montoInput]),
      UI.el('button', { class: 'btn danger small', type: 'button', onclick: () => row.remove() }, 'Quitar'),
    ]);
    return row;
  }

  function buildForm() {
    const idInput = UI.el('input', { type: 'number', min: '1', placeholder: 'Ej. 1', required: 'required' });
    const idHint = UI.el('div', { class: 'help-text' }, 'Escribe el número de folio. Si ya existe, este pago se sumará a esa venta.');
    idInput.addEventListener('blur', async () => {
      if (!idInput.value) { idHint.textContent = 'Escribe el número de folio. Si ya existe, este pago se sumará a esa venta.'; return; }
      try {
        const folio = await Api.folios.get(idInput.value);
        idHint.textContent = `Folio ${folio.id} ya existe (venta actual: ${UI.fmtMoney(folio.monto)}). Este pago se SUMARÁ a esa venta.`;
        idHint.style.color = 'var(--warn)';
      } catch (e) {
        idHint.textContent = 'Folio nuevo: se creará una venta nueva.';
        idHint.style.color = 'var(--accent)';
      }
    });

    const fechaInput = UI.el('input', { type: 'date', value: UI.todayISO(), required: 'required' });
    const tipoSel = UI.el('select', {}, [
      UI.el('option', { value: '' }, '— Tipo de servicio —'),
      ...tiposServicioCache.map(t => UI.el('option', { value: t.nombre }, t.nombre)),
    ]);
    const paxInput = UI.el('input', { type: 'number', min: '0', value: '1' });
    const tipoPagoSel = UI.el('select', { required: 'required' }, [
      UI.el('option', { value: '' }, '— Tipo de pago —'),
      ...tiposPagoCache.map(t => UI.el('option', { value: t.nombre }, t.nombre)),
    ]);
    const medioPagoSel = UI.el('select', { required: 'required' }, [
      UI.el('option', { value: '' }, '— Medio de pago / banco —'),
      ...posCache.map(p => UI.el('option', { value: p.nombre }, p.nombre)),
    ]);
    const montoInput = UI.el('input', { type: 'number', step: '0.01', min: '0.01', placeholder: '0.00', required: 'required' });

    filaAsociadosContainer = UI.el('div', {});
    const addFilaAsocBtn = UI.el('button', { class: 'btn secondary small', type: 'button', onclick: () => filaAsociadosContainer.appendChild(filaAsociado()) }, '+ Agregar pago a asociado');

    filaGastosContainer = UI.el('div', {});
    const addFilaGastoBtn = UI.el('button', { class: 'btn secondary small', type: 'button', onclick: () => filaGastosContainer.appendChild(filaGasto()) }, '+ Agregar gasto con aliado');

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'ID de folio'), idInput]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Fecha'), fechaInput]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Tipo de servicio'), tipoSel]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Pax'), paxInput]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Tipo de pago'), tipoPagoSel]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Medio de pago / banco'), medioPagoSel]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Monto recibido (Q)'), montoInput]),
      ]),
      idHint,

      UI.el('div', { class: 'section-divider' }, ['Pagos a asociados en esta venta', addFilaAsocBtn]),
      filaAsociadosContainer,

      UI.el('div', { class: 'section-divider' }, ['Gastos con aliados (tuctuc, café, combustible…)', addFilaGastoBtn]),
      filaGastosContainer,

      UI.el('div', { class: 'form-actions' }, [
        UI.el('button', { class: 'btn', type: 'submit' }, 'Guardar venta'),
        UI.el('span', { class: 'help-text' }, 'Base, IVA, ISR, comisión POS y utilidades se calculan automáticamente.'),
      ]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!idInput.value || !fechaInput.value || !tipoPagoSel.value || !medioPagoSel.value || !montoInput.value) {
        UI.toast('Completa folio, fecha, tipo de pago, medio de pago y monto.', true);
        return;
      }
      const asociados = [...filaAsociadosContainer.querySelectorAll('.repeatable-row')].map(row => ({
        asociado_id: row.querySelector('.fa-asociado').value,
        servicio: row.querySelector('.fa-servicio').value,
        monto_pagado: row.querySelector('.fa-monto').value,
      })).filter(a => a.asociado_id && a.monto_pagado);

      const gastos = [...filaGastosContainer.querySelectorAll('.repeatable-row')].map(row => ({
        aliado_id: row.querySelector('.fg-aliado').value,
        concepto: row.querySelector('.fg-concepto').value,
        monto: row.querySelector('.fg-monto').value,
      })).filter(g => g.aliado_id && g.monto);

      const body = {
        id: idInput.value, fecha: fechaInput.value, tipo: tipoSel.value, pax: paxInput.value,
        tipo_pago: tipoPagoSel.value, medio_pago: medioPagoSel.value, monto: montoInput.value,
        asociados, gastos,
      };
      try {
        const folio = await Api.folios.create(body);
        UI.toast(`Venta guardada. Folio ${folio.id} · Utilidad neta ${UI.fmtMoney(folio.utilidad_neta)}`);
        montoInput.value = ''; paxInput.value = '1';
        filaAsociadosContainer.innerHTML = '';
        filaGastosContainer.innerHTML = '';
        idHint.textContent = 'Escribe el número de folio. Si ya existe, este pago se sumará a esa venta.';
        idHint.style.color = '';
        await renderLista();
      } catch (err) {
        UI.toast(err.message || 'Ocurrió un error al guardar la venta', true);
      }
    });

    return form;
  }

  // ---------- Barra de importar / exportar ----------

  function buildImportExportBar() {
    const fileInput = UI.el('input', { type: 'file', accept: '.xlsx', style: 'display:none' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const resumen = await Api.datos.importar(file);
        const partes = [
          resumen.asociados_creados ? `${resumen.asociados_creados} asociados nuevos` : null,
          resumen.aliados_creados ? `${resumen.aliados_creados} aliados nuevos` : null,
          resumen.ventas_procesadas ? `${resumen.ventas_procesadas} pagos de venta` : null,
          resumen.pagos_asociados_procesados ? `${resumen.pagos_asociados_procesados} pagos a asociados` : null,
          resumen.gastos_aliados_procesados ? `${resumen.gastos_aliados_procesados} gastos con aliados` : null,
        ].filter(Boolean).join(', ');
        UI.toast(`Importación completa: ${partes || 'sin cambios'}${resumen.errores.length ? ` · ${resumen.errores.length} fila(s) con error` : ''}`, resumen.errores.length > 0);
        if (resumen.errores.length) console.warn('Errores de importación:', resumen.errores);
      } catch (err) {
        UI.toast(err.message || 'No se pudo importar el archivo', true);
      }
      fileInput.value = '';
      await renderLista();
      [asociadosCache, aliadosCache] = await Promise.all([Api.asociados.list(), Api.aliados.list()]);
    });

    return UI.el('div', { class: 'filters' }, [
      UI.el('a', { class: 'btn secondary small', href: Api.datos.plantillaUrl() }, 'Descargar plantilla'),
      UI.el('a', { class: 'btn secondary small', href: Api.datos.exportarUrl() }, 'Exportar a Excel'),
      UI.el('button', { class: 'btn small', type: 'button', onclick: () => fileInput.click() }, 'Importar Excel'),
      fileInput,
    ]);
  }

  // ---------- Tabla editable genérica (pagos / asociados / gastos dentro de un folio) ----------

  function filaPago(folio, p) {
    const tr = UI.el('tr');
    const pintar = () => {
      tr.innerHTML = '';
      tr.appendChild(UI.el('td', {}, p.tipo_pago));
      tr.appendChild(UI.el('td', {}, p.medio_pago));
      tr.appendChild(UI.el('td', { class: 'num' }, UI.fmtMoney(p.monto)));
      tr.appendChild(UI.el('td', { class: 'num', title: p.iva_retenido ? `Incluye IVA retenido ${UI.fmtMoney(p.iva_retenido)} (acreditable contra el IVA)` : '' }, UI.fmtMoney(p.comision_pos)));
      tr.appendChild(UI.el('td', { class: 'editable-row-actions' }, [
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
        UI.el('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => { try { await Api.folios.removePago(folio.id, p.id); UI.toast('Pago eliminado'); } catch (err) { UI.toast(err.message, true); return; } await renderLista(); },
        }, 'Eliminar'),
      ]));
    };
    const editar = () => {
      tr.innerHTML = '';
      const tipoPagoI = UI.el('select', {}, tiposPagoCache.map(t => UI.el('option', { value: t.nombre, ...(t.nombre === p.tipo_pago ? { selected: 'selected' } : {}) }, t.nombre)));
      const medioPagoI = UI.el('select', {}, posCache.map(m => UI.el('option', { value: m.nombre, ...(m.nombre === p.medio_pago ? { selected: 'selected' } : {}) }, m.nombre)));
      const montoI = UI.el('input', { type: 'number', step: '0.01', value: p.monto });
      tr.appendChild(UI.el('td', {}, tipoPagoI));
      tr.appendChild(UI.el('td', {}, medioPagoI));
      tr.appendChild(UI.el('td', {}, montoI));
      tr.appendChild(UI.el('td', {}, '—'));
      tr.appendChild(UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try {
              await Api.folios.updatePago(folio.id, p.id, { tipo_pago: tipoPagoI.value, medio_pago: medioPagoI.value, monto: montoI.value });
              UI.toast('Pago actualizado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Guardar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: pintar }, 'Cancelar'),
      ]));
    };
    pintar();
    return tr;
  }

  function filaAsociadoTabla(folio, fa) {
    const tr = UI.el('tr');
    const pintar = () => {
      tr.innerHTML = '';
      tr.appendChild(UI.el('td', {}, fa.asociado_nombre));
      tr.appendChild(UI.el('td', {}, fa.servicio || '—'));
      tr.appendChild(UI.el('td', { class: 'num' }, UI.fmtMoney(fa.monto_pagado)));
      tr.appendChild(UI.el('td', { class: 'editable-row-actions' }, [
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
        UI.el('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => { try { await Api.folios.removeAsociado(folio.id, fa.id); UI.toast('Registro eliminado'); } catch (err) { UI.toast(err.message, true); return; } await renderLista(); },
        }, 'Eliminar'),
      ]));
    };
    const editar = () => {
      tr.innerHTML = '';
      const asociadoI = UI.el('select', {}, asociadosCache.map(a => UI.el('option', { value: a.id, ...(String(a.id) === String(fa.asociado_id) ? { selected: 'selected' } : {}) }, a.nombre)));
      const servicioI = UI.el('input', { type: 'text', value: fa.servicio || '' });
      const montoI = UI.el('input', { type: 'number', step: '0.01', value: fa.monto_pagado });
      tr.appendChild(UI.el('td', {}, asociadoI));
      tr.appendChild(UI.el('td', {}, servicioI));
      tr.appendChild(UI.el('td', {}, montoI));
      tr.appendChild(UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try {
              await Api.folios.updateAsociado(folio.id, fa.id, { asociado_id: asociadoI.value, servicio: servicioI.value, monto_pagado: montoI.value });
              UI.toast('Actualizado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Guardar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: pintar }, 'Cancelar'),
      ]));
    };
    pintar();
    return tr;
  }

  function filaGastoTabla(folio, fg) {
    const tr = UI.el('tr');
    const pintar = () => {
      tr.innerHTML = '';
      tr.appendChild(UI.el('td', {}, fg.aliado_nombre));
      tr.appendChild(UI.el('td', {}, fg.concepto || '—'));
      tr.appendChild(UI.el('td', { class: 'num' }, UI.fmtMoney(fg.monto)));
      tr.appendChild(UI.el('td', { class: 'editable-row-actions' }, [
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar'),
        UI.el('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => { try { await Api.folios.removeGasto(folio.id, fg.id); UI.toast('Gasto eliminado'); } catch (err) { UI.toast(err.message, true); return; } await renderLista(); },
        }, 'Eliminar'),
      ]));
    };
    const editar = () => {
      tr.innerHTML = '';
      const aliadoI = UI.el('select', {}, aliadosCache.map(a => UI.el('option', { value: a.id, ...(String(a.id) === String(fg.aliado_id) ? { selected: 'selected' } : {}) }, a.nombre)));
      const conceptoI = UI.el('input', { type: 'text', value: fg.concepto || '' });
      const montoI = UI.el('input', { type: 'number', step: '0.01', value: fg.monto });
      tr.appendChild(UI.el('td', {}, aliadoI));
      tr.appendChild(UI.el('td', {}, conceptoI));
      tr.appendChild(UI.el('td', {}, montoI));
      tr.appendChild(UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try {
              await Api.folios.updateGasto(folio.id, fg.id, { aliado_id: aliadoI.value, concepto: conceptoI.value, monto: montoI.value });
              UI.toast('Actualizado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Guardar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: pintar }, 'Cancelar'),
      ]));
    };
    pintar();
    return tr;
  }

  function nuevaFilaPago(folio, tbody, contenedorBoton) {
    const tipoPagoI = UI.el('select', {}, tiposPagoCache.map(t => UI.el('option', { value: t.nombre }, t.nombre)));
    const medioPagoI = UI.el('select', {}, posCache.map(m => UI.el('option', { value: m.nombre }, m.nombre)));
    const montoI = UI.el('input', { type: 'number', step: '0.01', min: '0.01', placeholder: 'Monto' });
    const tr = UI.el('tr', {}, [
      UI.el('td', {}, tipoPagoI), UI.el('td', {}, medioPagoI), UI.el('td', {}, montoI), UI.el('td', {}, '—'),
      UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            if (!montoI.value) { UI.toast('Ingresa un monto', true); return; }
            try {
              await Api.folios.addPago(folio.id, { tipo_pago: tipoPagoI.value, medio_pago: medioPagoI.value, monto: montoI.value });
              UI.toast('Pago agregado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Agregar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: () => { tr.remove(); contenedorBoton.style.display = ''; } }, 'Cancelar'),
      ]),
    ]);
    tbody.appendChild(tr);
  }

  function nuevaFilaAsociado(folio, tbody, contenedorBoton) {
    const asociadoI = UI.el('select', {}, [
      UI.el('option', { value: '' }, '— Asociado —'),
      ...asociadosCache.map(a => UI.el('option', { value: a.id }, a.nombre)),
    ]);
    const servicioI = UI.el('input', { type: 'text', placeholder: 'Se autocompleta con la empresa del asociado' });
    asociadoI.addEventListener('change', () => {
      const a = asociadosCache.find(x => String(x.id) === asociadoI.value);
      if (a) servicioI.value = a.empresa || a.especialidad || '';
    });
    const montoI = UI.el('input', { type: 'number', step: '0.01', min: '0.01', placeholder: 'Monto pagado' });
    const tr = UI.el('tr', {}, [
      UI.el('td', {}, asociadoI), UI.el('td', {}, servicioI), UI.el('td', {}, montoI),
      UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            if (!asociadoI.value || !montoI.value) { UI.toast('Selecciona un asociado y un monto', true); return; }
            try {
              await Api.folios.addAsociado(folio.id, { asociado_id: asociadoI.value, servicio: servicioI.value, monto_pagado: montoI.value });
              UI.toast('Pago a asociado agregado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Agregar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: () => { tr.remove(); contenedorBoton.style.display = ''; } }, 'Cancelar'),
      ]),
    ]);
    tbody.appendChild(tr);
  }

  function nuevaFilaGasto(folio, tbody, contenedorBoton) {
    const aliadoI = UI.el('select', {}, [
      UI.el('option', { value: '' }, '— Aliado —'),
      ...aliadosCache.map(a => UI.el('option', { value: a.id }, a.nombre)),
    ]);
    const conceptoI = UI.el('input', { type: 'text', placeholder: 'Concepto (opcional)' });
    const montoI = UI.el('input', { type: 'number', step: '0.01', min: '0.01', placeholder: 'Monto' });
    const tr = UI.el('tr', {}, [
      UI.el('td', {}, aliadoI), UI.el('td', {}, conceptoI), UI.el('td', {}, montoI),
      UI.el('td', {}, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            if (!aliadoI.value || !montoI.value) { UI.toast('Selecciona un aliado y un monto', true); return; }
            try {
              await Api.folios.addGasto(folio.id, { aliado_id: aliadoI.value, concepto: conceptoI.value, monto: montoI.value });
              UI.toast('Gasto agregado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Agregar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: () => { tr.remove(); contenedorBoton.style.display = ''; } }, 'Cancelar'),
      ]),
    ]);
    tbody.appendChild(tr);
  }

  function encabezadoEditable(folio) {
    const box = UI.el('div', {});
    const pintar = () => {
      box.innerHTML = '';
      box.appendChild(UI.el('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, [
        UI.el('span', { class: 'muted' }, `Tipo: ${folio.tipo || '—'} · Pax: ${folio.pax || 0}`),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: editar }, 'Editar datos generales'),
      ]));
    };
    const editar = () => {
      box.innerHTML = '';
      const fechaI = UI.el('input', { type: 'date', value: folio.fecha });
      const tipoI = UI.el('select', {}, [
        UI.el('option', { value: '' }, '— Tipo —'),
        ...tiposServicioCache.map(t => UI.el('option', { value: t.nombre, ...(t.nombre === folio.tipo ? { selected: 'selected' } : {}) }, t.nombre)),
      ]);
      const paxI = UI.el('input', { type: 'number', min: '0', value: folio.pax || 0 });
      box.appendChild(UI.el('div', { class: 'form-grid', style: 'margin-bottom:10px' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Fecha'), fechaI]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Tipo'), tipoI]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Pax'), paxI]),
      ]));
      box.appendChild(UI.el('div', { class: 'form-actions' }, [
        UI.el('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try {
              await Api.folios.update(folio.id, { fecha: fechaI.value, tipo: tipoI.value, pax: paxI.value });
              UI.toast('Folio actualizado');
            } catch (err) { UI.toast(err.message, true); return; }
            await renderLista();
          },
        }, 'Guardar'),
        UI.el('button', { class: 'btn secondary small', type: 'button', onclick: pintar }, 'Cancelar'),
      ]));
    };
    pintar();
    return box;
  }

  function folioCard(folio) {
    const details = UI.el('details', { class: 'folio-card' });
    details.appendChild(UI.el('summary', {}, [
      UI.el('div', { class: 'folio-meta' }, [
        UI.el('span', { class: 'folio-id' }, `#${folio.id}`),
        UI.el('span', {}, folio.fecha),
        UI.el('span', { class: 'pill' }, folio.tipo || 'Sin tipo'),
        UI.el('span', { class: 'muted' }, `${folio.pax || 0} pax`),
        UI.el('span', { class: 'pill ochre' }, folio.tipo_pago || '—'),
      ]),
      UI.el('div', { class: 'folio-meta' }, [
        UI.el('span', {}, ['Venta: ', UI.el('strong', {}, UI.fmtMoney(folio.monto))]),
        UI.el('span', {}, ['Utilidad neta: ', UI.el('strong', {}, UI.fmtMoney(folio.utilidad_neta))]),
      ]),
    ]));

    const body = UI.el('div', { class: 'folio-body' });

    const resumen = UI.el('div', { class: 'grid grid-stats', style: 'margin-bottom:16px' }, [
      ['Base imponible', folio.base_imponible], ['IVA generado', folio.iva],
      ['IVA retenido POS', folio.iva_retenido], ['IVA por pagar', folio.iva_por_pagar],
      ['ISR', folio.isr],
      ['Gasto asociados', folio.total_gasto_asociados], ['Gasto con aliados', folio.total_gasto_aliados],
      ['Comisión POS (bruta)', folio.comision_pos], ['Comisión POS neta', folio.comision_pos_neta],
      ['IVA recuperado', folio.iva_recuperado],
      ['Utilidad bruta', folio.utilidad_bruta], ['Utilidad neta', folio.utilidad_neta],
    ].map(([l, v]) => UI.el('div', { class: 'stat-card' }, [
      UI.el('div', { class: 'label' }, l), UI.el('div', { class: 'value', style: 'font-size:16px' }, UI.fmtMoney(v)),
    ])));

    const pagosTbody = UI.el('tbody', {}, folio.pagos.map(p => filaPago(folio, p)));
    const pagosTable = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Tipo de pago'), UI.el('th', {}, 'Medio de pago'), UI.el('th', { class: 'num' }, 'Monto'), UI.el('th', { class: 'num' }, 'Comisión POS'), UI.el('th', {}, '')])),
      pagosTbody,
    ]);

    const asocTbody = UI.el('tbody', {}, folio.asociados.length ? folio.asociados.map(fa => filaAsociadoTabla(folio, fa)) : [UI.el('tr', {}, UI.el('td', { colspan: '4', class: 'empty-state' }, 'Sin pagos a asociados en esta venta.'))]);
    const asocTable = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Asociado'), UI.el('th', {}, 'Servicio'), UI.el('th', { class: 'num' }, 'Monto pagado'), UI.el('th', {}, '')])),
      asocTbody,
    ]);

    const gastosTbody = UI.el('tbody', {}, folio.gastos.length ? folio.gastos.map(fg => filaGastoTabla(folio, fg)) : [UI.el('tr', {}, UI.el('td', { colspan: '4', class: 'empty-state' }, 'Sin gastos con aliados en esta venta.'))]);
    const gastosTable = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Aliado'), UI.el('th', {}, 'Concepto'), UI.el('th', { class: 'num' }, 'Monto'), UI.el('th', {}, '')])),
      gastosTbody,
    ]);

    const agregarPagoBtn = UI.el('button', {
      class: 'btn secondary small', type: 'button',
      onclick: () => { agregarPagoBtn.style.display = 'none'; nuevaFilaPago(folio, pagosTbody, agregarPagoBtn); },
    }, '+ Agregar pago');

    const agregarAsociadoBtn = UI.el('button', {
      class: 'btn secondary small', type: 'button',
      onclick: () => { agregarAsociadoBtn.style.display = 'none'; nuevaFilaAsociado(folio, asocTbody, agregarAsociadoBtn); },
    }, '+ Agregar pago a asociado');

    const agregarGastoBtn = UI.el('button', {
      class: 'btn secondary small', type: 'button',
      onclick: () => { agregarGastoBtn.style.display = 'none'; nuevaFilaGasto(folio, gastosTbody, agregarGastoBtn); },
    }, '+ Agregar gasto con aliado');

    body.appendChild(encabezadoEditable(folio));
    body.appendChild(resumen);
    body.appendChild(UI.el('div', { class: 'section-divider' }, ['Pagos recibidos', agregarPagoBtn]));
    body.appendChild(UI.el('div', { class: 'table-wrap' }, pagosTable));
    body.appendChild(UI.el('div', { class: 'section-divider' }, ['Pagos a asociados', agregarAsociadoBtn]));
    body.appendChild(UI.el('div', { class: 'table-wrap' }, asocTable));
    body.appendChild(UI.el('div', { class: 'section-divider' }, ['Gastos con aliados', agregarGastoBtn]));
    body.appendChild(UI.el('div', { class: 'table-wrap' }, gastosTable));
    body.appendChild(UI.el('div', { class: 'form-actions' }, [
      UI.el('button', {
        class: 'btn danger small', type: 'button',
        onclick: async () => {
          if (!confirm(`¿Eliminar por completo el folio #${folio.id}? Esta acción no se puede deshacer.`)) return;
          try { await Api.folios.remove(folio.id); UI.toast('Folio eliminado'); } catch (err) { UI.toast(err.message, true); return; }
          await renderLista();
        },
      }, 'Eliminar folio completo'),
    ]));

    details.appendChild(body);
    return details;
  }

  async function renderLista() {
    if (!listaRoot) return;
    listaRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const folios = await Api.folios.list();
    listaRoot.innerHTML = '';
    if (!folios.length) {
      listaRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'Aún no hay ventas registradas.'));
      return;
    }
    folios.forEach(f => listaRoot.appendChild(folioCard(f)));
  }

  async function mount(root, actionsEl) {
    [asociadosCache, aliadosCache, posCache, tiposServicioCache, tiposPagoCache] = await Promise.all([
      Api.asociados.list(), Api.aliados.list(), Api.pos.list(), Api.catalogos.tiposServicio(), Api.catalogos.tiposPago(),
    ]);

    if (actionsEl) { actionsEl.innerHTML = ''; actionsEl.appendChild(buildImportExportBar()); }

    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Registrar venta / pago'),
      buildForm(),
    ]));

    listaRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Ventas registradas'),
      listaRoot,
    ]));

    await renderLista();
  }

  function destroy() { listaRoot = null; }

  return { mount, destroy };
})();
