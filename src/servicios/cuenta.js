// Lectura de la cuenta del usuario (FR-06, FR-07). Nunca expone el error de
// Supabase (NFR-06): devuelve { ok: true, cuenta } o { ok: false }.

// El cliente se importa de forma dinámica, como en sesionAnonima.js, porque
// clienteSupabase.js lanza al cargarse si faltan las variables de entorno: así
// esa falla se convierte en { ok: false } en lugar de dejar la pantalla en blanco.
async function ObtenerCliente() {
  const { clienteSupabase } = await import('./clienteSupabase.js');
  return clienteSupabase;
}

export async function ObtenerCuenta() {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.from('bav_cuenta').select('id,nombre,moneda,saldo');
    // Sin filas: el usuario no tiene cuenta (E5-2); se trata como una falla de carga.
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: false };
    }
    return { ok: true, cuenta: data[0] };
  } catch {
    return { ok: false };
  }
}
