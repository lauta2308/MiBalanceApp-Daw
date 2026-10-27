import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CampoMonto } from '../componentes/CampoMonto.jsx';
import { FlechaVolver } from '../componentes/FlechaVolver.jsx';
import { SelectorCategoria } from '../componentes/SelectorCategoria.jsx';
import { SelectorFecha } from '../componentes/SelectorFecha.jsx';
import { SelectorTipo } from '../componentes/SelectorTipo.jsx';
import { useMensajes } from '../mensajes/ProveedorMensajes.jsx';
import {
  mensajeErrorCargaMovimientos,
  mensajeErrorGuardarMovimiento,
  mensajeGastoRegistrado,
  mensajeIngresoRegistrado,
  mensajeMovimientoActualizado,
} from '../mensajes/textos.js';
import { ObtenerCategorias } from '../servicios/categorias.js';
import {
  AgregarMovimiento,
  EditarMovimiento,
  ObtenerMovimiento,
} from '../servicios/movimientos.js';
import { ObtenerCategoriaPorDefecto } from '../utilidades/categorias.js';
import { ObtenerFechaHoyLocal } from '../utilidades/fechas.js';
import { FormatearMonto, ValidarMonto } from '../utilidades/montos.js';

const textosPorTipo = {
  GASTO: { titulo: 'Añadir Gasto', mensajeExito: mensajeGastoRegistrado },
  INGRESO: { titulo: 'Añadir Ingreso', mensajeExito: mensajeIngresoRegistrado },
};

const textosEdicion = { titulo: 'Editar Movimiento', mensajeExito: mensajeMovimientoActualizado };

// Categoría que queda elegida al cargar las del tipo: la que ya estaba, si es
// de ese tipo (la del movimiento en la primera carga de la edición), o si no
// la por defecto (FEAT-001a FR-18; FEAT-001b FR-08).
function ElegirCategoria(idCategoriaActual, categorias) {
  const esDelTipo = categorias.some((categoria) => categoria.id === idCategoriaActual);
  return esDelTipo ? idCategoriaActual : ObtenerCategoriaPorDefecto(categorias);
}

// Formulario de alta de un gasto o un ingreso (FEAT-001a FR-12 a FR-33) y de
// edición de un movimiento (FEAT-001b, modo 'edicion'). En el alta, cada
// montaje empieza limpio: monto vacío, la categoría por defecto y la fecha de
// hoy (FEAT-001a FR-14). En la edición, cada montaje lee el movimiento guardado
// (FEAT-001b FR-02) y suma el selector de tipo; al cambiar el tipo, el monto se
// conserva y la categoría pasa a la por defecto del tipo nuevo (FEAT-001b
// FR-07, FR-08). "Guardar" valida el monto, deshabilita el formulario mientras
// guarda (FEAT-001a FR-33; FEAT-001b FR-19), llama una sola vez al servicio y,
// si sale bien, muestra el éxito y vuelve a Cuenta, que se monta de nuevo en la
// página 1 (FEAT-001a FR-42; FEAT-001b FR-21).
export function FormularioMovimiento({ modo = 'alta', tipo: tipoAlta, idMovimiento }) {
  const navegar = useNavigate();
  const { MostrarExito, MostrarError } = useMensajes();
  const esEdicion = modo === 'edicion';
  const { titulo, mensajeExito } = esEdicion ? textosEdicion : textosPorTipo[tipoAlta];

  // En la edición, el tipo (y con él las categorías) llega con el movimiento.
  const [tipo, EstablecerTipo] = useState(esEdicion ? null : tipoAlta);
  const [cargandoMovimiento, EstablecerCargandoMovimiento] = useState(esEdicion);
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

  // Con este estado, Cuenta enfoca el botón desde el que se abrió el alta
  // (NFR-07) o la fila del movimiento editado (D5).
  const estadoAlVolver = useMemo(
    () => (esEdicion ? { idMovimientoEditado: idMovimiento } : { tipoFormulario: tipoAlta }),
    [esEdicion, idMovimiento, tipoAlta],
  );
  const VolverACuenta = useCallback(() => {
    navegar('/', { state: estadoAlVolver });
  }, [estadoAlVolver, navegar]);

  // E4-4: si el movimiento no se puede leer (id mal formado, inexistente, de
  // otra cuenta o falla de red) o llega con un monto de formato inesperado
  // (FormatearMonto lanza), "Aceptar" vuelve a Cuenta.
  useEffect(() => {
    if (!esEdicion) {
      return undefined;
    }
    let vigente = true;
    ObtenerMovimiento(idMovimiento).then((resultado) => {
      if (!vigente) {
        return;
      }
      let montoCampo = null;
      try {
        montoCampo = resultado.ok ? FormatearMonto(resultado.movimiento.monto) : null;
      } catch {
        montoCampo = null;
      }
      if (montoCampo === null) {
        MostrarError(mensajeErrorCargaMovimientos, { alAceptar: VolverACuenta });
        return;
      }
      const { movimiento } = resultado;
      EstablecerMonto(montoCampo);
      EstablecerFecha(movimiento.fecha);
      EstablecerIdCategoria(movimiento.id_categoria);
      EstablecerTipo(movimiento.tipo);
      EstablecerCargandoMovimiento(false);
    });
    return () => {
      vigente = false;
    };
  }, [esEdicion, idMovimiento, MostrarError, VolverACuenta]);

  useEffect(() => {
    if (tipo === null) {
      return undefined;
    }
    let vigente = true;
    ObtenerCategorias(tipo).then((resultado) => {
      if (!vigente) {
        return;
      }
      if (!resultado.ok) {
        // E6-4 de FEAT-001a (edición: E4-5 de FEAT-001b): "Aceptar" reintenta; mientras tanto "Guardar"
        // sigue deshabilitado.
        MostrarError(mensajeErrorCargaMovimientos, {
          alAceptar: () => EstablecerIntentoCarga((intento) => intento + 1),
          elementoFoco: campoMonto.current,
        });
        return;
      }
      EstablecerCategorias(resultado.categorias);
      EstablecerIdCategoria((idActual) => ElegirCategoria(idActual, resultado.categorias));
    });
    return () => {
      vigente = false;
    };
  }, [tipo, intentoCarga, MostrarError]);

  // FEAT-001b FR-08: las categorías del tipo nuevo se cargan de nuevo ("Guardar" queda
  // deshabilitado mientras tanto) y se elige su categoría por defecto.
  function ManejarCambioTipo(tipoNuevo) {
    EstablecerTipo(tipoNuevo);
    EstablecerCategorias(null);
    EstablecerIdCategoria(null);
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

    const resultado = esEdicion
      ? await EditarMovimiento({ idMovimiento, tipo, monto, idCategoria, fecha })
      : await AgregarMovimiento({ tipo, monto, idCategoria, fecha });
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
      navegar('/', { state: { pagina: 1, ...estadoAlVolver } });
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
        <fieldset className="campos-formulario" disabled={guardando || cargandoMovimiento}>
          {esEdicion && (
            <SelectorTipo tipo={tipo} alCambiar={ManejarCambioTipo} deshabilitado={cargandoMovimiento} />
          )}
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
