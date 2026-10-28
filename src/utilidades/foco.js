const selectorEnfocable =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Primer control enfocable de `raiz` en el orden del documento, fuera de los
// fieldset deshabilitados; null si no hay ninguno (FR-44).
export function ObtenerPrimerControlEnfocable(raiz) {
  for (const elemento of raiz.querySelectorAll(selectorEnfocable)) {
    if (elemento.closest('fieldset:disabled')) {
      continue;
    }
    return elemento;
  }
  return null;
}
