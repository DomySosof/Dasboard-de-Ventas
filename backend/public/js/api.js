const Api = (() => {
  async function req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* sin body (204) */ }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  return {
    health: () => req('GET', '/api/health'),

    dashboard: (params) => req('GET', '/api/dashboard?' + new URLSearchParams(params).toString()),

    folios: {
      list: (params = {}) => req('GET', '/api/folios?' + new URLSearchParams(params).toString()),
      get: (id) => req('GET', `/api/folios/${id}`),
      create: (body) => req('POST', '/api/folios', body),
      update: (id, body) => req('PUT', `/api/folios/${id}`, body),
      remove: (id) => req('DELETE', `/api/folios/${id}`),

      addPago: (id, body) => req('POST', `/api/folios/${id}/pagos`, body),
      updatePago: (id, pagoId, body) => req('PUT', `/api/folios/${id}/pagos/${pagoId}`, body),
      removePago: (id, pagoId) => req('DELETE', `/api/folios/${id}/pagos/${pagoId}`),

      addAsociado: (id, body) => req('POST', `/api/folios/${id}/asociados`, body),
      updateAsociado: (id, faId, body) => req('PUT', `/api/folios/${id}/asociados/${faId}`, body),
      removeAsociado: (id, faId) => req('DELETE', `/api/folios/${id}/asociados/${faId}`),

      addGasto: (id, body) => req('POST', `/api/folios/${id}/gastos`, body),
      updateGasto: (id, gastoId, body) => req('PUT', `/api/folios/${id}/gastos/${gastoId}`, body),
      removeGasto: (id, gastoId) => req('DELETE', `/api/folios/${id}/gastos/${gastoId}`),
    },

    asociados: {
      list: () => req('GET', '/api/asociados'),
      get: (id) => req('GET', `/api/asociados/${id}`),
      create: (body) => req('POST', '/api/asociados', body),
      update: (id, body) => req('PUT', `/api/asociados/${id}`, body),
      remove: (id) => req('DELETE', `/api/asociados/${id}`),
    },

    aliados: {
      list: () => req('GET', '/api/aliados'),
      create: (body) => req('POST', '/api/aliados', body),
      update: (id, body) => req('PUT', `/api/aliados/${id}`, body),
      remove: (id) => req('DELETE', `/api/aliados/${id}`),
    },

    metas: {
      list: () => req('GET', '/api/metas'),
      get: (id) => req('GET', `/api/metas/${id}`),
      create: (body) => req('POST', '/api/metas', body),
      update: (id, body) => req('PUT', `/api/metas/${id}`, body),
      remove: (id) => req('DELETE', `/api/metas/${id}`),
    },

    datos: {
      exportarUrl: () => '/api/datos/exportar',
      plantillaUrl: () => '/api/datos/plantilla',
      importar: async (file) => {
        const fd = new FormData();
        fd.append('archivo', file);
        const res = await fetch('/api/datos/importar', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
      },
    },

    backup: {
      jsonUrl: () => '/api/backup/json',
      resumen: () => req('GET', '/api/backup/resumen'),
      importarJson: async (file) => {
        const fd = new FormData();
        fd.append('archivo', file);
        const res = await fetch('/api/backup/json', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
      },
      borrar: (modo) => req('POST', '/api/backup/borrar', { modo }),
    },

    pos: {
      list: () => req('GET', '/api/pos'),
      desglose: (monto, tipoPago) => req('GET', '/api/pos/desglose?' + new URLSearchParams({ monto, ...(tipoPago ? { tipo_pago: tipoPago } : {}) }).toString()),
      create: (body) => req('POST', '/api/pos', body),
      update: (id, body) => req('PUT', `/api/pos/${id}`, body),
      remove: (id) => req('DELETE', `/api/pos/${id}`),
    },

    catalogos: {
      tiposServicio: () => req('GET', '/api/catalogos/tipos-servicio'),
      addTipoServicio: (nombre, color) => req('POST', '/api/catalogos/tipos-servicio', { nombre, color }),
      updateTipoServicio: (id, body) => req('PUT', `/api/catalogos/tipos-servicio/${id}`, body),
      removeTipoServicio: (id) => req('DELETE', `/api/catalogos/tipos-servicio/${id}`),
      tiposPago: () => req('GET', '/api/catalogos/tipos-pago'),
      addTipoPago: (nombre) => req('POST', '/api/catalogos/tipos-pago', { nombre }),
      removeTipoPago: (id) => req('DELETE', `/api/catalogos/tipos-pago/${id}`),
    },
  };
})();
