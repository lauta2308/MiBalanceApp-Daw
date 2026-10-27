import { FormatearFecha } from '../utilidades/fechas.js';
import { AgruparPorFecha } from '../utilidades/listaMovimientos.js';
import { FormatearMontoConSigno } from '../utilidades/montos.js';

const textoSinMovimientos = 'Aquí verá sus movimientos.';

// Lista de UNA página de movimientos agrupada por fecha (FR-35, FR-47): cada
// fila muestra la categoría a la izquierda y el monto con signo a la derecha,
// sin el tipo ni la moneda (FR-36), en rojo o verde (FR-37).
export function ListaMovimientos({ movimientos, total }) {
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
              <li className="fila-movimiento" key={movimiento.id}>
                <span className="categoria-movimiento">{movimiento.nombre_categoria}</span>
                <span
                  className={`monto-movimiento ${movimiento.tipo === 'GASTO' ? 'monto-gasto' : 'monto-ingreso'}`}
                >
                  {FormatearMontoConSigno(movimiento.monto, movimiento.tipo)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
