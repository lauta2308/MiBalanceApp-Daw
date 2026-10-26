// Flecha para volver atrás del formulario de alta (FR-32). El ícono es
// decorativo: el nombre accesible lo da el aria-label del botón (NFR-07).
export function FlechaVolver({ alVolver, deshabilitada = false }) {
  return (
    <button
      type="button"
      className="flecha-volver"
      aria-label="Volver atrás"
      disabled={deshabilitada}
      onClick={alVolver}
    >
      <svg className="icono-flecha" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
