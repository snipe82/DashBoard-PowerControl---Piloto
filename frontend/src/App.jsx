import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AlertsTable from './components/AlertsTable';
import ReviewDrawer from './components/ReviewDrawer';

function App() {
  const [vistaActual, setVistaActual] = useState('DASHBOARD');
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);

  // 🚀 NUEVO: Recordar qué cliente/DNI se clickeó en la fila
  const [clienteContexto, setClienteContexto] = useState(null);

  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const cambiarVistaYLimpiar = (nuevaVista) => {
    setVistaActual(nuevaVista);
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '' });
  };

  // 🚀 ACTUALIZADO: Ahora recibe el identificador del cliente de la fila
  const abrirRevision = (alertId, clientCtx) => {
    setAlertaSeleccionada(alertId);
    setClienteContexto(clientCtx);
    setDrawerAbierto(true);
  };

  return (
    <div className="bg-bg-app text-gray-800 font-sans antialiased h-screen flex overflow-hidden">

      <Sidebar vistaActual={vistaActual} setVistaActual={cambiarVistaYLimpiar} />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50">
        <Header vistaActual={vistaActual} filtros={filtros} setFiltros={setFiltros} />

        <div className="flex-1 overflow-y-auto">
          {vistaActual === 'DASHBOARD' ? (
            <DashboardView />
          ) : (
            <AlertsTable
              vistaActual={vistaActual}
              onAbrirRevision={abrirRevision} // Pasa la función actualizada
              filtros={filtros}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>
      </main>

      <ReviewDrawer
        isOpen={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        alertId={alertaSeleccionada}
        clienteContexto={clienteContexto} // 🚀 Le pasamos el contexto del cliente clickeado al Drawer
        estadoActual={vistaActual}
        recargarTabla={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  )
}

export default App;