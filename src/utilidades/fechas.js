// Las fechas de los movimientos son días calendario "AAAA-MM-DD": nunca se
// pasan por UTC: no se serializan a ISO ni se construyen desde una cadena.
import { format } from 'date-fns';

const expresionFecha = /^(\d{4})-(\d{2})-(\d{2})$/;

function CompletarConCeros(valor, largo) {
  return String(valor).padStart(largo, '0');
}

function SepararFecha(textoFecha) {
  const partes = expresionFecha.exec(textoFecha);
  if (!partes) {
    throw new Error('Fecha inválida');
  }
  const [, textoAnio, textoMes, textoDia] = partes;
  const anio = parseInt(textoAnio, 10);
  const mes = parseInt(textoMes, 10);
  const dia = parseInt(textoDia, 10);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setFullYear(anio);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    throw new Error('Fecha inválida');
  }
  return { textoAnio, textoMes, textoDia, fecha };
}

export function ObtenerFechaHoyLocal() {
  const ahora = new Date();
  const anio = CompletarConCeros(ahora.getFullYear(), 4);
  const mes = CompletarConCeros(ahora.getMonth() + 1, 2);
  const dia = CompletarConCeros(ahora.getDate(), 2);
  return `${anio}-${mes}-${dia}`;
}

// Predicado que nunca lanza: rechaza lo que no es "AAAA-MM-DD" y los días que
// no existen ("2026-02-30"), para que los servicios filtren la base (FR-45).
export function EsFechaValida(textoFecha) {
  if (typeof textoFecha !== 'string') {
    return false;
  }
  try {
    SepararFecha(textoFecha);
    return true;
  } catch {
    return false;
  }
}

export function FormatearFecha(textoFecha) {
  const { textoAnio, textoMes, textoDia } = SepararFecha(textoFecha);
  return `${textoDia}/${textoMes}/${textoAnio}`;
}

export function ConvertirTextoAFecha(textoFecha) {
  return SepararFecha(textoFecha).fecha;
}

export function ConvertirFechaATexto(fecha) {
  return format(fecha, 'yyyy-MM-dd');
}
