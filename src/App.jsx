import { Route, Routes, useLocation } from 'react-router';
import { ProveedorMensajes } from './mensajes/ProveedorMensajes.jsx';
import { FormularioMovimiento } from './paginas/FormularioMovimiento.jsx';
import { SeccionCuenta } from './paginas/SeccionCuenta.jsx';
import { ProveedorSesion } from './sesion/ProveedorSesion.jsx';

// La sección Cuenta vive en "/" y los formularios de alta en "/gasto/nuevo" e
// "/ingreso/nuevo". Al volver de un alta exitosa, Cuenta muestra la página 1
// (FR-42) porque se vuelve a montar y su estado arranca en useState(1). El
// formulario navega a "/" con el estado { pagina: 1, tipoFormulario }: Cuenta no
// lee `pagina` (lo pide la spec) y usa `tipoFormulario` para devolver el foco al
// botón que abrió el formulario (NFR-07). Cada visita a un formulario tiene su propia `key`, así que
// se monta limpio aunque se repita la misma ruta (FR-14).
// Sin sesión iniciada no se renderiza ninguna ruta (FR-02).
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
          </Routes>
        </ProveedorMensajes>
      </ProveedorSesion>
    </main>
  );
}

export default App;
