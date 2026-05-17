import React, { useState, useEffect } from 'react';

const MiniAlertTooltip = ({ entityId, idx }) => {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/alerts/entity/${entityId}`)
      .then(res => res.json())
      .then(data => {
        const arr = data.data || (Array.isArray(data) ? data : []);
        setAlertas(arr.slice(0, 5));
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, [entityId]);

  const isTooHigh = idx < 2;

  return (
    <div className={`absolute z-50 left-1/2 -translate-x-1/2 w-[480px] bg-slate-900 text-white rounded-xl shadow-2xl p-5 border border-slate-700 pointer-events-none transition-opacity duration-200 animate-fade-in ${isTooHigh ? 'top-full mt-3' : 'bottom-full mb-3'
      }`}>
      <div className={`absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent ${isTooHigh ? 'bottom-full border-b-slate-900' : 'top-full border-t-slate-900'
        }`}></div>

      <h4 className="font-bold border-b border-slate-700 pb-2 mb-3 text-white uppercase tracking-widest text-sm">
        Vista Previa de Alertas
      </h4>

      {cargando ? (
        <p className="text-slate-100 italic text-center py-4 text-sm animate-pulse">Cargando detalle...</p>
      ) : alertas.length === 0 ? (
        <p className="text-slate-100 text-center py-3 text-sm">No hay detalle disponible</p>
      ) : (
        <ul className="space-y-2.5">
          {alertas.map((al, i) => (
            <li key={i} className="bg-slate-800 p-3 rounded-lg border border-slate-700/50 flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-mono text-sm text-red-200 bg-red-900/40 px-2 py-0.5 rounded border border-red-400/20 truncate max-w-[140px]" title={al.codigoregla}>
                  {al.codigoregla}
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  S/ {parseFloat(al.monto || 0).toFixed(2)}
                </span>
              </div>

              <p className="text-sm text-slate-50 font-medium mb-1.5 whitespace-normal" title={al.regla}>
                {al.regla || 'Alerta de riesgo'}
              </p>

              <div className="flex justify-between items-center text-xs text-slate-200">
                <span>{al.event_type || 'Transacción'}</span>
                <span>{new Date(al.fecha).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!cargando && alertas.length === 5 && (
        <p className="text-center text-xs text-slate-100 mt-3 italic border-t border-slate-800 pt-2">
          + más alertas ocultas (abrir revisión para ver todas)
        </p>
      )}
    </div>
  );
};

const AlertsTable = ({ vistaActual, onAbrirRevision, filtros, refreshTrigger }) => {
  const [entidades, setEntidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [paginaActual, setPaginaActual] = useState(1);
  const [paginacionInfo, setPaginacionInfo] = useState(null);
  const [hoveredEntityId, setHoveredEntityId] = useState(null);

  // 🚀 Variable local temporal para el valor que escribe el analista en el input de salto de página
  const [inputPagina, setInputPagina] = useState("1");

  const pageSize = 20;

  useEffect(() => { setPaginaActual(1); }, [vistaActual, filtros]);

  useEffect(() => {
    setCargando(true);
    const cargarDatos = () => {
      let url = `/api/alerts/grouped?status=${vistaActual}&page=${paginaActual}&pageSize=${pageSize}`;

      const busquedaDni = filtros?.busqueda?.trim() || '';
      const busquedaCodigoEntidad = filtros?.codigoEntidad?.trim() || '';

      if (busquedaCodigoEntidad !== '') {
        url = `/api/alerts/entity/${busquedaCodigoEntidad}?status=${vistaActual}`;
      } else if (busquedaDni !== '') {
        url = `/api/alerts/dni/${busquedaDni}?status=${vistaActual}`;
      }

      if (filtros?.fechaInicio) url += `&dateFrom=${filtros.fechaInicio}`;
      if (filtros?.fechaFin) url += `&dateTo=${filtros.fechaFin}`;

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Error en la red");
          return res.json();
        })
        .then(data => {
          let arrData = [];
          if (Array.isArray(data)) {
            arrData = data;
          } else if (data && Array.isArray(data.data)) {
            arrData = data.data;
          } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            arrData = [data.data || data];
          }

          arrData = arrData.filter(item => {
            const s = item.status || item.estado;
            return !s || s.toUpperCase() === vistaActual.toUpperCase();
          });

          arrData.sort((a, b) => {
            const fechaA = a.fecha_ultima_compra || a.fecha_ultima_alerta || a.ultima_fecha || a.max_fecha || a.fecha || 0;
            const fechaB = b.fecha_ultima_compra || b.fecha_ultima_alerta || b.ultima_fecha || b.max_fecha || b.fecha || 0;

            const dateA = new Date(fechaA);
            const dateB = new Date(fechaB);
            return dateB - dateA;
          });

          let infoPaginacion = null;
          const totalDesdeFila = arrData[0]?.total_count || data?.[0]?.total_count || data?.data?.[0]?.total_count;

          if (data?.pagination) {
            infoPaginacion = data.pagination;
          } else if (totalDesdeFila) {
            const totalItems = parseInt(totalDesdeFila, 10);
            infoPaginacion = {
              currentPage: paginaActual,
              pageSize: pageSize,
              totalItems: totalItems,
              totalPages: Math.ceil(totalItems / pageSize)
            };
          } else {
            infoPaginacion = {
              currentPage: paginaActual,
              pageSize: pageSize,
              totalItems: arrData.length,
              totalPages: arrData.length === pageSize ? paginaActual + 1 : paginaActual
            };
          }

          setEntidades(arrData);
          setPaginacionInfo(infoPaginacion);
          // Sincronizamos el input del frontend con la página real devuelta
          setInputPagina(paginaActual.toString());
          setCargando(false);
        })
        .catch(error => {
          console.error("Error cargando la tabla agrupada:", error);
          setEntidades([]);
          setPaginacionInfo(null);
          setCargando(false);
        });
    };

    cargarDatos();
    const intervalo = setInterval(cargarDatos, 30000);
    return () => intervalo && clearInterval(intervalo);
  }, [vistaActual, filtros, paginaActual, refreshTrigger]);

  // 🚀 FUNCIÓN DE SALTO DE PÁGINA INTELIGENTE
  const procesarSaltoPagina = () => {
    const num = parseInt(inputPagina, 10);
    if (!isNaN(num) && paginacionInfo) {
      // Validamos que esté en el rango de páginas válidas
      const paginaDestino = Math.max(1, Math.min(num, paginacionInfo.totalPages));
      setPaginaActual(paginaDestino);
      setInputPagina(paginaDestino.toString());
    } else {
      setInputPagina(paginaActual.toString());
    }
  };

  return (
    <div className="p-8 animate-fade-in h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible flex-1 flex flex-col">
        <div className="overflow-visible flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50/90 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-6 py-4 font-bold">Última Compra</th>
                <th className="px-6 py-4 font-bold">Entidad (Cliente)</th>
                <th className="px-6 py-4 font-bold text-center">Alertas Agrupadas</th>
                <th className="px-6 py-4 font-bold text-right">Riesgo Total Acumulado</th>
                <th className="px-6 py-4 font-bold text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="text-sm divide-y divide-gray-50">
              {cargando ? (
                <tr><td colSpan="5" className="text-center py-12 text-gray-400 font-bold italic">Consultando entidades...</td></tr>
              ) : entidades.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-gray-500 italic">No se encontraron entidades en riesgo.</td></tr>
              ) : (
                entidades.map((entidad, idx) => {
                  const fechaRaw = entidad.fecha_ultima_compra || entidad.fecha_ultima_alerta || entidad.ultima_fecha || entidad.max_fecha || entidad.fecha;

                  return (
                    <tr key={entidad.codigo_entidad || entidad.dni || `entidad-${idx}`} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-gray-500">
                        {fechaRaw ? new Date(fechaRaw).toLocaleString() : '—'}
                      </td>

                      <td className="px-6 py-4 font-bold text-gray-800">
                        {entidad.cliente || entidad.full_name || 'Cliente no registrado'}
                        <br />
                        <span className="text-[10px] text-gray-400 font-normal">
                          {entidad.dni || entidad.document_number ? `Doc: ${entidad.dni || entidad.document_number}` : 'Identificador de Entidad'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center relative">
                        <div
                          onMouseEnter={() => setHoveredEntityId(entidad.codigo_entidad || entidad.dni)}
                          onMouseLeave={() => setHoveredEntityId(null)}
                          className="inline-block relative"
                        >
                          <span className="bg-red-100 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 shadow-sm cursor-help block">
                            {entidad.total_alertas || 1} alertas
                          </span>
                          {hoveredEntityId === (entidad.codigo_entidad || entidad.dni) && (
                            <MiniAlertTooltip entityId={entidad.codigo_entidad || entidad.dni} idx={idx} />
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 font-black text-power-purple text-right text-base">
                        S/ {parseFloat(entidad.monto_total_riesgo || entidad.monto || 0).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-power-purple font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity bg-power-purple/10 px-4 py-2 rounded-lg"
                          onClick={() => onAbrirRevision(
                            entidad.codigo_entidad || entidad.dni,
                            entidad.dni || entidad.document_number || entidad.cliente || entidad.full_name
                          )}
                        >
                          Revisar Entidad
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!cargando && paginacionInfo && (
          <div className="bg-gray-50 border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-500">
              Mostrando página <span className="font-bold text-gray-800">{paginacionInfo.currentPage}</span> de <span className="font-bold text-gray-800">{paginacionInfo.totalPages}</span>
              <span className="ml-2 text-gray-400">({paginacionInfo.totalItems} agrupaciones encontradas)</span>
            </p>

            {/* 🚀 BARRA DE PAGINACIÓN EXPANDIDA CON CONTROL DE SALTO DIRECTO */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                disabled={paginacionInfo.currentPage === 1}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Anterior
              </button>

              {/* Selector e Input de Salto Rápido de Página */}
              <div className="flex items-center space-x-1.5 bg-white border border-gray-200 px-2.5 py-1 rounded-lg shadow-sm">
                <span className="text-[11px] text-gray-400 uppercase tracking-tight font-medium">Ir a:</span>
                <input
                  type="text"
                  value={inputPagina}
                  onChange={(e) => setInputPagina(e.target.value.replace(/\D/g, ''))} // Solo permite números planos
                  onKeyDown={(e) => e.key === 'Enter' && procesarSaltoPagina()} // Salta al presionar Enter
                  onBlur={procesarSaltoPagina} // Salta al hacer clic fuera del input
                  className="w-10 text-center font-bold text-xs border border-gray-200 rounded p-1 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-power-purple focus:bg-white"
                />
              </div>

              <button
                onClick={() => setPaginaActual(p => p + 1)}
                disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages}
                className="px-4 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-power-blue/5 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsTable;