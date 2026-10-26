import { Route, Routes } from 'react-router';
import { ProveedorMensajes } from './mensajes/ProveedorMensajes.jsx';
import { SeccionCuenta } from './paginas/SeccionCuenta.jsx';
import { ProveedorSesion } from './sesion/ProveedorSesion.jsx';

// La sección Cuenta vive en "/". Los formularios de alta ("/gasto/nuevo" e
// "/ingreso/nuevo") se incorporan en el bloque siguiente; al volver de un alta
// exitosa navegan a "/" con el estado { pagina: 1 } y, como la sección Cuenta se
// vuelve a montar, muestra la página 1 (FR-42).
// Sin sesión iniciada no se renderiza ninguna ruta (FR-02).
function App() {
  return (
    <main className="contenedor">
      <ProveedorSesion>
        <ProveedorMensajes>
          <Routes>
            <Route path="/" element={<SeccionCuenta />} />
            <Route path="/gasto/nuevo" element={<h1>Añadir Gasto</h1>} />
            <Route path="/ingreso/nuevo" element={<h1>Añadir Ingreso</h1>} />
          </Routes>
        </ProveedorMensajes>
      </ProveedorSesion>
    </main>
  );
}

export default App;
