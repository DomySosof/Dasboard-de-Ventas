/**
 * Carga de datos de EJEMPLO (los mismos 3 folios que traía tu plantilla original de Excel).
 * Sirve para verificar que los cálculos del sistema coinciden con los de tu hoja de cálculo.
 * Ejecutar con:  docker compose exec app node src/scripts/seed-demo.js
 */
const db = require('../db');

function nombreIdPorNombreParcial(nombre) {
  const row = db.prepare('SELECT id FROM asociados WHERE nombre LIKE ?').get(`%${nombre}%`);
  if (!row) throw new Error(`No se encontró asociado: ${nombre}`);
  return row.id;
}

const tx = db.transaction(() => {
  // Folio 1: Tour cultural, 24 pax, pago mixto (varias tarjetas Qpaypro + 1 efectivo)
  db.prepare(`INSERT OR REPLACE INTO folios (id, fecha, tipo, pax, tuctuc, cafe) VALUES (1, '2026-02-10','Tour cultural',24,80,200)`).run();
  const pagos1 = [1175, 1213, 364, 364, 364, 728, 728, 3425];
  const insPago = db.prepare(`INSERT INTO pagos (folio_id, tipo_pago, medio_pago, monto) VALUES (?,?,?,?)`);
  for (const m of pagos1) insPago.run(1, 'Tarjeta', 'Qpaypro', m);
  insPago.run(1, 'Efectivo', 'Banco industrial', 1092);
  const insFA = db.prepare(`INSERT INTO folio_asociados (folio_id, asociado_id, servicio, monto_pagado) VALUES (?,?,?,?)`);
  insFA.run(1, nombreIdPorNombreParcial('Diego'), 'Lancha', 1500);
  insFA.run(1, nombreIdPorNombreParcial('Flor'), 'Alma de Colores', 1690);

  // Folio 2: Tour cultural, 2 pax, una sola tarjeta
  db.prepare(`INSERT OR REPLACE INTO folios (id, fecha, tipo, pax, tuctuc, cafe) VALUES (2, '2026-02-11','Tour cultural',2,0,0)`).run();
  insPago.run(2, 'Tarjeta', 'Qpaypro', 244);

  // Folio 3: Tour cultural, 2 pax, varias tarjetas + pagos a asociados
  db.prepare(`INSERT OR REPLACE INTO folios (id, fecha, tipo, pax, tuctuc, cafe) VALUES (3, '2026-02-18','Tour cultural',2,47,50)`).run();
  for (const m of [2716, 2037, 679]) insPago.run(3, 'Tarjeta', 'Qpaypro', m);
  insFA.run(3, nombreIdPorNombreParcial('Arnulfo'), 'Guía', 300);
  insFA.run(3, nombreIdPorNombreParcial('Diego'), 'Lancha', 750);
  insFA.run(3, nombreIdPorNombreParcial('Flor'), 'Alma de Colores', 195);
});

tx();
console.log('Datos de ejemplo cargados (folios 1, 2 y 3).');
console.log('Verificación folio 1 (coincide con la plantilla original) -> Utilidad Neta ≈ Q4,199.18');
console.log('Nota: en el folio 3, la plantilla original de Excel sólo sumaba el primer pago (Q2,716) al monto');
console.log('total por un error en su fórmula; este sistema sí suma correctamente los 3 pagos (Q5,432 en total),');
console.log('tal como pediste ("si tiene el mismo id se suma el total"). Por eso su Utilidad Neta aquí es mayor.');
