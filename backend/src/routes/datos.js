const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { getFoliosCompletos } = require('../lib/folioService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// EXPORTAR
// ---------------------------------------------------------------------------

function construirLibroExportacion() {
  const wb = XLSX.utils.book_new();

  const asociados = db.prepare('SELECT id, nombre, genero, fecha_nacimiento, empresa, especialidad, regimen, activo FROM asociados ORDER BY nombre').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asociados), 'Asociados');

  const aliados = db.prepare('SELECT id, nombre, categoria, activo FROM aliados ORDER BY nombre').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aliados), 'Aliados');

  const folios = getFoliosCompletos({});
  const filasVentas = [];
  const filasPagosAsociados = [];
  const filasGastosAliados = [];
  for (const f of folios) {
    for (const p of f.pagos) {
      filasVentas.push({
        id: f.id, fecha: f.fecha, tipo: f.tipo, pax: f.pax,
        tipo_pago: p.tipo_pago, medio_pago: p.medio_pago, monto: p.monto,
      });
    }
    for (const fa of f.asociados) {
      filasPagosAsociados.push({ folio_id: f.id, asociado_nombre: fa.asociado_nombre, servicio: fa.servicio, monto_pagado: fa.monto_pagado });
    }
    for (const fg of f.gastos) {
      filasGastosAliados.push({ folio_id: f.id, aliado_nombre: fg.aliado_nombre, concepto: fg.concepto, monto: fg.monto });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasVentas), 'Ventas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasPagosAsociados), 'Pagos_Asociados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasGastosAliados), 'Gastos_Aliados');

  // Ajustes / catálogos: sin esto, un respaldo restaurado en una instalación
  // limpia no tendría bancos/POS, tipos de servicio ni metas configurados.
  const tiposServicio = db.prepare('SELECT nombre, color, activo FROM tipos_servicio ORDER BY nombre').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tiposServicio), 'Tipos_Servicio');

  const tiposPago = db.prepare('SELECT nombre FROM tipos_pago ORDER BY nombre').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tiposPago), 'Tipos_Pago');

  const posConfig = db.prepare('SELECT nombre, formula, pct_ventas, pct_iva_retencion, fijo, rec_pct_iva_step, rec_pct_monto, rec_pct_final, activo FROM pos_config ORDER BY nombre').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(posConfig), 'Bancos_POS');

  const metas = db.prepare('SELECT nombre, fecha_inicio, fecha_fin, monto_meta, notas FROM metas ORDER BY fecha_inicio').all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metas), 'Metas');

  return wb;
}

// GET /api/datos/exportar -> descarga un .xlsx con todo lo registrado
router.get('/exportar', (req, res) => {
  const wb = construirLibroExportacion();
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="dashboard-ventas-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.send(buffer);
});

// GET /api/datos/plantilla -> descarga un .xlsx vacío con las columnas esperadas, para cargar datos masivos
router.get('/plantilla', (req, res) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '', genero: 'hombre / mujer', fecha_nacimiento: 'AAAA-MM-DD', empresa: '', especialidad: '', regimen: 'General / Pequeño Contribuyente' }]), 'Asociados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '', categoria: '' }]), 'Aliados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ id: '', fecha: 'AAAA-MM-DD', tipo: '', pax: '', tipo_pago: 'Tarjeta / Efectivo / Transferencia...', medio_pago: 'Qpaypro / Banrural / BAC...', monto: '' }]), 'Ventas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ folio_id: '', asociado_nombre: '', servicio: '', monto_pagado: '' }]), 'Pagos_Asociados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ folio_id: '', aliado_nombre: '', concepto: '', monto: '' }]), 'Gastos_Aliados');
  // Ajustes / catálogos
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '', color: '#14161a', activo: 1 }]), 'Tipos_Servicio');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '' }]), 'Tipos_Pago');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '', formula: 'estandar / recurrente / sin_comision', pct_ventas: 4.5, pct_iva_retencion: 15, fijo: 2.43, rec_pct_iva_step: 15, rec_pct_monto: 4.59, rec_pct_final: 5, activo: 1 }]), 'Bancos_POS');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nombre: '', fecha_inicio: 'AAAA-MM-DD', fecha_fin: 'AAAA-MM-DD', monto_meta: '', notas: '' }]), 'Metas');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-carga-masiva.xlsx"');
  res.send(buffer);
});

// ---------------------------------------------------------------------------
// IMPORTAR
// ---------------------------------------------------------------------------

