import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConvertirFechaATexto,
  ConvertirTextoAFecha,
  FormatearFecha,
  ObtenerFechaHoyLocal,
} from './fechas.js';

const zonaOriginal = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (zonaOriginal === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = zonaOriginal;
  }
});

describe('ObtenerFechaHoyLocal', () => {
  it('devuelve la fecha local aunque en UTC ya sea el día siguiente (FR-20, AC-31)', () => {
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    // Precondición: la zona UTC-3 quedó activa.
    expect(new Date(2026, 9, 3).getTimezoneOffset()).toBe(180);
    vi.useFakeTimers();
    vi.setSystemTime('2026-10-03T23:30:00-03:00');
    expect(ObtenerFechaHoyLocal()).toBe('2026-10-03');
  });

  it('completa mes y día con ceros', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0));
    expect(ObtenerFechaHoyLocal()).toBe('2026-01-05');
  });
});

describe('FormatearFecha', () => {
  it('convierte "AAAA-MM-DD" a "DD/MM/AAAA"', () => {
    expect(FormatearFecha('2026-09-17')).toBe('17/09/2026');
    expect(FormatearFecha('1990-03-15')).toBe('15/03/1990');
  });

  it('(E3-4) lanza "Fecha inválida" con un formato que no es "AAAA-MM-DD"', () => {
    expect(() => FormatearFecha('17/09/2026')).toThrow('Fecha inválida');
    expect(() => FormatearFecha('2026-13-01')).toThrow('Fecha inválida');
  });
});

describe('ConvertirTextoAFecha y ConvertirFechaATexto', () => {
  it('crean la fecha local del día indicado', () => {
    const fecha = ConvertirTextoAFecha('2026-09-17');
    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(8);
    expect(fecha.getDate()).toBe(17);
  });

  it.each([
    ['America/Argentina/Buenos_Aires', 180],
    ['Pacific/Tongatapu', -780],
  ])(
    'la ida y vuelta conserva el día con TZ %s (UTC-3 y UTC+13)',
    (zona, desfaseMinutos) => {
      process.env.TZ = zona;
      // Precondición: la zona quedó activa (UTC-3 → 180, UTC+13 → -780).
      expect(new Date(2026, 8, 17).getTimezoneOffset()).toBe(desfaseMinutos);
      for (const texto of ['2026-09-17', '2026-01-01', '2026-12-31', '1990-03-15']) {
        expect(ConvertirFechaATexto(ConvertirTextoAFecha(texto))).toBe(texto);
      }
    },
  );

  it('(E3-4) ConvertirTextoAFecha lanza "Fecha inválida" con un formato inválido o un día inexistente', () => {
    expect(() => ConvertirTextoAFecha('17/09/2026')).toThrow('Fecha inválida');
    expect(() => ConvertirTextoAFecha('2026-02-30')).toThrow('Fecha inválida');
  });

  it('ConvertirFechaATexto lanza RangeError con una fecha inválida', () => {
    expect(() => ConvertirFechaATexto(new Date(NaN))).toThrow(RangeError);
  });
});
