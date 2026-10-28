// Lectura paginada de los movimientos (FR-34, FR-39), alta (FR-12, FR-13),
// lectura de un movimiento, edición (FEAT-001b) y eliminación (FEAT-001c).
// Nunca expone el error de Supabase (NFR-06): devuelve { ok: true, ... } o
// { ok: false }.
import { EsFechaValida } from '../utilidades/fechas.js';
import { ConvertirMontoParaApi, EsMontoApiValido } from '../utilidades/montos.js';
import { ObtenerCliente } from './obtenerCliente.js';

// El id del movimiento llega de afuera del servicio (la URL de la edición o la
// fila de la lista) y no es confiable: se valida su forma antes de consultar.
const expresionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La lista siempre se pide de a 50 filas: nunca se cargan todos los movimientos.
export const tamanoPaginaMovimientos = 50;

// Los datos de la base se validan acá, antes de dibujarlos: un tipo, un monto
// o una fecha con formato inesperado se tratan como una falla de carga (FR-45)
// en lugar de hacer lanzar a los formateadores durante el render.
function EsMovimientoValido(movimiento) {
  return (
    (movimiento.tipo === 'GASTO' || movimiento.tipo === 'INGRESO') &&
    EsMontoApiValido(movimiento.monto) &&
    !movimiento.monto.startsWith('-') &&
    EsFechaValida(movimiento.fecha)
  );
}

// Una página que no sea un entero ≥ 1 da { ok: false } sin consultar. Una sola
// fila inválida invalida la página entera: la lista y el saldo no pueden
// quedar desparejos.
export async function ObtenerPaginaMovimientos(numeroPagina) {
  if (!Number.isInteger(numeroPagina) || numeroPagina < 1) {
    return { ok: false };
  }
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
    if (error || !Array.isArray(data) || typeof count !== 'number' || !data.every(EsMovimientoValido)) {
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

// Lectura de un movimiento propio para precargar el formulario de edición
// (FR-02). Uno inexistente o de otra cuenta llega como null por la RLS y da
// { ok: false }; uno con tipo, monto o fecha inesperados, también (FR-45,
// E4-4). La fecha y el monto quedan como texto: nunca new Date(fecha).
export async function ObtenerMovimiento(idMovimiento) {
  if (typeof idMovimiento !== 'string' || !expresionUuid.test(idMovimiento)) {
    return { ok: false };
  }
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente
      .from('bav_movimientos')
      .select('id,fecha,tipo,monto,id_categoria')
      .eq('id', idMovimiento)
      .maybeSingle();
    if (error || !data || !EsMovimientoValido(data)) {
      return { ok: false };
    }
    return { ok: true, movimiento: data };
  } catch {
    return { ok: false };
  }
}

// Edición atómica de un movimiento: una sola llamada RPC que cambia el
// movimiento y ajusta el saldo en la misma transacción. El monto y la fecha
// viajan igual que en el alta (ADR-001, sin pasar por UTC).
export async function EditarMovimiento({ idMovimiento, tipo, monto, idCategoria, fecha }) {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.rpc('basp_editar_movimiento', {
      p_id_movimiento: idMovimiento,
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

// Eliminación atómica de un movimiento (FR-03, FR-05): una sola llamada RPC que
// borra el movimiento y ajusta el saldo en la misma transacción. Un id mal
// formado da { ok: false } sin consultar; cualquier rechazo, también (FR-10).
export async function EliminarMovimiento(idMovimiento) {
  if (typeof idMovimiento !== 'string' || !expresionUuid.test(idMovimiento)) {
    return { ok: false };
  }
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.rpc('basp_eliminar_movimiento', {
      p_id_movimiento: idMovimiento,
    });
    if (error || !data) {
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
