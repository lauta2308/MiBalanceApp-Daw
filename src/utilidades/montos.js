// Montos como texto de punta a punta (ADR-001): nunca se convierten a número
// ni se hacen cuentas con ellos. La API entrega y recibe "N.NN"; el campo de
// la interfaz usa el formato argentino "1.500,50".

const expresionMontoApi = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
const maximoDigitosEnteros = 13;
const digitosEnterosMontoMaximo = 12;

export const mensajeMontoMayorACero = 'El monto debe ser mayor a 0.';
export const mensajeMontoMaximo = 'El monto máximo es 999.999.999.999,99.';

// Agrupa de a tres desde el final en tiempo lineal: el saldo no tiene límite
// de dígitos (NFR-03).
function AgregarSeparadorMiles(digitos) {
  const grupos = [];
  let fin = digitos.length;
  while (fin > 3) {
    grupos.push(digitos.slice(fin - 3, fin));
    fin -= 3;
  }
  grupos.push(digitos.slice(0, fin));
  return grupos.reverse().join('.');
}

function SonTodosCeros(digitos) {
  return /^0*$/.test(digitos);
}

function QuitarCerosIzquierda(digitos) {
  return digitos.replace(/^0+(?=\d)/, '');
}

function SepararMontoCampo(textoCampo) {
  const [parteEntera = '', parteDecimal = ''] = textoCampo.split(',');
  return {
    digitosEnteros: parteEntera.replace(/\D/g, ''),
    digitosDecimales: parteDecimal.replace(/\D/g, ''),
  };
}

export function FormatearMonto(textoApi) {
  const partes = expresionMontoApi.exec(textoApi);
  if (!partes) {
    throw new Error('Monto inválido');
  }
  const [, signo, digitosEnteros, digitosDecimales = ''] = partes;
  const decimales = digitosDecimales.padEnd(2, '0');
  const signoVisible = SonTodosCeros(`${digitosEnteros}${digitosDecimales}`) ? '' : signo;
  return `${signoVisible}${AgregarSeparadorMiles(QuitarCerosIzquierda(digitosEnteros))},${decimales}`;
}

export function FormatearMontoConSigno(textoApi, tipo) {
  if (tipo !== 'GASTO' && tipo !== 'INGRESO') {
    throw new Error('Tipo de movimiento inválido');
  }
  if (textoApi.startsWith('-')) {
    throw new Error('Monto inválido');
  }
  const signo = tipo === 'GASTO' ? '-' : '+';
  return `${signo}${FormatearMonto(textoApi)}`;
}

export function FormatearSaldo(textoApi, moneda) {
  return `${moneda} ${FormatearMonto(textoApi)}`;
}

export function ObtenerSignoSaldo(textoApi) {
  const partes = expresionMontoApi.exec(textoApi);
  if (!partes) {
    throw new Error('Monto inválido');
  }
  const [, signo, digitosEnteros, digitosDecimales = ''] = partes;
  if (SonTodosCeros(`${digitosEnteros}${digitosDecimales}`)) {
    return 'cero';
  }
  return signo === '-' ? 'negativo' : 'positivo';
}

export function FiltrarEntradaMonto(textoCampo, valorAnterior = '') {
  if (textoCampo !== '' && !/[\d,]/.test(textoCampo)) {
    return valorAnterior;
  }
  let digitosEnteros = '';
  let digitosDecimales = '';
  let tieneComa = false;
  for (const caracter of textoCampo) {
    if (caracter === ',') {
      tieneComa = true;
    } else if (/\d/.test(caracter)) {
      if (!tieneComa && digitosEnteros.length < maximoDigitosEnteros) {
        digitosEnteros += caracter;
      } else if (tieneComa && digitosDecimales.length < 2) {
        digitosDecimales += caracter;
      }
    }
  }
  const parteEntera = AgregarSeparadorMiles(QuitarCerosIzquierda(digitosEnteros));
  return tieneComa ? `${parteEntera},${digitosDecimales}` : parteEntera;
}

export function ConvertirMontoParaApi(textoCampo) {
  const { digitosEnteros, digitosDecimales } = SepararMontoCampo(textoCampo);
  const parteEntera = QuitarCerosIzquierda(digitosEnteros) || '0';
  return `${parteEntera}.${digitosDecimales.slice(0, 2).padEnd(2, '0')}`;
}

export function ValidarMonto(textoCampo) {
  const { digitosEnteros, digitosDecimales } = SepararMontoCampo(textoCampo);
  if (SonTodosCeros(`${digitosEnteros}${digitosDecimales}`)) {
    return { valido: false, mensaje: mensajeMontoMayorACero };
  }
  const enterosSignificativos = digitosEnteros.replace(/^0+/, '');
  if (enterosSignificativos.length > digitosEnterosMontoMaximo) {
    return { valido: false, mensaje: mensajeMontoMaximo };
  }
  return { valido: true };
}
