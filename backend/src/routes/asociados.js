const express = require('express');
const db = require('../db');
const calc = require('../lib/calc');

const router = express.Router();

function withDerivados(a) {
  return {
    ...a,
    edad: calc.edad(a.fecha_nacimiento),
    clasificacion: calc.clasificacionEdad(a.fecha_nacimiento),
  };
}

// GET /api/asociados
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM asociados ORDER BY nombre').all();
  res.json(rows.map(withDerivados));
});

// GET /api/asociados/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM asociados WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Asociado no encontrado' });
  res.json(withDerivados(row));
});

// POST /api/asociados
router.post('/', (req, res) => {
  const { nombre, genero, fecha_nacimiento, empresa, especialidad, regimen } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare(`INSERT INTO asociados (nombre, genero, fecha_nacimiento, empresa, especialidad, regimen)
    VALUES (?,?,?,?,?,?)`).run(
    nombre, genero || '', fecha_nacimiento || null, empresa || '', especialidad || '',
    regimen === 'General' ? 'General' : 'Pequeño Contribuyente'
  );
  const row = db.prepare('SELECT * FROM asociados WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(withDerivados(row));
});

// PUT /api/asociados/:id
router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM asociados WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Asociado no encontrado' });
  const { nombre, genero, fecha_nacimiento, empresa, especialidad, regimen, activo } = req.body || {};
  db.prepare(`UPDATE asociados SET
      nombre = COALESCE(?, nombre),
      genero = COALESCE(?, genero),
      fecha_nacimiento = COALESCE(?, fecha_nacimiento),
      empresa = COALESCE(?, empresa),
      especialidad = COALESCE(?, especialidad),
      regimen = COALESCE(?, regimen),
      activo = COALESCE(?, activo)
    WHERE id = ?`).run(
    nombre ?? null, genero ?? null, fecha_nacimiento ?? null, empresa ?? null, especialidad ?? null,
    regimen ?? null, activo === undefined ? null : (activo ? 1 : 0), req.params.id
  );
  const row = db.prepare('SELECT * FROM asociados WHERE id = ?').get(req.params.id);
  res.json(withDerivados(row));
});

// DELETE /api/asociados/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM asociados WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
