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

  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
  });

  // 🚀 NUEVO: Función inteligente para cambiar de vista y limpiar la mesa
  const cambiarVistaYLimpiar = (nuevaVista) => {
    setVistaActual(nuevaVista);
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '' });
  };

  const abrirRevision = (alertId) => {
    setAlertaSeleccionada(alertId);
    setDrawerAbierto(true);
  };

  return (
    <div className="bg-bg-app text-gray-800 font-sans antialiased h-screen flex overflow-hidden">
      
      {/* 🚀 Le pasamos nuestra nueva función al Sidebar */}
      <Sidebar vistaActual={vistaActual} setVistaActual={cambiarVistaYLimpiar} />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50">
        <Header vistaActual={vistaActual} filtros={filtros} setFiltros={setFiltros} />
        
        <div className="flex-1 overflow-y-auto">
          {vistaActual === 'DASHBOARD' ? (
            <DashboardView />
          ) : (
            <AlertsTable 
              vistaActual={vistaActual} 
              onAbrirRevision={abrirRevision}
              filtros={filtros} 
            />
          )}
        </div>
      </main>

      <ReviewDrawer 
        isOpen={drawerAbierto} 
        onClose={() => setDrawerAbierto(false)} 
        alertId={alertaSeleccionada}
        estadoActual={vistaActual}
        recargarTabla={() => {
          setVistaActual(vistaActual + ' '); 
          setTimeout(() => setVistaActual(vistaActual.trim()), 50);
        }}
      />
    </div>
  )
}

export default App;