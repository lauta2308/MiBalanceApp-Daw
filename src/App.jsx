import { Route, Routes, useLocation, useParams } from 'react-router';
import { ProveedorMensajes } from './mensajes/ProveedorMensajes.jsx';
import { FormularioMovimiento } from './paginas/FormularioMovimiento.jsx';
import { SeccionCuenta } from './paginas/SeccionCuenta.jsx';
import { ProveedorSesion } from './sesion/ProveedorSesion.jsx';

// La sección Cuenta vive en "/", los formularios de alta en "/gasto/nuevo" e
// "/ingreso/nuevo" y el de edición en "/movimientos/:idMovimiento/editar".
// Al volver de un alta o una edición exitosa, Cuenta muestra la página 1
// (FEAT-001a FR-42; FEAT-001b FR-21) porque se vuelve a montar y su estado arranca en
// useState(1). El formulario navega a "/" con el estado { pagina: 1,
// tipoFormulario } (alta) o { pagina: 1, idMovimientoEditado } (edición; sin
// `pagina` al cancelar): Cuenta no lee `pagina` (lo pide la spec), usa
// `tipoFormulario` para devolver el foco al botón que abrió el formulario
// (FEAT-001a NFR-07) e `idMovimientoEditado` para devolverlo a la fila editada
// (FEAT-001b D5). Cada visita a un formulario tiene su propia `key`, así que se
// monta limpio aunque se repita la misma ruta (FEAT-001a FR-14) y la edición
// vuelve a leer los valores guardados (FEAT-001b FR-02). Sin sesión iniciada no
// se renderiza ninguna ruta (FEAT-001a FR-02).
function App() {
  const ubicacion = useLocation();

  return (
    <main className="contenedor">
      <ProveedorSesion>
        <ProveedorMensajes>
          <Routes>
            <Route path="/" element={<SeccionCuenta />} />
            <Route
              path="/gasto/nuevo"
              element={<FormularioMovimiento key={ubicacion.key} tipo="GASTO" />}
            />
            <Route
              path="/ingreso/nuevo"
              element={<FormularioMovimiento key={ubicacion.key} tipo="INGRESO" />}
            />
            <Route
              path="/movimientos/:idMovimiento/editar"
              element={<FormularioEdicion key={ubicacion.key} />}
            />
          </Routes>
        </ProveedorMensajes>
      </ProveedorSesion>
    </main>
  );
}

// El id llega de la URL sin validar: lo valida ObtenerMovimiento (E3-1).
function FormularioEdicion() {
  const { idMovimiento } = useParams();
  return <FormularioMovimiento modo="edicion" idMovimiento={idMovimiento} />;
}

export default App;
