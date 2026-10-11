const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS asociados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  genero TEXT DEFAULT '',
  fecha_nacimiento TEXT,
  empresa TEXT DEFAULT '',
  especialidad TEXT DEFAULT '',
  regimen TEXT NOT NULL DEFAULT 'Pequeño Contribuyente', -- 'General' | 'Pequeño Contribuyente'
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_servicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#14161a',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tipos_pago (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL
);

-- Catálogo de Medios de pago / Bancos / POS / Pasarelas, con su fórmula de comisión configurable
CREATE TABLE IF NOT EXISTS pos_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  formula TEXT NOT NULL DEFAULT 'estandar', -- 'estandar' | 'recurrente' | 'sin_comision'
  pct_ventas REAL NOT NULL DEFAULT 4.5,      -- % sobre el monto (fórmula estándar)
  pct_iva_retencion REAL NOT NULL DEFAULT 15, -- % sobre el IVA de la transacción (fórmula estándar)
  fijo REAL NOT NULL DEFAULT 2.43,            -- cargo fijo (fórmula estándar)
  rec_pct_iva_step REAL NOT NULL DEFAULT 15,  -- % sobre IVA (fórmula recurrente)
  rec_pct_monto REAL NOT NULL DEFAULT 4.59,   -- % sobre el monto (fórmula recurrente)
  rec_pct_final REAL NOT NULL DEFAULT 5,      -- % del remanente (fórmula recurrente)
  activo INTEGER NOT NULL DEFAULT 1
);

-- Aliados: proveedores de gastos externos gestionables (tuctuc, café, combustible, etc.)
CREATE TABLE IF NOT EXISTS aliados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  categoria TEXT DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- Una "venta" / folio / paquete. El id lo escribe el usuario (si ya existe, se agrega un pago nuevo)
CREATE TABLE IF NOT EXISTS folios (
  id INTEGER PRIMARY KEY,
  fecha TEXT NOT NULL,
  tipo TEXT DEFAULT '',
  pax INTEGER DEFAULT 0,
  tuctuc REAL NOT NULL DEFAULT 0,   -- heredado (ver tabla folio_gastos para gastos nuevos)
  cafe REAL NOT NULL DEFAULT 0,     -- heredado (ver tabla folio_gastos para gastos nuevos)
  notas TEXT DEFAULT '',
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

-- Cada cobro recibido dentro de un folio (permite pagos mixtos / varias pasarelas)
CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio_id INTEGER NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
  tipo_pago TEXT NOT NULL,
  medio_pago TEXT NOT NULL,
  monto REAL NOT NULL,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- Pago a un asociado dentro de un folio
CREATE TABLE IF NOT EXISTS folio_asociados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio_id INTEGER NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
  asociado_id INTEGER NOT NULL REFERENCES asociados(id),
  servicio TEXT DEFAULT '',
  monto_pagado REAL NOT NULL,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- Gasto pagado a un aliado (tuctuc, café, combustible, etc.) dentro de un folio
CREATE TABLE IF NOT EXISTS folio_gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio_id INTEGER NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
  aliado_id INTEGER NOT NULL REFERENCES aliados(id),
  concepto TEXT DEFAULT '',
  monto REAL NOT NULL,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- Metas de venta por periodo
CREATE TABLE IF NOT EXISTS metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT NOT NULL,
  monto_meta REAL NOT NULL,
  notas TEXT DEFAULT '',
  creado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS _migraciones (
  clave TEXT PRIMARY KEY,
  aplicada_en TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pagos_folio ON pagos(folio_id);
CREATE INDEX IF NOT EXISTS idx_fa_folio ON folio_asociados(folio_id);
CREATE INDEX IF NOT EXISTS idx_fa_asociado ON folio_asociados(asociado_id);
CREATE INDEX IF NOT EXISTS idx_fg_folio ON folio_gastos(folio_id);
CREATE INDEX IF NOT EXISTS idx_folios_fecha ON folios(fecha);
`);

function seedAsociados() {
  const count = db.prepare('SELECT COUNT(*) c FROM asociados').get().c;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO asociados (nombre, genero, fecha_nacimiento, empresa, especialidad, regimen) VALUES (?,?,?,?,?,?)`);
    const asociadosSeed = [
      ['Aniceto', 'hombre', '1996-05-05', 'IXIM', 'Miel / Apicultura', 'Pequeño Contribuyente'],
      ['Cruz', 'hombre', '1992-06-17', 'Alma de colores', 'Guía', 'Pequeño Contribuyente'],
      ['Heber', 'hombre', '1984-07-22', 'Kamayal', 'Guía', 'Pequeño Contribuyente'],
      ['Pedro Esquina', 'hombre', '1995-07-28', 'Guía', 'Guía', 'Pequeño Contribuyente'],
      ['Nicolas Ramon', 'hombre', '1968-07-17', 'Escuela de español', 'Escuela de español', 'Pequeño Contribuyente'],
      ['Arnulfo Navichoc', 'hombre', '1976-04-28', 'Hotel', 'Guía', 'Pequeño Contribuyente'],
      ['Diego', 'hombre', '2002-12-12', 'Lancha', 'Lancha', 'Pequeño Contribuyente'],
      ['Andres', 'hombre', '1990-02-21', '', 'Pintura', 'Pequeño Contribuyente'],
      ['Javier', 'hombre', '1987-06-19', '', 'Ceremonia maya', 'Pequeño Contribuyente'],
      ['Juana', 'mujer', '1976-03-26', '', 'Lancha', 'Pequeño Contribuyente'],
      ['Elena', 'mujer', '1990-05-07', '', 'Textil', 'Pequeño Contribuyente'],
      ['Teresa', 'mujer', '1982-02-07', '', 'Textil', 'Pequeño Contribuyente'],
      ['Elena Santos', 'mujer', '1994-10-26', '', 'Textil / Santos', 'Pequeño Contribuyente'],
      ['Raquel', 'mujer', '1983-08-22', '', 'Experiencia gastronómica', 'Pequeño Contribuyente'],
      ['Lady Maritza', 'mujer', '1993-01-03', '', 'Cerveza artesanal', 'Pequeño Contribuyente'],
      ['Clara', 'mujer', '1982-11-06', '', 'Experiencia gastronómica', 'General'],
      ['Josefa', 'mujer', '1990-01-07', '', 'Servicios', 'Pequeño Contribuyente'],
      ['Lucrecia', 'mujer', '1993-05-29', '', 'Artesanía', 'Pequeño Contribuyente'],
      ['Marta Lidia', 'mujer', '1986-12-06', '', 'Servicios', 'Pequeño Contribuyente'],
      ['Karol Gonzales', 'mujer', '1982-11-06', '', 'Hospedaje', 'Pequeño Contribuyente'],
      ['Lucila', 'mujer', '1985-06-16', '', 'Blusas', 'Pequeño Contribuyente'],
      ['Delia', 'mujer', '1974-04-29', '', 'Servicios', 'Pequeño Contribuyente'],
      ['Flor', 'mujer', '2002-03-26', '', 'Alma de Colores', 'General'],
      ['Maria Jose', 'mujer', '1980-02-04', '', 'Servicios', 'Pequeño Contribuyente'],
    ];
    const insertMany = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
    insertMany(asociadosSeed);
  }
}

