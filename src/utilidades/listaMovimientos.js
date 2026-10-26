// Agrupa los movimientos de UNA página, en el orden en que llegan: cada
// página empieza con el encabezado de su primera fecha (FR-47).
export function AgruparPorFecha(movimientosDeLaPagina) {
  const grupos = [];
  for (const movimiento of movimientosDeLaPagina) {
    const ultimoGrupo = grupos.at(-1);
    if (ultimoGrupo && ultimoGrupo.fecha === movimiento.fecha) {
      ultimoGrupo.movimientos.push(movimiento);
    } else {
      grupos.push({ fecha: movimiento.fecha, movimientos: [movimiento] });
    }
  }
  return grupos;
}
