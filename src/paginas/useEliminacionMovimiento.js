import { useEffect, useRef, useState } from 'react';
import { useMensajes } from '../mensajes/ProveedorMensajes.jsx';
import { mensajeErrorEliminarMovimiento, mensajeMovimientoEliminado } from '../mensajes/textos.js';
import { EliminarMovimiento } from '../servicios/movimientos.js';

// Eliminación de un movimiento desde la sección Cuenta, sin navegar (FEAT-001c
// D1): "Eliminar" abre la confirmación y, al eliminar, alEliminado recarga la
// página 1; cuando llega, el foco queda en su primera fila o, si quedó vacía,
// en "Añadir Gasto" (FEAT-001c D4). Recibe la página que se ve, la sección y
// el botón "Añadir Gasto" para ubicar ese foco.
export function useEliminacionMovimiento({ pagina, seccion, botonGasto, alEliminado }) {
  const { MostrarExito, MostrarError } = useMensajes();
  // Movimiento a eliminar y botón de su fila, mientras la confirmación está abierta.
  const [confirmacion, EstablecerConfirmacion] = useState(null);
  const [eliminando, EstablecerEliminando] = useState(false);
  // Bloquea una segunda eliminación antes de que React vuelva a dibujar (FR-06).
  const eliminacionEnCurso = useRef(false);
  // El foco tras eliminar espera a que llegue la página 1 recargada (D4).
  const focoEliminacionPendiente = useRef(false);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Si la recarga posterior a la eliminación falla, la página no cambia y el
  // foco sigue pendiente hasta la recarga exitosa (E3-4).
  useEffect(() => {
    if (!pagina || pagina.numero !== 1 || !focoEliminacionPendiente.current) {
      return;
    }
    focoEliminacionPendiente.current = false;
    const primeraFila = seccion.current?.querySelector('[data-id-movimiento]');
    (primeraFila ?? botonGasto.current)?.focus();
  }, [pagina, seccion, botonGasto]);

  function AbrirConfirmacion(idMovimiento, elementoBotonFila) {
    EstablecerConfirmacion({ idMovimiento, elementoBotonFila });
  }

  // D3: el foco vuelve a la fila desde la que se eligió "Eliminar".
  function CancelarEliminacion() {
    const elementoBotonFila = confirmacion?.elementoBotonFila;
    EstablecerConfirmacion(null);
    if (elementoBotonFila?.isConnected) {
      elementoBotonFila.focus();
    }
  }

  async function ConfirmarEliminacion() {
    if (eliminacionEnCurso.current || !confirmacion) {
      return;
    }
    const { idMovimiento, elementoBotonFila } = confirmacion;
    eliminacionEnCurso.current = true;
    EstablecerEliminando(true);

    const resultado = await EliminarMovimiento(idMovimiento);
    // El éxito y el error se muestran siempre, aunque el usuario ya haya salido
    // de Cuenta (FR-07, FR-10, E3-5); el estado se toca solo si sigue montada.
    // Ante el error, la confirmación se cierra antes de mostrarlo y, al
    // aceptarlo, el foco vuelve a la fila si sigue en el DOM (D3, E3-1).
    if (montado.current) {
      eliminacionEnCurso.current = false;
      EstablecerEliminando(false);
      EstablecerConfirmacion(null);
    }
    if (!resultado.ok) {
      MostrarError(mensajeErrorEliminarMovimiento, { elementoFoco: elementoBotonFila });
      return;
    }
    MostrarExito(mensajeMovimientoEliminado);
    if (montado.current) {
      // D4: se recarga la página 1 aunque ya se estuviera en ella.
      focoEliminacionPendiente.current = true;
      alEliminado();
    }
  }

  return { confirmacion, eliminando, AbrirConfirmacion, CancelarEliminacion, ConfirmarEliminacion };
}
