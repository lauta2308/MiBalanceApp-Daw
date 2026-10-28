# Registro de Cambios

Todos los cambios notables de este proyecto se registran en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado
- [FEAT-001a] Inicio de sesión anónimo (provisorio hasta Google OAuth) con
  mensaje de error y botón "Aceptar" para reintentar.
- [FEAT-001a] Cuenta única por usuario, creada automáticamente con las
  categorías por defecto "Pago Realizado" y "Pago Ingresado".
- [FEAT-001a] Sección Cuenta con el saldo en verde o rojo, lista de
  movimientos agrupada por fecha y paginación de 50 en 50.
- [FEAT-001a] Formularios "Añadir Gasto" y "Añadir Ingreso" con monto,
  categoría y calendario en español; el alta y el saldo se actualizan en
  una sola operación atómica.
- [FEAT-001a] Seguridad en la base: cada usuario solo ve sus datos (RLS) y
  ninguna escritura directa desde la API.
- [FEAT-001a] Accesibilidad y rendimiento: uso completo con teclado, foco
  visible, contraste verificado con axe-core, sin desplazamiento horizontal
  de 320 a 1920 px y altas en menos de 2 s (p95).
- [FEAT-001b] Menú en cada fila de la lista con la opción "Editar", que se
  abre con clic, toque o teclado.
- [FEAT-001b] Formulario "Editar Movimiento" precargado: permite cambiar el
  tipo, el monto, la categoría y la fecha; al cambiar el tipo sin elegir
  categoría usa la categoría por defecto del tipo nuevo.
- [FEAT-001b] Edición y ajuste del saldo en una sola operación atómica,
  sin cambiar la fecha de registro ni permitir editar movimientos de otro
  usuario; ediciones en menos de 2 s (p95).
- [FEAT-001c] Opción "Eliminar" en el menú de cada fila, con confirmación
  "¿Está seguro que desea eliminar este movimiento?" y los botones
  "Cancelar" y "Confirmar", usable solo con el teclado.
- [FEAT-001c] Eliminación y ajuste del saldo en una sola operación atómica,
  sin permitir eliminar movimientos de otro usuario; al eliminar se vuelve
  a la página 1 de la lista; eliminaciones en menos de 2 s (p95).

### Cambiado
- [FEAT-001b] Los servicios comparten un único acceso al cliente de
  Supabase, y las pruebas, sus ayudantes comunes.
