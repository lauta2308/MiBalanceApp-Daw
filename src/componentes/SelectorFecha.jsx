import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import {
  ConvertirFechaATexto,
  ConvertirTextoAFecha,
  FormatearFecha,
  ObtenerFechaHoyLocal,
} from '../utilidades/fechas.js';

// Primer mes que ofrecen los selectores de mes y año del calendario. El
// servidor no tiene fecha mínima (FR-23); este límite solo acota la lista de
// años para que sea navegable.
const inicioCalendario = new Date(1900, 0, 1);

// Campo "Fecha" (FR-19 a FR-21, FR-48): muestra DD/MM/AAAA y abre un calendario
// en español, con la semana desde el lunes, que elige solo el día, siempre con
// uno elegido (`required`: no se puede deseleccionar) y sin días posteriores a
// hoy. "Hoy" es la fecha local del dispositivo y el valor es siempre el texto
// "AAAA-MM-DD": nunca pasa por UTC.
export function SelectorFecha({ valor, alCambiar }) {
  const idEtiqueta = useId();
  const idCampo = useId();
  const idCalendario = useId();
  const [abierto, EstablecerAbierto] = useState(false);
  const campo = useRef(null);
  const contenedor = useRef(null);

  const hoy = ConvertirTextoAFecha(ObtenerFechaHoyLocal());
  const fechaElegida = ConvertirTextoAFecha(valor);

  function CerrarCalendario() {
    EstablecerAbierto(false);
    campo.current?.focus();
  }

  function ManejarSeleccion(fecha) {
    if (fecha) {
      alCambiar(ConvertirFechaATexto(fecha));
    }
    CerrarCalendario();
  }

  // Escape cierra el calendario desde cualquier punto del selector, también con
  // el foco en el campo "Fecha" (NFR-07).
  function ManejarTecla(evento) {
    if (abierto && evento.key === 'Escape') {
      evento.stopPropagation();
      CerrarCalendario();
    }
  }

  // Mientras está abierto, un clic afuera (aunque caiga en una zona no
  // enfocable) o el foco que pasa a otro control (Tab) lo cierran sin mover el
  // foco. Los oyentes se quitan al cerrar o al desmontar.
  useEffect(() => {
    if (!abierto) {
      return undefined;
    }
    function ManejarEventoAfuera(evento) {
      if (!contenedor.current?.contains(evento.target)) {
        EstablecerAbierto(false);
      }
    }
    document.addEventListener('pointerdown', ManejarEventoAfuera);
    document.addEventListener('focusin', ManejarEventoAfuera);
    return () => {
      document.removeEventListener('pointerdown', ManejarEventoAfuera);
      document.removeEventListener('focusin', ManejarEventoAfuera);
    };
  }, [abierto]);

  return (
    <div className="campo-formulario selector-fecha" ref={contenedor} onKeyDown={ManejarTecla}>
      <label className="etiqueta-campo" id={idEtiqueta} htmlFor={idCampo}>
        Fecha
      </label>
      <button
        id={idCampo}
        ref={campo}
        type="button"
        className="entrada-campo campo-fecha"
        aria-labelledby={`${idEtiqueta} ${idCampo}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? idCalendario : undefined}
        onClick={() => EstablecerAbierto((estaAbierto) => !estaAbierto)}
      >
        {FormatearFecha(valor)}
      </button>
      {abierto && (
        <div id={idCalendario} className="calendario" role="dialog" aria-label="Calendario">
          <DayPicker
            mode="single"
            required
            selected={fechaElegida}
            onSelect={ManejarSeleccion}
            locale={es}
            weekStartsOn={1}
            disabled={{ after: hoy }}
            defaultMonth={fechaElegida}
            startMonth={inicioCalendario}
            endMonth={hoy}
            captionLayout="dropdown"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
