import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CampoMonto } from './CampoMonto.jsx';

// El campo es controlado: la prueba lo envuelve con su propio estado, como lo
// hace el formulario.
function CampoConEstado({ valorInicial = '' }) {
  const [monto, EstablecerMonto] = useState(valorInicial);
  return <CampoMonto valor={monto} alCambiar={EstablecerMonto} />;
}

function RenderizarCampo(valorInicial) {
  render(<CampoConEstado valorInicial={valorInicial} />);
  return screen.getByLabelText('Monto');
}

// Escribe tecla por tecla: cada tecla agrega un carácter al final de lo que
// muestra el campo en ese momento.
function Escribir(campo, texto) {
  for (const caracter of texto) {
    fireEvent.change(campo, { target: { value: `${campo.value}${caracter}` } });
  }
}

// Pega el texto con el cursor al final del valor actual.
function Pegar(campo, texto) {
  campo.setSelectionRange(campo.value.length, campo.value.length);
  fireEvent.paste(campo, { clipboardData: { getData: () => texto } });
}

describe('CampoMonto', () => {
  it('es un campo de texto con teclado decimal y la etiqueta "Monto"', () => {
    const campo = RenderizarCampo();

    expect(campo).toHaveAttribute('type', 'text');
    expect(campo).toHaveAttribute('inputmode', 'decimal');
    expect(campo).toHaveValue('');
  });

  it('no acepta el tercer decimal: "10,555" muestra "10,55" (AC-17)', () => {
    const campo = RenderizarCampo();

    Escribir(campo, '10,555');

    expect(campo).toHaveValue('10,55');
  });

  it.each(['-50', 'abc50'])('no acepta signos ni letras: "%s" muestra "50" (AC-18)', (texto) => {
    const campo = RenderizarCampo();

    Escribir(campo, texto);

    expect(campo).toHaveValue('50');
  });

  it.each([
    ['1500000', '1.500.000'],
    ['1500,50', '1.500,50'],
  ])('agrega el separador de miles: "%s" muestra "%s" (AC-19)', (texto, esperado) => {
    const campo = RenderizarCampo();

    Escribir(campo, texto);

    expect(campo).toHaveValue(esperado);
  });

  it('ignora la segunda coma: "1,5" y después "," y "0" muestra "1,50" (AC-65)', () => {
    const campo = RenderizarCampo();

    Escribir(campo, '1,5');
    Escribir(campo, ',');
    expect(campo).toHaveValue('1,5');
    Escribir(campo, '0');

    expect(campo).toHaveValue('1,50');
  });

  it('(error E3-3) pegar "$ 1.500,50" en el campo vacío muestra "1.500,50"; pegar "abc" sobre "1.500,50" lo conserva (AC-66)', () => {
    const campo = RenderizarCampo();

    Pegar(campo, '$ 1.500,50');
    expect(campo).toHaveValue('1.500,50');

    Pegar(campo, 'abc');
    expect(campo).toHaveValue('1.500,50');
  });

  it('pegar reemplaza el texto seleccionado y aplica el mismo filtro', () => {
    const campo = RenderizarCampo('1.500');

    campo.setSelectionRange(0, campo.value.length);
    fireEvent.paste(campo, { clipboardData: { getData: () => '-2.000,755' } });

    expect(campo).toHaveValue('2.000,75');
  });
});
