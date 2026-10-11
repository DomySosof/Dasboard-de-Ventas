const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Mismo cálculo de carpeta de datos que db.js (permite DATA_DIR personalizado)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Tablas que forman el respaldo, en orden de inserción (primero los "padres",
// luego los que dependen de ellos por llave foránea).
const TABLAS = [
  'asociados',
  'aliados',
  'tipos_servicio',
  'tipos_pago',
  'pos_config',
  'metas',
  'folios',
  'pagos',
  'folio_asociados',
  'folio_gastos',
];

function snapshot() {
  const tablas = {};
  for (const t of TABLAS) tablas[t] = db.prepare(`SELECT * FROM ${t}`).all();
  return {
    app: 'dashboard-ventas-asociados',
    formato: 'backup-json',
    version: 1,
    exportado_en: new Date().toISOString(),
    tablas,
  };
}

function columnasDe(tabla) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().map(c => c.name);
}

// Antes de reemplazar o borrar todo, guarda una copia del estado actual en data/backups
// para poder deshacer una acción equivocada.
function copiaDeSeguridadPrevia(etiqueta = 'restaurar') {
  try {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-'); // incluye milisegundos para no colisionar
    const nombre = `antes-de-${etiqueta}-${stamp}.json`;
    fs.writeFileSync(path.join(dir, nombre), JSON.stringify(snapshot(), null, 2), 'utf8');
    return nombre;
  } catch (e) {
    return null;
  }
}

// GET /api/backup/resumen -> cuántos registros hay en cada tabla (para mostrar en pantalla)
router.get('/resumen', (req, res) => {
  const tablas = {};
  for (const t of TABLAS) tablas[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  res.json({ tablas });
});

// GET /api/backup/json -> descarga un respaldo completo en JSON (todas las tablas)
router.get('/json', (req, res) => {
  const data = snapshot();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="backup-ventas-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

// POST /api/backup/json -> restaura un respaldo completo (reemplaza TODO el contenido)
router.post('/json', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Adjunta un archivo .json en el campo "archivo"' });

  let data;
  try {
    data = JSON.parse(req.file.buffer.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'El archivo no es un JSON válido' });
  }
  if (!data || typeof data !== 'object' || !data.tablas || typeof data.tablas !== 'object') {
    return res.status(400).json({ error: 'El JSON no tiene el formato de respaldo esperado (falta el objeto "tablas").' });
  }

  const resumen = { ok: true, tablas: {} };
  try {
    resumen.copia_seguridad = copiaDeSeguridadPrevia();
    const tx = db.transaction(() => {
      // Borra primero los hijos para respetar las llaves foráneas
      for (const t of [...TABLAS].reverse()) db.prepare(`DELETE FROM ${t}`).run();

      for (const t of TABLAS) {
        const filas = Array.isArray(data.tablas[t]) ? data.tablas[t] : [];
        resumen.tablas[t] = filas.length;
        if (!filas.length) continue;

        const columnasTabla = columnasDe(t);
        const claves = columnasTabla.filter(c => Object.prototype.hasOwnProperty.call(filas[0], c));
        if (!claves.length) continue;

        const insert = db.prepare(
          `INSERT INTO ${t} (${claves.join(',')}) VALUES (${claves.map(k => '@' + k).join(',')})`
        );
        for (const fila of filas) {
          const obj = {};
          for (const k of claves) obj[k] = fila[k] === undefined ? null : fila[k];
          insert.run(obj);
        }
      }
    });
    tx();
    res.json(resumen);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo restaurar el respaldo: ' + e.message });
  }
});

// POST /api/backup/borrar -> elimina datos.
//   modo "movimientos": borra ventas/pagos/gastos y CONSERVA los ajustes (asociados, aliados, catálogos, metas).
//   modo "todo":        borra TODO (incluidos ajustes) y deja solo lo mínimo para seguir registrando ventas.
const MOVIMIENTOS = ['folio_gastos', 'folio_asociados', 'pagos', 'folios'];

router.post('/borrar', (req, res) => {
  const modo = req.body && req.body.modo;
  if (modo !== 'movimientos' && modo !== 'todo') {
    return res.status(400).json({ error: 'Indica modo "movimientos" (conservar ajustes) o "todo" (borrar todo).' });
  }

  try {
    const copia = copiaDeSeguridadPrevia('borrar');
    const borrado = {};
    const tx = db.transaction(() => {
      // Siempre se borran primero los hijos (para respetar llaves foráneas)
      const orden = modo === 'todo' ? [...TABLAS].reverse() : MOVIMIENTOS.slice();
      for (const t of orden) {
        borrado[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
        db.prepare(`DELETE FROM ${t}`).run();
      }
      // En "todo" se restablecen los tipos de pago y bancos por defecto para que
      // la app siga funcionando; lo demás (productos, aliados, asociados) queda vacío.
      if (modo === 'todo') db.seedCatalogosPorDefecto({ minimo: true });
    });
    tx();
    res.json({ ok: true, modo, borrado, copia_seguridad: copia });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron borrar los datos: ' + e.message });
  }
});

module.exports = router;
