import React, { useState, useEffect } from 'react';
import api from '../api';
import ReviewDrawer from './ReviewDrawer';

const EventsSearch = ({ isModal = false, onClose, initialDni = '', initialAppId = '', onSelectEvent = null }) => {
  const [searchParams, setSearchParams] = useState({
    dni: initialDni,
    celular: '',
    application_id: initialAppId,
    customer_id: '',
    alert_code: '',
    start_date: '',
    end_date: ''
  });
  
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [haBuscado, setHaBuscado] = useState(false);

  const [filtrosExpandidos, setFiltrosExpandidos] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('ALERTAS');
  
  const [alertToInspect, setAlertToInspect] = useState(null);

  // 🚀 ESTADOS PARA EL BOTÓN DE PÁNICO (Alerta Manual)
  const [eventoParaAlerta, setEventoParaAlerta] = useState(null);
  const [comentarioManual, setComentarioManual] = useState('');
  const [severidadManual, setSeveridadManual] = useState('HIGH');
  const [enviandoAlerta, setEnviandoAlerta] = useState(false);
  const [errorAlerta, setErrorAlerta] = useState('');

  const formatToInput = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.replace(' ', 'T').substring(0, 16);
  };

  const formatToApi = (inputStr) => {
    if (!inputStr) return '';
    return inputStr.replace('T', ' ') + ':00';
  };

  const shiftTime = (fieldName, minutesAmount) => {
    const currentValue = searchParams[fieldName];
    if (!currentValue) return;

    const standardizedStr = currentValue.replace(' ', 'T');
    const dateObj = new Date(standardizedStr);
    
    if (isNaN(dateObj.getTime())) return;

    dateObj.setMinutes(dateObj.getMinutes() + minutesAmount);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    const newApiStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    setSearchParams(prev => ({
      ...prev,
      [fieldName]: newApiStr
    }));
  };

  const ejecutarBusquedaDirecta = async (params, isManualSearch = false) => {
    setCargando(true);
    setError('');
    setHaBuscado(true);
    
    if (isManualSearch) {
      setFiltrosExpandidos(false);
    }
    
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value && String(value).trim()) {
          query.append(key, String(value).trim());
        }
      });

      const res = await api.get(`/api/v1/events/search?${query.toString()}`);
      setEventos(res.data.data || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al procesar la auditoría temporal.';
      setError(msg);
      setEventos([]);
      if (isManualSearch) {
        setFiltrosExpandidos(true); 
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (initialDni || initialAppId) {
      const paramsCajon = {
        dni: initialDni,
        celular: '',
        application_id: initialAppId,
        customer_id: '',
        alert_code: '',
        start_date: '',
        end_date: ''
      };
      setSearchParams(paramsCajon);
      ejecutarBusquedaDirecta({ dni: initialDni, application_id: initialAppId }, false);
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const defaultStart = `${todayStr} 00:00:00`;
      const defaultEnd = `${todayStr} 23:59:59`;

      const paramsGenerales = {
        dni: '',
        celular: '',
        application_id: '',
        customer_id: '',
        alert_code: '',
        start_date: defaultStart,
        end_date: defaultEnd
      };

      setSearchParams(paramsGenerales);
      ejecutarBusquedaDirecta({ start_date: defaultStart, end_date: defaultEnd }, false);
    }
  }, [initialDni, initialAppId]);

  const handleInputChange = (e) => {
    setSearchParams({ ...searchParams, [e.target.name]: e.target.value });
    setError(''); 
  };

  const handleDateTimeChange = (e) => {
    const { name, value } = e.target;
    setSearchParams({
      ...searchParams,
      [name]: formatToApi(value) 
    });
    setError('');
  };

  const limpiarBusqueda = () => {
    setSearchParams({ dni: '', celular: '', application_id: '', customer_id: '', alert_code: '', start_date: '', end_date: '' });
    setEventos([]);
    setHaBuscado(false);
    setError('');
    setFiltrosExpandidos(true);
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    if (
      !searchParams.dni && !searchParams.celular && 
      !searchParams.application_id && !searchParams.customer_id &&
      !searchParams.alert_code &&
      !searchParams.start_date && !searchParams.end_date
    ) {
      setError('Debes proporcionar al menos un criterio de búsqueda o un rango de fechas explícito.');
      return;
    }
    ejecutarBusquedaDirecta(searchParams, true);
  };

  const abrirVisorForense = (evento) => {
    setSelectedEvent(evento);
    setActiveTab('ALERTAS');
  };

  // 🚀 FUNCIÓN PARA GATILLAR ALERTA MANUAL
  const generarAlertaManual = async (e) => {
    e.preventDefault();
    if (!comentarioManual.trim()) {
      setErrorAlerta("El comentario justificativo es obligatorio.");
      return;
    }

    setEnviandoAlerta(true);
    setErrorAlerta('');

    const payload = {
      customer_id: eventoParaAlerta.customer_id,
      application_id: eventoParaAlerta.application_id || '',
      review_comment: comentarioManual,
      severity: severidadManual
    };

    try {
      const res = await api.post('/api/v1/events/manual-alert', payload);
      alert(res.data?.message || '¡Alerta generada con éxito! Ya se encuentra en la bandeja de En Revisión.');
      setEventoParaAlerta(null);
      setComentarioManual('');
      setSeveridadManual('HIGH');
    } catch (err) {
      setErrorAlerta(err.response?.data?.error || err.response?.data?.message || 'Error al intentar generar la alerta manual.');
    } finally {
      setEnviandoAlerta(false);
    }
  };

  const totalEncontrados = eventos.length;
  const totalConAlertas = eventos.filter(evt => evt.alerts_summary?.has_alerts).length;

  return (
    <div className={`flex flex-col h-full animate-fade-in ${isModal ? 'w-full h-full' : 'p-4 md:p-6 max-w-7xl mx-auto'}`}>
      
      <div className="mb-4 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-power-blue flex items-center gap-2">
            <span className="text-amber-500">⚡</span> Buscador Forense de Eventos
          </h2>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">Inspección pormenorizada de cargas útiles, marcas de tiempo Perú y respuestas de la caja negra.</p>
          
          {haBuscado && !cargando && (
            <div className="flex flex-wrap gap-2.5 mt-3 animate-fade-in">
              <span className="bg-power-purple/10 text-power-purple border border-power-purple/20 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
                🔎 Eventos Evaluados: {totalEncontrados}
              </span>
              {totalConAlertas > 0 ? (
                <span className="bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
                  ⚠️ Alertas en este lote: {totalConAlertas}
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
                  ✅ Tráfico 100% Limpio
                </span>
              )}
            </div>
          )}
        </div>
        
        {isModal && (
          <button onClick={onClose} className="bg-white border border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95">
            ✕
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl mb-6 shadow-sm overflow-hidden transition-all shrink-0">
        <div 
          className="px-5 py-3 bg-slate-50 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
          onClick={() => setFiltrosExpandidos(!filtrosExpandidos)}
        >
          <span className="text-[11px] font-black text-power-blue uppercase tracking-widest flex items-center gap-2">
            <span>🔍</span> Parámetros de Auditoría Forense
          </span>
          <button type="button" className="text-slate-500 font-bold text-xs bg-white px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1">
            {filtrosExpandidos ? (
              <>Contraer <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg></>
            ) : (
              <>Expandir <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></>
            )}
          </button>
        </div>

        {filtrosExpandidos && (
          <div className="p-5 animate-fade-in">
            <form onSubmit={handleBuscar} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">DNI Cliente</label>
                  <input type="text" name="dni" value={searchParams.dni} onChange={handleInputChange} placeholder="Ej: 46789012" className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Celular Actual</label>
                  <input type="text" name="celular" value={searchParams.celular} onChange={handleInputChange} placeholder="Ej: 999888777" className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">ID Solicitud (App)</label>
                  <input type="text" name="application_id" value={searchParams.application_id} onChange={handleInputChange} placeholder="Ej: APP-88452" className="w-full p-2 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Customer ID</label>
                  <input type="text" name="customer_id" value={searchParams.customer_id} onChange={handleInputChange} placeholder="Ej: cust-9923..." className="w-full p-2 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-power-purple uppercase tracking-wider mb-1">Cód. Alerta (Regla)</label>
                  <input type="text" name="alert_code" value={searchParams.alert_code} onChange={handleInputChange} placeholder="Ej: RP03" className="w-full p-2 border border-power-purple/30 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-power-purple bg-power-purple/5 focus:bg-white transition-colors" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Fecha/Hora Desde</label>
                  <input type="datetime-local" name="start_date" value={formatToInput(searchParams.start_date)} onChange={handleDateTimeChange} className="w-full p-2 border border-gray-200 rounded-xl text-xs font-sans outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors text-gray-700 font-bold" />
                  <div className="flex items-center justify-between gap-1 mt-1.5 px-0.5">
                    <button type="button" onClick={() => shiftTime('start_date', -60)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Restar 1 hora">-1h</button>
                    <button type="button" onClick={() => shiftTime('start_date', -15)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Restar 15 minutos">-15m</button>
                    <button type="button" onClick={() => shiftTime('start_date', 15)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Sumar 15 minutos">+15m</button>
                    <button type="button" onClick={() => shiftTime('start_date', 60)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Sumar 1 hora">+1h</button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Fecha/Hora Hasta</label>
                  <input type="datetime-local" name="end_date" value={formatToInput(searchParams.end_date)} onChange={handleDateTimeChange} className="w-full p-2 border border-gray-200 rounded-xl text-xs font-sans outline-none focus:ring-2 focus:ring-power-purple bg-gray-50 focus:bg-white transition-colors text-gray-700 font-bold" />
                  <div className="flex items-center justify-between gap-1 mt-1.5 px-0.5">
                    <button type="button" onClick={() => shiftTime('end_date', -60)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Restar 1 hora">-1h</button>
                    <button type="button" onClick={() => shiftTime('end_date', -15)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Restar 15 minutos">-15m</button>
                    <button type="button" onClick={() => shiftTime('end_date', 15)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Sumar 15 minutos">+15m</button>
                    <button type="button" onClick={() => shiftTime('end_date', 60)} className="text-[9px] font-black text-gray-500 bg-gray-100 hover:bg-slate-200 px-1 py-0.5 rounded transition-colors" title="Sumar 1 hora">+1h</button>
                  </div>
                </div>
              </div>

              {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold animate-fade-in mt-2">🛑 {error}</div>}

              <div className="flex justify-end gap-2.5 mt-2 pt-5 border-t border-gray-100">
                <button type="button" onClick={limpiarBusqueda} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 text-xs transition-colors active:scale-95">Limpiar</button>
                <button type="submit" disabled={cargando} className="px-6 py-2 rounded-xl font-bold bg-power-purple text-white text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {cargando ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '🔍 Ejecutar Auditoría'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-[250px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead className="bg-slate-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-black sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3.5">Fecha/Hora (Lima)</th>
                <th className="px-5 py-3.5">Cliente / Identidad</th>
                <th className="px-5 py-3.5">ID Solicitud / DNI</th>
                <th className="px-5 py-3.5">Contacto Principal</th>
                <th className="px-5 py-3.5">Tipo Evento</th>
                <th className="px-5 py-3.5 text-center">Resolución Motor</th>
                <th className="px-5 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-gray-100">
              {cargando ? (
                <tr><td colSpan="7" className="text-center py-20 text-gray-400 font-bold italic">Extrayendo logs del motor transaccional...</td></tr>
              ) : eventos.length === 0 && haBuscado ? (
                <tr><td colSpan="7" className="text-center py-20 text-gray-500 italic font-medium">No se localizaron eventos en el segmento de tiempo especificado.</td></tr>
              ) : eventos.length === 0 && !haBuscado ? (
                <tr><td colSpan="7" className="text-center py-20 text-gray-400 italic font-medium">Establece un rango horario y presiona buscar.</td></tr>
              ) : (
                eventos.map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3 font-mono">
                      <p className="font-bold text-gray-800">{evt.dates?.lima?.split(',')[0]}</p>
                      <p className="text-[10px] text-power-purple font-bold mt-0.5">{evt.dates?.lima?.split(',')[1]?.trim()}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-black text-gray-800 uppercase tracking-tight">
                        {evt.customer_details?.full_name || 'TITULAR NO REGISTRADO'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">Cust ID: {evt.customer_id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-power-blue font-mono">{evt.application_id}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-bold">DNI: {evt.customer_details?.dni || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700">{evt.customer_details?.celular || 'N/A'}</span>
                        {evt.customer_details?.previous_phone && (
                          <div className="relative flex items-center cursor-help">
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide uppercase shadow-2xs">
                              Historial
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                        {evt.event_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {evt.alerts_summary?.has_alerts ? (
                        <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                          <span className="text-rose-500 text-[10px]">⚠️</span>
                          <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">{evt.alerts_summary.total_alerts} Alertas</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                          <span className="text-emerald-500 text-[10px]">✅</span>
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Limpio</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {onSelectEvent ? (
                        <button 
                          onClick={() => onSelectEvent(evt)} 
                          className="text-white font-black text-[11px] bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 whitespace-nowrap"
                        >
                          ⚡ Seleccionar
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {/* 🚀 BOTÓN DE PÁNICO (Alerta Manual) */}
                          <button 
                            onClick={() => setEventoParaAlerta(evt)} 
                            className="text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold text-[10px] px-2 py-1 rounded-md transition-colors shadow-xs flex items-center gap-1 active:scale-95"
                            title="Generar Alerta de Fraude Manual"
                          >
                            🚨 Gatillar Alerta
                          </button>
                          
                          <button 
                            onClick={() => abrirVisorForense(evt)} 
                            className="text-power-purple font-black text-[11px] bg-power-purple/5 hover:bg-power-purple/10 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap border border-power-purple/20 active:scale-95"
                          >
                            Ver Trama
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 MODAL: GENERACIÓN DE ALERTA MANUAL */}
      {eventoParaAlerta && (
        <div className="fixed inset-0 bg-slate-900/70 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-4 flex justify-between items-center">
              <h3 className="text-rose-700 font-black flex items-center gap-2 text-lg">
                <span>🚨</span> Botón de Pánico 
              </h3>
              <button onClick={() => setEventoParaAlerta(null)} className="text-gray-400 hover:bg-white hover:text-rose-600 w-8 h-8 rounded-full flex items-center justify-center transition-colors font-bold shadow-xs border border-transparent hover:border-gray-200">✕</button>
            </div>
            
            <form onSubmit={generarAlertaManual} className="p-5">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Estás a punto de saltarte el motor de reglas y crear una alerta manual para el cliente <strong className="text-gray-800">{eventoParaAlerta.customer_details?.full_name || 'Desconocido'}</strong>. Esta alerta pasará directamente a la bandeja <strong className="text-rose-600">En Revisión</strong>.
              </p>

              {errorAlerta && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span>🛑</span> {errorAlerta}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Nivel de Severidad</label>
                  <select 
                    value={severidadManual} 
                    onChange={(e) => setSeveridadManual(e.target.value)} 
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-gray-50 font-bold text-gray-700"
                  >
                    <option value="CRITICAL">🔴 Crítico (Riesgo inminente)</option>
                    <option value="HIGH">🟠 Alto</option>
                    <option value="MEDIUM">🟡 Medio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">Justificación Obligatoria</label>
                  <textarea 
                    required
                    rows="3"
                    value={comentarioManual}
                    onChange={(e) => setComentarioManual(e.target.value)}
                    placeholder="Explica por qué estás levantando esta alerta manualmente..."
                    className="w-full p-3 border border-rose-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-rose-50/30 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setEventoParaAlerta(null)} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 text-xs transition-colors">Cancelar</button>
                <button type="submit" disabled={enviandoAlerta || !comentarioManual.trim()} className="px-6 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {enviandoAlerta ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '🚨 Generar Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE CAJA NEGRA EN 3 PESTAÑAS */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col border border-gray-200 overflow-hidden">
            
            <div className="bg-slate-950 p-4 flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Inspección Forense de Cargas Útiles</h3>
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">{selectedEvent.event_type}</span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">Cliente: {selectedEvent.customer_details?.full_name || 'No registrado'} | Solicitud: {selectedEvent.application_id}</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white bg-slate-800 hover:bg-rose-600 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs">✕</button>
            </div>

            <div className="flex bg-slate-900 border-b border-slate-800 shrink-0 px-2 pt-1.5 gap-1">
              {[
                { id: 'ALERTAS', label: '⚠️ Alertas Disparadas' },
                { id: 'INPUT', label: '📥 JSON Entrada (Recepción)' },
                { id: 'OUTPUT', label: '📤 JSON Salida (Respuesta ARIC)' }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-t-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-colors ${activeTab === tab.id ? 'bg-white text-power-blue' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 bg-white overflow-auto p-4 md:p-5">
              {activeTab === 'ALERTAS' && (
                <div className="animate-fade-in">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b">Estatus de Reglas Detonadas por el Motor</h4>
                  {!selectedEvent.alerts_summary?.has_alerts || selectedEvent.alerts_summary.details.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 shadow-2xs">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="font-black text-sm">Transacción Limpia</p>
                        <p className="text-xs mt-0.5">El motor de fraude no gatilló ninguna alerta frente a esta solicitud.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-gray-200 rounded-xl shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase text-gray-400 font-bold">
                          <tr>
                            <th className="px-4 py-2.5">Alert ID</th>
                            <th className="px-4 py-2.5">Código de Regla</th>
                            <th className="px-4 py-2.5">Estado Actual</th>
                            <th className="px-4 py-2.5">Fecha Captura (UTC)</th>
                            <th className="px-4 py-2.5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                          {selectedEvent.alerts_summary.details.map((al, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2.5 font-mono text-gray-500 font-bold">#{al.alert_id}</td>
                              <td className="px-4 py-2.5 font-black text-power-purple">{al.rule_code}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${al.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-200' : al.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                  {al.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 font-mono">{al.created_at}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button 
                                  onClick={() => setAlertToInspect(al)}
                                  className="text-[10px] font-black bg-power-blue text-white px-3 py-1.5 rounded-lg hover:bg-power-blue/90 transition-colors shadow-sm active:scale-95"
                                >
                                  🔍 Inspeccionar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'INPUT' || activeTab === 'OUTPUT') && (
                <div className="h-full flex flex-col animate-fade-in bg-[#282c34] rounded-xl overflow-hidden border border-slate-700 shadow-inner">
                  <div className="bg-slate-800 px-4 py-2 border-b border-slate-900 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-widest uppercase">
                      {activeTab === 'INPUT' ? 'payload.recepcion.json' : 'payload.respuesta.json'}
                    </span>
                  </div>
                  <div className="p-4 overflow-auto flex-1 text-xs font-mono text-gray-300 leading-relaxed scrollbar-thin">
                    <pre>
                      <code>
                        {JSON.stringify(
                          activeTab === 'INPUT' ? selectedEvent.payloads?.recepcion : selectedEvent.payloads?.respuesta,
                          null,
                          2
                        )}
                      </code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

     {/* RENDERIZADO DEL CAJÓN DE REVISIÓN EN MODO SOLO LECTURA FORENSE */}
     {alertToInspect && (
        <div className="relative z-[300]">
          <ReviewDrawer 
            isOpen={!!alertToInspect} 
            onClose={() => setAlertToInspect(null)} 
            alertId={selectedEvent?.customer_id || selectedEvent?.customer_details?.dni}
            estadoActual={alertToInspect.status || 'OPEN'}
            isReadOnlyContext={true}
            targetAlertId={alertToInspect.alert_id} 
          />
        </div>
      )}

    </div>
  );
};

export default EventsSearch;