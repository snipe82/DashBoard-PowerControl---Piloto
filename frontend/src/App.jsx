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
  
  const [listaActual, setListaActual] = useState([]);
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
    setMenuAbierto(false); 
    // 🚀 LA SOLUCIÓN: El Padre cierra el cajón automáticamente al cambiar de pestaña. ¡Cero bugs!
    setDrawerAbierto(false); 
  };

  const abrirRevision = (alertId, clientCtx, entidadesDeLaTabla) => {
    setAlertaSeleccionada(alertId);
    setClienteContexto(clientCtx);
    setListaActual(entidadesDeLaTabla || []); 
    setDrawerAbierto(true);
  };

  const currentIndex = listaActual.findIndex(e => 
    (e.id_agrupacion || e.codigo_entidad || e.dni || e.document_number) === alertaSeleccionada
  );

  const hayAnterior = currentIndex > 0;
  const haySiguiente = currentIndex >= 0 && currentIndex < listaActual.length - 1;

  const irAnterior = () => {
    if (hayAnterior) {
      const prev = listaActual[currentIndex - 1];
      setAlertaSeleccionada(prev.id_agrupacion || prev.codigo_entidad || prev.dni || prev.document_number);
      setClienteContexto(prev.cliente || prev.full_name || prev.dni || prev.document_number);
    }
  };

  const irSiguiente = () => {
    if (haySiguiente) {
      const next = listaActual[currentIndex + 1];
      setAlertaSeleccionada(next.id_agrupacion || next.codigo_entidad || next.dni || next.document_number);
      setClienteContexto(next.cliente || next.full_name || next.dni || next.document_number);
    }
  };

  return (
    <div className="bg-bg-app text-gray-800 font-sans antialiased h-screen flex overflow-hidden relative">

      {menuAbierto && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out flex`}>
        <Sidebar vistaActual={vistaActual} setVistaActual={cambiarVistaYLimpiar} />
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50 w-full">
        
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
        onAnterior={irAnterior}
        onSiguiente={irSiguiente}
        hayAnterior={hayAnterior}
        haySiguiente={haySiguiente}
      />
    </div>
  )
}

export default App;