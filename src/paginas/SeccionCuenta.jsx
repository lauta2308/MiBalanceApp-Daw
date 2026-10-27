import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { EncabezadoCuenta } from '../componentes/EncabezadoCuenta.jsx';
import { ListaMovimientos } from '../componentes/ListaMovimientos.jsx';
import { Paginacion } from '../componentes/Paginacion.jsx';
import { useMensajes } from '../mensajes/ProveedorMensajes.jsx';
import { mensajeErrorCargaMovimientos, textoCargando } from '../mensajes/textos.js';
import { ObtenerCuenta } from '../servicios/cuenta.js';
import { ObtenerPaginaMovimientos, tamanoPaginaMovimientos } from '../servicios/movimientos.js';

// Sección Cuenta: encabezado con el saldo, lista paginada de movimientos y los
// accesos a los formularios de alta. No tiene flecha para volver atrás (FR-32).
// Cada carga pide la cuenta y una sola página de 50 movimientos; mientras llega
// una página nueva se sigue mostrando la anterior, con su propio número.
// Al volver de un formulario de alta (que indica su tipo en el estado de la
// navegación), el foco queda en el botón que lo abrió, en lugar de perderse en
// <body> al montarse de nuevo (NFR-07). La primera vez no se fuerza el foco.
export function SeccionCuenta() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const botonGasto = useRef(null);
  const botonIngreso = useRef(null);
  const { MostrarError } = useMensajes();
  const [numeroPagina, EstablecerNumeroPagina] = useState(1);
  const [intentoCarga, EstablecerIntentoCarga] = useState(0);
  const [cargando, EstablecerCargando] = useState(true);
  const [cuenta, EstablecerCuenta] = useState(null);
  const [pagina, EstablecerPagina] = useState(null);

  // Tipo del formulario del que se volvió y el resto del estado de la
  // navegación, leídos una sola vez al montarse.
  const [{ tipoFormularioOrigen, restoEstado }] = useState(() => {
    const { tipoFormulario = null, ...resto } = ubicacion.state ?? {};
    return {
      tipoFormularioOrigen: tipoFormulario,
      restoEstado: Object.keys(resto).length > 0 ? resto : null,
    };
  });

  // Tras enfocar el botón de origen, se quita tipoFormulario del estado de la
  // navegación (reemplazando la entrada del historial): si no, una recarga o
  // volver con atrás/adelante a esta entrada forzaría el foco otra vez, en
  // lugar de comportarse como la primera carga.
  useEffect(() => {
    const botonOrigen = { GASTO: botonGasto, INGRESO: botonIngreso }[tipoFormularioOrigen];
    if (!botonOrigen) {
      return;
    }
    botonOrigen.current?.focus();
    navegar('.', { replace: true, state: restoEstado });
  }, [tipoFormularioOrigen, restoEstado, navegar]);

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

  return (
    <section className="seccion-cuenta">
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
          <ListaMovimientos movimientos={pagina.movimientos} total={pagina.total} />
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
    </section>
  );
}
