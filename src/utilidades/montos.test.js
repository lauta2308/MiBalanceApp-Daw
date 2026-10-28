import { describe, expect, it } from 'vitest';
import {
  ConvertirMontoParaApi,
  EsMontoApiValido,
  FiltrarEntradaMonto,
  FormatearMonto,
  FormatearMontoConSigno,
  FormatearSaldo,
  ObtenerSignoSaldo,
  ValidarMonto,
} from './montos.js';

const mensajeMayorACero = 'El monto debe ser mayor a 0.';
const mensajeMaximo = 'El monto máximo es 999.999.999.999,99.';

// La menor de varias mediciones descarta las demoras ajenas a la función
// (recolección de basura, compilación).
function MedirDuracionMinima(funcion, repeticiones = 10) {
  let duracionMinima = Infinity;
  for (let indice = 0; indice < repeticiones; indice += 1) {
    const inicio = performance.now();
    funcion();
    duracionMinima = Math.min(duracionMinima, performance.now() - inicio);
  }
  return duracionMinima;
}

describe('FormatearMonto', () => {
  it('formatea montos de la API con puntos de miles y coma decimal (AC-38, AC-56)', () => {
    expect(FormatearMonto('1500.00')).toBe('1.500,00');
    expect(FormatearMonto('520.50')).toBe('520,50');
    expect(FormatearMonto('1000.00')).toBe('1.000,00');
    expect(FormatearMonto('999999999999.99')).toBe('999.999.999.999,99');
    expect(FormatearMonto('1999999999999.98')).toBe('1.999.999.999.999,98');
  });

  it('convierte el monto de la API en el texto del campo de edición, sin signo (FR-03)', () => {
    expect(FormatearMonto('1500.00')).toBe('1.500,00');
  });

  it('formatea más de 15 dígitos sin pérdida de precisión', () => {
    expect(FormatearMonto('12345678901234567.89')).toBe('12.345.678.901.234.567,89');
  });

  it('completa los decimales y conserva el signo negativo', () => {
    expect(FormatearMonto('1500.5')).toBe('1.500,50');
    expect(FormatearMonto('-1000.00')).toBe('-1.000,00');
    expect(FormatearMonto('0.00')).toBe('0,00');
  });

  it('no muestra signo cuando todos los dígitos son cero', () => {
    expect(FormatearMonto('-0.00')).toBe('0,00');
    expect(FormatearMonto('-0')).toBe('0,00');
    expect(FormatearMonto('-000.0')).toBe('0,00');
  });

  it('agrupa de a tres una parte entera de 20.000 dígitos en tiempo lineal (NFR-03)', () => {
    const digitos = `1${'0'.repeat(19999)}`;
    const digitosChicos = `1${'0'.repeat(1999)}`;
    const formateado = FormatearMonto(`${digitos}.00`);
    const duracion = MedirDuracionMinima(() => FormatearMonto(`${digitos}.00`));
    const duracionChica = MedirDuracionMinima(() => FormatearMonto(`${digitosChicos}.00`));
    const [parteEntera, decimales] = formateado.split(',');
    const grupos = parteEntera.split('.');
    expect(decimales).toBe('00');
    expect(grupos).toHaveLength(6667);
    expect(grupos[0]).toBe('10');
    expect(grupos.slice(1).every((grupo) => grupo === '000')).toBe(true);
    expect(grupos.join('')).toBe(digitos);
    // Con 10× más dígitos, lo lineal tarda ~10× más y lo cuadrático ~100×: el
    // límite de 30× separa ambos sin depender de la velocidad de la máquina.
    expect(duracion).toBeLessThan(duracionChica * 30);
  });

  it('lanza un error con un texto que no es un monto de la API', () => {
    expect(() => FormatearMonto('1.500,00')).toThrow('Monto inválido');
  });
});

describe('FormatearMontoConSigno', () => {
  it('antepone "-" a un gasto y "+" a un ingreso (FR-36)', () => {
    expect(FormatearMontoConSigno('1500.00', 'GASTO')).toBe('-1.500,00');
    expect(FormatearMontoConSigno('1000.00', 'INGRESO')).toBe('+1.000,00');
    expect(FormatearMontoConSigno('520.50', 'INGRESO')).toBe('+520,50');
  });

  it('lanza "Monto inválido" si el monto del movimiento es negativo', () => {
    expect(() => FormatearMontoConSigno('-1500.00', 'GASTO')).toThrow('Monto inválido');
    expect(() => FormatearMontoConSigno('-0.00', 'INGRESO')).toThrow('Monto inválido');
  });

  it('lanza "Tipo de movimiento inválido" con un tipo que no es GASTO ni INGRESO', () => {
    expect(() => FormatearMontoConSigno('1500.00', 'OTRO')).toThrow('Tipo de movimiento inválido');
    expect(() => FormatearMontoConSigno('1500.00', 'gasto')).toThrow('Tipo de movimiento inválido');
  });
});

describe('FormatearSaldo', () => {
  it('antepone la moneda al saldo formateado (AC-10, FR-07)', () => {
    expect(FormatearSaldo('10000.00', 'USD')).toBe('USD 10.000,00');
    expect(FormatearSaldo('-1000.00', 'USD')).toBe('USD -1.000,00');
    expect(FormatearSaldo('0.00', 'USD')).toBe('USD 0,00');
    expect(FormatearSaldo('-0.00', 'USD')).toBe('USD 0,00');
  });

  it('lanza "Monto inválido" con un texto que no es un monto de la API', () => {
    expect(() => FormatearSaldo('abc', 'USD')).toThrow('Monto inválido');
    expect(() => FormatearSaldo('1.500,00', 'USD')).toThrow('Monto inválido');
  });
});

