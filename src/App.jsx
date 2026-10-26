import { Route, Routes } from 'react-router';
import { ProveedorMensajes } from './mensajes/ProveedorMensajes.jsx';
import { ProveedorSesion } from './sesion/ProveedorSesion.jsx';

// Esqueleto de rutas. Las páginas reales se incorporan en los bloques siguientes:
// la sección Cuenta en "/" y los formularios de alta en "/gasto/nuevo" e "/ingreso/nuevo".
// Sin sesión iniciada no se renderiza ninguna ruta (FR-02).
function App() {
  return (
    <main className="contenedor">
      <ProveedorSesion>
        <ProveedorMensajes>
          <Routes>
            <Route path="/" element={<h1>Mi Cuenta</h1>} />
            <Route path="/gasto/nuevo" element={<h1>Añadir Gasto</h1>} />
            <Route path="/ingreso/nuevo" element={<h1>Añadir Ingreso</h1>} />
          </Routes>
        </ProveedorMensajes>
      </ProveedorSesion>
    </main>
  );
}

export default App;
