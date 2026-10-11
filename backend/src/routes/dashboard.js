const express = require('express');
const db = require('../db');
const { getFoliosCompletos, getPosConfigMap } = require('../lib/folioService');
const calc = require('../lib/calc');

const router = express.Router();

function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Calcula {desde, hasta} (strings YYYY-MM-DD) según el periodo pedido, relativo a una fecha de referencia */
function calcularRango(periodo, fechaRef, desdeQS, hastaQS) {
  if (periodo === 'personalizado') {
    return { desde: desdeQS || null, hasta: hastaQS || null };
  }
  if (periodo === 'todo' || !periodo) {
    return { desde: null, hasta: null };
  }
  const ref = fechaRef ? new Date(fechaRef + 'T00:00:00') : new Date();
  const y = ref.getFullYear();
  const m = ref.getMonth(); // 0-11

  switch (periodo) {
    case 'dia': {
      const d = iso(ref);
      return { desde: d, hasta: d };
    }
    case 'semana': {
      const day = (ref.getDay() + 6) % 7; // 0=lunes
      const lunes = new Date(ref); lunes.setDate(ref.getDate() - day);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { desde: iso(lunes), hasta: iso(domingo) };
    }
    case 'mes': {
      const inicio = new Date(y, m, 1);
      const fin = new Date(y, m + 1, 0);
      return { desde: iso(inicio), hasta: iso(fin) };
    }
    case 'trimestre': {
      const q = Math.floor(m / 3); // 0-3
      const inicio = new Date(y, q * 3, 1);
      const fin = new Date(y, q * 3 + 3, 0);
      return { desde: iso(inicio), hasta: iso(fin) };
    }
    case 'semestre': {
      const s = m < 6 ? 0 : 1;
      const inicio = new Date(y, s * 6, 1);
      const fin = new Date(y, s * 6 + 6, 0);
      return { desde: iso(inicio), hasta: iso(fin) };
    }
    case 'anio': {
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    }
    default:
      return { desde: null, hasta: null };
  }
}

