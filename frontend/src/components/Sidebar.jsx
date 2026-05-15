import React from 'react';

const Sidebar = ({ vistaActual, setVistaActual }) => {
  const menuItems = [
    { id: 'DASHBOARD', titulo: 'Panel de Resumen', icono: <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" strokeWidth="2" /> },
    { id: 'OPEN', titulo: 'Triage (Nuevas)', icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /> },
    { id: 'IN_REVIEW', titulo: 'En Revisión', icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { id: 'FRAUD', titulo: 'Casos Críticos', icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
    { id: 'DISCARDED', titulo: 'Historial', icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /> }
  ];

  return (
    <aside className="w-64 bg-white shadow-xl flex flex-col justify-between h-full z-20 shrink-0">
      <div>
        <div className="h-20 flex flex-col justify-center items-center border-b border-gray-100">
          <h1 className="text-3xl tracking-tighter">
            <span className="text-power-purple font-black italic">Power</span>
            <span className="text-power-blue font-black italic">Control</span>
          </h1>
          <span className="text-xs text-power-blue mt-1">Sistema Antifraude</span>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {menuItems.map(item => {
            const isActive = vistaActual === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setVistaActual(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive
                    // AQUÍ ESTÁ LA MAGIA: bg-power-purple/10 en lugar del opacity viejo
                    ? 'bg-power-purple/10 text-power-purple font-semibold border-l-4 border-power-purple'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icono}
                  </svg>
                  {item.titulo}
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-power-blue text-white flex items-center justify-center font-bold">A</div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">Analista Test</p>
            <button className="text-xs text-gray-400 hover:text-power-purple">Cerrar Sesión</button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;