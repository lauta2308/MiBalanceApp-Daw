// Lectura de la cuenta del usuario (FR-06, FR-07). Nunca expone el error de
// Supabase (NFR-06): devuelve { ok: true, cuenta } o { ok: false }.
import { EsMontoApiValido } from '../utilidades/montos.js';
import { ObtenerCliente } from './obtenerCliente.js';

export async function ObtenerCuenta() {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.from('bav_cuenta').select('id,nombre,moneda,saldo');
    // Sin filas: el usuario no tiene cuenta (E5-2); se trata como una falla de carga.
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: false };
    }
    // Un saldo con formato inesperado también es una falla de carga (FR-45):
    // nunca llega a FormatearSaldo, que lanzaría al dibujarlo. Puede ser negativo.
    if (!EsMontoApiValido(data[0].saldo)) {
      return { ok: false };
    }
    return { ok: true, cuenta: data[0] };
  } catch {
    return { ok: false };
  }
}
