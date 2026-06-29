import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api'; 

const MiniAlertTooltip = ({ entityId, idx, vistaActual, subTabFraud }) => {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    const controller = new AbortController();
    setCargando(true);
    const cleanId = String(entityId).trim();
    const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    
    let targetStatus = vistaActual;
    let extraParam = '';
    
    // 🚀 RUTEO DINÁMICO PARA SUBBANDEJAS DE FRAUDE
    if (vistaActual === 'FRAUD') {
      if (subTabFraud === 'PENDING') {
        targetStatus = 'FRAUD';
      } else if (subTabFraud === 'FRUSTRATED') {
        targetStatus = 'CLOSED_CONFIRMED_FRAUD';
        extraParam = '&fraud_type=FRAUD_FRUSTRATED';
      } else if (subTabFraud === 'MATERIALIZED') {
        targetStatus = 'CLOSED_CONFIRMED_FRAUD';
        extraParam = '&fraud_type=FRAUD_MERCHANT_ASSUMED,FRAUD_LOSS';
      }
    }

    let urlEndpoint = `/api/alerts/entity/${cleanId}?status=${targetStatus}${extraParam}`;
    if (!esUUID) urlEndpoint = `/api/alerts/dni/${cleanId}?status=${targetStatus}${extraParam}`;

    api.get(urlEndpoint, { signal: controller.signal })
      .then(res => {
        const data = res.data;
        const arr = data.data || (Array.isArray(data) ? data : []);
        
        // Confiamos en el Backend, solo validamos status base y ordenamos
        const alertsFiltered = arr.filter(al => !al.status || !al.estado || String(al.status || al.estado).toUpperCase() === String(targetStatus).toUpperCase());
        alertsFiltered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        setAlertas(alertsFiltered.slice(0, 5));
        setCargando(false);
      })
      .catch(err => {
        if (axios.isCancel(err) || err.name === 'CanceledError') return;
        setCargando(false);
      });

    return () => controller.abort();
  }, [entityId, vistaActual, subTabFraud]);

  const isTooHigh = idx < 6;

  return (
    <div className={`absolute z-50 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 w-[280px] sm:w-[320px] md:w-[480px] bg-slate-900 text-white rounded-xl shadow-2xl p-4 md:p-5 border border-slate-700 transition-opacity duration-200 animate-fade-in ${isTooHigh ? 'top-full mt-3' : 'bottom-full mb-3'}`}>
      <div className={`absolute right-6 md:right-auto md:left-1/2 md:-translate-x-1/2 border-[6px] border-transparent ${isTooHigh ? 'bottom-full border-b-slate-900' : 'top-full border-t-slate-900'}`}></div>
      <h4 className="font-bold border-b border-slate-700 pb-2 mb-3 text-white uppercase tracking-widest text-xs md:text-sm">Vista Previa de Alertas</h4>
      {cargando ? <p className="text-slate-100 italic text-center py-4 text-xs animate-pulse">Cargando detalle...</p> : alertas.length === 0 ? <p className="text-slate-100 text-center py-3 text-xs">No hay detalle disponible para este estado</p> : (
        <ul className="space-y-2.5">
          {alertas.map((al, i) => (
            <li key={i} className="bg-slate-800 p-2.5 md:p-3 rounded-lg border border-slate-700/50 flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-mono text-[10px] md:text-sm text-red-200 bg-red-900/40 px-2 py-0.5 rounded border border-red-400/20 truncate max-w-[120px]" title={al.codigoregla}>{al.codigoregla}</span>
                <span className="font-bold text-emerald-400 text-xs md:text-sm">S/ {parseFloat(al.monto || 0).toFixed(2)}</span>
              </div>
              <p className="text-xs md:text-sm text-slate-50 font-medium mb-1.5 whitespace-normal">{al.regla || 'Alerta de riesgo'}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-200"><span>{al.event_type || 'Transacción'}</span><span>{new Date(al.fecha).toLocaleString()}</span></div>
            </li>
          ))}
        </ul>
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
  
  // 🚀 ESTADO PARA LAS SUBBANDEJAS DE FRAUDE
  const [subTabFraud, setSubTabFraud] = useState('PENDING'); 
  
  const pageSize = 20;

  const userSession = JSON.parse(localStorage.getItem('user') || '{}');
  const miUsuarioActual = userSession.email || userSession.username || "analista@powerpay.pe";

  // Reseteos
  useEffect(() => { 
    setPaginaActual(1); 
    if (vistaActual !== 'FRAUD') setSubTabFraud('PENDING'); 
  }, [vistaActual, filtros]);

  useEffect(() => { setPaginaActual(1); }, [subTabFraud]);

  useEffect(() => {
    const controller = new AbortController();
    setCargando(true);

    const cargarDatos = () => {
      const busquedaDni = filtros?.busqueda?.trim() || '';
      const busquedaCodigoEntidad = filtros?.codigoEntidad?.trim() || '';
      const textoBusqueda = busquedaCodigoEntidad || busquedaDni;
      const hayBusqueda = textoBusqueda !== '';
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(textoBusqueda);

      // 🚀 RUTEO DINÁMICO
      let targetStatus = vistaActual;
      let fraudTypeParam = '';

      if (vistaActual === 'FRAUD') {
        if (subTabFraud === 'PENDING') {
          targetStatus = 'FRAUD'; 
        } else if (subTabFraud === 'FRUSTRATED') {
          targetStatus = 'CLOSED_CONFIRMED_FRAUD';
          fraudTypeParam = '&fraud_type=FRAUD_FRUSTRATED';
        } else if (subTabFraud === 'MATERIALIZED') {
          targetStatus = 'CLOSED_CONFIRMED_FRAUD';
          fraudTypeParam = '&fraud_type=FRAUD_MERCHANT_ASSUMED,FRAUD_LOSS';
        }
      }

      let url = `/api/alerts/grouped?status=${targetStatus}&page=${paginaActual}&pageSize=${pageSize}${fraudTypeParam}`;
      
      if (hayBusqueda) {
        url = esUUID ? `/api/alerts/entity/${textoBusqueda}?status=${targetStatus}${fraudTypeParam}` : `/api/alerts/dni/${textoBusqueda}?status=${targetStatus}${fraudTypeParam}`;
      }
      
      if (filtros?.fechaInicio) url += `&dateFrom=${filtros.fechaInicio}`;
      if (filtros?.fechaFin) url += `&dateTo=${filtros.fechaFin}`;

      api.get(url, { signal: controller.signal })
        .then(res => {
          const data = res.data;
          let arrData = Array.isArray(data) ? data : (data?.data || (data && typeof data === 'object' && data.alert_id ? [data] : []));

          // 🛡️ Filtro Base: Validamos que el status coincida con la bandeja principal
          arrData = arrData.filter(item => !item.status || !item.estado || String(item.status || item.estado).toUpperCase() === String(targetStatus).toUpperCase());

          const resolveEntityId = (item) => {
              if (!item) return Math.random().toString();
              let id = item.dni || item.document_number || item.documentNumber || item.nro_documento;
              if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
              id = item.codigo_entidad || item.customer_id || item.merchant_id || item.entity_id;
              if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
              id = item.cliente || item.full_name || item.merchant_name || item.nombre;
              return id ? String(id).trim().toUpperCase() : Math.random().toString();
          };

          const agrupado = {};
          arrData.forEach(item => {
            const id = resolveEntityId(item);
            if (!agrupado[id]) {
              agrupado[id] = { 
                ...item, 
                id_agrupacion: id, 
                total_alertas: 1, 
                monto_total_riesgo: parseFloat(item.monto || 0),
                locked_by: item.locked_by || null,
                locked_at: item.locked_at || null,
                fraud_type: item.fraud_type || null
              };
            } else {
              agrupado[id].total_alertas += 1;
              agrupado[id].monto_total_riesgo += parseFloat(item.monto || 0);
              
              if (item.fraud_type) agrupado[id].fraud_type = item.fraud_type; 

              if (item.locked_by) {
                agrupado[id].locked_by = item.locked_by;
                agrupado[id].locked_at = item.locked_at;
              }
              if (new Date(item.fecha || 0) > new Date(agrupado[id].fecha_ultima_compra || agrupado[id].fecha || 0)) {
                agrupado[id].fecha_ultima_compra = item.fecha || item.fecha_ultima_compra;
              }
            }
          });

          arrData = Object.values(agrupado).sort((a, b) => new Date(b.fecha_ultima_compra || b.fecha || 0) - new Date(a.fecha_ultima_compra || a.fecha || 0));

          const totalDesdeFila = arrData[0]?.total_count || data?.[0]?.total_count || data?.data?.[0]?.total_count;
          const infoPaginacion = data?.pagination ? data.pagination : {
            currentPage: paginaActual, pageSize,
            totalItems: totalDesdeFila ? parseInt(totalDesdeFila, 10) : arrData.length,
            totalPages: Math.ceil((totalDesdeFila ? parseInt(totalDesdeFila, 10) : arrData.length) / pageSize) || 1
          };

          setEntidades(arrData);
          setPaginacionInfo(infoPaginacion);
          setInputPagina(paginaActual.toString());
          setCargando(false);
        })
        .catch(error => {
          if (axios.isCancel(error) || error.name === 'CanceledError') return; 
          console.error("Error cargando tabla:", error);
          setEntidades([]);
          setPaginacionInfo(null);
          setCargando(false);
        });
    };

    cargarDatos();
    const intervalo = setInterval(cargarDatos, 30000);
    return () => { clearInterval(intervalo); controller.abort(); };
  }, [vistaActual, filtros, paginaActual, refreshTrigger, subTabFraud]);

  const procesarSaltoPagina = () => {
    const num = parseInt(inputPagina, 10);
    if (!isNaN(num) && paginacionInfo) {
      const paginaDestino = Math.max(1, Math.min(num, paginacionInfo.totalPages));
      setPaginaActual(paginaDestino);
      setInputPagina(paginaDestino.toString());
    } else setInputPagina(paginaActual.toString());
  };

  return (
    <div className="p-3 md:p-8 animate-fade-in h-full flex flex-col">
      <div className="bg-white md:rounded-2xl shadow-sm md:border border-gray-100 overflow-visible flex-1 flex flex-col">
        
        {/* 🚀 SUB-NAVEGACIÓN (SOLO PARA LA VISTA DE FRAUDE) */}
        {vistaActual === 'FRAUD' && (
          <div className="bg-white border-b border-gray-100 p-2 md:p-4 rounded-t-2xl shrink-0 flex gap-2 overflow-x-auto custom-scrollbar">
            <button 
              onClick={() => setSubTabFraud('PENDING')}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${subTabFraud === 'PENDING' ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'}`}
            >
              ⏳ Fraude por Confirmar
            </button>
            <button 
              onClick={() => setSubTabFraud('FRUSTRATED')}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${subTabFraud === 'FRUSTRATED' ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'}`}
            >
              🛡️ Fraudes Frustrados
            </button>
            <button 
              onClick={() => setSubTabFraud('MATERIALIZED')}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${subTabFraud === 'MATERIALIZED' ? 'bg-rose-100 text-rose-700 border border-rose-300 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'}`}
            >
              💸 Fraudes (Pérdidas/Asumidos)
            </button>
          </div>
        )}

        <div className="overflow-visible flex-1 bg-gray-50 md:bg-white relative">
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
              {cargando ? <tr><td colSpan="5" className="text-center py-12 text-gray-400 font-bold italic">Consultando entidades...</td></tr> : 
               entidades.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-500 italic">No se encontraron casos en esta bandeja.</td></tr> : 
               entidades.map((entidad, idx) => {
                  const idEntidadFinal = entidad.id_agrupacion || 'ID_ERROR';
                  
                  const lockedByClean = String(entidad.locked_by || '').trim().toLowerCase();
                  const miUsuarioClean = String(miUsuarioActual || '').trim().toLowerCase();
                  const isLockedBySomeoneElse = entidad.locked_by !== null && lockedByClean !== miUsuarioClean;

                  return (
                    <tr key={idEntidadFinal || `entidad-${idx}`} className={`hover:bg-gray-50 transition-colors group ${hoveredEntityId === idEntidadFinal ? 'relative z-50' : 'relative z-0'}`}>
                      <td className="px-6 py-4 text-gray-500">{entidad.fecha_ultima_compra || entidad.fecha ? new Date(entidad.fecha_ultima_compra || entidad.fecha).toLocaleString() : '—'}</td>
                      
                      <td className="px-6 py-4 font-bold text-gray-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{entidad.cliente || entidad.full_name || 'No registrado'}</span>
                          
                          {/* 🚀 BADGE VISUAL DE TIPIFICACIÓN DE FRAUDE */}
                          {entidad.fraud_type && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shadow-xs uppercase tracking-tight ${
                              entidad.fraud_type === 'FRAUD_FRUSTRATED' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                              entidad.fraud_type === 'FRAUD_MERCHANT_ASSUMED' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                              entidad.fraud_type === 'FRAUD_LOSS' ? 'bg-red-100 text-red-700 border border-red-300' :
                              'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {entidad.fraud_type === 'FRAUD_FRUSTRATED' ? '🛡️ Frustrado' :
                               entidad.fraud_type === 'FRAUD_MERCHANT_ASSUMED' ? '🏪 Asumido Comercio' :
                               entidad.fraud_type === 'FRAUD_LOSS' ? '💸 Pérdida' : entidad.fraud_type}
                            </span>
                          )}

                          {isLockedBySomeoneElse && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-black shadow-xs tracking-tight animate-pulse" title={`Bloqueado por ${entidad.locked_by} el ${entidad.locked_at ? new Date(entidad.locked_at).toLocaleString() : '—'}`}>
                              🔒 {entidad.locked_by.split('@')[0]}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal block mt-0.5">Doc: {entidad.dni || entidad.document_number || idEntidadFinal}</span>
                      </td>

                      <td className={`px-6 py-4 text-center relative ${hoveredEntityId === idEntidadFinal ? 'z-50' : 'z-0'}`}>
                        <div onMouseEnter={() => setHoveredEntityId(idEntidadFinal)} onMouseLeave={() => setHoveredEntityId(null)} className="inline-block relative">
                          <span className="bg-red-100 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 shadow-sm cursor-pointer block">{entidad.total_alertas || 1} alertas</span>
                          {hoveredEntityId === idEntidadFinal && <MiniAlertTooltip entityId={idEntidadFinal} idx={idx} vistaActual={vistaActual} subTabFraud={subTabFraud} />}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-power-purple text-right text-base">S/ {parseFloat(entidad.monto_total_riesgo || entidad.monto || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-power-purple font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity bg-power-purple/10 px-4 py-2 rounded-lg disabled:opacity-50"
                          disabled={!idEntidadFinal || idEntidadFinal === 'ID_ERROR'}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAbrirRevision(idEntidadFinal, entidad.dni || entidad.cliente, entidades);
                          }}>{isLockedBySomeoneElse ? 'Ver Expediente' : 'Revisar Entidad'}</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* VISTA MÓVIL DISPOSITIVOS RESPONSIVOS */}
          <div className="block md:hidden space-y-3 pb-4">
            {cargando ? <p className="text-center py-12 text-gray-400 font-bold italic">Consultando entidades...</p> : 
             entidades.length === 0 ? <p className="text-center py-12 text-gray-500 italic">No se encontraron casos en esta bandeja.</p> : 
             entidades.map((entidad, idx) => {
                const idEntidadFinal = entidad.id_agrupacion || 'ID_ERROR';
                
                const lockedByClean = String(entidad.locked_by || '').trim().toLowerCase();
                const miUsuarioClean = String(miUsuarioActual || '').trim().toLowerCase();
                const isLockedBySomeoneElse = entidad.locked_by !== null && lockedByClean !== miUsuarioClean;

                return (
                  <div key={idEntidadFinal || `card-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-gray-500">{entidad.fecha_ultima_compra ? new Date(entidad.fecha_ultima_compra).toLocaleString() : '—'}</span>
                      <div className={`relative ${hoveredEntityId === idEntidadFinal ? 'z-50' : 'z-0'}`} onMouseEnter={() => setHoveredEntityId(idEntidadFinal)} onMouseLeave={() => setHoveredEntityId(null)}>
                        <span className="bg-red-100 text-red-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-red-200 shadow-sm cursor-pointer block">{entidad.total_alertas || 1} alertas</span>
                        {hoveredEntityId === idEntidadFinal && <MiniAlertTooltip entityId={idEntidadFinal} idx={idx} vistaActual={vistaActual} subTabFraud={subTabFraud} />}
                      </div>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-800 text-base leading-tight flex items-center gap-2 flex-wrap">
                        <span>{entidad.cliente || 'No registrado'}</span>
                        
                        {/* 🚀 BADGE CONDICIONAL MÓVIL */}
                        {entidad.fraud_type && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shadow-xs uppercase tracking-tight ${
                            entidad.fraud_type === 'FRAUD_FRUSTRATED' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                            entidad.fraud_type === 'FRAUD_MERCHANT_ASSUMED' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                            entidad.fraud_type === 'FRAUD_LOSS' ? 'bg-red-100 text-red-700 border border-red-300' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {entidad.fraud_type === 'FRAUD_FRUSTRATED' ? '🛡️ Frustrado' :
                             entidad.fraud_type === 'FRAUD_MERCHANT_ASSUMED' ? '🏪 Asumido Comercio' :
                             entidad.fraud_type === 'FRAUD_LOSS' ? '💸 Pérdida' : entidad.fraud_type}
                          </span>
                        )}

                        {isLockedBySomeoneElse && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold animate-pulse">
                            🔒 {entidad.locked_by.split('@')[0]}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Doc: {entidad.dni || idEntidadFinal}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-50">
                      <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Riesgo Total</p><p className="font-black text-power-purple text-lg">S/ {parseFloat(entidad.monto_total_riesgo || 0).toFixed(2)}</p></div>
                      <button className="bg-power-purple text-white font-bold px-4 py-2.5 rounded-lg text-xs shadow-md active:scale-95 transition-transform disabled:opacity-50"
                        disabled={!idEntidadFinal || idEntidadFinal === 'ID_ERROR'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrirRevision(idEntidadFinal, entidad.dni || entidad.cliente, entidades);
                        }}>{isLockedBySomeoneElse ? 'Ver' : 'Revisar'}</button>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {!cargando && paginacionInfo && (
          <div className="bg-white border-t border-gray-100 p-3 md:p-4 flex flex-col md:flex-row items-center justify-between shrink-0 gap-3 md:gap-0">
            <p className="text-xs text-gray-500 text-center md:text-left">
              Mostrando pág <span className="font-bold text-gray-800">{paginacionInfo.currentPage}</span> de <span className="font-bold text-gray-800">{paginacionInfo.totalPages}</span>
            </p>
            <div className="flex items-center space-x-1.5 md:space-x-2 w-full md:w-auto justify-between md:justify-end">
              <button onClick={() => setPaginaActual(1)} disabled={paginacionInfo.currentPage === 1} className="px-2 md:px-3 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform">«</button>
              <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginacionInfo.currentPage === 1} className="px-3 md:px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform">Anterior</button>
              <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg shadow-sm">
                <span className="text-[10px] text-gray-400 uppercase font-medium hidden sm:inline">Ir a:</span>
                <input type="text" value={inputPagina} onChange={(e) => setInputPagina(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && procesarSaltoPagina()} onBlur={procesarSaltoPagina} className="w-8 md:w-10 text-center font-bold text-xs border border-gray-200 rounded p-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-power-purple" />
              </div>
              <button onClick={() => setPaginaActual(p => p + 1)} disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages} className="px-3 md:px-4 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform">Siguiente</button>
              <button onClick={() => setPaginaActual(paginacionInfo.totalPages)} disabled={paginacionInfo.currentPage >= paginacionInfo.totalPages} className="px-2 md:px-3 py-2 text-xs font-bold text-power-blue bg-white border border-power-blue/20 rounded-lg shadow-sm disabled:opacity-50 active:scale-95 transition-transform">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsTable;