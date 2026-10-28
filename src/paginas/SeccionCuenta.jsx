import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ConfirmacionEliminarMovimiento } from '../componentes/ConfirmacionEliminarMovimiento.jsx';
import { EncabezadoCuenta } from '../componentes/EncabezadoCuenta.jsx';
import { ListaMovimientos } from '../componentes/ListaMovimientos.jsx';
import { Paginacion } from '../componentes/Paginacion.jsx';
import { useMensajes } from '../mensajes/ProveedorMensajes.jsx';
import {
  mensajeErrorCargaMovimientos,
  mensajeErrorEliminarMovimiento,
  mensajeMovimientoEliminado,
  textoCargando,
} from '../mensajes/textos.js';
import { ObtenerCuenta } from '../servicios/cuenta.js';
import {
  EliminarMovimiento,
  ObtenerPaginaMovimientos,
  tamanoPaginaMovimientos,
} from '../servicios/movimientos.js';

// Sección Cuenta: encabezado con el saldo, lista paginada de movimientos y los
// accesos a los formularios de alta. No tiene flecha para volver atrás (FR-32).
// Cada carga pide la cuenta y una sola página de 50 movimientos; mientras llega
// una página nueva se sigue mostrando la anterior, con su propio número.
// Al volver de un formulario de alta (que indica su tipo en el estado de la
// navegación), el foco queda en el botón que lo abrió, en lugar de perderse en
// <body> al montarse de nuevo (NFR-07). Al volver de la edición (que indica el
// movimiento), el foco queda en la fila de ese movimiento si está en la página
// 1 o, si no, en la primera fila (D5 de FEAT-001b). La primera vez no se fuerza
// el foco. La eliminación ocurre acá, sin navegar (FEAT-001c D1): "Eliminar"
// abre la confirmación y, al eliminar, se recarga la página 1 con el foco en
// su primera fila o, si quedó vacía, en "Añadir Gasto" (FEAT-001c D4).
export function SeccionCuenta() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const botonGasto = useRef(null);
  const botonIngreso = useRef(null);
  const seccion = useRef(null);
  const { MostrarExito, MostrarError } = useMensajes();
  const [numeroPagina, EstablecerNumeroPagina] = useState(1);
  const [intentoCarga, EstablecerIntentoCarga] = useState(0);
  const [cargando, EstablecerCargando] = useState(true);
  const [cuenta, EstablecerCuenta] = useState(null);
  const [pagina, EstablecerPagina] = useState(null);
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

  // Tipo del formulario de alta o movimiento editado del que se volvió, y el
  // resto del estado de la navegación, leídos una sola vez al montarse.
  const [{ tipoFormularioOrigen, idMovimientoEditadoOrigen, restoEstado }] = useState(() => {
    const { tipoFormulario = null, idMovimientoEditado = null, ...resto } = ubicacion.state ?? {};
    return {
      tipoFormularioOrigen: tipoFormulario,
      idMovimientoEditadoOrigen: idMovimientoEditado,
      restoEstado: Object.keys(resto).length > 0 ? resto : null,
    };
  });
  // El foco de la edición espera a que llegue la página 1, y se aplica una vez.
  const focoEdicionPendiente = useRef(idMovimientoEditadoOrigen !== null);

  // Tras enfocar el botón de origen, se quita tipoFormulario del estado de la
  // navegación (reemplazando la entrada del historial): si no, una recarga o
  // volver con atrás/adelante a esta entrada forzaría el foco otra vez, en
  // lugar de comportarse como la primera carga. Lo mismo con
  // idMovimientoEditado, más abajo.
  useEffect(() => {
    const botonOrigen = { GASTO: botonGasto, INGRESO: botonIngreso }[tipoFormularioOrigen];
    if (!botonOrigen) {
      return;
    }
    botonOrigen.current?.focus();
    navegar('.', { replace: true, state: restoEstado });
  }, [tipoFormularioOrigen, restoEstado, navegar]);

  // La fila se busca comparando el id como texto, sin armar un selector CSS con
  // él: llega del estado de la navegación.
  useEffect(() => {
    if (!pagina || !focoEdicionPendiente.current) {
      return;
    }
    focoEdicionPendiente.current = false;
    const filas = [...(seccion.current?.querySelectorAll('[data-id-movimiento]') ?? [])];
    const filaEditada = filas.find((fila) => fila.dataset.idMovimiento === idMovimientoEditadoOrigen);
    (filaEditada ?? filas[0])?.focus();
    navegar('.', { replace: true, state: restoEstado });
  }, [pagina, idMovimientoEditadoOrigen, restoEstado, navegar]);

  // Si la recarga posterior a la eliminación falla, la página no cambia y el
  // foco sigue pendiente hasta la recarga exitosa (E3-4).
  useEffect(() => {
    if (!pagina || pagina.numero !== 1 || !focoEliminacionPendiente.current) {
      return;
    }
    focoEliminacionPendiente.current = false;
    const primeraFila = seccion.current?.querySelector('[data-id-movimiento]');
    (primeraFila ?? botonGasto.current)?.focus();
  }, [pagina]);

  useEffect(() => {
    let vigente = true;
    Promise.all([ObtenerCuenta(), ObtenerPaginaMovimientos(numeroPagina)]).then(
      ([resultadoCuenta, resultadoPagina]) => {
        if (!vigente) {
          return;
        }
        EstablecerCargando(false);
        if (!resultadoCuenta.ok || !resultadoPagina.ok) {
          // FR-45: "Aceptar" reintenta ambas cargas.
          MostrarError(mensajeErrorCargaMovimientos, {
            alAceptar: () => {
              EstablecerCargando(true);
              EstablecerIntentoCarga((intento) => intento + 1);
            },
          });
          return;
        }
        EstablecerCuenta(resultadoCuenta.cuenta);
        EstablecerPagina({
          numero: numeroPagina,
          movimientos: resultadoPagina.movimientos,
          total: resultadoPagina.total,
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [numeroPagina, intentoCarga, MostrarError]);

  // Tras un error, numeroPagina puede valer N+1 mientras se ve la página N: el diálogo modal bloquea la navegación y "Aceptar" reintenta N+1.
  function ManejarCambioPagina(numeroPaginaNuevo) {
    EstablecerCargando(true);
    EstablecerNumeroPagina(numeroPaginaNuevo);
  }

  function ManejarEliminar(idMovimiento, elementoBotonFila) {
    EstablecerConfirmacion({ idMovimiento, elementoBotonFila });
  }

  // D3: el foco vuelve a la fila desde la que se eligió "Eliminar".
  function ManejarCancelarEliminacion() {
    const elementoBotonFila = confirmacion?.elementoBotonFila;
    EstablecerConfirmacion(null);
    if (elementoBotonFila?.isConnected) {
      elementoBotonFila.focus();
    }
  }

  async function ManejarConfirmarEliminacion() {
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
      EstablecerCargando(true);
      EstablecerNumeroPagina(1);
      EstablecerIntentoCarga((intento) => intento + 1);
    }
  }

  return (
    <section className="seccion-cuenta" ref={seccion}>
      {cuenta && <EncabezadoCuenta cuenta={cuenta} />}
      <div className="acciones-cuenta">
        <button
          ref={botonGasto}
          type="button"
          className="boton-accion"
          onClick={() => navegar('/gasto/nuevo')}
        >
          Añadir Gasto
        </button>
        <button
          ref={botonIngreso}
          type="button"
          className="boton-accion"
          onClick={() => navegar('/ingreso/nuevo')}
        >
          Añadir Ingreso
        </button>
      </div>
      {cargando && !pagina && (
        <p className="texto-cargando" role="status">
          {textoCargando}
        </p>
      )}
      {pagina && (
        <>
          <ListaMovimientos
            movimientos={pagina.movimientos}
            total={pagina.total}
            alEditar={(idMovimiento) => navegar(`/movimientos/${idMovimiento}/editar`)}
            alEliminar={ManejarEliminar}
          />
          <Paginacion
            numeroPagina={pagina.numero}
            total={pagina.total}
            tamanoPagina={tamanoPaginaMovimientos}
            // Tras un error se sigue viendo la página N aunque numeroPagina valga N+1 (ver ManejarCambioPagina).
            deshabilitada={cargando}
            alAnterior={() => ManejarCambioPagina(pagina.numero - 1)}
            alSiguiente={() => ManejarCambioPagina(pagina.numero + 1)}
          />
        </>
      )}
      {confirmacion && (
        <ConfirmacionEliminarMovimiento
          eliminando={eliminando}
          alConfirmar={ManejarConfirmarEliminacion}
          alCancelar={ManejarCancelarEliminacion}
        />
      )}
    </section>
  );
}
