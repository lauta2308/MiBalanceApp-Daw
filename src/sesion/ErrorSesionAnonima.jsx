import { MensajeError } from '../mensajes/MensajeError.jsx';
import { mensajeErrorInicioSesion } from '../mensajes/textos.js';

// Error de FR-02 (provisorio): se reemplaza por RF-24 al incorporar Google.
export function ErrorSesionAnonima({ alReintentar }) {
  return <MensajeError texto={mensajeErrorInicioSesion} alAceptar={alReintentar} />;
}
