import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AlertsTable from './components/AlertsTable';
import ReviewDrawer from './components/ReviewDrawer';
import LoginView from './components/LoginView';
import UsersList from './components/UsersList'; 
import UserCreate from './components/UserCreate'; 

import RulesList from './components/RulesList';
import RuleForm from './components/RuleForm';
import EventsSearch from './components/EventsSearch';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));
  
  const [moduloActual, setModuloActual] = useState('ALERTAS');
  const [vistaActual, setVistaActual] = useState('DASHBOARD');
  
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [clienteContexto, setClienteContexto] = useState(null);
  const [listaActual, setListaActual] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [filtros, setFiltros] = useState({ fechaInicio: '', fechaFin: '', busqueda: '', codigoEntidad: '' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [reglaEnEdicion, setReglaEnEdicion] = useState(null);
  
  // 🚀 NUEVO ESTADO: Controla el Modal del Acceso Rápido a Eventos
  const [quickEventsOpen, setQuickEventsOpen] = useState(false);

  const abrirRevision = useCallback((alertId, clientCtx, entidadesDeLaTabla) => {
    setAlertaSeleccionada(alertId); 
    setClienteContexto(clientCtx);
    setListaActual(entidadesDeLaTabla || []); 
    setTimeout(() => { setDrawerAbierto(true); }, 10);
  }, []);

  if (!isAuthenticated) {
    return <LoginView onLogin={() => {
      setIsAuthenticated(true);
      setModuloActual('ALERTAS');
      setVistaActual('DASHBOARD');
    }} />;
  }

  const handleCambiarModulo = (nuevoModulo) => {
    setModuloActual(nuevoModulo);
    
    if (nuevoModulo === 'ALERTAS') {
      setVistaActual('DASHBOARD');
    } else if (nuevoModulo === 'ANALISIS') {
      setVistaActual('RULES_LIST');
    } else if (nuevoModulo === 'EVENTOS') {
      setVistaActual('EVENTS_SEARCH'); 
    } else {
      setVistaActual('USERS_LIST');
    }
    
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '', codigoEntidad: '' });
    setMenuAbierto(false);
    setDrawerAbierto(false);
  };

  const cambiarVistaYLimpiar = (nuevaVista) => {
    setVistaActual(nuevaVista);
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '', codigoEntidad: '' });
    setMenuAbierto(false); 
    setDrawerAbierto(false); 
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
        {/* 🚀 Pasamos la instrucción de abrir eventos rápidos al Header */}
        <Header 
          moduloActual={moduloActual}
          vistaActual={vistaActual} 
          filtros={filtros} 
          setFiltros={setFiltros} 
          onToggleMenu={() => setMenuAbierto(true)} 
          onOpenQuickEvents={() => setQuickEventsOpen(true)}
        />
        
        <div className="flex-1 overflow-y-auto">
          {moduloActual === 'ALERTAS' && (
            vistaActual === 'DASHBOARD' ? (
              <DashboardView />
            ) : (
              <AlertsTable vistaActual={vistaActual} onAbrirRevision={abrirRevision} filtros={filtros} refreshTrigger={refreshTrigger} />
            )
          )}

          {moduloActual === 'ANALISIS' && (
            vistaActual === 'RULES_LIST' ? (
              <RulesList onCreateRule={() => { setReglaEnEdicion(null); setVistaActual('RULE_FORM'); }} onEditRule={(rule) => { setReglaEnEdicion(rule); setVistaActual('RULE_FORM'); }} filtros={filtros} />
            ) : (
              <RuleForm ruleToEdit={reglaEnEdicion} onCancel={() => setVistaActual('RULES_LIST')} onSuccess={() => setVistaActual('RULES_LIST')} />
            )
          )}

          {moduloActual === 'EVENTOS' && (
             <EventsSearch />
          )}

          {moduloActual === 'SEGURIDAD' && (
            vistaActual === 'USERS_LIST' ? (
              <UsersList filtros={filtros} />
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

      {/* 🚀 MODAL: ACCESO RÁPIDO A EVENTOS (CAJA NEGRA) */}
      {quickEventsOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col relative overflow-hidden border border-gray-200">
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {/* Le avisamos al componente que se está pintando en un modal */}
              <EventsSearch isModal={true} onClose={() => setQuickEventsOpen(false)} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App;