// "Anterior", "Página X de Y" y "Siguiente" (FR-40, FR-41). Solo se muestra
// cuando hay más de una página; el tamaño de página llega por prop.
//
// En los extremos (primera y última página) el botón lleva `disabled`. Mientras
// carga una página (`deshabilitada`) los botones NO llevan `disabled`, porque el
// navegador le quitaría el foco al botón presionado (NFR-07): llevan
// `aria-disabled="true"` y el clic se ignora.
export function Paginacion({
  numeroPagina,
  total,
  tamanoPagina,
  deshabilitada = false,
  alAnterior,
  alSiguiente,
}) {
  if (total <= tamanoPagina) {
    return null;
  }
  const totalPaginas = Math.ceil(total / tamanoPagina);
  const ariaDeshabilitada = deshabilitada ? 'true' : undefined;

  function ManejarAnterior() {
    if (!deshabilitada) {
      alAnterior();
    }
  }

  function ManejarSiguiente() {
    if (!deshabilitada) {
      alSiguiente();
    }
  }

  return (
    <nav className="paginacion" aria-label="Paginación">
      <button
        type="button"
        className="boton-paginacion"
        disabled={numeroPagina <= 1}
        aria-disabled={ariaDeshabilitada}
        onClick={ManejarAnterior}
      >
        Anterior
      </button>
      <p className="indicador-pagina" aria-live="polite">
        {`Página ${numeroPagina} de ${totalPaginas}`}
      </p>
      <button
        type="button"
        className="boton-paginacion"
        disabled={numeroPagina >= totalPaginas}
        aria-disabled={ariaDeshabilitada}
        onClick={ManejarSiguiente}
      >
        Siguiente
      </button>
    </nav>
  );
}
