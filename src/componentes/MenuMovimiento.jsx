import { useEffect, useRef } from 'react';

// Menú de la fila de un movimiento (FR-01): por ahora una sola opción,
// "Editar" (FEAT-001c le agrega "Eliminar"). Se dibuja debajo del botón de la
// fila que lo abrió. Al abrirse, el foco pasa a la primera opción; las flechas,
// Inicio y Fin lo mueven entre las opciones; Escape, Mayús+Tab o un clic afuera
// lo cierran y devuelven el foco al botón de la fila; Tab lo cierra y deja que
// el foco siga su camino (NFR-04). `id` e `idBotonFila` enlazan el menú con su
// fila (patrón APG de botón de menú).
export function MenuMovimiento({ id, idBotonFila, botonFila, alEditar, alCerrar }) {
  const menu = useRef(null);

  useEffect(() => {
    menu.current?.querySelector('[role="menuitem"]')?.focus();
  }, []);

  function CerrarYVolverAFila() {
    alCerrar();
    botonFila.current?.focus();
  }

  // Un clic afuera (fuera del menú y del botón de la fila, que se abre y se
  // cierra solo) lo cierra. Si el foco pasa a otro control sin clic (Tab
  // hacia adelante), se cierra sin moverlo: el menú sigue en el DOM mientras el
  // navegador elige el control siguiente.
  useEffect(() => {
    function EstaAdentro(elemento) {
      return menu.current?.contains(elemento) || botonFila.current?.contains(elemento);
    }
    function ManejarClicAfuera(evento) {
      if (!EstaAdentro(evento.target)) {
        alCerrar();
        botonFila.current?.focus();
      }
    }
    function ManejarFocoAfuera(evento) {
      if (!EstaAdentro(evento.target)) {
        alCerrar();
      }
    }
    document.addEventListener('pointerdown', ManejarClicAfuera);
    document.addEventListener('focusin', ManejarFocoAfuera);
    return () => {
      document.removeEventListener('pointerdown', ManejarClicAfuera);
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
        <button type="button" className="opcion-menu" role="menuitem" onClick={alEditar}>
          Editar
        </button>
      </li>
    </ul>
  );
}
