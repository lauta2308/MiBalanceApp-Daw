import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router';
import { MensajeError } from './MensajeError.jsx';
import { MensajeExito } from './MensajeExito.jsx';
import { ObtenerPrimerControlEnfocable } from '../utilidades/foco.js';

const duracionMensajeExitoMs = 3000;

const ContextoMensajes = createContext(null);

export function ProveedorMensajes({ children }) {
  const [mensajeExito, EstablecerMensajeExito] = useState(null);
  const [mensajeError, EstablecerMensajeError] = useState(null);
  const temporizadorExito = useRef(null);
  const temporizadorEscritura = useRef(null);
  const hayMensajeExito = useRef(false);
  const contadorMensajes = useRef(0);
  const focoPendiente = useRef(null);
  const cierreReciente = useRef(false);
  const ubicacion = useLocation();

  useEffect(
    () => () => {
      clearTimeout(temporizadorExito.current);
      clearTimeout(temporizadorEscritura.current);
      cierreReciente.current = false;
    },
    [],
  );

  // Un mensaje nuevo reemplaza al que esté en pantalla y cuenta sus propios
  // 3 segundos (FR-43, E4-3). Si ya hay uno, la región viva se vacía y el
  // texto nuevo se escribe en el tick siguiente: así el lector de pantalla lo
  // anuncia aunque sea igual al anterior (NFR-07).
  const MostrarExito = useCallback((texto) => {
    clearTimeout(temporizadorExito.current);
    clearTimeout(temporizadorEscritura.current);
    contadorMensajes.current += 1;
    const mensajeNuevo = { idMensaje: contadorMensajes.current, texto };

    if (hayMensajeExito.current) {
      EstablecerMensajeExito(null);
      temporizadorEscritura.current = setTimeout(() => {
        EstablecerMensajeExito(mensajeNuevo);
      }, 0);
    } else {
      EstablecerMensajeExito(mensajeNuevo);
    }
    hayMensajeExito.current = true;

    temporizadorExito.current = setTimeout(() => {
      clearTimeout(temporizadorEscritura.current);
      hayMensajeExito.current = false;
      EstablecerMensajeExito(null);
    }, duracionMensajeExitoMs);
  }, []);

  // El error queda visible hasta "Aceptar"; al cerrarlo, el foco vuelve a
  // `elementoFoco` (un elemento del DOM, FR-44) o, si no se indicó, al
  // elemento que tenía el foco al mostrar el error. Si ese elemento ya no está
  // en pantalla (el usuario se fue de la sección) o era <body>, el foco pasa
  // al primer control enfocable de la pantalla que queda después de
  // `alAceptar`; si no hay ninguno, no se enfoca nada. Si ya había un error en
  // pantalla, se conserva su elemento de retorno (el foco estaba en su
  // "Aceptar"). Cada error tiene su propio id para que el diálogo se vuelva a
  // montar y "Aceptar" recupere el foco.
  const MostrarError = useCallback((texto, { alAceptar, elementoFoco } = {}) => {
    const elementoActivo = document.activeElement;
    contadorMensajes.current += 1;
    const idMensaje = contadorMensajes.current;
    EstablecerMensajeError((errorAnterior) => ({
      idMensaje,
      texto,
      alAceptar,
      elementoFoco: elementoFoco ?? errorAnterior?.elementoFoco ?? elementoActivo,
    }));
  }, []);

  // El foco se resuelve en el commit que cierra el error, no acá: el diálogo
  // ya no está y la pantalla es la que dejó `alAceptar` (por ejemplo, Cuenta
  // tras VolverACuenta), que puede haber desmontado `elementoFoco`.
  function ManejarAceptarError() {
    const errorActual = mensajeError;
    focoPendiente.current = {
      elementoFoco: errorActual?.elementoFoco,
      puedeNavegar: Boolean(errorActual?.alAceptar),
    };
    EstablecerMensajeError(null);
    errorActual?.alAceptar?.();
  }

  useLayoutEffect(() => {
    const pendiente = focoPendiente.current;
    if (!pendiente) {
      return;
    }
    focoPendiente.current = null;
    cierreReciente.current = false;
    if (mensajeError) {
      return;
    }
    if (EsElementoFocoValido(pendiente.elementoFoco)) {
      pendiente.elementoFoco.focus();
    } else {
      EnfocarPrimerControl();
    }
    cierreReciente.current = pendiente.puedeNavegar;
  }, [mensajeError]);

  // react-router aplica la navegación de `alAceptar` (por ejemplo,
  // VolverACuenta) en una transición, en un commit posterior al que cerró el
  // error: si esa pantalla nueva dejó el foco en <body>, se vuelve a aplicar
  // la reserva. Solo queda armada tras cerrar un error con `alAceptar` (el
  // único que puede navegar) y se consume en la primera navegación que sigue;
  // sin ella no se hace nada, para no pisar el foco que pone Cuenta al volver
  // de un formulario.
  useLayoutEffect(() => {
    if (!cierreReciente.current) {
      return;
    }
    cierreReciente.current = false;
    if (!EsElementoFocoValido(document.activeElement)) {
      EnfocarPrimerControl();
    }
  }, [ubicacion.key]);

  const valorContexto = useMemo(() => ({ MostrarExito, MostrarError }), [MostrarExito, MostrarError]);

  return (
    <ContextoMensajes.Provider value={valorContexto}>
      {children}
      <div className="region-mensaje-exito" role="status" aria-live="polite" aria-atomic="true">
        {mensajeExito && <MensajeExito key={mensajeExito.idMensaje} texto={mensajeExito.texto} />}
      </div>
      {mensajeError && (
        <MensajeError
          key={mensajeError.idMensaje}
          texto={mensajeError.texto}
          alAceptar={ManejarAceptarError}
        />
      )}
    </ContextoMensajes.Provider>
  );
}

function EnfocarPrimerControl() {
  ObtenerPrimerControlEnfocable(document.querySelector('main') ?? document.body)?.focus();
}

// <body> y <html> son el foco "de nadie": no cuentan como elemento de retorno.
function EsElementoFocoValido(elemento) {
  return (
    Boolean(elemento?.isConnected) &&
    elemento !== document.body &&
    elemento !== document.documentElement
  );
}

export function useMensajes() {
  const contexto = useContext(ContextoMensajes);
  if (!contexto) {
    throw new Error('useMensajes debe usarse dentro de ProveedorMensajes');
  }
  return contexto;
}
