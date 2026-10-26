export function OrdenarCategorias(lista) {
  return [...lista].sort((categoria, otra) => {
    if (categoria.es_por_defecto !== otra.es_por_defecto) {
      return categoria.es_por_defecto ? -1 : 1;
    }
    return categoria.nombre.localeCompare(otra.nombre, 'es', { sensitivity: 'base' });
  });
}
