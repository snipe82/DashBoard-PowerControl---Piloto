import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AlertsTable from './components/AlertsTable';
import ReviewDrawer from './components/ReviewDrawer';
import LoginView from './components/LoginView';
import UsersList from './components/UsersList'; 
import UserCreate from './components/UserCreate'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));
  
  // ESTADO MAESTRO PARA MODULARIDAD
  const [moduloActual, setModuloActual] = useState('ALERTAS');
  const [vistaActual, setVistaActual] = useState('DASHBOARD');
  
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [clienteContexto, setClienteContexto] = useState(null);
  const [listaActual, setListaActual] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [filtros, setFiltros] = useState({ fechaInicio: '', fechaFin: '', busqueda: '' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🚀 PANTALLA BLOQUEADA: Si no hay token, no entra
  if (!isAuthenticated) {
    return <LoginView onLogin={() => {
      setIsAuthenticated(true);
      // FORZAR MÓDULO POR DEFECTO AL INICIAR SESIÓN
      setModuloActual('ALERTAS');
      setVistaActual('DASHBOARD');
    }} />;
  }

  // Lógica de cambio de módulo
  const handleCambiarModulo = (nuevoModulo) => {
    setModuloActual(nuevoModulo);
    setVistaActual(nuevoModulo === 'ALERTAS' ? 'DASHBOARD' : 'USERS_LIST');
    setMenuAbierto(false);
    setDrawerAbierto(false);
  };

  const cambiarVistaYLimpiar = (nuevaVista) => {
    setVistaActual(nuevaVista);
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '' });
    setMenuAbierto(false); 
    setDrawerAbierto(false); 
  };

  // 🚀 ORQUESTACIÓN ATÓMICA DE ESTADOS DEL CASO
  const abrirRevision = (alertId, clientCtx, entidadesDeLaTabla) => {
    setAlertaSeleccionada(alertId); 
    setClienteContexto(clientCtx);
    setListaActual(entidadesDeLaTabla || []); 
    setDrawerAbierto(true);
  };

  const currentIndex = listaActual.findIndex(e => (e.id_agrupacion || e.codigo_entidad || e.dni) === alertaSeleccionada);
  const hayAnterior = currentIndex > 0;
  const haySiguiente = currentIndex >= 0 && currentIndex < listaActual.length - 1;

  const irAnterior = () => {
    if (hayAnterior) {
      const prev = listaActual[currentIndex - 1];
      setAlertaSeleccionada(prev.id_agrupacion || prev.codigo_entidad || prev.dni);
      setClienteContexto(prev.cliente || prev.full_name || prev.dni);
    }
  };

  const irSiguiente = () => {
    if (haySiguiente) {
      const next = listaActual[currentIndex + 1];
      setAlertaSeleccionada(next.id_agrupacion || next.codigo_entidad || next.dni);
      setClienteContexto(next.cliente || next.full_name || next.dni);
    }
  };

  return (
    <div className="bg-bg-app text-gray-800 font-sans antialiased h-screen flex overflow-hidden relative">
      {menuAbierto && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" onClick={() => setMenuAbierto(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out flex`}>
        <Sidebar 
          moduloActual={moduloActual} 
          setModuloActual={handleCambiarModulo} 
          vistaActual={vistaActual} 
          setVistaActual={cambiarVistaYLimpiar} 
          onLogout={() => { localStorage.clear(); setIsAuthenticated(false); }}
        />
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50 w-full">
        <Header vistaActual={vistaActual} filtros={filtros} setFiltros={setFiltros} onToggleMenu={() => setMenuAbierto(true)} mostrarFiltros={moduloActual === 'ALERTAS'} />
        
        <div className="flex-1 overflow-y-auto">
          {moduloActual === 'ALERTAS' ? (
            vistaActual === 'DASHBOARD' ? (
              <DashboardView />
            ) : (
              <AlertsTable vistaActual={vistaActual} onAbrirRevision={abrirRevision} filtros={filtros} refreshTrigger={refreshTrigger} />
            )
          ) : (
            vistaActual === 'USERS_LIST' ? (
              <UsersList />
            ) : (
              <UserCreate setVistaActual={setVistaActual} />
            )
          )}
        </div>
      </main>

      {moduloActual === 'ALERTAS' && (
        <ReviewDrawer
          isOpen={drawerAbierto} onClose={() => setDrawerAbierto(false)} alertId={alertaSeleccionada} clienteContexto={clienteContexto} estadoActual={vistaActual} recargarTabla={() => setRefreshTrigger(prev => prev + 1)} onAnterior={irAnterior} onSiguiente={irSiguiente} hayAnterior={hayAnterior} haySiguiente={haySiguiente}
        />
      )}
    </div>
  )
}

export default App;