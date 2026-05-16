import React, { useState, useEffect } from 'react';

const AlertsTable = ({ vistaActual, onAbrirRevision, filtros }) => {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 🚀 NUEVO: Estados para controlar la paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [paginacionInfo, setPaginacionInfo] = useState(null);

  // Si cambian los filtros o la vista, reseteamos a la página 1
  useEffect(() => {
    setPaginaActual(1);
  }, [vistaActual, filtros]);

  // El radar principal
  useEffect(() => {
    setCargando(true);

    const cargarDatos = () => {
      // 🚀 TRUCO: Si el usuario escribe una búsqueda, usamos el nuevo servicio por DNI
      let url = filtros?.busqueda
        ? `/api/alerts/dni/${filtros.busqueda.trim()}`
        : `/api/alerts?status=${vistaActual}&page=${paginaActual}&pageSize=20`;

      // Solo agregamos fechas si no es una búsqueda directa por DNI
      if (!filtros?.busqueda) {
        if (filtros?.fechaInicio) url += `&dateFrom=${filtros.fechaInicio}`;
        if (filtros?.fechaFin) url += `&dateTo=${filtros.fechaFin}`;
      }

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Error en la red");
          return res.json();
        })
        .then(data => {
          // El nuevo servicio de DNI puede devolver un array directo o un objeto con .data
          const resultadoFinal = Array.isArray(data) ? data : (data.data || []);
          setAlertas(resultadoFinal);

          // Si estamos buscando por DNI no tiene sentido paginar (trae todo lo de ese cliente)
          if (!filtros?.busqueda && data.pagination) {
            setPaginacionInfo(data.pagination);
          } else {
            setPaginacionInfo(null); // Oculta los botones de Siguiente/Atrás al buscar
          }
          setCargando(false);
        })
        .catch(error => {
          console.error("Error cargando la tabla:", error);
          setAlertas([]);
          setPaginacionInfo(null);
          setCargando(false);
        });
    };

    // 1. Llamada inicial
    cargarDatos();

    // 2. 🚀 EL TRUCO: Refresco automático cada 30 segundos en segundo plano
    const intervalo = setInterval(cargarDatos, 30000);

    // 3. Desactivar cuando se vaya de la página
    return () => clearInterval(intervalo);
  }, [vistaActual, filtros, paginaActual]);

  return (
    <div className="p-8 animate-fade-in h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50/90 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-6 py-4 font-bold">Fecha</th>
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold">Regla</th>
                <th className="px-6 py-4 font-bold">Comercio</th>
                <th className="px-6 py-4 font-bold">Monto</th>
                <th className="px-6 py-4 font-bold text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="text-sm divide-y divide-gray-50">
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-400 font-bold italic">
                    Consultando motor...
                  </td>
                </tr>
              ) : alertas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-500 italic">
                    No se encontraron alertas.
                  </td>
                </tr>
              ) : (
                alertas.map(alerta => (
                  <tr key={alerta.alert_id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(alerta.fecha).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {alerta.cliente}
                      <br />
                      <span className="text-[10px] text-gray-400 font-normal">DNI: {alerta.dni}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-600">
                        {alerta.codigoregla}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]">
                      {alerta.tienda}
                    </td>
                    <td className="px-6 py-4 font-black text-gray-800">
                      S/ {alerta.monto}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="text-power-purple font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity"
                        onClick={() => onAbrirRevision(alerta.alert_id)}
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 🚀 NUEVO: Barra inferior siempre visible */}
        {!cargando && (
          <div className="bg-gray-50 border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
            {paginacionInfo ? (
              <>
                <p className="text-xs text-gray-500">
                  Mostrando página <span className="font-bold text-gray-800">{paginacionInfo.currentPage}</span> de <span className="font-bold text-gray-800">{paginacionInfo.totalPages}</span>
                  <span className="ml-2 text-gray-400">({paginacionInfo.totalItems} registros totales)</span>
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginacionInfo.currentPage === 1}
                    className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPaginaActual(p => p + 1)}
                    disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages}
                    className="px-4 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg hover:bg-power-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              // Se muestra si estás buscando un DNI específico o no hay paginación del backend
              <p className="text-xs text-gray-500">
                Mostrando <span className="font-bold text-gray-800">{alertas.length}</span> {alertas.length === 1 ? 'registro' : 'registros'} en total
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AlertsTable;