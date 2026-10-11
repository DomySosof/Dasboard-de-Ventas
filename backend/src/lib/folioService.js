const db = require('../db');
const calc = require('./calc');

function getPosConfigMap() {
  const rows = db.prepare('SELECT * FROM pos_config').all();
  const map = {};
  for (const r of rows) map[r.nombre] = r;
  return map;
}

/** Construye el objeto folio con todos los totales calculados (equivalente a una "fila" del Excel) */
function buildFolio(folioRow, pagos, folioAsociados, folioGastos, posConfigMap, asociadosMap, aliadosMap) {
  const montoTotal = pagos.reduce((s, p) => s + p.monto, 0);
  const baseImponible = calc.base(montoTotal);
  const ivaGenerado = calc.iva(montoTotal);
  const isrRetenido = calc.isr(montoTotal);

  const pagosConComision = pagos.map(p => {
    const conf = posConfigMap[p.medio_pago] || { formula: 'estandar', pct_ventas: 4.5, pct_iva_retencion: 15, fijo: 2.43 };
    return {
      ...p,
      comision_pos: calc.comisionPOS(p.monto, conf, p.tipo_pago),
      iva_retenido: calc.ivaRetenidoPOS(p.monto, conf, p.tipo_pago),
    };
  });
  const comisionPosTotal = pagosConComision.reduce((s, p) => s + p.comision_pos, 0);
  // El IVA retenido por el banco/POS no es un costo: es un pago de tu IVA.
  // Se saca del gasto externo y se acredita contra el IVA por pagar.
  const ivaRetenidoPosTotal = calc.round2(pagosConComision.reduce((s, p) => s + (p.iva_retenido || 0), 0));
  const comisionPosNeta = calc.round2(comisionPosTotal - ivaRetenidoPosTotal);

  const totalGastoAsociados = folioAsociados.reduce((s, fa) => s + fa.monto_pagado, 0);
  const totalGastoAliados = folioGastos.reduce((s, fg) => s + fg.monto, 0);
  const totalGastoExterno = calc.round2(folioRow.tuctuc + folioRow.cafe + totalGastoAliados + comisionPosNeta);
  const totalGastos = calc.round2(totalGastoAsociados + totalGastoExterno);

  const ivaRecuperado = folioAsociados.reduce((s, fa) => {
    const asociado = asociadosMap[fa.asociado_id];
    return s + calc.ivaRecuperadoDePago(fa.monto_pagado, asociado ? asociado.regimen : null);
  }, 0);

  // IVA por pagar neto: al IVA generado se le resta el IVA que ya retuvo el
  // banco/POS (si no, se pagaría dos veces ese IVA).
  const ivaPorPagar = calc.round2(ivaGenerado - ivaRetenidoPosTotal);
  const utilidadBruta = calc.round2(montoTotal - ivaPorPagar - isrRetenido);
  const utilidadNeta = calc.round2(utilidadBruta - totalGastos + ivaRecuperado);

  // tipo de pago "resumen": si hay más de un tipo distinto entre los pagos -> Mixto
  const tiposUnicos = [...new Set(pagos.map(p => p.tipo_pago))];
  const tipoPagoResumen = tiposUnicos.length === 1 ? tiposUnicos[0] : (tiposUnicos.length > 1 ? 'Mixto' : '');

  return {
    id: folioRow.id,
    fecha: folioRow.fecha,
    tipo: folioRow.tipo,
    pax: folioRow.pax,
    notas: folioRow.notas,
    tipo_pago: tipoPagoResumen,
    monto: calc.round2(montoTotal),
    base_imponible: calc.round2(baseImponible),
    iva: calc.round2(ivaGenerado),
    iva_retenido: ivaRetenidoPosTotal,
    iva_por_pagar: ivaPorPagar,
    isr: calc.round2(isrRetenido),
    pagos: pagosConComision,
    asociados: folioAsociados.map(fa => ({
      ...fa,
      asociado_nombre: asociadosMap[fa.asociado_id] ? asociadosMap[fa.asociado_id].nombre : '(eliminado)',
    })),
    gastos: folioGastos.map(fg => ({
      ...fg,
      aliado_nombre: aliadosMap[fg.aliado_id] ? aliadosMap[fg.aliado_id].nombre : '(eliminado)',
    })),
    tuctuc: folioRow.tuctuc,
    cafe: folioRow.cafe,
    comision_pos: calc.round2(comisionPosTotal),
    comision_pos_neta: comisionPosNeta,
    total_gasto_asociados: calc.round2(totalGastoAsociados),
    total_gasto_aliados: calc.round2(totalGastoAliados),
    total_gasto_externo: totalGastoExterno,
    total_gastos: totalGastos,
    utilidad_bruta: utilidadBruta,
    iva_recuperado: calc.round2(ivaRecuperado),
    utilidad_neta: utilidadNeta,
  };
}

/** Carga y calcula un folio por id. Devuelve null si no existe. */
function getFolioCompleto(folioId) {
  const folioRow = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folioRow) return null;
  const pagos = db.prepare('SELECT * FROM pagos WHERE folio_id = ? ORDER BY id').all(folioId);
  const folioAsociados = db.prepare('SELECT * FROM folio_asociados WHERE folio_id = ? ORDER BY id').all(folioId);
  const folioGastos = db.prepare('SELECT * FROM folio_gastos WHERE folio_id = ? ORDER BY id').all(folioId);
  const posConfigMap = getPosConfigMap();
  const asociados = db.prepare('SELECT * FROM asociados').all();
  const asociadosMap = {};
  for (const a of asociados) asociadosMap[a.id] = a;
  const aliados = db.prepare('SELECT * FROM aliados').all();
  const aliadosMap = {};
  for (const al of aliados) aliadosMap[al.id] = al;
  return buildFolio(folioRow, pagos, folioAsociados, folioGastos, posConfigMap, asociadosMap, aliadosMap);
}

/** Carga y calcula TODOS los folios (usado por listados y dashboard). Acepta filtro de fecha opcional. */
function getFoliosCompletos({ desde, hasta, tipo } = {}) {
  let sql = 'SELECT * FROM folios WHERE 1=1';
  const params = [];
  if (desde) { sql += ' AND fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND fecha <= ?'; params.push(hasta); }
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY fecha DESC, id DESC';
  const folioRows = db.prepare(sql).all(...params);
  if (folioRows.length === 0) return [];

  const posConfigMap = getPosConfigMap();
  const asociados = db.prepare('SELECT * FROM asociados').all();
  const asociadosMap = {};
  for (const a of asociados) asociadosMap[a.id] = a;
  const aliados = db.prepare('SELECT * FROM aliados').all();
  const aliadosMap = {};
  for (const al of aliados) aliadosMap[al.id] = al;

  const pagosStmt = db.prepare('SELECT * FROM pagos WHERE folio_id = ? ORDER BY id');
  const faStmt = db.prepare('SELECT * FROM folio_asociados WHERE folio_id = ? ORDER BY id');
  const fgStmt = db.prepare('SELECT * FROM folio_gastos WHERE folio_id = ? ORDER BY id');

  return folioRows.map(fr => buildFolio(fr, pagosStmt.all(fr.id), faStmt.all(fr.id), fgStmt.all(fr.id), posConfigMap, asociadosMap, aliadosMap));
}

module.exports = { getFolioCompleto, getFoliosCompletos, getPosConfigMap };
