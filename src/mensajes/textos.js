// Todos los textos fijos que la interfaz muestra en mensajes (NFR-06, R11):
// nunca se muestra el mensaje que devuelve Supabase.

// Éxito (FR-43; edición: FR-20 de FEAT-001b; eliminación: FR-07 de FEAT-001c).
export const mensajeGastoRegistrado = 'Gasto registrado con éxito.';
export const mensajeIngresoRegistrado = 'Ingreso registrado con éxito.';
export const mensajeMovimientoActualizado = 'Movimiento actualizado con éxito.';
export const mensajeMovimientoEliminado = 'Movimiento eliminado con éxito.';

// Validación (FR-24, FR-25).
export const mensajeMontoMayorACero = 'El monto debe ser mayor a 0.';
export const mensajeMontoMaximo = 'El monto máximo es 999.999.999.999,99.';

// Errores (FR-02, FR-45, FR-46; eliminación: FR-10 de FEAT-001c).
export const mensajeErrorInicioSesion = 'No se pudo iniciar la sesión. Vuelva a intentarlo.';
export const mensajeErrorCargaMovimientos =
  'No se pudieron cargar sus movimientos. Vuelva a intentarlo.';
export const mensajeErrorGuardarMovimiento =
  'No se pudo guardar el movimiento. Vuelva a intentarlo.';
export const mensajeErrorEliminarMovimiento =
  'No se pudo eliminar el movimiento. Vuelva a intentarlo.';

// Confirmación de la eliminación (FR-02, FR-06 de FEAT-001c).
export const textoConfirmarEliminacion = '¿Está seguro que desea eliminar este movimiento?';
export const textoBotonConfirmar = 'Confirmar';
export const textoBotonCancelar = 'Cancelar';
export const textoEliminando = 'Eliminando…';

// Textos auxiliares de los mensajes.
export const textoCargando = 'Cargando…';
export const textoBotonAceptar = 'Aceptar';
export const textoIconoExito = 'Éxito';
export const textoIconoError = 'Error';
