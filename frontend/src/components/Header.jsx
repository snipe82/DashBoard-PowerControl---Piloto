import React from 'react';

const Header = ({ moduloActual, vistaActual, filtros, setFiltros, onToggleMenu, onOpenQuickEvents }) => {
  
  const titulos = {
    DASHBOARD: 'Resumen de Alertas',
    OPEN: 'Triage de Alertas',
    IN_REVIEW: 'Alertas en Revisión',               
    ADDITIONAL_REVIEW: 'Revisión Adicional',         
    FRAUD: 'Casos Críticos',
    DISCARDED: 'Historial',
    RULES_LIST: 'Lista de Reglas', 
    NEW_RULE: 'Nueva Regla',
    EDIT_RULE: 'Editar Regla',
    USERS_LIST: 'Lista de Usuarios',
    EVENTS_SEARCH: 'Buscador de Eventos'
  };

  const tituloAMostrar = titulos[vistaActual] || (vistaActual ? vistaActual.replace(/_/g, ' ') : 'Módulo en Construcción');
  
  const isAlertasView = ['OPEN', 'IN_REVIEW', 'ADDITIONAL_REVIEW', 'FRAUD', 'DISCARDED'].includes(vistaActual);
  const isRulesView = vistaActual === 'RULES_LIST';
  const isUsersView = vistaActual === 'USERS_LIST';
  
  const mostrarFiltros = isAlertasView || isRulesView || isUsersView;
  const hayFiltrosActivos = filtros?.busqueda || filtros?.codigoEntidad || filtros?.fechaInicio || filtros?.fechaFin;

  const limpiarFiltros = () => {
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '', codigoEntidad: '' });
  };

  return (
    <header className="min-h-[5rem] bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-3 md:py-0 z-30 shrink-0 gap-3 md:gap-0 w-full overflow-hidden border-b border-gray-100">
      
      <div className="flex items-center w-full md:w-auto shrink-0 max-w-xs lg:max-w-none">
        <button 
          onClick={onToggleMenu}
          className="md:hidden mr-3 p-1.5 text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded-lg focus:outline-none transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-base lg:text-xl font-black text-gray-800 tracking-tight truncate" title={tituloAMostrar}>
          {tituloAMostrar}
        </h2>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end flex-1 w-full md:w-auto gap-3 lg:gap-3 overflow-visible">
        
        {mostrarFiltros && (
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2 lg:gap-3 flex-1 md:flex-none justify-start md:justify-end w-full md:w-auto">
            {hayFiltrosActivos && (
              <button onClick={limpiarFiltros} className="shrink-0 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1.5 rounded transition-colors">
                Limpiar ✕
              </button>
            )}

            {isAlertasView && (
              <>
                <div className="w-full md:w-auto shrink-0 flex items-center justify-between md:justify-start bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-power-purple transition-all">
                  <div className="flex items-center flex-1 md:flex-none">
                    <span className="text-[9px] font-black text-gray-400 mr-1.5 uppercase tracking-tighter">Desde</span>
                    <input type="date" value={filtros?.fechaInicio || ''} onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })} className="bg-transparent text-xs focus:outline-none text-gray-600 w-full md:w-[105px]" />
                  </div>
                  <span className="mx-1.5 text-gray-300">|</span>
                  <div className="flex items-center flex-1 md:flex-none">
                    <span className="text-[9px] font-black text-gray-400 mr-1.5 uppercase tracking-tighter">Hasta</span>
                    <input type="date" value={filtros?.fechaFin || ''} onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })} className="bg-transparent text-xs focus:outline-none text-gray-600 w-full md:w-[105px]" />
                  </div>
                </div>
                
                {/* 🚀 NUEVO BLOQUE: DNI y Entidad visibles en móvil (50/50 de ancho) */}
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                  <div className="relative group flex-1 md:flex-none">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round"></path></svg></span>
                    <input type="text" placeholder="Buscar DNI..." value={filtros?.busqueda || ''} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-power-purple w-full md:w-32 lg:w-40 bg-white text-gray-800" />
                  </div>

                  <div className="relative group flex-1 md:flex-none">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round"></path></svg></span>
                    <input type="text" placeholder="Código Entidad..." value={filtros?.codigoEntidad || ''} onChange={(e) => setFiltros({ ...filtros, codigoEntidad: e.target.value })} className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-power-purple w-full md:w-36 lg:w-48 bg-white text-gray-800" />
                  </div>
                </div>
              </>
            )}

            {isRulesView && (
              <div className="relative group shrink-0 w-full md:w-auto mt-2 md:mt-0">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"></path></svg></span>
                <input type="text" placeholder="Buscar código o nombre de regla..." value={filtros?.busqueda || ''} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-power-purple w-full md:w-72 bg-white text-gray-800 shadow-sm" />
              </div>
            )}

            {isUsersView && (
              <div className="relative group shrink-0 w-full md:w-auto mt-2 md:mt-0">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"></path></svg></span>
                <input type="text" placeholder="Buscar por nombre o correo..." value={filtros?.busqueda || ''} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-power-purple w-full md:w-72 bg-white text-gray-800 shadow-sm" />
              </div>
            )}
          </div>
        )}

        {moduloActual !== 'EVENTOS' && moduloActual !== 'SEGURIDAD' && vistaActual !== 'DASHBOARD' && (
          <button 
            onClick={onOpenQuickEvents}
            className="w-full md:w-auto flex justify-center items-center gap-1.5 bg-slate-900 text-white px-3 lg:px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-md active:scale-95 border border-slate-700 whitespace-nowrap shrink-0"
          >
            <span className="text-amber-400 text-sm">⚡</span> Acceso Rápido a Eventos
          </button>
        )}

      </div>
    </header>
  );
};

export default Header;