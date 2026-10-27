import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { textoCargando } from '../mensajes/textos.js';
import { ErrorSesionAnonima } from './ErrorSesionAnonima.jsx';
import { IniciarSesion } from './sesionAnonima.js';

const ContextoSesion = createContext(null);

// El resto de la aplicación solo conoce este proveedor: no sabe cómo se inicia
// la sesión (hoy anónima, luego Google OAuth).
export function ProveedorSesion({ children }) {
  const [estadoSesion, EstablecerEstadoSesion] = useState('cargando');
  const [sesion, EstablecerSesion] = useState(null);
  const montado = useRef(false);

  function AplicarResultado(resultado) {
    if (resultado.ok) {
      EstablecerSesion(resultado.sesion);
      EstablecerEstadoSesion('iniciada');
    } else {
      EstablecerSesion(null);
      EstablecerEstadoSesion('error');
    }
  }

  useEffect(() => {
    montado.current = true;
    IniciarSesion().then((resultado) => {
      if (montado.current) {
        AplicarResultado(resultado);
      }
    });
    return () => {
      montado.current = false;
    };
  }, []);

  function ManejarReintento() {
    EstablecerEstadoSesion('cargando');
    IniciarSesion().then((resultado) => {
      if (montado.current) {
        AplicarResultado(resultado);
      }
    });
  }

  if (estadoSesion === 'cargando') {
    return (
      <p className="texto-cargando" role="status">
        {textoCargando}
      </p>
    );
  }
  if (estadoSesion === 'error') {
    return <ErrorSesionAnonima alReintentar={ManejarReintento} />;
  }
  return <ContextoSesion.Provider value={{ sesion }}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  }
  return contexto;
}
