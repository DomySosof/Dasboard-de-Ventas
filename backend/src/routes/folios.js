const express = require('express');
const db = require('../db');
const { getFolioCompleto, getFoliosCompletos } = require('../lib/folioService');

const router = express.Router();

// GET /api/folios?desde=&hasta=&tipo=  -> lista de folios calculados
router.get('/', (req, res) => {
  const { desde, hasta, tipo } = req.query;
  const folios = getFoliosCompletos({ desde, hasta, tipo });
  res.json(folios);
});

// GET /api/folios/:id -> un folio calculado
router.get('/:id', (req, res) => {
  const folio = getFolioCompleto(req.params.id);
  if (!folio) return res.status(404).json({ error: 'Folio no encontrado' });
  res.json(folio);
});

/**
 * POST /api/folios
 * Body: { id, fecha, tipo, pax, tipo_pago, medio_pago, monto,
 *         asociados: [{asociado_id, servicio, monto_pagado}],
 *         gastos: [{aliado_id, concepto, monto}] }
 *
 * Reglas (igual que en el Excel):
 * - Si el id NO existe -> crea un folio nuevo y agrega el primer pago.
 * - Si el id YA existe  -> agrega un pago adicional al folio existente (el monto total se recalcula solo, sumando).
 * - Los pagos a asociados y los gastos con aliados que vengan en el body se agregan como líneas nuevas (no reemplazan las existentes).
 */
