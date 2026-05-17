import React from 'react';

const Header = ({ vistaActual, filtros, setFiltros }) => {
  const titulos = {
    DASHBOARD: 'Resumen Ejecutivo de Operaciones',
    OPEN: 'Triage de Alertas',
    IN_REVIEW: 'Gestión Activa (En Revisión)',
    ADDITIONAL_REVIEW: 'Casos Especiales (Revisión Adicional)', // 🚀 NUEVO
    FRAUD: 'Casos Críticos (Fraude)',
    DISCARDED: 'Historial (Descartadas)'
  };

  const tituloAMostrar = titulos[vistaActual] || 'Cargando...';
  const mostrarFiltros = vistaActual !== 'DASHBOARD';

  const hayFiltrosActivos = filtros?.busqueda || filtros?.codigoEntidad || filtros?.fechaInicio || filtros?.fechaFin;

  const limpiarFiltros = () => {
    setFiltros({ fechaInicio: '', fechaFin: '', busqueda: '', codigoEntidad: '' });
  };

  return (
    <header className="h-20 bg-white shadow-sm flex items-center justify-between px-8 z-30 shrink-0">
      <h2 className="text-xl font-bold text-gray-800 tracking-tight">{tituloAMostrar}</h2>

      {mostrarFiltros && (
        <div className="flex items-center space-x-4">

          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              Limpiar ✕
            </button>
          )}

          {/* Filtros de Fecha */}
          <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-power-purple transition-all">
            <div className="flex items-center">
              <span className="text-[9px] font-black text-gray-400 mr-2 uppercase tracking-tighter">Desde</span>
              <input
                type="date"
                value={filtros?.fechaInicio || ''}
                onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                className="bg-transparent text-sm focus:outline-none text-gray-600"
              />
            </div>
            <span className="mx-3 text-gray-300">|</span>
            <div className="flex items-center">
              <span className="text-[9px] font-black text-gray-400 mr-2 uppercase tracking-tighter">Hasta</span>
              <input
                type="date"
                value={filtros?.fechaFin || ''}
                onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                className="bg-transparent text-sm focus:outline-none text-gray-600"
              />
            </div>
          </div>

          {/* BUSCADOR 1: Filtro Clásico por DNI */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"></path>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por DNI..."
              value={filtros?.busqueda || ''}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-power-purple w-44 bg-white text-gray-800"
            />
          </div>

          {/* BUSCADOR 2: Filtro por Código de Entidad (UUID) */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"></path>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por Código Entidad..."
              value={filtros?.codigoEntidad || ''}
              onChange={(e) => setFiltros({ ...filtros, codigoEntidad: e.target.value })}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-power-purple w-56 bg-white text-gray-800"
            />
          </div>

        </div>
      )}
    </header>
  );
};

export default Header;