const PosView = (() => {
  let tableRoot = null;
  let desgloseRoot = null;
  let montoEjemplo = 50;
  let desgloseTimer = null;

  const FORMULAS = [
    ['estandar', 'Estándar (% venta + % IVA + fijo)'],
    ['recurrente', 'Recurrente (pasarela con cobro recurrente)'],
    ['sin_comision', 'Sin comisión'],
  ];

  function camposFormula(p, prefix) {
    // devuelve inputs según la fórmula seleccionada, para crear o editar
    const std = [
      UI.el('div', { class: 'field' }, [UI.el('label', {}, '% sobre venta'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-pct_ventas`, value: p.pct_ventas ?? 4.5 })]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, '% sobre IVA'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-pct_iva_retencion`, value: p.pct_iva_retencion ?? 15 })]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Cargo fijo (Q)'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-fijo`, value: p.fijo ?? 2.43 })]),
    ];
    const rec = [
      UI.el('div', { class: 'field' }, [UI.el('label', {}, '% paso IVA'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-rec_pct_iva_step`, value: p.rec_pct_iva_step ?? 15 })]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, '% sobre monto'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-rec_pct_monto`, value: p.rec_pct_monto ?? 4.59 })]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, '% final'), UI.el('input', { type: 'number', step: '0.01', class: `${prefix}-rec_pct_final`, value: p.rec_pct_final ?? 5 })]),
    ];
    return { std, rec };
  }

  function buildForm() {
    const nombre = UI.el('input', { type: 'text', placeholder: 'Ej. Visanet, Banco X, Link de pago Y', required: 'required' });
    const formula = UI.el('select', {}, FORMULAS.map(([v, l]) => UI.el('option', { value: v }, l)));
    const paramsBox = UI.el('div', { class: 'form-grid' });

    const campos = camposFormula({}, 'new');
    function refrescarCampos() {
      paramsBox.innerHTML = '';
      (formula.value === 'estandar' ? campos.std : formula.value === 'recurrente' ? campos.rec : [])
        .forEach(c => paramsBox.appendChild(c));
    }
    formula.addEventListener('change', refrescarCampos);
    refrescarCampos();

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Nombre del banco / POS / pasarela'), nombre]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Tipo de fórmula'), formula]),
      ]),
      paramsBox,
      UI.el('div', { class: 'help-text' }, 'Cada banco o pasarela puede cobrar comisión distinta. Ajusta aquí los porcentajes según tu contrato con cada uno. Los pagos en Efectivo nunca generan comisión, sin importar el medio elegido.'),
      UI.el('div', { class: 'form-actions' }, [UI.el('button', { class: 'btn', type: 'submit' }, 'Agregar medio de pago')]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nombre.value) { UI.toast('El nombre es obligatorio', true); return; }
      const body = {
        nombre: nombre.value, formula: formula.value,
        pct_ventas: form.querySelector('.new-pct_ventas')?.value,
        pct_iva_retencion: form.querySelector('.new-pct_iva_retencion')?.value,
        fijo: form.querySelector('.new-fijo')?.value,
        rec_pct_iva_step: form.querySelector('.new-rec_pct_iva_step')?.value,
        rec_pct_monto: form.querySelector('.new-rec_pct_monto')?.value,
        rec_pct_final: form.querySelector('.new-rec_pct_final')?.value,
      };
      await UI.handle(Api.pos.create(body), 'Medio de pago agregado');
      nombre.value = '';
      await renderTabla();
    });

    return form;
  }

  function fila(p) {
    const tr = UI.el('tr');
    const detalle = p.formula === 'estandar'
      ? `${p.pct_ventas}% venta + ${p.pct_iva_retencion}% del IVA + Q${p.fijo}`
      : p.formula === 'recurrente'
        ? `IVA×${p.rec_pct_iva_step}% + monto×${p.rec_pct_monto}% + resto×${p.rec_pct_final}%`
        : 'Sin comisión';

    tr.appendChild(UI.el('td', {}, p.nombre));
    tr.appendChild(UI.el('td', {}, UI.el('span', { class: 'pill' }, ({ estandar: 'Estándar', recurrente: 'Recurrente', sin_comision: 'Sin comisión' })[p.formula])));
    tr.appendChild(UI.el('td', { class: 'muted' }, detalle));
    tr.appendChild(UI.el('td', {}, [
      UI.el('button', {
        class: 'btn secondary small', type: 'button',
        onclick: () => abrirEdicion(tr, p),
      }, 'Editar'),
      ' ',
      UI.el('button', {
        class: 'btn danger small', type: 'button',
        onclick: async () => {
          if (!confirm(`¿Eliminar "${p.nombre}" del catálogo de medios de pago?`)) return;
          await UI.handle(Api.pos.remove(p.id), 'Eliminado');
          await renderTabla();
        },
      }, 'Eliminar'),
    ]));
    return tr;
  }

  function abrirEdicion(tr, p) {
    tr.innerHTML = '';
    const formulaSel = UI.el('select', {}, FORMULAS.map(([v, l]) => UI.el('option', { value: v, ...(v === p.formula ? { selected: 'selected' } : {}) }, l)));
    const paramsBox = UI.el('div', { class: 'form-grid' });
    const campos = camposFormula(p, 'edit');
    function refrescar() {
      paramsBox.innerHTML = '';
      (formulaSel.value === 'estandar' ? campos.std : formulaSel.value === 'recurrente' ? campos.rec : [])
        .forEach(c => paramsBox.appendChild(c));
    }
    formulaSel.addEventListener('change', refrescar);
    refrescar();

    const guardar = UI.el('button', {
      class: 'btn small', type: 'button',
      onclick: async () => {
        const body = {
          formula: formulaSel.value,
          pct_ventas: tr.querySelector('.edit-pct_ventas')?.value,
          pct_iva_retencion: tr.querySelector('.edit-pct_iva_retencion')?.value,
          fijo: tr.querySelector('.edit-fijo')?.value,
          rec_pct_iva_step: tr.querySelector('.edit-rec_pct_iva_step')?.value,
          rec_pct_monto: tr.querySelector('.edit-rec_pct_monto')?.value,
          rec_pct_final: tr.querySelector('.edit-rec_pct_final')?.value,
        };
        await UI.handle(Api.pos.update(p.id, body), 'Actualizado');
        await renderTabla();
      },
    }, 'Guardar');

    const td1 = UI.el('td', {}, p.nombre);
    const td2 = UI.el('td', {}, formulaSel);
    const td3 = UI.el('td', {}, paramsBox);
    const td4 = UI.el('td', {}, guardar);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
  }

  async function renderTabla() {
    tableRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const rows = await Api.pos.list();
    tableRoot.innerHTML = '';
    if (!rows.length) { tableRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'No hay medios de pago configurados.')); return; }
    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [UI.el('th', {}, 'Nombre'), UI.el('th', {}, 'Fórmula'), UI.el('th', {}, 'Detalle'), UI.el('th', {}, '')])),
    ]);
    const tbody = UI.el('tbody');
    rows.forEach(p => tbody.appendChild(fila(p)));
    table.appendChild(tbody);
    tableRoot.appendChild(UI.el('div', { class: 'table-wrap' }, table));
  }

  // ---------- Desglose verificable de la comisión ----------

  function inputMonto() {
    const input = UI.el('input', {
      type: 'number', step: '0.01', min: '0.01', value: String(montoEjemplo),
      style: 'max-width:140px',
      oninput: (e) => {
        const v = Number(e.target.value);
        if (!isFinite(v) || v <= 0) return;
        montoEjemplo = v;
        clearTimeout(desgloseTimer);
        desgloseTimer = setTimeout(renderDesglose, 300);
      },
    });
    return UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Monto de ejemplo (Q)'), input]);
  }

  async function renderDesglose() {
    if (!desgloseRoot) return;
    desgloseRoot.innerHTML = '<div class="empty-state">Calculando…</div>';
    let data;
    try {
      data = await Api.pos.desglose(montoEjemplo);
    } catch (e) {
      desgloseRoot.innerHTML = `<div class="empty-state">No se pudo calcular: ${e.message}</div>`;
      return;
    }

    const fmt6 = (n) => 'Q ' + (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

    const resumen = UI.el('div', { class: 'stat-inline' }, [
      UI.el('span', { class: 'chip' }, `Monto: ${UI.fmtMoney(data.monto)}`),
      UI.el('span', { class: 'chip' }, `Base = monto / 1.12 = ${fmt6(data.base)}`),
      UI.el('span', { class: 'chip' }, `IVA = base × 12% = ${fmt6(data.iva)}`),
    ]);

    desgloseRoot.innerHTML = '';
    desgloseRoot.appendChild(resumen);

    if (!data.medios.length) {
      desgloseRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'No hay medios configurados.'));
      return;
    }

    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [
        UI.el('th', {}, 'Medio'),
        UI.el('th', {}, 'Cómo se calcula'),
        UI.el('th', { class: 'num' }, 'Retención sobre el IVA'),
        UI.el('th', { class: 'num' }, 'Comisión total'),
      ])),
    ]);
    const tbody = UI.el('tbody');
    for (const m of data.medios) {
      const partes = m.sin_comision
        ? UI.el('span', { class: 'muted' }, 'Sin comisión')
        : UI.el('div', {}, m.partes.map(p =>
            UI.el('div', { class: 'muted', style: 'font-size:12px;line-height:1.5' }, `${p.etiqueta}: ${fmt6(p.monto)}`)));
      tbody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, m.nombre),
        UI.el('td', {}, partes),
        UI.el('td', { class: 'num' }, m.sin_comision ? '—' : fmt6(m.retencion_iva)),
        UI.el('td', { class: 'num' }, UI.fmtMoney(m.comision)),
      ]));
    }
    table.appendChild(tbody);
    desgloseRoot.appendChild(UI.el('div', { class: 'table-wrap', style: 'margin-top:12px' }, table));
  }

  async function mount(root) {
    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Nuevo banco / POS / pasarela'),
      buildForm(),
    ]));
    tableRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Medios de pago configurados'),
      tableRoot,
    ]));

    desgloseRoot = UI.el('div');
    root.appendChild(UI.el('div', { class: 'panel', style: 'margin-top:18px' }, [
      UI.el('div', { class: 'panel-title' }, 'Verificación del cálculo'),
      UI.el('div', { class: 'help-text', style: 'margin:0 0 12px' },
        'Comprueba cómo queda la comisión para un monto. La retención se aplica sobre el IVA de la transacción: base = monto / 1.12, IVA = base × 12% y retención = IVA × el % configurado (por defecto 15%). Ej.: para Q50 → base 44.642857, IVA 5.357143 y retención 0.803571.'),
      inputMonto(),
      desgloseRoot,
    ]));

    await Promise.all([renderTabla(), renderDesglose()]);
  }

  function destroy() {
    clearTimeout(desgloseTimer);
    tableRoot = null;
    desgloseRoot = null;
  }

  return { mount, destroy };
})();
