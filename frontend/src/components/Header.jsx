import React from 'react';

// 🚀 NUEVO: Recibimos la prop onToggleMenu desde App.jsx
const Header = ({ vistaActual, filtros, setFiltros, onToggleMenu }) => {
  const titulos = {
    DASHBOARD: 'Resumen Ejecutivo de Operaciones',
    OPEN: 'Triage de Alertas',
    IN_REVIEW: 'Gestión Activa (En Revisión)',
    ADDITIONAL_REVIEW: 'Casos Especiales (Revisión Adicional)',
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
    // 🚀 ADAPTACIÓN: Cambiamos h-20 por min-h para que pueda crecer si es necesario, 
    // y lo hacemos flex-col en móviles y flex-row en PC.
    <header className="min-h-[5rem] bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 py-3 md:py-0 z-30 shrink-0 gap-3 md:gap-0">
      
      {/* Contenedor del Título y el Botón Hamburguesa */}
      <div className="flex items-center w-full md:w-auto">
        
        {/* 🚀 EL MENÚ HAMBURGUESA: Solo visible en celular (md:hidden) */}
        <button 
          onClick={onToggleMenu}
          className="md:hidden mr-3 p-1.5 text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded-lg focus:outline-none transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h2 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight truncate">{tituloAMostrar}</h2>
      </div>

      {mostrarFiltros && (
        // 🚀 ADAPTACIÓN FILTROS: overflow-x-auto permite que en celular se deslicen con el dedo sin romper el diseño
        <div className="flex items-center space-x-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">

          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="shrink-0 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1.5 rounded transition-colors"
            >
              Limpiar ✕
            </button>
          )}

          {/* Filtros de Fecha (Añadimos shrink-0 para que no se aplaste) */}
          <div className="shrink-0 flex items-center bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-power-purple transition-all">
            <div className="flex items-center">
              <span className="text-[9px] font-black text-gray-400 mr-2 uppercase tracking-tighter">Desde</span>
              <input
                type="date"
                value={filtros?.fechaInicio || ''}
                onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                className="bg-transparent text-sm focus:outline-none text-gray-600"
              />
            </div>
            <span className="mx-2 text-gray-300">|</span>
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

          {/* BUSCADOR 1: Filtro Clásico por DNI (Añadimos shrink-0) */}
          <div className="relative group shrink-0">
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
              className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-power-purple w-40 md:w-44 bg-white text-gray-800"
            />
          </div>

          {/* BUSCADOR 2: Filtro por Código de Entidad (Añadimos shrink-0) */}
          <div className="relative group shrink-0">
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
              className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-power-purple w-48 md:w-56 bg-white text-gray-800"
            />
          </div>

        </div>
      )}
    </header>
  );
};

export default Header;