router.post('/', (req, res) => {
  const body = req.body || {};
  const id = Number(body.id);
  if (!id || !body.fecha || !body.tipo_pago || !body.medio_pago || body.monto === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: id, fecha, tipo_pago, medio_pago, monto' });
  }
  const monto = Number(body.monto);
  if (isNaN(monto) || monto <= 0) return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });

  const tx = db.transaction(() => {
    const existente = db.prepare('SELECT * FROM folios WHERE id = ?').get(id);
    if (!existente) {
      db.prepare(`INSERT INTO folios (id, fecha, tipo, pax, notas) VALUES (?,?,?,?,?)`)
        .run(id, body.fecha, body.tipo || '', Number(body.pax) || 0, body.notas || '');
    } else {
      // permite refrescar fecha/tipo/pax si se envían, y acumula pax si aplica
      db.prepare(`UPDATE folios SET
          fecha = COALESCE(?, fecha),
          tipo = COALESCE(NULLIF(?, ''), tipo),
          pax = pax + ?,
          actualizado_en = datetime('now')
        WHERE id = ?`)
        .run(body.fecha || null, body.tipo || '', Number(body.pax) || 0, id);
    }

    db.prepare(`INSERT INTO pagos (folio_id, tipo_pago, medio_pago, monto) VALUES (?,?,?,?)`)
      .run(id, body.tipo_pago, body.medio_pago, monto);

    if (Array.isArray(body.asociados)) {
      const insFA = db.prepare(`INSERT INTO folio_asociados (folio_id, asociado_id, servicio, monto_pagado) VALUES (?,?,?,?)`);
      for (const fa of body.asociados) {
        if (!fa.asociado_id || !fa.monto_pagado) continue;
        insFA.run(id, Number(fa.asociado_id), fa.servicio || '', Number(fa.monto_pagado));
      }
    }

    if (Array.isArray(body.gastos)) {
      const insFG = db.prepare(`INSERT INTO folio_gastos (folio_id, aliado_id, concepto, monto) VALUES (?,?,?,?)`);
      for (const fg of body.gastos) {
        if (!fg.aliado_id || !fg.monto) continue;
        insFG.run(id, Number(fg.aliado_id), fg.concepto || '', Number(fg.monto));
      }
    }
  });

  try {
    tx();
    res.status(201).json(getFolioCompleto(id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/folios/:id -> edita los datos generales del folio (fecha, tipo, pax, notas)
router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM folios WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Folio no encontrado' });
  const { fecha, tipo, pax, notas } = req.body || {};
  db.prepare(`UPDATE folios SET
      fecha = COALESCE(?, fecha),
      tipo = COALESCE(?, tipo),
      pax = COALESCE(?, pax),
      notas = COALESCE(?, notas),
      actualizado_en = datetime('now')
    WHERE id = ?`).run(
    fecha ?? null, tipo ?? null, pax === undefined ? null : Number(pax), notas ?? null, req.params.id
  );
  res.json(getFolioCompleto(req.params.id));
});

// DELETE /api/folios/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM folios WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Pagos ----------

// POST /api/folios/:id/pagos -> agrega un pago adicional (equivalente a volver a enviar el formulario)
router.post('/:id/pagos', (req, res) => {
  const folioId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM folios WHERE id = ?').get(folioId)) return res.status(404).json({ error: 'Folio no encontrado' });
  const { tipo_pago, medio_pago, monto } = req.body || {};
  if (!tipo_pago || !medio_pago || !monto) return res.status(400).json({ error: 'tipo_pago, medio_pago y monto son obligatorios' });
  db.prepare(`INSERT INTO pagos (folio_id, tipo_pago, medio_pago, monto) VALUES (?,?,?,?)`).run(folioId, tipo_pago, medio_pago, Number(monto));
  res.status(201).json(getFolioCompleto(folioId));
});

// PUT /api/folios/:id/pagos/:pagoId -> edita un pago existente
router.put('/:id/pagos/:pagoId', (req, res) => {
  const existente = db.prepare('SELECT * FROM pagos WHERE id = ? AND folio_id = ?').get(req.params.pagoId, req.params.id);
  if (!existente) return res.status(404).json({ error: 'Pago no encontrado' });
  const { tipo_pago, medio_pago, monto } = req.body || {};
  db.prepare(`UPDATE pagos SET
      tipo_pago = COALESCE(?, tipo_pago),
      medio_pago = COALESCE(?, medio_pago),
      monto = COALESCE(?, monto)
    WHERE id = ?`).run(tipo_pago ?? null, medio_pago ?? null, monto === undefined ? null : Number(monto), req.params.pagoId);
  res.json(getFolioCompleto(req.params.id));
});

router.delete('/:id/pagos/:pagoId', (req, res) => {
  db.prepare('DELETE FROM pagos WHERE id = ? AND folio_id = ?').run(req.params.pagoId, req.params.id);
  res.json(getFolioCompleto(req.params.id));
});

// ---------- Pagos a asociados ----------

// POST /api/folios/:id/asociados  -> agrega UN pago a un asociado dentro de un folio existente
router.post('/:id/asociados', (req, res) => {
  const folioId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM folios WHERE id = ?').get(folioId)) return res.status(404).json({ error: 'Folio no encontrado' });
  const { asociado_id, servicio, monto_pagado } = req.body || {};
  if (!asociado_id || !monto_pagado) return res.status(400).json({ error: 'asociado_id y monto_pagado son obligatorios' });
  db.prepare(`INSERT INTO folio_asociados (folio_id, asociado_id, servicio, monto_pagado) VALUES (?,?,?,?)`)
    .run(folioId, Number(asociado_id), servicio || '', Number(monto_pagado));
  res.status(201).json(getFolioCompleto(folioId));
});

// PUT /api/folios/:id/asociados/:faId -> edita un pago a asociado
router.put('/:id/asociados/:faId', (req, res) => {
  const existente = db.prepare('SELECT * FROM folio_asociados WHERE id = ? AND folio_id = ?').get(req.params.faId, req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  const { asociado_id, servicio, monto_pagado } = req.body || {};
  db.prepare(`UPDATE folio_asociados SET
      asociado_id = COALESCE(?, asociado_id),
      servicio = COALESCE(?, servicio),
      monto_pagado = COALESCE(?, monto_pagado)
    WHERE id = ?`).run(
    asociado_id === undefined ? null : Number(asociado_id), servicio ?? null,
    monto_pagado === undefined ? null : Number(monto_pagado), req.params.faId
  );
  res.json(getFolioCompleto(req.params.id));
});

router.delete('/:id/asociados/:faId', (req, res) => {
  db.prepare('DELETE FROM folio_asociados WHERE id = ? AND folio_id = ?').run(req.params.faId, req.params.id);
  res.json(getFolioCompleto(req.params.id));
});

// ---------- Gastos con aliados (tuctuc, café, combustible, etc.) ----------

// POST /api/folios/:id/gastos -> agrega UN gasto con un aliado dentro de un folio existente
router.post('/:id/gastos', (req, res) => {
  const folioId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM folios WHERE id = ?').get(folioId)) return res.status(404).json({ error: 'Folio no encontrado' });
  const { aliado_id, concepto, monto } = req.body || {};
  if (!aliado_id || !monto) return res.status(400).json({ error: 'aliado_id y monto son obligatorios' });
  db.prepare(`INSERT INTO folio_gastos (folio_id, aliado_id, concepto, monto) VALUES (?,?,?,?)`)
    .run(folioId, Number(aliado_id), concepto || '', Number(monto));
  res.status(201).json(getFolioCompleto(folioId));
});

// PUT /api/folios/:id/gastos/:gastoId -> edita un gasto con aliado
router.put('/:id/gastos/:gastoId', (req, res) => {
  const existente = db.prepare('SELECT * FROM folio_gastos WHERE id = ? AND folio_id = ?').get(req.params.gastoId, req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  const { aliado_id, concepto, monto } = req.body || {};
  db.prepare(`UPDATE folio_gastos SET
      aliado_id = COALESCE(?, aliado_id),
      concepto = COALESCE(?, concepto),
      monto = COALESCE(?, monto)
    WHERE id = ?`).run(
    aliado_id === undefined ? null : Number(aliado_id), concepto ?? null,
    monto === undefined ? null : Number(monto), req.params.gastoId
  );
  res.json(getFolioCompleto(req.params.id));
});

router.delete('/:id/gastos/:gastoId', (req, res) => {
  db.prepare('DELETE FROM folio_gastos WHERE id = ? AND folio_id = ?').run(req.params.gastoId, req.params.id);
  res.json(getFolioCompleto(req.params.id));
});

module.exports = router;
