const MetasView = (() => {
  let listRoot = null;

  function buildForm() {
    const nombre = UI.el('input', { type: 'text', placeholder: 'Ej. Meta Marzo 2026', required: 'required' });
    const inicio = UI.el('input', { type: 'date', required: 'required' });
    const fin = UI.el('input', { type: 'date', required: 'required' });
    const monto = UI.el('input', { type: 'number', step: '0.01', min: '0.01', placeholder: '0.00', required: 'required' });
    const notas = UI.el('input', { type: 'text', placeholder: 'Notas (opcional)' });

    const form = UI.el('form', {}, [
      UI.el('div', { class: 'form-grid' }, [
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Nombre de la meta'), nombre]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Desde'), inicio]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Hasta'), fin]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Monto meta (Q)'), monto]),
        UI.el('div', { class: 'field' }, [UI.el('label', {}, 'Notas'), notas]),
      ]),
      UI.el('div', { class: 'help-text' }, 'El progreso se calcula automáticamente sumando todas las ventas registradas entre esas dos fechas.'),
      UI.el('div', { class: 'form-actions' }, [UI.el('button', { class: 'btn', type: 'submit' }, 'Crear meta')]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nombre.value || !inicio.value || !fin.value || !monto.value) { UI.toast('Completa todos los campos obligatorios', true); return; }
      if (inicio.value > fin.value) { UI.toast('La fecha "Desde" no puede ser posterior a "Hasta"', true); return; }
      try {
        await Api.metas.create({ nombre: nombre.value, fecha_inicio: inicio.value, fecha_fin: fin.value, monto_meta: monto.value, notas: notas.value });
        UI.toast('Meta creada');
      } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
      nombre.value = ''; inicio.value = ''; fin.value = ''; monto.value = ''; notas.value = '';
      await renderLista();
    });

    return form;
  }

  function metaCard(m) {
    const pct = Math.min(m.porcentaje, 100);
    const card = UI.el('div', { class: 'meta-card' }, [
      UI.el('div', { class: 'meta-head' }, [
        UI.el('div', {}, [
          UI.el('div', { class: 'meta-nombre' }, m.nombre),
          UI.el('div', { class: 'meta-fechas' }, `${m.fecha_inicio} → ${m.fecha_fin} · ${m.cantidad_ventas} venta(s)`),
        ]),
        UI.el('span', { class: `pill ${m.cumplida ? 'green' : ''}` }, m.cumplida ? 'Meta alcanzada' : `${UI.fmtPct(m.porcentaje)}`),
      ]),
      UI.el('div', { class: 'progress-track' }, UI.el('div', { class: `progress-fill ${m.cumplida ? 'done' : ''}`, style: `width:${pct}%` })),
      UI.el('div', { class: 'meta-numeros' }, [
        UI.el('span', {}, ['Vendido: ', UI.el('strong', {}, UI.fmtMoney(m.venta_actual))]),
        UI.el('span', {}, ['Meta: ', UI.el('strong', {}, UI.fmtMoney(m.monto_meta))]),
        UI.el('span', {}, m.cumplida ? '¡Lograda! 🎉' : `Faltan ${UI.fmtMoney(m.faltante)}`),
      ]),
      m.notas ? UI.el('div', { class: 'help-text', style: 'margin-top:8px' }, m.notas) : null,
      UI.el('div', { class: 'form-actions', style: 'margin-top:10px' }, [
        UI.el('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => {
            if (!confirm(`¿Eliminar la meta "${m.nombre}"?`)) return;
            try { await Api.metas.remove(m.id); UI.toast('Meta eliminada'); } catch (err) { UI.toast(err.message || 'Ocurrió un error', true); return; }
            await renderLista();
          },
        }, 'Eliminar'),
      ]),
    ]);
    return card;
  }

  async function renderLista() {
    listRoot.innerHTML = '<div class="empty-state">Cargando…</div>';
    const metas = await Api.metas.list();
    listRoot.innerHTML = '';
    if (!metas.length) { listRoot.appendChild(UI.el('div', { class: 'empty-state' }, 'Aún no has creado ninguna meta.')); return; }
    const grid = UI.el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill, minmax(300px, 1fr))' });
    metas.forEach(m => grid.appendChild(metaCard(m)));
    listRoot.appendChild(grid);
  }

  async function mount(root) {
    root.innerHTML = '';
    root.appendChild(UI.el('div', { class: 'panel' }, [
      UI.el('div', { class: 'panel-title' }, 'Nueva meta de venta'),
      buildForm(),
    ]));
    listRoot = UI.el('div', { style: 'margin-top:18px' });
    root.appendChild(listRoot);
    await renderLista();
  }

  function destroy() { listRoot = null; }

  return { mount, destroy };
})();
