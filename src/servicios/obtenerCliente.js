// Acceso compartido al cliente de Supabase para los servicios de src/servicios/.
//
// El cliente se importa de forma dinámica, como en sesionAnonima.js, porque
// clienteSupabase.js lanza al cargarse si faltan las variables de entorno: así
// esa falla se convierte en { ok: false } en lugar de dejar la pantalla en blanco.
//
// Las llamadas simultáneas (Cuenta pide la cuenta y los movimientos a la vez)
// comparten una sola importación: con dos importaciones simultáneas desde este
// módulo, Vitest no aplica la simulación de clienteSupabase.js a la segunda.
//
// Si la importación falla, la promesa rechazada no se guarda. Esto no recupera
// la app en el navegador: un módulo que lanzó al evaluarse queda con error en el
// registro de módulos, y volver a importarlo da el mismo rechazo. Solo permite
// reintentar bajo Vitest o si lo que falló fue la descarga del archivo.
let importacionCliente = null;

export async function ObtenerCliente() {
  if (!importacionCliente) {
    importacionCliente = import('./clienteSupabase.js').then(
      ({ clienteSupabase }) => clienteSupabase,
      (error) => {
        importacionCliente = null;
        throw error;
      },
    );
  }
  return importacionCliente;
}