describe('ObtenerSignoSaldo', () => {
  it('distingue saldo positivo, negativo y cero (FR-08)', () => {
    expect(ObtenerSignoSaldo('8500.00')).toBe('positivo');
    expect(ObtenerSignoSaldo('-1000.00')).toBe('negativo');
    expect(ObtenerSignoSaldo('0.00')).toBe('cero');
    expect(ObtenerSignoSaldo('-0.00')).toBe('cero');
    expect(ObtenerSignoSaldo('0.01')).toBe('positivo');
  });

  it('lanza "Monto inválido" con un texto que no es un monto de la API', () => {
    for (const texto of ['abc', '', '1.500,00']) {
      expect(() => ObtenerSignoSaldo(texto)).toThrow('Monto inválido');
    }
  });
});

describe('FiltrarEntradaMonto', () => {
  it('descarta el tercer decimal (AC-17)', () => {
    expect(FiltrarEntradaMonto('10,555')).toBe('10,55');
  });

  it('descarta el signo menos y las letras (AC-18)', () => {
    expect(FiltrarEntradaMonto('-50')).toBe('50');
    expect(FiltrarEntradaMonto('abc50')).toBe('50');
  });

  it('agrega el separador de miles (AC-19)', () => {
    expect(FiltrarEntradaMonto('1500000')).toBe('1.500.000');
    expect(FiltrarEntradaMonto('1500,50')).toBe('1.500,50');
    expect(FiltrarEntradaMonto('1.500.0000')).toBe('15.000.000');
  });

  it('ignora la segunda coma (AC-65)', () => {
    expect(FiltrarEntradaMonto('1,5,0')).toBe('1,50');
  });

  it('(E3-3) filtra lo pegado y conserva el valor anterior si no hay ningún carácter válido (AC-66)', () => {
    expect(FiltrarEntradaMonto('$ 1.500,50', '')).toBe('1.500,50');
    expect(FiltrarEntradaMonto('abc', '1.500,50')).toBe('1.500,50');
    expect(FiltrarEntradaMonto('1.500,50abc', '1.500,50')).toBe('1.500,50');
    expect(FiltrarEntradaMonto('abc')).toBe('');
  });

  it('permite vaciar el campo', () => {
    expect(FiltrarEntradaMonto('', '1.500,50')).toBe('');
  });

  it('limita la parte entera a 13 dígitos', () => {
    expect(FiltrarEntradaMonto('12345678901234')).toBe('1.234.567.890.123');
    expect(FiltrarEntradaMonto('99999999999999,99')).toBe('9.999.999.999.999,99');
  });
});

describe('ConvertirMontoParaApi', () => {
  it('convierte el formato del campo al de la API "N.NN"', () => {
    expect(ConvertirMontoParaApi('1.500,50')).toBe('1500.50');
    expect(ConvertirMontoParaApi('1.000')).toBe('1000.00');
    expect(ConvertirMontoParaApi('10,5')).toBe('10.50');
    expect(ConvertirMontoParaApi(',5')).toBe('0.50');
    expect(ConvertirMontoParaApi('999.999.999.999,99')).toBe('999999999999.99');
  });

  // No valida: el formulario llama antes a ValidarMonto, que rechaza estas entradas.
  it('convierte un campo vacío o sin dígitos en "0.00" sin lanzar', () => {
    expect(ConvertirMontoParaApi('')).toBe('0.00');
    expect(ConvertirMontoParaApi('abc')).toBe('0.00');
  });
});

describe('ValidarMonto', () => {
  it('(E3-1) rechaza vacío, cero y una coma sola (FR-24)', () => {
    for (const texto of ['', '0', '0,00', ',', '0,0', '000']) {
      expect(ValidarMonto(texto)).toEqual({ valido: false, mensaje: mensajeMayorACero });
    }
  });

  it('(E3-2) rechaza montos mayores al máximo y acepta el máximo (FR-25)', () => {
    expect(ValidarMonto('1.000.000.000.000,00')).toEqual({ valido: false, mensaje: mensajeMaximo });
    expect(ValidarMonto('9.999.999.999.999')).toEqual({ valido: false, mensaje: mensajeMaximo });
    expect(ValidarMonto('999.999.999.999,99')).toEqual({ valido: true });
  });

  it('acepta montos positivos', () => {
    expect(ValidarMonto('1.500,50')).toEqual({ valido: true });
    expect(ValidarMonto('0,01')).toEqual({ valido: true });
    expect(ValidarMonto(',5')).toEqual({ valido: true });
  });
});

describe('EsMontoApiValido', () => {
  it.each([['0.00'], ['10'], ['-5.5'], ['1500.50']])('acepta %j', (texto) => {
    expect(EsMontoApiValido(texto)).toBe(true);
  });

  it.each([['abc'], ['1,5'], ['1.555'], [''], [10], [null], [undefined]])('rechaza %j sin lanzar', (valor) => {
    expect(EsMontoApiValido(valor)).toBe(false);
  });
});
