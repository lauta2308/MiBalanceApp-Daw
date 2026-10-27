import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MensajeError } from './MensajeError.jsx';
import { MensajeExito } from './MensajeExito.jsx';

const duracionMensajeExitoMs = 3000;

const ContextoMensajes = createContext(null);

export function ProveedorMensajes({ children }) {
  const [mensajeExito, EstablecerMensajeExito] = useState(null);
  const [mensajeError, EstablecerMensajeError] = useState(null);
  const temporizadorExito = useRef(null);
  const temporizadorEscritura = useRef(null);
  const hayMensajeExito = useRef(false);
  const contadorMensajes = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(temporizadorExito.current);
      clearTimeout(temporizadorEscritura.current);
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
  // elemento que tenía el foco al mostrar el error. Si ya había un error en
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

  function ManejarAceptarError() {
    const errorActual = mensajeError;
    EstablecerMensajeError(null);
    errorActual?.alAceptar?.();
    if (errorActual?.elementoFoco?.isConnected) {
      errorActual.elementoFoco.focus();
    }
  }

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

export function useMensajes() {
  const contexto = useContext(ContextoMensajes);
  if (!contexto) {
    throw new Error('useMensajes debe usarse dentro de ProveedorMensajes');
  }
  return contexto;
}
