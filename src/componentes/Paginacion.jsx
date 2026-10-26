import { useLayoutEffect, useRef } from 'react';

// "Anterior", "Página X de Y" y "Siguiente" (FR-40, FR-41). Solo se muestra
// cuando hay más de una página; el tamaño de página llega por prop.
//
// En los extremos (primera y última página) el botón lleva `disabled`. Mientras
// carga una página (`deshabilitada`) los botones NO llevan `disabled`, porque el
// navegador le quitaría el foco al botón presionado (NFR-07): llevan
// `aria-disabled="true"` y el clic se ignora.
//
// Al llegar a un extremo, el botón presionado pasa a `disabled` y el navegador
// dejaría el foco en <body>: si ese botón tenía el foco (o el foco se perdió),
// pasa al otro botón ("Siguiente" → "Anterior" en la última página, "Anterior"
// → "Siguiente" en la primera) (NFR-07).
export function Paginacion({
  numeroPagina,
  total,
  tamanoPagina,
  deshabilitada = false,
  alAnterior,
  alSiguiente,
}) {
  const botonAnterior = useRef(null);
  const botonSiguiente = useRef(null);
  // Botón presionado con el foco puesto, a la espera de la página nueva.
  const botonPresionado = useRef(null);
  const totalPaginas = Math.ceil(total / tamanoPagina);
  const ariaDeshabilitada = deshabilitada ? 'true' : undefined;

  useLayoutEffect(() => {
    const presionado = botonPresionado.current;
    if (deshabilitada || !presionado) {
      return;
    }
    botonPresionado.current = null;
    const boton = presionado === 'anterior' ? botonAnterior.current : botonSiguiente.current;
    const otroBoton = presionado === 'anterior' ? botonSiguiente.current : botonAnterior.current;
    const focoPerdido =
      document.activeElement === boton || document.activeElement === document.body;
    if (boton?.disabled && focoPerdido) {
      otroBoton?.focus();
    }
  }, [numeroPagina, deshabilitada]);

  if (total <= tamanoPagina) {
    return null;
  }

  // Recuerda el botón si se presionó teniendo el foco, para el efecto de arriba.
  function RegistrarPresionado(nombre, boton) {
    botonPresionado.current = document.activeElement === boton.current ? nombre : null;
  }

  function ManejarAnterior() {
    if (!deshabilitada) {
      RegistrarPresionado('anterior', botonAnterior);
      alAnterior();
    }
  }

  function ManejarSiguiente() {
    if (!deshabilitada) {
      RegistrarPresionado('siguiente', botonSiguiente);
      alSiguiente();
    }
  }

  return (
    <nav className="paginacion" aria-label="Paginación">
      <button
        ref={botonAnterior}
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
        ref={botonSiguiente}
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
