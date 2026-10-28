import { useEffect, useLayoutEffect, useRef } from 'react';

// Controles que reciben el foco al presionarlos con el puntero. Se excluyen
// los deshabilitados y el enlace sin href; la etiqueta cuenta solo si tiene un
// control habilitado, al que le pasa el foco.
const selectorEnfocable = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'summary',
  '[tabindex]',
  '[contenteditable="true"]',
].join(', ');

function RecibeFocoAlPresionar(elemento) {
  if (elemento.closest?.(selectorEnfocable)) {
    return true;
  }
  const control = elemento.closest?.('label')?.control;
  return Boolean(control && !control.disabled);
}

// Menú de la fila de un movimiento (FEAT-001b FR-01; FEAT-001c FR-01): las
// opciones "Editar" y "Eliminar". Se dibuja debajo del botón de la fila que lo
// abrió. Al abrirse, el foco pasa a la primera opción; las flechas, Inicio y
// Fin lo mueven entre las opciones, que quedan fuera del orden de Tab; Escape
// o Mayús+Tab lo cierran y devuelven el foco al botón de la fila; Tab lo
// cierra y deja que el foco siga su camino (NFR-04). Un clic afuera lo
// cierra: si cae en una zona que no puede recibir el foco, el foco vuelve a la
// fila; si cae en un control enfocable, queda en ese control (patrón APG).
// `id` e `idBotonFila` enlazan el menú con su fila (patrón APG de botón de
// menú).
export function MenuMovimiento({ id, idBotonFila, botonFila, alEditar, alEliminar, alCerrar }) {
  const menu = useRef(null);

  // El foco inicial se pone en el commit que abre el menú (useLayoutEffect),
  // para que una tecla que llegue antes de los efectos pasivos no lo pise.
  useLayoutEffect(() => {
    menu.current?.querySelector('[role="menuitem"]')?.focus();
  }, []);

  function CerrarYVolverAFila() {
    alCerrar();
    botonFila.current?.focus();
  }

  // Un clic afuera (fuera del menú y del botón de la fila, que se abre y se
  // cierra solo) lo cierra. Sobre una zona no enfocable devuelve el foco a la
  // fila y cancela el mousedown, que es lo que en todos los navegadores le
  // quitaría el foco y lo dejaría en <body>. Sobre un control enfocable no se
  // cancela nada y el foco queda en ese control. Si el foco pasa a otro
  // control sin clic (Tab hacia adelante), se cierra sin moverlo: el menú
  // sigue en el DOM mientras el navegador elige el control siguiente.
  useEffect(() => {
    function EstaAdentro(elemento) {
      return menu.current?.contains(elemento) || botonFila.current?.contains(elemento);
    }
    function ManejarClicAfuera(evento) {
      if (EstaAdentro(evento.target)) {
        return;
      }
      alCerrar();
      if (!RecibeFocoAlPresionar(evento.target)) {
        evento.preventDefault();
        botonFila.current?.focus();
      }
    }
    function ManejarFocoAfuera(evento) {
      if (!EstaAdentro(evento.target)) {
        alCerrar();
      }
    }
    document.addEventListener('mousedown', ManejarClicAfuera);
    document.addEventListener('focusin', ManejarFocoAfuera);
    return () => {
      document.removeEventListener('mousedown', ManejarClicAfuera);
      document.removeEventListener('focusin', ManejarFocoAfuera);
    };
  }, [botonFila, alCerrar]);

  function ManejarTecla(evento) {
    const opciones = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const indiceActual = opciones.indexOf(document.activeElement);
    const indiceNuevo = {
      ArrowDown: (indiceActual + 1) % opciones.length,
      ArrowUp: (indiceActual - 1 + opciones.length) % opciones.length,
      Home: 0,
      End: opciones.length - 1,
    }[evento.key];

    if (evento.key === 'Escape' || (evento.key === 'Tab' && evento.shiftKey)) {
      evento.preventDefault();
      evento.stopPropagation();
      CerrarYVolverAFila();
    } else if (indiceNuevo !== undefined) {
      evento.preventDefault();
      opciones[indiceNuevo]?.focus();
    }
  }

  return (
    <ul
      id={id}
      className="menu-movimiento"
      role="menu"
      aria-labelledby={idBotonFila}
      ref={menu}
      onKeyDown={ManejarTecla}
    >
      <li role="none">
        <button
          type="button"
          className="opcion-menu"
          role="menuitem"
          tabIndex={-1}
          onClick={alEditar}
        >
          Editar
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          className="opcion-menu"
          role="menuitem"
          tabIndex={-1}
          onClick={alEliminar}
        >
          Eliminar
        </button>
      </li>
    </ul>
  );
}
