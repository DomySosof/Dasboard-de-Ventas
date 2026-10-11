const express = require('express');
const db = require('../db');
const { getFoliosCompletos } = require('../lib/folioService');
const calc = require('../lib/calc');

const router = express.Router();

function conProgreso(meta) {
  const folios = getFoliosCompletos({ desde: meta.fecha_inicio, hasta: meta.fecha_fin });
  const ventaActual = calc.round2(folios.reduce((s, f) => s + f.monto, 0));
  const porcentaje = meta.monto_meta > 0 ? calc.round2((ventaActual / meta.monto_meta) * 100) : 0;
  return {
    ...meta,
    venta_actual: ventaActual,
    faltante: calc.round2(Math.max(meta.monto_meta - ventaActual, 0)),
    porcentaje,
    cumplida: ventaActual >= meta.monto_meta,
    cantidad_ventas: folios.length,
  };
}

// GET /api/metas -> todas las metas con su progreso calculado
router.get('/', (req, res) => {
  const metas = db.prepare('SELECT * FROM metas ORDER BY fecha_inicio DESC').all();
  res.json(metas.map(conProgreso));
});

// GET /api/metas/:id
router.get('/:id', (req, res) => {
  const meta = db.prepare('SELECT * FROM metas WHERE id = ?').get(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Meta no encontrada' });
  res.json(conProgreso(meta));
});

// POST /api/metas
router.post('/', (req, res) => {
  const { nombre, fecha_inicio, fecha_fin, monto_meta, notas } = req.body || {};
  if (!nombre || !fecha_inicio || !fecha_fin || !monto_meta) {
    return res.status(400).json({ error: 'nombre, fecha_inicio, fecha_fin y monto_meta son obligatorios' });
  }
  const info = db.prepare(`INSERT INTO metas (nombre, fecha_inicio, fecha_fin, monto_meta, notas) VALUES (?,?,?,?,?)`)
    .run(nombre, fecha_inicio, fecha_fin, Number(monto_meta), notas || '');
  res.status(201).json(conProgreso(db.prepare('SELECT * FROM metas WHERE id = ?').get(info.lastInsertRowid)));
});

// PUT /api/metas/:id
router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM metas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Meta no encontrada' });
  const { nombre, fecha_inicio, fecha_fin, monto_meta, notas } = req.body || {};
  db.prepare(`UPDATE metas SET
      nombre = COALESCE(?, nombre),
      fecha_inicio = COALESCE(?, fecha_inicio),
      fecha_fin = COALESCE(?, fecha_fin),
      monto_meta = COALESCE(?, monto_meta),
      notas = COALESCE(?, notas)
    WHERE id = ?`).run(
    nombre ?? null, fecha_inicio ?? null, fecha_fin ?? null,
    monto_meta === undefined ? null : Number(monto_meta), notas ?? null, req.params.id
  );
  res.json(conProgreso(db.prepare('SELECT * FROM metas WHERE id = ?').get(req.params.id)));
});

// DELETE /api/metas/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM metas WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
