import { useId } from 'react';

const opcionesTipo = [
  { tipo: 'GASTO', etiqueta: 'Gasto' },
  { tipo: 'INGRESO', etiqueta: 'Ingreso' },
];

// Selector "Tipo" del formulario de edición (FR-06, FR-07): radios nativos, así
// que siempre hay uno elegido y las flechas cambian la opción con el teclado
// (NFR-04). `deshabilitado` lo bloquea mientras el movimiento no está cargado.
export function SelectorTipo({ tipo, alCambiar, deshabilitado = false }) {
  const nombreGrupo = useId();

  return (
    <fieldset className="campo-formulario selector-tipo" disabled={deshabilitado}>
      <legend className="etiqueta-campo">Tipo</legend>
      <div className="opciones-tipo">
        {opcionesTipo.map((opcion) => (
          <label className="opcion-tipo" key={opcion.tipo}>
            <input
              type="radio"
              name={nombreGrupo}
              value={opcion.tipo}
              checked={tipo === opcion.tipo}
              onChange={() => alCambiar(opcion.tipo)}
            />
            {opcion.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
