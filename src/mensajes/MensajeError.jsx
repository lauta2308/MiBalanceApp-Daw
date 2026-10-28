import { useId, useLayoutEffect, useRef } from 'react';
import { textoBotonAceptar, textoIconoError } from './textos.js';

// Mensaje de error (FR-44): diálogo modal que queda en pantalla hasta que se
// presiona "Aceptar". "Aceptar" recibe el foco al aparecer y, por ser el único
// control, Tab y Shift+Tab no lo sacan del diálogo. Escape no lo cierra. Un
// clic en el fondo o en el texto tampoco le saca el foco (AC-72).
export function MensajeError({ texto, alAceptar }) {
  const idTexto = useId();
  const botonAceptar = useRef(null);

  // El foco inicial se pone en el commit que monta el diálogo (useLayoutEffect),
  // para que un clic en "Aceptar" que llegue antes de los efectos pasivos no lo pise.
  useLayoutEffect(() => {
    botonAceptar.current?.focus();
  }, []);

  function ManejarTecla(evento) {
    if (evento.key === 'Tab') {
      evento.preventDefault();
      botonAceptar.current?.focus();
    }
  }

  function ManejarPresion(evento) {
    if (!evento.target.closest('button:not(:disabled)')) {
      evento.preventDefault();
    }
  }

  return (
    <div className="fondo-mensaje-error" onMouseDown={ManejarPresion}>
      <div
        className="mensaje mensaje-error"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTexto}
        onKeyDown={ManejarTecla}
      >
        <svg
          className="icono-mensaje icono-error"
          role="img"
          aria-label={textoIconoError}
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        <p className="texto-mensaje" id={idTexto}>
          {texto}
        </p>
        <button type="button" className="boton-aceptar" ref={botonAceptar} onClick={alAceptar}>
          {textoBotonAceptar}
        </button>
      </div>
    </div>
  );
}
