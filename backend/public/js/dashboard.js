const DashboardView = (() => {
  let charts = [];
  let state = { periodo: 'mes', fecha: UI.todayISO(), tipo: '' };

  function destroyCharts() {
    charts.forEach(c => c.destroy());
    charts = [];
  }

  function statCard(label, value, dark, sub) {
    return UI.el('div', { class: `stat-card ${dark ? 'dark' : ''}` }, [
      UI.el('div', { class: 'label' }, label),
      UI.el('div', { class: 'value' }, value),
      sub ? UI.el('div', { class: 'sub' }, sub) : null,
    ]);
  }

  function highlightCard(icon, titulo, valor, sub) {
    return UI.el('div', { class: 'highlight-card' }, [
      UI.el('div', { class: 'badge' }, icon),
      UI.el('div', {}, [
        UI.el('div', { class: 'htitle' }, titulo),
        UI.el('div', { class: 'hvalue' }, valor),
        sub ? UI.el('div', { class: 'hsub' }, sub) : null,
      ]),
    ]);
  }

  async function renderFilters(actionsEl, onChange) {
    const tipos = await Api.catalogos.tiposServicio().catch(() => []);

    const periodoSel = UI.el('select', { onchange: (e) => { state.periodo = e.target.value; onChange(); } },
      ['dia', 'semana', 'mes', 'trimestre', 'semestre', 'anio', 'todo'].map(p =>
        UI.el('option', { value: p, ...(p === state.periodo ? { selected: 'selected' } : {}) },
          ({ dia: 'Día', semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre', semestre: 'Semestre', anio: 'Año', todo: 'Todo' })[p])
      ));

    const fechaInput = UI.el('input', {
      type: 'date', value: state.fecha,
      onchange: (e) => { state.fecha = e.target.value; onChange(); }
    });

    const tipoSel = UI.el('select', { onchange: (e) => { state.tipo = e.target.value; onChange(); } }, [
      UI.el('option', { value: '' }, 'Todos los tipos'),
      ...tipos.map(t => UI.el('option', { value: t.nombre, ...(t.nombre === state.tipo ? { selected: 'selected' } : {}) }, t.nombre))
    ]);

    actionsEl.appendChild(UI.el('div', { class: 'filters' }, [
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Periodo'), periodoSel]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Referencia'), fechaInput]),
      UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Tipo de servicio'), tipoSel]),
    ]));
  }

  function renderRangoTexto(filtro) {
    if (!filtro.desde && !filtro.hasta) return 'Todo el historial';
    if (filtro.desde === filtro.hasta) return `Día: ${filtro.desde}`;
    return `Del ${filtro.desde} al ${filtro.hasta}`;
  }

  async function render(root) {
    root.innerHTML = '<div class="empty-state">Calculando…</div>';
    let data;
    try {
      data = await Api.dashboard({ periodo: state.periodo, fecha: state.fecha, tipo: state.tipo });
    } catch (e) {
      root.innerHTML = `<div class="empty-state">No se pudo cargar el dashboard: ${e.message}</div>`;
      return;
    }
    destroyCharts();

    const t = data.totales;

    const kpiGroup = (titulo, cards) => UI.el('div', { class: 'kpi-group' }, [
      UI.el('div', { class: 'kpi-group-title' }, titulo),
      UI.el('div', { class: 'grid grid-stats' }, cards),
    ]);

    const sectionHead = (titulo, hint) => UI.el('div', { class: 'section-head' }, [
      UI.el('h2', { class: 'section-title' }, titulo),
      hint ? UI.el('span', { class: 'section-hint' }, hint) : null,
    ]);

    const metaPanel = await buildMetasPanel(data.filtro);

    // --- Sección 1: Resumen financiero (KPIs agrupados por significado) ---
    const seccionResumen = UI.el('section', { class: 'dash-section is-first' }, [
      sectionHead('Resumen financiero', `${renderRangoTexto(data.filtro)} · ${t.cantidad_folios} venta(s)`),
      UI.el('div', { class: 'kpi-wrap' }, [
        kpiGroup('Ventas', [
          statCard('Venta total', UI.fmtMoney(t.venta_total)),
          statCard('Pax recibidos', UI.fmtNum(t.pax_total)),
        ]),
        kpiGroup('Impuestos por pagar', [
          statCard('IVA por pagar', UI.fmtMoney(t.iva_por_pagar), false,
            t.iva_retenido ? `Ya restado ${UI.fmtMoney(t.iva_retenido)} retenido por POS` : ''),
          statCard('ISR por pagar', UI.fmtMoney(t.isr_por_pagar)),
        ]),
        kpiGroup('Gastos', [
          statCard('Gasto con asociados', UI.fmtMoney(t.gasto_asociados)),
          statCard('Gasto externo', UI.fmtMoney(t.gasto_externo), false, 'Aliados + comisión POS (sin IVA retenido)'),
          statCard('IVA retenido POS', UI.fmtMoney(t.iva_retenido), false, 'Acreditado contra el IVA por pagar'),
          statCard('IVA recuperado', UI.fmtMoney(t.iva_recuperado), false, 'De asociados en Régimen General'),
        ]),
        kpiGroup('Resultado', [
          statCard('Utilidad bruta', UI.fmtMoney(t.utilidad_bruta)),
          statCard('Utilidad neta', UI.fmtMoney(t.utilidad_neta), true),
        ]),
      ]),
    ]);

    // --- Sección 2: Tipos de paquete (tipo de paquete vendido) ---
    const seccionPaquetes = UI.el('section', { class: 'dash-section' }, [
      sectionHead('Tipos de paquete', 'Cuáles se venden más y quién los atiende'),
      UI.el('div', { class: 'panel' }, [
        UI.el('div', { class: 'help-text', style: 'margin:0 0 14px' },
          'Una gráfica por cada tipo de servicio (colores configurables en "Tipos de servicio"). Cada asociado y cada aliado se cuenta una sola vez por tipo, aunque haya participado en varias ventas de ese tipo. "Con empresa" = el asociado tiene una empresa/cooperativa asignada en su ficha · "Independiente" = no tiene empresa asignada.'),
        data.por_paquete.length
          ? UI.el('div', {}, [
              UI.el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill, minmax(300px, 1fr))' }, data.por_paquete.map((p, i) => buildPaqueteMiniCard(p, i))),
              UI.el('div', { class: 'table-wrap', style: 'margin-top:20px' }, buildPaquetesTable(data.por_paquete)),
            ])
          : UI.el('div', { class: 'empty-state' }, 'No hay ventas con tipo de paquete en este periodo.'),
      ]),
    ]);

    // --- Sección 3: Cómo pagaron los clientes ---
    const seccionCobros = UI.el('section', { class: 'dash-section' }, [
      sectionHead('Cómo pagaron los clientes', 'Banco/app y medio de pago con mayor volumen'),
      UI.el('div', { class: 'grid grid-2' }, [
        data.medio_top
          ? highlightCard('🏦', 'Banco / app con más pagos recibidos', data.medio_top.concepto,
              `${UI.fmtMoney(data.medio_top.monto)} · ${data.medio_top.transacciones} transacciones · ${UI.fmtPct(data.medio_top.porcentaje)} del total`)
          : highlightCard('🏦', 'Banco / app con más pagos recibidos', 'Sin datos', ''),
        data.tipo_pago_top
          ? highlightCard('💳', 'Medio de pago más recibido', data.tipo_pago_top.concepto,
              `${UI.fmtMoney(data.tipo_pago_top.monto)} · ${data.tipo_pago_top.transacciones} transacciones · ${UI.fmtPct(data.tipo_pago_top.porcentaje)} del total`)
          : highlightCard('💳', 'Medio de pago más recibido', 'Sin datos', ''),
      ]),
    ]);

    // --- Sección 4: Metas ---
    const seccionMetas = metaPanel ? UI.el('section', { class: 'dash-section' }, [
      sectionHead('Metas del periodo', 'Avance de las metas que cruzan el rango filtrado'),
      metaPanel,
    ]) : null;

    // --- Sección 5: Ventas por tipo de pago (último) ---
    const seccionVentasPorTipoPago = UI.el('section', { class: 'dash-section' }, [
      sectionHead('Ventas por tipo de pago', 'Desglose final'),
      UI.el('div', { class: 'grid grid-charts' }, [
        UI.el('div', { class: 'panel' }, [
          UI.el('div', { class: 'panel-title' }, 'Ventas por tipo de pago'),
          UI.el('div', { class: 'chart-box' }, UI.el('canvas', { id: 'chart-tipo-pago' })),
        ]),
        UI.el('div', { class: 'panel' }, [
          UI.el('div', { class: 'panel-title' }, 'Ventas por banco / app (medio de pago)'),
          UI.el('div', { class: 'chart-box' }, UI.el('canvas', { id: 'chart-medio-pago' })),
        ]),
      ]),
    ]);

    // --- Sección 6: Asociados ---
    const seccionAsociados = UI.el('section', { class: 'dash-section' }, [
      sectionHead('Asociados', 'Monto recibido y paquetes en que participaron'),
      UI.el('div', { class: 'panel' }, data.por_asociado.length
        ? [buildResumenDemografico(data.resumen_demografico), UI.el('div', { class: 'table-wrap' }, buildAsociadosTable(data.por_asociado))]
        : UI.el('div', { class: 'empty-state' }, 'No hay pagos a asociados en este periodo.')),
    ]);

    root.innerHTML = '';
    root.appendChild(seccionResumen);
    root.appendChild(seccionPaquetes);
    root.appendChild(seccionCobros);
    if (seccionMetas) root.appendChild(seccionMetas);
    root.appendChild(seccionVentasPorTipoPago);
    root.appendChild(seccionAsociados);

    drawCharts(data);
  }

  function buildResumenDemografico(r) {
    if (!r) return null;
    return UI.el('div', { class: 'stat-inline' }, [
      UI.el('span', { class: 'chip' }, `${r.hombres + r.mujeres + r.sin_dato} asociados involucrados`),
      UI.el('span', { class: 'chip men' }, `${r.hombres} hombres`),
      UI.el('span', { class: 'chip women' }, `${r.mujeres} mujeres`),
      UI.el('span', { class: 'chip' }, `${r.jovenes} jóvenes (${r.jovenes_hombres} hombres · ${r.jovenes_mujeres} mujeres)`),
      UI.el('span', { class: 'chip' }, `${r.mayores} adultos (${r.mayores_hombres} hombres · ${r.mayores_mujeres} mujeres)`),
    ]);
  }

  function hexToRgba(hex, alpha) {
    const h = (hex || '#f4f4f6').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function buildPaqueteMiniCard(p, i) {
    const aliadosChips = p.aliados.length
      ? UI.el('div', { class: 'stat-inline', style: 'margin-top:10px' },
          p.aliados.map(a => UI.el('span', { class: 'chip' }, `${a.nombre} · x${a.veces} · ${UI.fmtMoney(a.monto)}`)))
      : UI.el('div', { class: 'help-text', style: 'margin-top:8px' }, 'Sin gastos con aliados en este tipo.');

    return UI.el('div', { class: 'panel', style: 'padding:14px 16px' }, [
      UI.el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px' }, [
        UI.el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}` }),
        UI.el('strong', { style: 'font-size:13.5px' }, p.tipo),
        UI.el('span', { class: 'muted', style: 'margin-left:auto;font-size:12px' }, `${p.ventas} venta(s) · ${UI.fmtMoney(p.monto)}`),
      ]),
      UI.el('div', { class: 'chart-box', style: 'height:170px' }, UI.el('canvas', { id: `chart-paquete-${i}` })),
      aliadosChips,
    ]);
  }

  function buildPaquetesTable(rows) {
    return UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [
        UI.el('th', {}, 'Tipo de paquete'), UI.el('th', { class: 'num' }, 'Ventas'), UI.el('th', { class: 'num' }, 'Monto'),
        UI.el('th', { class: 'num' }, 'Hombres'), UI.el('th', { class: 'num' }, 'Mujeres'),
        UI.el('th', { class: 'num' }, 'Jóvenes'), UI.el('th', { class: 'num' }, 'Adultos'),
        UI.el('th', { class: 'num' }, 'Con empresa'), UI.el('th', { class: 'num' }, 'Independientes'),
        UI.el('th', {}, 'Aliados involucrados'),
      ])),
      UI.el('tbody', {}, rows.map(r => UI.el('tr', {}, [
        UI.el('td', {}, [UI.el('span', { style: `display:inline-block;width:9px;height:9px;border-radius:50%;background:${r.color};margin-right:6px` }), r.tipo]),
        UI.el('td', { class: 'num' }, UI.fmtNum(r.ventas)), UI.el('td', { class: 'num' }, UI.fmtMoney(r.monto)),
        UI.el('td', { class: 'num' }, UI.fmtNum(r.hombres)), UI.el('td', { class: 'num' }, UI.fmtNum(r.mujeres)),
        UI.el('td', { class: 'num' }, UI.fmtNum(r.jovenes)), UI.el('td', { class: 'num' }, UI.fmtNum(r.mayores)),
        UI.el('td', { class: 'num' }, UI.fmtNum(r.con_empresa)), UI.el('td', { class: 'num' }, UI.fmtNum(r.independientes)),
        UI.el('td', {}, r.aliados.length ? r.aliados.map(a => `${a.nombre} (x${a.veces})`).join(', ') : '—'),
      ]))),
    ]);
  }

  function metaCardMini(m) {
    const pct = Math.min(m.porcentaje, 100);
    return UI.el('div', { class: 'meta-card' }, [
      UI.el('div', { class: 'meta-head' }, [
        UI.el('div', {}, [
          UI.el('div', { class: 'meta-nombre' }, m.nombre),
          UI.el('div', { class: 'meta-fechas' }, `${m.fecha_inicio} → ${m.fecha_fin}`),
        ]),
        UI.el('span', { class: `pill ${m.cumplida ? 'green' : ''}` }, m.cumplida ? 'Alcanzada' : UI.fmtPct(m.porcentaje)),
      ]),
      UI.el('div', { class: 'progress-track' }, UI.el('div', { class: `progress-fill ${m.cumplida ? 'done' : ''}`, style: `width:${pct}%` })),
      UI.el('div', { class: 'meta-numeros' }, [
        UI.el('span', {}, [UI.el('strong', {}, UI.fmtMoney(m.venta_actual)), ` de ${UI.fmtMoney(m.monto_meta)}`]),
        UI.el('span', {}, m.cumplida ? '¡Lograda! 🎉' : `Faltan ${UI.fmtMoney(m.faltante)}`),
      ]),
    ]);
  }

  // Muestra las metas cuyo rango de fechas se cruza con el periodo actualmente filtrado en el dashboard
  async function buildMetasPanel(filtro) {
    let metas = [];
    try { metas = await Api.metas.list(); } catch (e) { return null; }
    if (!metas.length) return null;

    const desde = filtro.desde;
    const hasta = filtro.hasta;
    const seCruzan = metas.filter(m => {
      if (!desde && !hasta) return true; // "Todo": muestra todas
      const iniOk = !hasta || m.fecha_inicio <= hasta;
      const finOk = !desde || m.fecha_fin >= desde;
      return iniOk && finOk;
    });
    if (!seCruzan.length) return null;

    return UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill, minmax(280px, 1fr))' }, seCruzan.map(metaCardMini)),
    ]);
  }

  function buildAsociadosTable(rows) {
    const table = UI.el('table', {}, [
      UI.el('thead', {}, UI.el('tr', {}, [
        UI.el('th', {}, 'Asociado'), UI.el('th', {}, 'Género'), UI.el('th', {}, 'Empresa / Especialidad'),
        UI.el('th', {}, 'Régimen'), UI.el('th', {}, 'Edad'), UI.el('th', {}, 'Clasificación'),
        UI.el('th', { class: 'num' }, 'Paquetes'), UI.el('th', { class: 'num' }, 'Monto recibido'),
      ])),
    ]);
    const tbody = UI.el('tbody');
    rows.forEach(r => {
      const generoLabel = r.genero === 'hombre' ? 'Hombre' : r.genero === 'mujer' ? 'Mujer' : '—';
      tbody.appendChild(UI.el('tr', {}, [
        UI.el('td', {}, r.nombre),
        UI.el('td', {}, generoLabel),
        UI.el('td', {}, r.empresa || r.especialidad || '—'),
        UI.el('td', {}, UI.el('span', { class: `pill ${r.regimen === 'General' ? 'green' : ''}` }, r.regimen || '—')),
        UI.el('td', {}, r.edad === null ? '—' : String(r.edad)),
        UI.el('td', {}, r.clasificacion || '—'),
        UI.el('td', { class: 'num' }, UI.fmtNum(r.paquetes)),
        UI.el('td', { class: 'num' }, UI.fmtMoney(r.monto_recibido)),
      ]));
    });
    table.appendChild(tbody);
    return table;
  }

  // Paleta monocromática (grises) alineada con el tema oscuro
  function palette(n) {
    const base = ['#f4f4f6', '#c3c2ca', '#9a99a1', '#6f6e77', '#4c4b52', '#e6e5ea', '#82818a', '#b3b2ba'];
    const out = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  function drawCharts(data) {
    // Tema oscuro: ejes y leyendas en gris claro (Chart.js por defecto usa gris oscuro)
    if (window.Chart) {
      Chart.defaults.color = '#a6a5ac';
      Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
      Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }
    const ctx1 = document.getElementById('chart-tipo-pago');
    const ctx2 = document.getElementById('chart-medio-pago');
    if (ctx1) {
      charts.push(new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: data.por_tipo_pago.map(x => x.concepto),
          datasets: [{
            data: data.por_tipo_pago.map(x => x.monto),
            backgroundColor: palette(data.por_tipo_pago.length),
            borderColor: '#1e1d20',
            borderWidth: 3,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                padding: 14,
                font: { size: 11.5 },
                generateLabels(chart) {
                  const ds = chart.data.datasets[0];
                  const total = ds.data.reduce((a, b) => a + b, 0) || 1;
                  return chart.data.labels.map((label, i) => ({
                    text: `${label} · ${UI.fmtPct((ds.data[i] / total) * 100)}`,
                    fillStyle: ds.backgroundColor[i],
                    strokeStyle: ds.backgroundColor[i],
                    lineWidth: 0,
                    pointStyle: 'circle',
                    hidden: typeof chart.getDataVisibility === 'function' ? !chart.getDataVisibility(i) : false,
                    index: i,
                  }));
                },
              },
            },
            tooltip: {
              callbacks: { label: (c) => ` ${c.label}: ${UI.fmtMoney(c.parsed)}` },
            },
          },
        },
      }));
    }
    if (ctx2) {
      charts.push(new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: data.por_medio_pago.map(x => x.concepto),
          datasets: [{ label: 'Monto recibido', data: data.por_medio_pago.map(x => x.monto), backgroundColor: '#dcdbe1', borderRadius: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 11 } } } },
        },
      }));
    }

    const ctx3 = document.getElementById('chart-paquete-0');
    if (ctx3 || data.por_paquete.length) {
      data.por_paquete.forEach((p, i) => {
        const canvas = document.getElementById(`chart-paquete-${i}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const gradiente = ctx.createLinearGradient(0, 0, 0, 170);
        gradiente.addColorStop(0, hexToRgba(p.color, 0.45));
        gradiente.addColorStop(1, hexToRgba(p.color, 0.02));
        charts.push(new Chart(canvas, {
          type: 'line',
          data: {
            labels: ['Ventas', 'Hombres', 'Mujeres', 'Jóvenes', 'Adultos', 'Con empresa', 'Independientes'],
            datasets: [{
              data: [p.ventas, p.hombres, p.mujeres, p.jovenes, p.mayores, p.con_empresa, p.independientes],
              borderColor: p.color,
              backgroundColor: gradiente,
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: p.color,
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.07)' } },
              x: { ticks: { font: { size: 9.5 }, maxRotation: 30, minRotation: 30 }, grid: { display: false } },
            },
          },
        }));
      });
    }
  }

  async function mount(root, actionsEl) {
    await renderFilters(actionsEl, () => render(root));
    await render(root);
  }

  function destroy() { destroyCharts(); }

  return { mount, destroy };
})();
