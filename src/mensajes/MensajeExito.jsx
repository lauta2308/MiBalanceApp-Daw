import { textoIconoExito } from './textos.js';

// Mensaje de éxito (FR-43): se cierra solo, sin botón y sin bloquear la
// aplicación. Se dibuja dentro de la región viva de ProveedorMensajes, que es
// la que lo anuncia a los lectores de pantalla (NFR-07).
export function MensajeExito({ texto }) {
  return (
    <div className="mensaje mensaje-exito">
      <svg
        className="icono-mensaje icono-exito"
        role="img"
        aria-label={textoIconoExito}
        viewBox="0 0 24 24"
        focusable="false"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <p className="texto-mensaje">{texto}</p>
    </div>
  );
}