/** Siembra los catálogos y ajustes base (tipos de servicio, tipos de pago, bancos/POS y aliados) cuando están vacíos. */
function seedCatalogosPorDefecto({ minimo = false } = {}) {
  const tc = db.prepare('SELECT COUNT(*) c FROM tipos_servicio').get().c;
  if (!minimo && tc === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO tipos_servicio (nombre, color) VALUES (?,?)');
    [
      ['Tour cultural', '#14161a'], ['Tour de pesca', '#2f8a5c'], ['Tour de pueblos', '#b5822b'],
      ['Tour bienestar y salud', '#c1443c'], ['Senderismo', '#5a6b8c'], ['Promoción y publicidad', '#8a8f98'],
    ].forEach(([n, c]) => ins.run(n, c));
  }

  const tp = db.prepare('SELECT COUNT(*) c FROM tipos_pago').get().c;
  if (tp === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO tipos_pago (nombre) VALUES (?)');
    ['Transferencia', 'Efectivo', 'Tarjeta', 'POS', 'Link de pago', 'Mixto'].forEach(n => ins.run(n));
  }

  const pc = db.prepare('SELECT COUNT(*) c FROM pos_config').get().c;
  if (pc === 0) {
    const ins = db.prepare(`INSERT OR IGNORE INTO pos_config
      (nombre, formula, pct_ventas, pct_iva_retencion, fijo, rec_pct_iva_step, rec_pct_monto, rec_pct_final)
      VALUES (@nombre, @formula, @pct_ventas, @pct_iva_retencion, @fijo, @rec_pct_iva_step, @rec_pct_monto, @rec_pct_final)`);
    const base = { pct_ventas: 4.5, pct_iva_retencion: 15, fijo: 2.43, rec_pct_iva_step: 15, rec_pct_monto: 4.59, rec_pct_final: 5 };
    [
      { nombre: 'Qpaypro', formula: 'estandar', ...base },
      { nombre: 'Banco industrial', formula: 'estandar', ...base },
      { nombre: 'Banrural', formula: 'estandar', ...base },
      { nombre: 'BAC', formula: 'estandar', ...base },
      { nombre: 'POS BAC', formula: 'estandar', ...base },
      { nombre: 'Link BAC', formula: 'estandar', ...base },
      { nombre: 'Recurrente', formula: 'recurrente', ...base },
      { nombre: 'Efectivo', formula: 'sin_comision', ...base },
    ].forEach(r => ins.run(r));
  }

  const al = db.prepare('SELECT COUNT(*) c FROM aliados').get().c;
  if (!minimo && al === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO aliados (nombre, categoria) VALUES (?,?)');
    [['Tuctuc', 'Transporte'], ['Café', 'Alimentos'], ['Combustible', 'Transporte'], ['Almuerzo', 'Alimentos']]
      .forEach(([n, c]) => ins.run(n, c));
  }
}

