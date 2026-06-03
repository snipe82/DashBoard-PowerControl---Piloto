import React, { useState, useEffect } from 'react';

const MiniAlertTooltip = ({ entityId, idx, vistaActual }) => {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    
    const controller = new AbortController();
    setCargando(true);
    
    const cleanId = String(entityId).trim();
    const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    let urlEndpoint = `/api/alerts/entity/${cleanId}?status=${vistaActual}`;
    
    if (!esUUID) {
      urlEndpoint = `/api/alerts/dni/${cleanId}?status=${vistaActual}`;
    }

    fetch(urlEndpoint, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const arr = data.data || (Array.isArray(data) ? data : []);
        const alertsFiltered = arr.filter(al => {
          const s = al.status || al.estado;
          return !s || String(s).toUpperCase() === String(vistaActual).toUpperCase();
        });
        alertsFiltered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setAlertas(alertsFiltered.slice(0, 5));
        setCargando(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setCargando(false);
      });

    return () => controller.abort();
  }, [entityId, vistaActual]);

  const isTooHigh = idx < 6;

  return (
    <div className={`absolute z-50 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 w-[280px] sm:w-[320px] md:w-[480px] bg-slate-900 text-white rounded-xl shadow-2xl p-4 md:p-5 border border-slate-700 transition-opacity duration-200 animate-fade-in ${
      isTooHigh ? 'top-full mt-3' : 'bottom-full mb-3'
    }`}>
      <div className={`absolute right-6 md:right-auto md:left-1/2 md:-translate-x-1/2 border-[6px] border-transparent ${
        isTooHigh ? 'bottom-full border-b-slate-900' : 'top-full border-t-slate-900'
      }`}></div>

      <h4 className="font-bold border-b border-slate-700 pb-2 mb-3 text-white uppercase tracking-widest text-xs md:text-sm">
        Vista Previa de Alertas
      </h4>

      {cargando ? (
        <p className="text-slate-100 italic text-center py-4 text-xs md:text-sm animate-pulse">Cargando detalle...</p>
      ) : alertas.length === 0 ? (
        <p className="text-slate-100 text-center py-3 text-xs md:text-sm">No hay detalle disponible para este estado</p>
      ) : (
        <ul className="space-y-2.5">
          {alertas.map((al, i) => (
            <li key={i} className="bg-slate-800 p-2.5 md:p-3 rounded-lg border border-slate-700/50 flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-mono text-[10px] md:text-sm text-red-200 bg-red-900/40 px-2 py-0.5 rounded border border-red-400/20 truncate max-w-[120px] md:max-w-[140px]" title={al.codigoregla}>
                  {al.codigoregla}
                </span>
                <span className="font-bold text-emerald-400 text-xs md:text-sm">
                  S/ {parseFloat(al.monto || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-50 font-medium mb-1.5 whitespace-normal" title={al.regla}>
                {al.regla || 'Alerta de riesgo'}
              </p>
              <div className="flex justify-between items-center text-[10px] md:text-xs text-slate-200">
                <span>{al.event_type || 'Transacción'}</span>
                <span>{new Date(al.fecha).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!cargando && alertas.length === 5 && (
        <p className="text-center text-[10px] md:text-xs text-slate-100 mt-3 italic border-t border-slate-800 pt-2">
          + más alertas (abrir revisión para ver todas)
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
  const [inputPagina, setInputPagina] = useState("1");

  const pageSize = 20;

  useEffect(() => { setPaginaActual(1); }, [vistaActual, filtros]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    setCargando(true);
    const cargarDatos = () => {
      const busquedaDni = filtros?.busqueda?.trim() || '';
      const busquedaCodigoEntidad = filtros?.codigoEntidad?.trim() || '';
      
      const textoBusqueda = busquedaCodigoEntidad || busquedaDni;
      const hayBusqueda = textoBusqueda !== '';
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(textoBusqueda);

      let url = `/api/alerts/grouped?status=${vistaActual}&page=${paginaActual}&pageSize=${pageSize}`;

      if (hayBusqueda) {
        if (esUUID) {
          url = `/api/alerts/entity/${textoBusqueda}?status=${vistaActual}`;
        } else {
          url = `/api/alerts/dni/${textoBusqueda}?status=${vistaActual}`;
        }
      }

      if (filtros?.fechaInicio) url += `&dateFrom=${filtros.fechaInicio}`;
      if (filtros?.fechaFin) url += `&dateTo=${filtros.fechaFin}`;

      fetch(url, { signal })
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
          } else if (data && typeof data === 'object') {
            const obj = data.data || data;
            if (obj && (obj.alert_id || obj.cliente || obj.dni || obj.customer_id)) {
              arrData = [obj];
            }
          }

          arrData = arrData.filter(item => {
            if (!item) return false;
            const s = item.status || item.estado;
            return !s || String(s).toUpperCase() === String(vistaActual).toUpperCase();
          });

          if (hayBusqueda) {
            const agrupado = {};
            arrData.forEach(item => {
              let id = null;
              const posiblesIds = [item.codigo_entidad, item.customer_id, item.merchant_id];
              for (let pid of posiblesIds) {
                if (pid && typeof pid === 'string' && /^[0-9a-fA-F]{8}-/.test(pid)) {
                  id = pid; break;
                }
              }
              if (!id) id = item.dni || item.document_number || textoBusqueda;

              if (!agrupado[id]) {
                agrupado[id] = { ...item, id_agrupacion: id };
                if (!item.hasOwnProperty('total_alertas')) {
                  agrupado[id].total_alertas = 1;
                  agrupado[id].monto_total_riesgo = parseFloat(item.monto || 0);
                }
              } else {
                if (!item.hasOwnProperty('total_alertas')) {
                  agrupado[id].total_alertas += 1;
                  agrupado[id].monto_total_riesgo += parseFloat(item.monto || 0);
                }
                const d1 = new Date(agrupado[id].fecha_ultima_compra || agrupado[id].fecha || 0);
                const d2 = new Date(item.fecha_ultima_compra || item.fecha || 0);
                if (d2 > d1) {
                  agrupado[id].fecha_ultima_compra = item.fecha || item.fecha_ultima_compra;
                }
              }
            });
            arrData = Object.values(agrupado);
          } else {
             arrData = arrData.map(item => ({
                ...item,
                id_agrupacion: item.codigo_entidad || item.customer_id || item.merchant_id || item.dni || item.document_number
             }));
          }

          arrData.sort((a, b) => {
            const fechaA = a.fecha_ultima_compra || a.fecha_ultima_alerta || a.ultima_fecha || a.max_fecha || a.fecha || 0;
            const fechaB = b.fecha_ultima_compra || b.fecha_ultima_alerta || b.ultima_fecha || b.max_fecha || b.fecha || 0;
            return new Date(fechaB) - new Date(fechaA); 
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
              totalPages: Math.ceil(arrData.length / pageSize) || 1
            };
          }

          setEntidades(arrData);
          setPaginacionInfo(infoPaginacion);
          setInputPagina(paginaActual.toString());
          setCargando(false);
        })
        .catch(error => {
          if (error.name === 'AbortError') return; 
          console.error("Error cargando la tabla:", error);
          setEntidades([]);
          setPaginacionInfo(null);
          setCargando(false);
        });
    };

    cargarDatos();
    const intervalo = setInterval(cargarDatos, 30000);

    return () => {
      clearInterval(intervalo);
      controller.abort(); 
    };
  }, [vistaActual, filtros, paginaActual, refreshTrigger]);

  const procesarSaltoPagina = () => {
    const num = parseInt(inputPagina, 10);
    if (!isNaN(num) && paginacionInfo) {
      const paginaDestino = Math.max(1, Math.min(num, paginacionInfo.totalPages));
      setPaginaActual(paginaDestino);
      setInputPagina(paginaDestino.toString());
    } else {
      setInputPagina(paginaActual.toString());
    }
  };

  return (
    <div className="p-3 md:p-8 animate-fade-in h-full flex flex-col">
      <div className="bg-white md:rounded-2xl shadow-sm md:border border-gray-100 overflow-visible flex-1 flex flex-col">
        
        <div className="overflow-visible flex-1 bg-gray-50 md:bg-white">
          
          {/* ==================================================================================== */}
          {/* 💻 VISTA ESCRITORIO: LA TABLA CLÁSICA */}
          {/* ==================================================================================== */}
          <table className="hidden md:table w-full text-left border-collapse relative min-w-[800px]">
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
                  const idEntidadFinal = entidad.id_agrupacion || 'ID_ERROR';
                  const isHovered = hoveredEntityId === idEntidadFinal;

                  return (
                    <tr 
                      key={idEntidadFinal || `entidad-${idx}`} 
                      className={`hover:bg-gray-50 transition-colors group ${isHovered ? 'relative z-50' : 'relative z-0'}`}
                    >
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

                      <td className={`px-6 py-4 text-center relative ${isHovered ? 'z-50' : 'z-0'}`}>
                        <div 
                          onMouseEnter={() => setHoveredEntityId(idEntidadFinal)}
                          onMouseLeave={() => setHoveredEntityId(null)}
                          onClick={() => setHoveredEntityId(hoveredEntityId === idEntidadFinal ? null : idEntidadFinal)}
                          className="inline-block relative"
                        >
                          <span className="bg-red-100 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 shadow-sm cursor-pointer block">
                            {entidad.total_alertas || 1} alertas
                          </span>
                          {isHovered && (
                            <MiniAlertTooltip entityId={idEntidadFinal} idx={idx} vistaActual={vistaActual} />
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 font-black text-power-purple text-right text-base">
                        S/ {parseFloat(entidad.monto_total_riesgo || entidad.monto || 0).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-power-purple font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity bg-power-purple/10 px-4 py-2 rounded-lg disabled:opacity-50"
                          disabled={!idEntidadFinal || idEntidadFinal === 'ID_ERROR'}
                          onClick={() => onAbrirRevision(
                            idEntidadFinal, 
                            entidad.dni || entidad.document_number || entidad.cliente || entidad.full_name,
                            entidades // 🚀 AQUÍ LE INYECTAMOS LA LISTA COMPLETA AL PADRE
                          )}
                        >
                          {idEntidadFinal && idEntidadFinal !== 'ID_ERROR' ? 'Revisar Entidad' : 'ID Inválido'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* ==================================================================================== */}
          {/* 📱 VISTA MÓVIL: TARJETAS CON TOOLTIP HABILITADO */}
          {/* ==================================================================================== */}
          <div className="block md:hidden space-y-3 pb-4">
            {cargando ? (
              <p className="text-center py-12 text-gray-400 font-bold italic">Consultando entidades...</p>
            ) : entidades.length === 0 ? (
              <p className="text-center py-12 text-gray-500 italic">No se encontraron entidades en riesgo.</p>
            ) : (
              entidades.map((entidad, idx) => {
                const fechaRaw = entidad.fecha_ultima_compra || entidad.fecha_ultima_alerta || entidad.ultima_fecha || entidad.max_fecha || entidad.fecha;
                const idEntidadFinal = entidad.id_agrupacion || 'ID_ERROR';
                const isHovered = hoveredEntityId === idEntidadFinal;

                return (
                  <div key={idEntidadFinal || `card-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                    
                    {/* Fila Superior */}
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-gray-500">
                        {fechaRaw ? new Date(fechaRaw).toLocaleString() : '—'}
                      </span>
                      
                      <div 
                        className={`relative ${isHovered ? 'z-50' : 'z-0'}`}
                        onMouseEnter={() => setHoveredEntityId(idEntidadFinal)}
                        onMouseLeave={() => setHoveredEntityId(null)}
                        onClick={() => setHoveredEntityId(hoveredEntityId === idEntidadFinal ? null : idEntidadFinal)}
                      >
                        <span className="bg-red-100 text-red-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-red-200 shadow-sm cursor-pointer block">
                          {entidad.total_alertas || 1} alertas
                        </span>
                        {isHovered && (
                          <MiniAlertTooltip entityId={idEntidadFinal} idx={idx} vistaActual={vistaActual} />
                        )}
                      </div>
                    </div>

                    {/* Centro */}
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-800 text-base leading-tight">
                        {entidad.cliente || entidad.full_name || 'Cliente no registrado'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entidad.dni || entidad.document_number ? `Doc: ${entidad.dni || entidad.document_number}` : 'Identificador de Entidad'}
                      </p>
                    </div>

                    {/* Fila Inferior */}
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Riesgo Total</p>
                        <p className="font-black text-power-purple text-lg">
                          S/ {parseFloat(entidad.monto_total_riesgo || entidad.monto || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        className="bg-power-purple text-white font-bold px-4 py-2.5 rounded-lg text-xs shadow-md active:scale-95 transition-transform disabled:opacity-50"
                        disabled={!idEntidadFinal || idEntidadFinal === 'ID_ERROR'}
                        onClick={() => onAbrirRevision(
                          idEntidadFinal, 
                          entidad.dni || entidad.document_number || entidad.cliente || entidad.full_name,
                          entidades // 🚀 AQUÍ LE INYECTAMOS LA LISTA COMPLETA AL PADRE EN MÓVIL
                        )}
                      >
                        {idEntidadFinal && idEntidadFinal !== 'ID_ERROR' ? 'Revisar' : 'Inválido'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==================================================================================== */}
        {/* 🚀 PAGINACIÓN REPOTENCIADA: "Primera" (<<) y "Última" (>>) añadidas y adaptables */}
        {/* ==================================================================================== */}
        {!cargando && paginacionInfo && (
          <div className="bg-white border-t border-gray-100 p-3 md:p-4 flex flex-col md:flex-row items-center justify-between shrink-0 gap-3 md:gap-0">
            <p className="text-xs text-gray-500 text-center md:text-left">
              Mostrando pág <span className="font-bold text-gray-800">{paginacionInfo.currentPage}</span> de <span className="font-bold text-gray-800">{paginacionInfo.totalPages}</span>
              <span className="ml-1 text-gray-400 hidden sm:inline">({paginacionInfo.totalItems} agrupaciones)</span>
            </p>
            
            <div className="flex items-center space-x-1.5 md:space-x-2 w-full md:w-auto justify-between md:justify-end">
              
              {/* 🚀 Botón: Primera Página */}
              <button 
                onClick={() => setPaginaActual(1)} 
                disabled={paginacionInfo.currentPage === 1} 
                className="px-2 md:px-3 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
                title="Primera página"
              >
                «
              </button>

              <button 
                onClick={() => setPaginaActual(p => Math.max(1, p - 1))} 
                disabled={paginacionInfo.currentPage === 1} 
                className="px-3 md:px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                Anterior
              </button>
              
              <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg shadow-sm">
                <span className="text-[10px] text-gray-400 uppercase font-medium hidden sm:inline">Ir a:</span>
                <input 
                  type="text" 
                  value={inputPagina} 
                  onChange={(e) => setInputPagina(e.target.value.replace(/\D/g, ''))} 
                  onKeyDown={(e) => e.key === 'Enter' && procesarSaltoPagina()} 
                  onBlur={procesarSaltoPagina} 
                  className="w-8 md:w-10 text-center font-bold text-xs border border-gray-200 rounded p-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-power-purple" 
                />
              </div>

              <button 
                onClick={() => setPaginaActual(p => p + 1)} 
                disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages} 
                className="px-3 md:px-4 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                Siguiente
              </button>

              {/* 🚀 Botón: Última Página */}
              <button 
                onClick={() => setPaginaActual(paginacionInfo.totalPages)} 
                disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages} 
                className="px-2 md:px-3 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
                title="Última página"
              >
                »
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsTable;