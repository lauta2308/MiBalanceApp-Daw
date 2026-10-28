import { useLayoutEffect } from 'react';

// Corre `alComprometer(dependencia)` en el efecto de diseño de este padre, en
// el mismo commit que monta o actualiza a sus hijos: después de los efectos de
// diseño de todo el subárbol y antes de cualquier efecto pasivo. Simula una
// interacción que el navegador entrega antes de que React corra los efectos
// pasivos (FIX-001, punto 4). Vuelve a correr cuando cambia `dependencia`.
export function AntesDeEfectosPasivos({ alComprometer, dependencia, children }) {
  useLayoutEffect(() => {
    alComprometer(dependencia);
  }, [alComprometer, dependencia]);
  return children;
}
