/**
 * Lógica de negocio extraída y generalizada de las fórmulas reales del Excel
 * (hoja "Datos de venta" y hoja "Asociados").
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Base imponible = Monto / 1.12 */
function base(monto) {
  return monto / 1.12;
}

/** IVA = Base * 12% */
function iva(monto) {
  return base(monto) * 0.12;
}

/**
 * ISR: fórmula real de la hoja (progresiva):
 * si Base > 30000  ->  (Base - 30000) * 7% + 1500
 * si no            ->  Base * 5%
 */
function isr(monto) {
  const b = base(monto);
  return b > 30000 ? (b - 30000) * 0.07 + 1500 : b * 0.05;
}

/**
 * Comisión POS por línea de pago. Reproduce y simplifica la fórmula real:
 *   =IF(medio_pago="Recurrente",
 *        G-(G-(((G/1.12)*12%)*15%)-(G*4.59%)-((G-((G/1.12)*12%)*15%)-(G*4.59%))*5%),
 *        (G*4.5%)+(I*15%)+2.43)
 * que simplifica a: term1 + term2 + term3 (ver README).
 * Los porcentajes vienen de la configuración del medio de pago (pos_config),
 * así cada banco/pasarela puede tener su propia tarifa.
 */
function comisionPOS(monto, posConfig, tipoPago) {
  // Regla observada en los datos reales: los pagos en Efectivo nunca generan comisión,
  // sin importar el banco/medio seleccionado (no pasan por una pasarela).
  if (tipoPago === 'Efectivo') return 0;
  if (!posConfig || posConfig.formula === 'sin_comision') return 0;
  const ivaLinea = iva(monto); // I de esa línea de pago

  if (posConfig.formula === 'recurrente') {
    const term1 = ivaLinea * (posConfig.rec_pct_iva_step / 100);
    const term2 = monto * (posConfig.rec_pct_monto / 100);
    const term3 = (monto - term1 - term2) * (posConfig.rec_pct_final / 100);
    return round2(term1 + term2 + term3);
  }

  // estándar
  return round2(monto * (posConfig.pct_ventas / 100) + ivaLinea * (posConfig.pct_iva_retencion / 100) + posConfig.fijo);
}

/**
 * Desglose verificable de la comisión POS para un monto dado (para la sección
 * "Bancos / POS"). Devuelve base, IVA y cada parte de la fórmula, de modo que el
 * usuario pueda comprobar a mano, por ejemplo, que la retención del 15% se aplica
 * sobre el IVA (50 / 1.12 = 44.642857 -> IVA 5.357143 -> retención 0.803571).
 */
function desgloseComisionPOS(monto, posConfig, tipoPago) {
  const r6 = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  const m = r6(Number(monto) || 0);
  const baseLinea = r6(base(m));
  const ivaLinea = r6(iva(m));
  const comun = { monto: r6(m), base: baseLinea, iva: ivaLinea };

  if (tipoPago === 'Efectivo' || !posConfig || posConfig.formula === 'sin_comision') {
    return {
      ...comun,
      formula: posConfig ? posConfig.formula : 'sin_comision',
      sin_comision: true,
      partes: [],
      retencion_iva: 0,
      comision: 0,
    };
  }

  if (posConfig.formula === 'recurrente') {
    const p1 = ivaLinea * (posConfig.rec_pct_iva_step / 100);
    const p2 = m * (posConfig.rec_pct_monto / 100);
    const p3 = (m - p1 - p2) * (posConfig.rec_pct_final / 100);
    return {
      ...comun,
      formula: 'recurrente',
      sin_comision: false,
      partes: [
        { etiqueta: `IVA × ${posConfig.rec_pct_iva_step}% (retención)`, monto: r6(p1) },
        { etiqueta: `Monto × ${posConfig.rec_pct_monto}%`, monto: r6(p2) },
        { etiqueta: `Remanente × ${posConfig.rec_pct_final}%`, monto: r6(p3) },
      ],
      retencion_iva: r6(p1),
      comision: round2(p1 + p2 + p3),
    };
  }

  const p1 = m * (posConfig.pct_ventas / 100);
  const ret = ivaLinea * (posConfig.pct_iva_retencion / 100);
  return {
    ...comun,
    formula: 'estandar',
    sin_comision: false,
    partes: [
      { etiqueta: `${posConfig.pct_ventas}% sobre la venta`, monto: r6(p1) },
      { etiqueta: `${posConfig.pct_iva_retencion}% sobre el IVA (retención)`, monto: r6(ret) },
      { etiqueta: `Cargo fijo`, monto: r6(posConfig.fijo) },
    ],
    retencion_iva: r6(ret),
    comision: round2(p1 + ret + posConfig.fijo),
  };
}

/**
 * Parte de la comisión POS que corresponde al IVA retenido (15% del IVA por
 * defecto). Es un pago de tu IVA, no un costo: se acredita contra el IVA por
 * pagar. Se excluye del gasto externo y se resta del IVA a pagar.
 */
function ivaRetenidoPOS(monto, posConfig, tipoPago) {
  if (tipoPago === 'Efectivo' || !posConfig || posConfig.formula === 'sin_comision') return 0;
  const ivaLinea = iva(monto);
  if (posConfig.formula === 'recurrente') {
    return round2(ivaLinea * (posConfig.rec_pct_iva_step / 100));
  }
  return round2(ivaLinea * (posConfig.pct_iva_retencion / 100));
}

/** Edad en años cumplidos a la fecha de hoy, a partir de fecha_nacimiento (YYYY-MM-DD) */
function edad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) e--;
  return e;
}

/**
 * Clasificación por edad. Igual que la hoja "Asociados" original:
 * edad <= umbral  -> "Joven (≤ umbral)"
 * edad > umbral   -> "Adulto (> umbral)"
 * (umbral configurable, por defecto 35 — igual que el Excel original)
 */
function clasificacionEdad(fechaNacimiento, umbral = 35) {
  const e = edad(fechaNacimiento);
  if (e === null) return '';
  return e <= umbral ? `Joven (≤ ${umbral})` : `Adulto (> ${umbral})`;
}

/** IVA recuperado de un pago a un asociado, solo si es Régimen General */
function ivaRecuperadoDePago(montoPagado, regimenAsociado) {
  if (regimenAsociado !== 'General') return 0;
  return round2(iva(montoPagado));
}

module.exports = {
  round2,
  base,
  iva,
  isr,
  comisionPOS,
  ivaRetenidoPOS,
  desgloseComisionPOS,
  edad,
  clasificacionEdad,
  ivaRecuperadoDePago,
};
