import { useCallback, useId, useRef, useState } from 'react';
import { FormatearFecha } from '../utilidades/fechas.js';
import { AgruparPorFecha } from '../utilidades/listaMovimientos.js';
import { FormatearMontoConSigno } from '../utilidades/montos.js';
import { MenuMovimiento } from './MenuMovimiento.jsx';

const textoSinMovimientos = 'Aquí verá sus movimientos.';

// Lista de UNA página de movimientos agrupada por fecha (FR-35, FR-47): cada
// fila muestra la categoría a la izquierda y el monto con signo a la derecha,
// sin el tipo ni la moneda (FR-36), en rojo o verde (FR-37). Cada fila es un
// botón que abre su menú (FEAT-001b FR-01; FEAT-001c FR-01); solo hay un menú
// abierto a la vez. "Eliminar" entrega también el botón de la fila, al que
// vuelve el foco si se cancela o falla la eliminación.
export function ListaMovimientos({ movimientos, total, alEditar, alEliminar }) {
  const [idMenuAbierto, EstablecerIdMenuAbierto] = useState(null);
  const CerrarMenu = useCallback(() => EstablecerIdMenuAbierto(null), []);

  if (total === 0) {
    return <p className="lista-vacia">{textoSinMovimientos}</p>;
  }
  return (
    <div className="lista-movimientos">
      {AgruparPorFecha(movimientos).map((grupo) => (
        <section className="grupo-movimientos" key={grupo.fecha}>
          <h2 className="fecha-grupo">{FormatearFecha(grupo.fecha)}</h2>
          <ul className="filas-movimientos">
            {grupo.movimientos.map((movimiento) => (
              <FilaMovimiento
                key={movimiento.id}
                movimiento={movimiento}
                menuAbierto={idMenuAbierto === movimiento.id}
                alAlternarMenu={() =>
                  EstablecerIdMenuAbierto((idActual) => (idActual === movimiento.id ? null : movimiento.id))
                }
                alCerrarMenu={CerrarMenu}
                alEditar={() => {
                  CerrarMenu();
                  alEditar(movimiento.id);
                }}
                alEliminar={(botonFila) => {
                  CerrarMenu();
                  alEliminar(movimiento.id, botonFila);
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Botón de menú según el patrón APG: el menú toma su nombre del texto de la
// fila (aria-labelledby) y la fila lo controla mientras está abierto
// (aria-controls). La flecha hacia abajo también lo abre (NFR-04).
function FilaMovimiento({
  movimiento,
  menuAbierto,
  alAlternarMenu,
  alCerrarMenu,
  alEditar,
  alEliminar,
}) {
  const botonFila = useRef(null);
  const idBotonFila = useId();
  const idMenu = useId();

  function ManejarTecla(evento) {
    if (evento.key === 'ArrowDown' && !menuAbierto) {
      evento.preventDefault();
      alAlternarMenu();
    }
  }

  return (
    <li className="fila-movimiento">
      <button
        ref={botonFila}
        id={idBotonFila}
        type="button"
        className="boton-fila-movimiento"
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
        aria-controls={menuAbierto ? idMenu : undefined}
        data-id-movimiento={movimiento.id}
        onClick={alAlternarMenu}
        onKeyDown={ManejarTecla}
      >
        <span className="categoria-movimiento">{movimiento.nombre_categoria}</span>
        <span
          className={`monto-movimiento ${movimiento.tipo === 'GASTO' ? 'monto-gasto' : 'monto-ingreso'}`}
        >
          {FormatearMontoConSigno(movimiento.monto, movimiento.tipo)}
        </span>
      </button>
      {menuAbierto && (
        <MenuMovimiento
          id={idMenu}
          idBotonFila={idBotonFila}
          botonFila={botonFila}
          alEditar={alEditar}
          alEliminar={() => alEliminar(botonFila.current)}
          alCerrar={alCerrarMenu}
        />
      )}
    </li>
  );
}
