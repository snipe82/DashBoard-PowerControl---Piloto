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
  const [clienteContexto, setClienteContexto] = useState(null);

  // 🚀 NUEVO: Memoria para saber si el menú de celular está abierto o cerrado
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const cambiarVistaYLimpiar = (nuevaVista) => {
    setVistaActual(nuevaVista);
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '' });
    // 🚀 NUEVO: Si estamos en celular, cerramos el menú automáticamente al elegir una opción
    setMenuAbierto(false); 
  };

  const abrirRevision = (alertId, clientCtx) => {
    setAlertaSeleccionada(alertId);
    setClienteContexto(clientCtx);
    setDrawerAbierto(true);
  };

  return (
    <div className="bg-bg-app text-gray-800 font-sans antialiased h-screen flex overflow-hidden relative">

      {/* 🚀 NUEVO: Cortina oscura (Overlay) que aparece detrás del menú en celulares */}
      {menuAbierto && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* 🚀 NUEVO: Envolvemos el Sidebar. 
          En celular (por defecto): absolute, z-50, fuera de la pantalla (-translate-x-full).
          En PC (md:): relativo, sin animaciones de entrada, siempre visible (translate-x-0). */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out flex`}>
        <Sidebar vistaActual={vistaActual} setVistaActual={cambiarVistaYLimpiar} />
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50 w-full">
        
        {/* 🚀 Le pasamos al Header la llave para abrir el menú (onToggleMenu) */}
        <Header 
          vistaActual={vistaActual} 
          filtros={filtros} 
          setFiltros={setFiltros} 
          onToggleMenu={() => setMenuAbierto(true)} 
        />

        <div className="flex-1 overflow-y-auto">
          {vistaActual === 'DASHBOARD' ? (
            <DashboardView />
          ) : (
            <AlertsTable
              vistaActual={vistaActual}
              onAbrirRevision={abrirRevision}
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
        clienteContexto={clienteContexto}
        estadoActual={vistaActual}
        recargarTabla={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  )
}

export default App;