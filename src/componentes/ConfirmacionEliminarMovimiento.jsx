import { useEffect, useId, useRef } from 'react';
import {
  textoBotonCancelar,
  textoBotonConfirmar,
  textoConfirmarEliminacion,
  textoEliminando,
} from '../mensajes/textos.js';

// Confirmación de la eliminación de un movimiento (FEAT-001c FR-02, D1):
// diálogo modal con "Cancelar" y "Confirmar". Al abrirse, el foco va a
// "Cancelar", la opción que no borra nada (D2, patrón APG de alertdialog); Tab
// y Mayús+Tab lo alternan entre los dos botones y Escape equivale a "Cancelar".
// Mientras elimina (D5), "Confirmar" muestra "Eliminando…" y toma el foco: no
// lleva disabled (el navegador le quitaría el foco), sino aria-disabled, y el
// segundo clic lo ignora quien elimina. "Cancelar" sí queda deshabilitado, Tab
// no saca el foco de "Eliminando…" y Escape se ignora (FR-06). Un clic fuera
// de un botón habilitado (el fondo, el texto o "Cancelar" deshabilitado) no
// mueve el foco: si no, quedaría en <body> y Tab saldría del modal (NFR-04).
export function ConfirmacionEliminarMovimiento({ eliminando, alConfirmar, alCancelar }) {
  const idTexto = useId();
  const botonCancelar = useRef(null);
  const botonConfirmar = useRef(null);

  useEffect(() => {
    botonCancelar.current?.focus();
  }, []);

  useEffect(() => {
    if (eliminando) {
      botonConfirmar.current?.focus();
    }
  }, [eliminando]);

  function ManejarTecla(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      if (!eliminando) {
        alCancelar();
      }
    } else if (evento.key === 'Tab') {
      evento.preventDefault();
      const enCancelar = document.activeElement === botonCancelar.current;
      (eliminando || enCancelar ? botonConfirmar : botonCancelar).current?.focus();
    }
  }

  function ManejarPresion(evento) {
    if (!evento.target.closest('button:not(:disabled)')) {
      evento.preventDefault();
    }
  }

  return (
    <div className="fondo-confirmacion" onMouseDown={ManejarPresion}>
      <div
        className="mensaje confirmacion-eliminar"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTexto}
        onKeyDown={ManejarTecla}
      >
        <p className="texto-mensaje" id={idTexto}>
          {textoConfirmarEliminacion}
        </p>
        <div className="botones-confirmacion">
          <button
            ref={botonCancelar}
            type="button"
            className="boton-secundario"
            disabled={eliminando}
            onClick={alCancelar}
          >
            {textoBotonCancelar}
          </button>
          <button
            ref={botonConfirmar}
            type="button"
            className="boton-accion"
            aria-disabled={eliminando ? 'true' : undefined}
            onClick={alConfirmar}
          >
            {eliminando ? textoEliminando : textoBotonConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