function limpio(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }
function numero(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function fechaISO(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // admite "2026-03-05" o números de fecha de Excel
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  if (!isNaN(n) && n > 20000) {
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return s || null;
}

// POST /api/datos/importar  (multipart/form-data, campo "archivo")
router.post('/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Adjunta un archivo .xlsx en el campo "archivo"' });

  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    return res.status(400).json({ error: 'No se pudo leer el archivo. ¿Es un .xlsx válido?' });
  }

  const resumen = {
    asociados_creados: 0, asociados_omitidos: 0,
    aliados_creados: 0, aliados_omitidos: 0,
    ventas_procesadas: 0, ventas_con_error: 0,
    pagos_asociados_procesados: 0, pagos_asociados_con_error: 0,
    gastos_aliados_procesados: 0, gastos_aliados_con_error: 0,
    tipos_servicio_creados: 0, tipos_servicio_actualizados: 0,
    tipos_pago_creados: 0,
    bancos_creados: 0, bancos_actualizados: 0,
    metas_creadas: 0, metas_omitidas: 0,
    errores: [],
  };

  const hoja = (nombre) => wb.Sheets[nombre] ? XLSX.utils.sheet_to_json(wb.Sheets[nombre], { defval: '' }) : [];

  const tx = db.transaction(() => {
    // 1) Asociados
    const insAsociado = db.prepare(`INSERT INTO asociados (nombre, genero, fecha_nacimiento, empresa, especialidad, regimen) VALUES (?,?,?,?,?,?)`);
    for (const fila of hoja('Asociados')) {
      const nombre = limpio(fila.nombre);
      if (!nombre) continue;
      const yaExiste = db.prepare('SELECT id FROM asociados WHERE nombre = ?').get(nombre);
      if (yaExiste) { resumen.asociados_omitidos++; continue; }
      insAsociado.run(nombre, limpio(fila.genero), fechaISO(fila.fecha_nacimiento), limpio(fila.empresa), limpio(fila.especialidad), limpio(fila.regimen) === 'General' ? 'General' : 'Pequeño Contribuyente');
      resumen.asociados_creados++;
    }

    // 2) Aliados
    const insAliado = db.prepare(`INSERT INTO aliados (nombre, categoria) VALUES (?,?)`);
    for (const fila of hoja('Aliados')) {
      const nombre = limpio(fila.nombre);
      if (!nombre) continue;
      const yaExiste = db.prepare('SELECT id FROM aliados WHERE nombre = ?').get(nombre);
      if (yaExiste) { resumen.aliados_omitidos++; continue; }
      insAliado.run(nombre, limpio(fila.categoria));
      resumen.aliados_creados++;
    }

    // 3) Ventas (folios + pagos) — misma regla: si el id ya existe, se suma un pago más
    const getFolio = db.prepare('SELECT id FROM folios WHERE id = ?');
    const insFolio = db.prepare(`INSERT INTO folios (id, fecha, tipo, pax) VALUES (?,?,?,?)`);
    const updFolioPax = db.prepare(`UPDATE folios SET pax = pax + ? WHERE id = ?`);
    const insPago = db.prepare(`INSERT INTO pagos (folio_id, tipo_pago, medio_pago, monto) VALUES (?,?,?,?)`);
    for (const [i, fila] of hoja('Ventas').entries()) {
      try {
        const id = Number(fila.id);
        const monto = numero(fila.monto);
        if (!id || !monto) { continue; }
        const fecha = fechaISO(fila.fecha) || new Date().toISOString().slice(0, 10);
        if (!getFolio.get(id)) {
          insFolio.run(id, fecha, limpio(fila.tipo), numero(fila.pax));
        } else if (fila.pax) {
          updFolioPax.run(numero(fila.pax), id);
        }
        insPago.run(id, limpio(fila.tipo_pago) || 'Efectivo', limpio(fila.medio_pago) || 'Efectivo', monto);
        resumen.ventas_procesadas++;
      } catch (e) {
        resumen.ventas_con_error++;
        resumen.errores.push(`Ventas fila ${i + 2}: ${e.message}`);
      }
    }

    // 4) Pagos a asociados (requiere que el asociado y el folio ya existan)
    const insFA = db.prepare(`INSERT INTO folio_asociados (folio_id, asociado_id, servicio, monto_pagado) VALUES (?,?,?,?)`);
    for (const [i, fila] of hoja('Pagos_Asociados').entries()) {
      try {
        const folioId = Number(fila.folio_id);
        const monto = numero(fila.monto_pagado);
        const asociado = db.prepare('SELECT id FROM asociados WHERE nombre = ?').get(limpio(fila.asociado_nombre));
        if (!folioId || !monto || !asociado || !getFolio.get(folioId)) {
          resumen.pagos_asociados_con_error++;
          resumen.errores.push(`Pagos_Asociados fila ${i + 2}: folio o asociado no encontrado`);
          continue;
        }
        insFA.run(folioId, asociado.id, limpio(fila.servicio), monto);
        resumen.pagos_asociados_procesados++;
      } catch (e) {
        resumen.pagos_asociados_con_error++;
        resumen.errores.push(`Pagos_Asociados fila ${i + 2}: ${e.message}`);
      }
    }

    // 5) Gastos con aliados
    const insFG = db.prepare(`INSERT INTO folio_gastos (folio_id, aliado_id, concepto, monto) VALUES (?,?,?,?)`);
    for (const [i, fila] of hoja('Gastos_Aliados').entries()) {
      try {
        const folioId = Number(fila.folio_id);
        const monto = numero(fila.monto);
        const aliado = db.prepare('SELECT id FROM aliados WHERE nombre = ?').get(limpio(fila.aliado_nombre));
        if (!folioId || !monto || !aliado || !getFolio.get(folioId)) {
          resumen.gastos_aliados_con_error++;
          resumen.errores.push(`Gastos_Aliados fila ${i + 2}: folio o aliado no encontrado`);
          continue;
        }
        insFG.run(folioId, aliado.id, limpio(fila.concepto), monto);
        resumen.gastos_aliados_procesados++;
      } catch (e) {
        resumen.gastos_aliados_con_error++;
        resumen.errores.push(`Gastos_Aliados fila ${i + 2}: ${e.message}`);
      }
    }

    // 6) Tipos de servicio (ajustes)
    for (const fila of hoja('Tipos_Servicio')) {
      const nombre = limpio(fila.nombre);
      if (!nombre) continue;
      const color = limpio(fila.color) || '#14161a';
      const activo = fila.activo === '' || fila.activo === undefined ? 1 : (numero(fila.activo) ? 1 : 0);
      const existe = db.prepare('SELECT id FROM tipos_servicio WHERE nombre = ?').get(nombre);
      if (existe) {
        db.prepare('UPDATE tipos_servicio SET color = ?, activo = ? WHERE id = ?').run(color, activo, existe.id);
        resumen.tipos_servicio_actualizados++;
      } else {
        db.prepare('INSERT INTO tipos_servicio (nombre, color, activo) VALUES (?,?,?)').run(nombre, color, activo);
        resumen.tipos_servicio_creados++;
      }
    }

    // 7) Tipos de pago (ajustes)
    for (const fila of hoja('Tipos_Pago')) {
      const nombre = limpio(fila.nombre);
      if (!nombre) continue;
      const info = db.prepare('INSERT OR IGNORE INTO tipos_pago (nombre) VALUES (?)').run(nombre);
      if (info.changes) resumen.tipos_pago_creados++;
    }

    // 8) Bancos / POS (ajustes)
    const FORMULAS = ['estandar', 'recurrente', 'sin_comision'];
    for (const fila of hoja('Bancos_POS')) {
      const nombre = limpio(fila.nombre);
      if (!nombre) continue;
      const campos = {
        formula: FORMULAS.includes(limpio(fila.formula)) ? limpio(fila.formula) : 'estandar',
        pct_ventas: fila.pct_ventas === '' ? 4.5 : numero(fila.pct_ventas),
        pct_iva_retencion: fila.pct_iva_retencion === '' ? 15 : numero(fila.pct_iva_retencion),
        fijo: fila.fijo === '' ? 2.43 : numero(fila.fijo),
        rec_pct_iva_step: fila.rec_pct_iva_step === '' ? 15 : numero(fila.rec_pct_iva_step),
        rec_pct_monto: fila.rec_pct_monto === '' ? 4.59 : numero(fila.rec_pct_monto),
        rec_pct_final: fila.rec_pct_final === '' ? 5 : numero(fila.rec_pct_final),
        activo: fila.activo === '' || fila.activo === undefined ? 1 : (numero(fila.activo) ? 1 : 0),
      };
      const existe = db.prepare('SELECT id FROM pos_config WHERE nombre = ?').get(nombre);
      if (existe) {
        db.prepare(`UPDATE pos_config SET formula=@formula, pct_ventas=@pct_ventas, pct_iva_retencion=@pct_iva_retencion, fijo=@fijo, rec_pct_iva_step=@rec_pct_iva_step, rec_pct_monto=@rec_pct_monto, rec_pct_final=@rec_pct_final, activo=@activo WHERE id=@id`)
          .run({ ...campos, id: existe.id });
        resumen.bancos_actualizados++;
      } else {
        db.prepare(`INSERT INTO pos_config (nombre, formula, pct_ventas, pct_iva_retencion, fijo, rec_pct_iva_step, rec_pct_monto, rec_pct_final, activo) VALUES (@nombre,@formula,@pct_ventas,@pct_iva_retencion,@fijo,@rec_pct_iva_step,@rec_pct_monto,@rec_pct_final,@activo)`)
          .run({ nombre, ...campos });
        resumen.bancos_creados++;
      }
    }

    // 9) Metas (ajustes)
    for (const fila of hoja('Metas')) {
      const nombre = limpio(fila.nombre);
      const inicio = fechaISO(fila.fecha_inicio);
      const fin = fechaISO(fila.fecha_fin);
      const monto = numero(fila.monto_meta);
      if (!nombre || !inicio || !fin || !monto) continue;
      const existe = db.prepare('SELECT id FROM metas WHERE nombre = ? AND fecha_inicio = ?').get(nombre, inicio);
      if (existe) { resumen.metas_omitidas++; continue; }
      db.prepare('INSERT INTO metas (nombre, fecha_inicio, fecha_fin, monto_meta, notas) VALUES (?,?,?,?,?)')
        .run(nombre, inicio, fin, monto, limpio(fila.notas));
      resumen.metas_creadas++;
    }
  });

  try {
    tx();
    res.json(resumen);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
