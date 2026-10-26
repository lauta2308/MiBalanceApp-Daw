import { useId } from 'react';

// Selector "Categoría" (FR-15, FR-16): solo las categorías del tipo del
// movimiento, siempre con una seleccionada y sin opción vacía. El orden y la
// preselección los decide quien lo usa (FR-17, FR-18). `deshabilitado` lo
// bloquea mientras las categorías no están disponibles (E6-4).
export function SelectorCategoria({ categorias, idCategoria, alCambiar, deshabilitado = false }) {
  const idCampo = useId();

  return (
    <div className="campo-formulario">
      <label className="etiqueta-campo" htmlFor={idCampo}>
        Categoría
      </label>
      <select
        id={idCampo}
        className="entrada-campo"
        value={idCategoria ?? ''}
        disabled={deshabilitado}
        onChange={(evento) => alCambiar(evento.target.value)}
      >
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
