// Lectura paginada de los movimientos (FR-34, FR-39). Nunca expone el error
// de Supabase (NFR-06): devuelve { ok: true, movimientos, total } o { ok: false }.

// La lista siempre se pide de a 50 filas: nunca se cargan todos los movimientos.
export const tamanoPaginaMovimientos = 50;

// Importación dinámica del cliente: ver el comentario en cuenta.js.
async function ObtenerCliente() {
  const { clienteSupabase } = await import('./clienteSupabase.js');
  return clienteSupabase;
}

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
