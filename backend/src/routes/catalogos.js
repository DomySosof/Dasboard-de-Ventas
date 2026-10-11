const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/tipos-servicio', (req, res) => {
  res.json(db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all());
});
router.post('/tipos-servicio', (req, res) => {
  const { nombre, color } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'nombre obligatorio' });
  try {
    db.prepare('INSERT INTO tipos_servicio (nombre, color) VALUES (?,?)').run(nombre, color || '#14161a');
  } catch (e) {
    return res.status(400).json({ error: 'Ya existe un tipo de servicio con ese nombre' });
  }
  res.json(db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all());
});
router.put('/tipos-servicio/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM tipos_servicio WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'No encontrado' });
  const { nombre, color, activo } = req.body || {};
  db.prepare(`UPDATE tipos_servicio SET
      nombre = COALESCE(?, nombre),
      color = COALESCE(?, color),
      activo = COALESCE(?, activo)
    WHERE id = ?`).run(nombre ?? null, color ?? null, activo === undefined ? null : (activo ? 1 : 0), req.params.id);
  res.json(db.prepare('SELECT * FROM tipos_servicio WHERE id = ?').get(req.params.id));
});
router.delete('/tipos-servicio/:id', (req, res) => {
  db.prepare('DELETE FROM tipos_servicio WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.get('/tipos-pago', (req, res) => {
  res.json(db.prepare('SELECT * FROM tipos_pago ORDER BY nombre').all());
});
router.post('/tipos-pago', (req, res) => {
  const { nombre } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'nombre obligatorio' });
  try {
    db.prepare('INSERT INTO tipos_pago (nombre) VALUES (?)').run(nombre);
  } catch (e) { /* ya existe */ }
  res.json(db.prepare('SELECT * FROM tipos_pago ORDER BY nombre').all());
});
router.delete('/tipos-pago/:id', (req, res) => {
  db.prepare('DELETE FROM tipos_pago WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
