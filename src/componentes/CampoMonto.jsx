import { useId } from 'react';
import { FiltrarEntradaMonto } from '../utilidades/montos.js';

const expresionCaracterValido = /[\d,]/;

// Campo "Monto" (FR-26 a FR-28): solo dígitos y una coma, como máximo dos
// decimales, con punto de miles mientras se escribe. El mismo filtro se aplica
// a lo que se escribe y a lo que se pega; si lo pegado no tiene ningún carácter
// válido, el campo conserva lo que tenía (E3-3). El valor es siempre texto
// (ADR-001). `ref` llega al input para devolverle el foco tras un error (FR-44).
export function CampoMonto({ valor, alCambiar, ref }) {
  const idCampo = useId();

  function ManejarCambio(evento) {
    alCambiar(FiltrarEntradaMonto(evento.target.value, valor));
  }

  function ManejarPegado(evento) {
    evento.preventDefault();
    const textoPegado = evento.clipboardData?.getData('text') ?? '';
    if (!expresionCaracterValido.test(textoPegado)) {
      return;
    }
    const campo = evento.currentTarget;
    const inicio = campo.selectionStart ?? valor.length;
    const fin = campo.selectionEnd ?? valor.length;
    const textoNuevo = `${valor.slice(0, inicio)}${textoPegado}${valor.slice(fin)}`;
    alCambiar(FiltrarEntradaMonto(textoNuevo, valor));
  }

  return (
    <div className="campo-formulario">
      <label className="etiqueta-campo" htmlFor={idCampo}>
        Monto
      </label>
      <input
        id={idCampo}
        ref={ref}
        className="entrada-campo"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={valor}
        onChange={ManejarCambio}
        onPaste={ManejarPegado}
      />
    </div>
  );
}
