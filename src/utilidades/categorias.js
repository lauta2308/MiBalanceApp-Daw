export function OrdenarCategorias(lista) {
  return [...lista].sort((categoria, otra) => {
    if (categoria.es_por_defecto !== otra.es_por_defecto) {
      return categoria.es_por_defecto ? -1 : 1;
    }
    return categoria.nombre.localeCompare(otra.nombre, 'es', { sensitivity: 'base' });
  });
}

// Categoría que se preselecciona al abrir el formulario (FR-18): la por
// defecto o, si no hubiera, la primera, para que siempre haya una elegida (FR-15).
// Con la lista vacía no hay nada que elegir: devuelve null.
export function ObtenerCategoriaPorDefecto(categorias) {
  return (categorias.find((categoria) => categoria.es_por_defecto) ?? categorias[0])?.id ?? null;
}