/** Siembra lo mínimo para que el sistema funcione (asociados de ejemplo + catálogos base). Solo al arrancar. */
function seedIfEmpty() {
  seedAsociados();
  seedCatalogosPorDefecto();
}

/**
 * Migra los gastos que antes vivían fijos en folios.tuctuc / folios.cafe hacia el
 * sistema flexible de folio_gastos + aliados. Se ejecuta una sola vez.
 */
function migrarGastosFlexibles() {
  const yaAplicada = db.prepare('SELECT 1 FROM _migraciones WHERE clave = ?').get('gastos_flexibles_v1');
  if (yaAplicada) return;

  const ensureAliado = (nombre, categoria) => {
    let a = db.prepare('SELECT id FROM aliados WHERE nombre = ?').get(nombre);
    if (!a) {
      const info = db.prepare('INSERT INTO aliados (nombre, categoria) VALUES (?,?)').run(nombre, categoria);
      return info.lastInsertRowid;
    }
    return a.id;
  };

  const tx = db.transaction(() => {
    const aliadoTuctuc = ensureAliado('Tuctuc', 'Transporte');
    const aliadoCafe = ensureAliado('Café', 'Alimentos');
    const folios = db.prepare('SELECT id, tuctuc, cafe FROM folios WHERE tuctuc > 0 OR cafe > 0').all();
    const insGasto = db.prepare(`INSERT INTO folio_gastos (folio_id, aliado_id, concepto, monto) VALUES (?,?,?,?)`);
    for (const f of folios) {
      if (f.tuctuc > 0) insGasto.run(f.id, aliadoTuctuc, 'Tuctuc (migrado automáticamente)', f.tuctuc);
      if (f.cafe > 0) insGasto.run(f.id, aliadoCafe, 'Café (migrado automáticamente)', f.cafe);
    }
    db.prepare(`UPDATE folios SET tuctuc = 0, cafe = 0 WHERE tuctuc > 0 OR cafe > 0`).run();
    db.prepare(`INSERT INTO _migraciones (clave) VALUES (?)`).run('gastos_flexibles_v1');
  });
  tx();
}

/**
 * Agrega las columnas color/activo a tipos_servicio si la base de datos venía de una
 * versión anterior (ALTER TABLE, porque CREATE TABLE IF NOT EXISTS no agrega columnas
 * a una tabla que ya existe).
 */
function migrarColumnasTiposServicio() {
  const columnas = db.prepare("PRAGMA table_info(tipos_servicio)").all().map(c => c.name);
  const paleta = ['#14161a', '#2f8a5c', '#b5822b', '#c1443c', '#5a6b8c', '#8a8f98', '#7c5cad', '#1f8a8a', '#a34e8c', '#4a7c59'];
  if (!columnas.includes('color')) {
    db.exec("ALTER TABLE tipos_servicio ADD COLUMN color TEXT NOT NULL DEFAULT '#14161a'");
    const filas = db.prepare('SELECT id FROM tipos_servicio ORDER BY id').all();
    const upd = db.prepare('UPDATE tipos_servicio SET color = ? WHERE id = ?');
    filas.forEach((f, i) => upd.run(paleta[i % paleta.length], f.id));
  }
  if (!columnas.includes('activo')) {
    db.exec('ALTER TABLE tipos_servicio ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
  }
}

seedIfEmpty();
migrarGastosFlexibles();
migrarColumnasTiposServicio();

// Se expone para poder re-sembrar los catálogos base tras un "borrar todo".
db.seedCatalogosPorDefecto = seedCatalogosPorDefecto;

module.exports = db;