// GET /api/dashboard?periodo=mes&fecha=2026-02-15&tipo=Tour%20cultural
// periodo: dia | semana | mes | trimestre | semestre | anio | todo | personalizado (usa desde/hasta)
router.get('/', (req, res) => {
  const { periodo, fecha, desde: desdeQS, hasta: hastaQS, tipo } = req.query;
  const { desde, hasta } = calcularRango(periodo, fecha, desdeQS, hastaQS);

  const folios = getFoliosCompletos({ desde, hasta, tipo: tipo || null });

  // Info de asociados (empresa, régimen, edad, clasificación, género) desde la tabla asociados
  const asociadosInfo = db.prepare('SELECT * FROM asociados').all();
  const asociadosInfoMap = {};
  for (const a of asociadosInfo) asociadosInfoMap[a.id] = a;

  // Colores configurados por tipo de servicio (pestaña "Tipos de servicio")
  const tiposServicioInfo = db.prepare('SELECT * FROM tipos_servicio').all();
  const tiposServicioMap = {};
  for (const ts of tiposServicioInfo) tiposServicioMap[ts.nombre] = ts;

  const totales = {
    venta_total: 0,
    pax_total: 0,
    base_imponible: 0,
    iva_por_pagar: 0,
    iva_retenido: 0,
    isr_por_pagar: 0,
    gasto_asociados: 0,
    gasto_externo: 0,
    total_gastos: 0,
    utilidad_bruta: 0,
    iva_recuperado: 0,
    utilidad_neta: 0,
    cantidad_folios: folios.length,
  };

  const porTipoPago = {};   // { Tarjeta: {transacciones, monto} }
  const porMedioPago = {};  // { Qpaypro: {transacciones, monto} }
  const porAsociado = {};   // { asociado_id: {nombre, empresa, regimen, edad, clasificacion, paquetes:Set, monto} }
  const matrizMedioTipo = {}; // { medio: { tipo: monto } }
  const porPaquete = {};    // { tipoServicio: { folios:Set, monto:0, asociadosMap:Map } }

  for (const f of folios) {
    totales.venta_total += f.monto;
    totales.pax_total += f.pax || 0;
    totales.base_imponible += f.base_imponible;
    totales.iva_por_pagar += f.iva_por_pagar;
    totales.iva_retenido += f.iva_retenido;
    totales.isr_por_pagar += f.isr;
    totales.gasto_asociados += f.total_gasto_asociados;
    totales.gasto_externo += f.total_gasto_externo;
    totales.total_gastos += f.total_gastos;
    totales.utilidad_bruta += f.utilidad_bruta;
    totales.iva_recuperado += f.iva_recuperado;
    totales.utilidad_neta += f.utilidad_neta;

    for (const p of f.pagos) {
      if (!porTipoPago[p.tipo_pago]) porTipoPago[p.tipo_pago] = { concepto: p.tipo_pago, transacciones: 0, monto: 0 };
      porTipoPago[p.tipo_pago].transacciones++;
      porTipoPago[p.tipo_pago].monto += p.monto;

      if (!porMedioPago[p.medio_pago]) porMedioPago[p.medio_pago] = { concepto: p.medio_pago, transacciones: 0, monto: 0 };
      porMedioPago[p.medio_pago].transacciones++;
      porMedioPago[p.medio_pago].monto += p.monto;

      if (!matrizMedioTipo[p.medio_pago]) matrizMedioTipo[p.medio_pago] = {};
      matrizMedioTipo[p.medio_pago][p.tipo_pago] = (matrizMedioTipo[p.medio_pago][p.tipo_pago] || 0) + p.monto;
    }

    const paquetesEnEsteFolio = new Set();
    for (const fa of f.asociados) {
      if (!porAsociado[fa.asociado_id]) {
        porAsociado[fa.asociado_id] = {
          asociado_id: fa.asociado_id,
          nombre: fa.asociado_nombre,
          monto_recibido: 0,
          paquetes: new Set(),
        };
      }
      porAsociado[fa.asociado_id].monto_recibido += fa.monto_pagado;
      porAsociado[fa.asociado_id].paquetes.add(f.id);
    }

    // --- Por tipo de paquete: qué tipos se venden más y quién los atiende ---
    const tipoPaquete = f.tipo || '(Sin tipo)';
    if (!porPaquete[tipoPaquete]) {
      porPaquete[tipoPaquete] = { tipo: tipoPaquete, folios: new Set(), monto: 0, asociadosMap: new Map(), aliadosMap: new Map() };
    }
    porPaquete[tipoPaquete].folios.add(f.id);
    porPaquete[tipoPaquete].monto += f.monto;
    for (const fa of f.asociados) {
      if (!porPaquete[tipoPaquete].asociadosMap.has(fa.asociado_id)) {
        porPaquete[tipoPaquete].asociadosMap.set(fa.asociado_id, asociadosInfoMap[fa.asociado_id] || null);
      }
    }
    for (const fg of f.gastos) {
      const actual = porPaquete[tipoPaquete].aliadosMap.get(fg.aliado_id) || { nombre: fg.aliado_nombre, veces: 0, monto: 0 };
      actual.veces += 1;
      actual.monto += fg.monto;
      porPaquete[tipoPaquete].aliadosMap.set(fg.aliado_id, actual);
    }
  }

  // redondeos
  for (const k of Object.keys(totales)) {
    if (typeof totales[k] === 'number') totales[k] = calc.round2(totales[k]);
  }

  const listaTipoPago = Object.values(porTipoPago).map(x => ({
    ...x, monto: calc.round2(x.monto),
    porcentaje: totales.venta_total ? calc.round2((x.monto / totales.venta_total) * 100) : 0,
  })).sort((a, b) => b.monto - a.monto);

  const listaMedioPago = Object.values(porMedioPago).map(x => ({
    ...x, monto: calc.round2(x.monto),
    porcentaje: totales.venta_total ? calc.round2((x.monto / totales.venta_total) * 100) : 0,
  })).sort((a, b) => b.monto - a.monto);

  // Completa info de asociados por venta (nombre ya viene del folio)
  const listaAsociados = Object.values(porAsociado).map(x => {
    const info = asociadosInfoMap[x.asociado_id] || {};
    return {
      asociado_id: x.asociado_id,
      nombre: x.nombre,
      genero: info.genero || '',
      empresa: info.empresa || '',
      especialidad: info.especialidad || '',
      regimen: info.regimen || '',
      edad: calc.edad(info.fecha_nacimiento),
      clasificacion: calc.clasificacionEdad(info.fecha_nacimiento),
      paquetes: x.paquetes.size,
      monto_recibido: calc.round2(x.monto_recibido),
    };
  }).sort((a, b) => b.monto_recibido - a.monto_recibido);

  // Resumen demográfico de los asociados que participaron en el periodo (cada uno contado UNA vez)
  const resumenDemografico = { hombres: 0, mujeres: 0, jovenes: 0, mayores: 0, jovenes_hombres: 0, jovenes_mujeres: 0, mayores_hombres: 0, mayores_mujeres: 0, sin_dato: 0 };
  for (const a of listaAsociados) {
    const g = (a.genero || '').toLowerCase();
    const esJoven = a.clasificacion.startsWith('Joven');
    const esMayor = a.clasificacion.startsWith('Adulto');
    if (g === 'hombre') resumenDemografico.hombres++;
    else if (g === 'mujer') resumenDemografico.mujeres++;
    else resumenDemografico.sin_dato++;
    if (esJoven) { resumenDemografico.jovenes++; if (g === 'hombre') resumenDemografico.jovenes_hombres++; if (g === 'mujer') resumenDemografico.jovenes_mujeres++; }
    if (esMayor) { resumenDemografico.mayores++; if (g === 'hombre') resumenDemografico.mayores_hombres++; if (g === 'mujer') resumenDemografico.mayores_mujeres++; }
  }

  const matriz = Object.entries(matrizMedioTipo).map(([medio, tipos]) => {
    const fila = { medio_pago: medio };
    let total = 0;
    for (const [tipo2, monto] of Object.entries(tipos)) { fila[tipo2] = calc.round2(monto); total += monto; }
    fila.total = calc.round2(total);
    return fila;
  });

  // Resumen por tipo de paquete: cuántas ventas tuvo, y de los asociados que participaron
  // (contados una sola vez por tipo de paquete): cuántos hombres/mujeres, jóvenes/adultos,
  // y si tienen empresa asignada o trabajan de forma independiente.
  const listaPorPaquete = Object.values(porPaquete).map(x => {
    let hombres = 0, mujeres = 0, jovenes = 0, mayores = 0, conEmpresa = 0, independientes = 0;
    for (const info of x.asociadosMap.values()) {
      if (!info) continue;
      const g = (info.genero || '').toLowerCase();
      if (g === 'hombre') hombres++; else if (g === 'mujer') mujeres++;
      const e = calc.edad(info.fecha_nacimiento);
      if (e !== null) { if (e <= 35) jovenes++; else mayores++; }
      if (info.empresa && info.empresa.trim()) conEmpresa++; else independientes++;
    }
    const aliadosInvolucrados = [...x.aliadosMap.values()]
      .map(a => ({ nombre: a.nombre, veces: a.veces, monto: calc.round2(a.monto) }))
      .sort((a, b) => b.monto - a.monto);
    return {
      tipo: x.tipo,
      color: (tiposServicioMap[x.tipo] && tiposServicioMap[x.tipo].color) || '#14161a',
      ventas: x.folios.size,
      monto: calc.round2(x.monto),
      asociados_involucrados: x.asociadosMap.size,
      hombres, mujeres, jovenes, mayores,
      con_empresa: conEmpresa, independientes,
      aliados: aliadosInvolucrados,
    };
  }).sort((a, b) => b.ventas - a.ventas);

  res.json({
    filtro: { periodo: periodo || 'todo', desde, hasta, tipo: tipo || null },
    totales,
    medio_top: listaMedioPago[0] || null,
    tipo_pago_top: listaTipoPago[0] || null,
    por_tipo_pago: listaTipoPago,
    por_medio_pago: listaMedioPago,
    por_asociado: listaAsociados,
    resumen_demografico: resumenDemografico,
    por_paquete: listaPorPaquete,
    matriz_medio_tipo: matriz,
  });
});

module.exports = router;
