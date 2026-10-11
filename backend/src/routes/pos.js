const express = require('express');
const db = require('../db');
const calc = require('../lib/calc');

const router = express.Router();

// GET /api/pos -> catálogo de bancos / POS / pasarelas
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM pos_config ORDER BY nombre').all());
});

// GET /api/pos/desglose?monto=50&tipo_pago=Tarjeta
// Devuelve, por cada medio configurado, el desglose verificable de la comisión
// (base, IVA y cada parte de la fórmula). Sirve para comprobar en la sección
// "Bancos / POS" que la retención del 15% se aplica sobre el IVA.
router.get('/desglose', (req, res) => {
  const monto = Number(req.query.monto);
  if (!isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });
  const tipoPago = req.query.tipo_pago || null;

  const medios = db.prepare('SELECT * FROM pos_config ORDER BY nombre').all();
  const r6 = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  const baseLinea = r6(calc.base(monto));
  const ivaLinea = r6(calc.iva(monto));

  res.json({
    monto: calc.round2(monto),
    tipo_pago: tipoPago,
    base: baseLinea,
    iva: ivaLinea,
    medios: medios.map(m => ({
      id: m.id,
      nombre: m.nombre,
      formula: m.formula,
      activo: m.activo,
      ...calc.desgloseComisionPOS(monto, m, tipoPago),
    })),
  });
});

// POST /api/pos -> crear un nuevo medio de pago con su fórmula de comisión
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = db.prepare(`INSERT INTO pos_config
      (nombre, formula, pct_ventas, pct_iva_retencion, fijo, rec_pct_iva_step, rec_pct_monto, rec_pct_final)
      VALUES (@nombre, @formula, @pct_ventas, @pct_iva_retencion, @fijo, @rec_pct_iva_step, @rec_pct_monto, @rec_pct_final)`)
      .run({
        nombre: b.nombre,
        formula: b.formula || 'estandar',
        pct_ventas: Number(b.pct_ventas) || 4.5,
        pct_iva_retencion: Number(b.pct_iva_retencion) || 15,
        fijo: Number(b.fijo) || 2.43,
        rec_pct_iva_step: Number(b.rec_pct_iva_step) || 15,
        rec_pct_monto: Number(b.rec_pct_monto) || 4.59,
        rec_pct_final: Number(b.rec_pct_final) || 5,
      });
    res.status(201).json(db.prepare('SELECT * FROM pos_config WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Ese nombre de medio de pago ya existe' });
  }
});

// PUT /api/pos/:id -> editar fórmula / tarifas de un medio de pago
router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM pos_config WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'No encontrado' });
  const b = req.body || {};
  db.prepare(`UPDATE pos_config SET
      nombre = COALESCE(?, nombre),
      formula = COALESCE(?, formula),
      pct_ventas = COALESCE(?, pct_ventas),
      pct_iva_retencion = COALESCE(?, pct_iva_retencion),
      fijo = COALESCE(?, fijo),
      rec_pct_iva_step = COALESCE(?, rec_pct_iva_step),
      rec_pct_monto = COALESCE(?, rec_pct_monto),
      rec_pct_final = COALESCE(?, rec_pct_final),
      activo = COALESCE(?, activo)
    WHERE id = ?`).run(
    b.nombre ?? null, b.formula ?? null,
    b.pct_ventas === undefined ? null : Number(b.pct_ventas),
    b.pct_iva_retencion === undefined ? null : Number(b.pct_iva_retencion),
    b.fijo === undefined ? null : Number(b.fijo),
    b.rec_pct_iva_step === undefined ? null : Number(b.rec_pct_iva_step),
    b.rec_pct_monto === undefined ? null : Number(b.rec_pct_monto),
    b.rec_pct_final === undefined ? null : Number(b.rec_pct_final),
    b.activo === undefined ? null : (b.activo ? 1 : 0),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM pos_config WHERE id = ?').get(req.params.id));
});

// DELETE /api/pos/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM pos_config WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
