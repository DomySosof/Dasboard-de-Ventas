const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/aliados
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM aliados ORDER BY nombre').all());
});

// POST /api/aliados
router.post('/', (req, res) => {
  const { nombre, categoria } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = db.prepare('INSERT INTO aliados (nombre, categoria) VALUES (?,?)').run(nombre, categoria || '');
    res.status(201).json(db.prepare('SELECT * FROM aliados WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Ya existe un aliado con ese nombre' });
  }
});

// PUT /api/aliados/:id
router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM aliados WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Aliado no encontrado' });
  const { nombre, categoria, activo } = req.body || {};
  db.prepare(`UPDATE aliados SET
      nombre = COALESCE(?, nombre),
      categoria = COALESCE(?, categoria),
      activo = COALESCE(?, activo)
    WHERE id = ?`).run(nombre ?? null, categoria ?? null, activo === undefined ? null : (activo ? 1 : 0), req.params.id);
  res.json(db.prepare('SELECT * FROM aliados WHERE id = ?').get(req.params.id));
});

// DELETE /api/aliados/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM aliados WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
