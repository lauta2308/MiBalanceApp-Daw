// Categorías del usuario para el selector del formulario de alta (FR-15 a
// FR-18). Nunca expone el error de Supabase (NFR-06): devuelve
// { ok: true, categorias } o { ok: false }.
import { OrdenarCategorias } from '../utilidades/categorias.js';
import { ObtenerCliente } from './obtenerCliente.js';

// Solo las categorías del tipo pedido ('GASTO' | 'INGRESO'), con la por defecto
// primero y el resto en orden alfabético (FR-16, FR-17). Sin filas también es
// una falla: toda cuenta tiene su categoría por defecto, y sin categorías el
// movimiento no se puede guardar.
export async function ObtenerCategorias(tipo) {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente
      .from('bat_categorias')
      .select('id,nombre,tipo,es_por_defecto')
      .eq('tipo', tipo);
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: false };
    }
    return { ok: true, categorias: OrdenarCategorias(data) };
  } catch {
    return { ok: false };
  }
}
