// Inicio de sesión PROVISORIO (anónimo) mientras no exista Google OAuth
// (RF-22, RF-23). Es el único archivo que conoce signInAnonymously: al
// incorporar Google se reemplaza este archivo y ErrorSesionAnonima.jsx.
//
// Nunca expone el error de Supabase (R11): devuelve { ok: true, sesion } o
// { ok: false }.

let inicioEnCurso = null;

// El cliente se importa de forma dinámica porque clienteSupabase.js lanza al
// cargarse si faltan las variables de entorno: así esa falla se convierte en
// { ok: false } y la interfaz muestra el mensaje de FR-02 en lugar de quedar
// en blanco.
async function ObtenerCliente() {
  const { clienteSupabase } = await import('../servicios/clienteSupabase.js');
  return clienteSupabase;
}

export async function ObtenerSesionActual() {
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.auth.getSession();
    if (error) {
      return { ok: false };
    }
    return { ok: true, sesion: data?.session ?? null };
  } catch {
    return { ok: false };
  }
}

async function IniciarSesionAnonima() {
  // FR-03: si supabase-js ya tiene una sesión guardada, se reutiliza.
  const sesionActual = await ObtenerSesionActual();
  if (!sesionActual.ok) {
    return { ok: false };
  }
  if (sesionActual.sesion) {
    return { ok: true, sesion: sesionActual.sesion };
  }
  try {
    const cliente = await ObtenerCliente();
    const { data, error } = await cliente.auth.signInAnonymously();
    if (error || !data?.session) {
      return { ok: false };
    }
    return { ok: true, sesion: data.session };
  } catch {
    return { ok: false };
  }
}

// Las llamadas simultáneas (por ejemplo, el doble efecto de StrictMode)
// comparten el mismo intento para no crear dos usuarios anónimos.
export function IniciarSesion() {
  if (!inicioEnCurso) {
    inicioEnCurso = IniciarSesionAnonima().finally(() => {
      inicioEnCurso = null;
    });
  }
  return inicioEnCurso;
}
