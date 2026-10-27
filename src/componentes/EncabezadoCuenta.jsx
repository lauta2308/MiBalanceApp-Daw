import { FormatearSaldo, ObtenerSignoSaldo } from '../utilidades/montos.js';

// Nombre de la cuenta con su moneda (FR-06) y saldo con el color de su signo
// (FR-07, FR-08): verde si es positivo, rojo si es negativo, normal si es 0.
export function EncabezadoCuenta({ cuenta }) {
  const claseSaldo = `saldo saldo-${ObtenerSignoSaldo(cuenta.saldo)}`;
  return (
    <header className="encabezado-cuenta">
      <h1 className="nombre-cuenta">{`${cuenta.nombre} (${cuenta.moneda})`}</h1>
      <p className={claseSaldo}>{FormatearSaldo(cuenta.saldo, cuenta.moneda)}</p>
    </header>
  );
}
