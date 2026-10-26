import { Route, Routes } from 'react-router';

// Esqueleto de rutas. Las páginas reales se incorporan en los bloques siguientes:
// la sección Cuenta en "/" y los formularios de alta en "/gasto/nuevo" e "/ingreso/nuevo".
function App() {
  return (
    <main className="contenedor">
      <Routes>
        <Route path="/" element={<h1>Mi Cuenta</h1>} />
        <Route path="/gasto/nuevo" element={<h1>Añadir Gasto</h1>} />
        <Route path="/ingreso/nuevo" element={<h1>Añadir Ingreso</h1>} />
      </Routes>
    </main>
  );
}

export default App;
