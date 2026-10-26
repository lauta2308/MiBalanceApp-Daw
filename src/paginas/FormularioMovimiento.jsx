import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CampoMonto } from '../componentes/CampoMonto.jsx';
import { FlechaVolver } from '../componentes/FlechaVolver.jsx';
import { SelectorCategoria } from '../componentes/SelectorCategoria.jsx';
import { SelectorFecha } from '../componentes/SelectorFecha.jsx';
import { useMensajes } from '../mensajes/ProveedorMensajes.jsx';
import {
  mensajeErrorCargaMovimientos,
  mensajeErrorGuardarMovimiento,
  mensajeGastoRegistrado,
  mensajeIngresoRegistrado,
} from '../mensajes/textos.js';
import { ObtenerCategorias } from '../servicios/categorias.js';
import { AgregarMovimiento } from '../servicios/movimientos.js';
import { ObtenerCategoriaPorDefecto } from '../utilidades/categorias.js';
import { ObtenerFechaHoyLocal } from '../utilidades/fechas.js';
import { ValidarMonto } from '../utilidades/montos.js';

const textosPorTipo = {
  GASTO: { titulo: 'Añadir Gasto', mensajeExito: mensajeGastoRegistrado },
  INGRESO: { titulo: 'Añadir Ingreso', mensajeExito: mensajeIngresoRegistrado },
};

// Formulario de alta de un gasto o un ingreso (FR-12 a FR-33). Cada montaje
// empieza limpio: monto vacío, la categoría por defecto y la fecha de hoy
// (FR-14). "Guardar" valida el monto, deshabilita el formulario mientras guarda
// (FR-33), llama una sola vez al alta y, si sale bien, muestra el éxito y vuelve
// a Cuenta, que se monta de nuevo en la página 1 (FR-42).
export function FormularioMovimiento({ tipo }) {
  const navegar = useNavigate();
  const { MostrarExito, MostrarError } = useMensajes();
  const { titulo, mensajeExito } = textosPorTipo[tipo];

  const [monto, EstablecerMonto] = useState('');
  const [fecha, EstablecerFecha] = useState(ObtenerFechaHoyLocal);
  const [categorias, EstablecerCategorias] = useState(null);
  const [idCategoria, EstablecerIdCategoria] = useState(null);
  const [intentoCarga, EstablecerIntentoCarga] = useState(0);
  const [guardando, EstablecerGuardando] = useState(false);

  const campoMonto = useRef(null);
  const botonGuardar = useRef(null);
  // Bloquea un segundo envío antes de que React vuelva a dibujar (FR-33).
  const envioEnCurso = useRef(false);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    ObtenerCategorias(tipo).then((resultado) => {
      if (!vigente) {
        return;
      }
      if (!resultado.ok) {
        // E6-4: "Aceptar" reintenta; mientras tanto "Guardar" sigue deshabilitado.
        MostrarError(mensajeErrorCargaMovimientos, {
          alAceptar: () => EstablecerIntentoCarga((intento) => intento + 1),
          elementoFoco: campoMonto.current,
        });
        return;
      }
      EstablecerCategorias(resultado.categorias);
      EstablecerIdCategoria(ObtenerCategoriaPorDefecto(resultado.categorias));
    });
    return () => {
      vigente = false;
    };
  }, [tipo, intentoCarga, MostrarError]);

  function VolverACuenta() {
    navegar('/');
  }

  async function ManejarEnvio(evento) {
    evento.preventDefault();
    if (envioEnCurso.current || !categorias) {
      return;
    }

    // E6-1, E6-2: al aceptar el error, el foco vuelve a "Monto" (FR-44).
    const validacion = ValidarMonto(monto);
    if (!validacion.valido) {
      MostrarError(validacion.mensaje, { elementoFoco: campoMonto.current });
      return;
    }

    envioEnCurso.current = true;
    EstablecerGuardando(true);
    // Los campos quedan deshabilitados: el foco pasa a "Guardando…", que sigue
    // habilitado para el teclado, para que no se pierda (NFR-07).
    botonGuardar.current?.focus();

    const resultado = await AgregarMovimiento({ tipo, monto, idCategoria, fecha });
    // El mensaje de éxito se muestra siempre, aunque el usuario ya haya salido
    // del formulario (por ejemplo, con Atrás del navegador): el movimiento se
    // registró (FR-43). Navegar y tocar el estado, solo si sigue montado.
    if (resultado.ok) {
      MostrarExito(mensajeExito);
    }
    if (!montado.current) {
      return;
    }
    if (resultado.ok) {
      navegar('/', { state: { pagina: 1 } });
      return;
    }

    // E6-3: el formulario sigue abierto con los datos ingresados (FR-46).
    envioEnCurso.current = false;
    EstablecerGuardando(false);
    MostrarError(mensajeErrorGuardarMovimiento, { elementoFoco: campoMonto.current });
  }

  return (
    <section className="formulario-movimiento">
      <header className="encabezado-formulario">
        <FlechaVolver alVolver={VolverACuenta} deshabilitada={guardando} />
        <h1 className="titulo-formulario">{titulo}</h1>
      </header>
      <form className="formulario" onSubmit={ManejarEnvio} noValidate>
        <fieldset className="campos-formulario" disabled={guardando}>
          <CampoMonto ref={campoMonto} valor={monto} alCambiar={EstablecerMonto} />
          <SelectorCategoria
            categorias={categorias ?? []}
            idCategoria={idCategoria}
            alCambiar={EstablecerIdCategoria}
            deshabilitado={!categorias}
          />
          <SelectorFecha valor={fecha} alCambiar={EstablecerFecha} />
        </fieldset>
        <div className="acciones-formulario">
          {/* "Guardar" queda fuera del fieldset: mientras guarda no lleva
              disabled (el navegador le quitaría el foco), sino aria-disabled, y
              el segundo envío se ignora. Sin categorías sí está deshabilitado. */}
          <button
            ref={botonGuardar}
            type="submit"
            className="boton-accion"
            disabled={!categorias}
            aria-disabled={guardando ? 'true' : undefined}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="boton-secundario"
            disabled={guardando}
            onClick={VolverACuenta}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
