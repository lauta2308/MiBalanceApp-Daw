// Lectura paginada de los movimientos (FR-34, FR-39) y alta (FR-12, FR-13).
// Nunca expone el error de Supabase (NFR-06): devuelve { ok: true, ... } o
// { ok: false }.
import { ConvertirMontoParaApi } from '../utilidades/montos.js';
import { ObtenerCliente } from './obtenerCliente.js';

// La lista siempre se pide de a 50 filas: nunca se cargan todos los movimientos.
export const tamanoPaginaMovimientos = 50;

export async function ObtenerPaginaMovimientos(numeroPagina) {
  const desde = (numeroPagina - 1) * tamanoPaginaMovimientos;
  const hasta = desde + tamanoPaginaMovimientos - 1;
  try {
    const cliente = await ObtenerCliente();
    const { data, error, count } = await cliente
      .from('bav_movimientos')
      .select('id,fecha,tipo,monto,nombre_categoria,creado_en', { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, hasta);
    if (error || !Array.isArray(data) || typeof count !== 'number') {
      return { ok: false };
    }
    return { ok: true, movimientos: data, total: count };
  } catch {
    return { ok: false };
  }
}

// Alta atómica de un movimiento (FR-12, FR-13): una sola llamada RPC que guarda
// el movimiento y actualiza el saldo en la misma transacción (NFR-04). El monto
// llega con el formato del campo ("1.500,50") y viaja como texto "1500.50"
// (ADR-001); la fecha viaja tal cual, "AAAA-MM-DD", sin pasar por UTC.
export async function AgregarMovimiento({ tipo, monto, idCategoria, fecha }) {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.rpc('basp_agregar_movimiento', {
      p_tipo: tipo,
      p_monto: ConvertirMontoParaApi(monto),
      p_id_categoria: idCategoria,
      p_fecha: fecha,
    });
    if (error || !data) {
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
