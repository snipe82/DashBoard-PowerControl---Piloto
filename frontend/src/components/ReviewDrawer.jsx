import React, { useState, useEffect, useRef } from 'react';
import api from '../api'; 
// 🚀 IMPORTACIÓN CRÍTICA: Traemos el módulo forense para el despliegue en paralelo
import EventsSearch from './EventsSearch';

const traducirEstado = (estado) => {
  const diccionario = {
    'OPEN': 'Abierta',
    'IN_REVIEW': 'En revisión',
    'ADDITIONAL_REVIEW': 'En revisión adicional',
    'SUSPICIOUS': 'Sospechosa',
    'FRAUD': 'Fraude Confirmado',
    'DISCARDED': 'Descartada (Falso Positivo)'
  };
  return diccionario[estado?.toUpperCase()] || estado || '—';
};

const RESPUESTAS_RAPIDAS = [
  "CLIENTE PASO BIOMETRIA PREVIAMENTE",
  "COINCIDE MOVIL CON TITULAR - YAPE",
  "COINCIDE MOVIL CON TITULAR - PLIN",
  "EN INVESTIGACIÓN"
];

const ReviewDrawer = ({ 
  isOpen, 
  onClose, 
  alertId: entityId, 
  clienteContexto, 
  estadoActual, 
  recargarTabla,
  onAnterior,
  onSiguiente,
  hayAnterior = false,
  haySiguiente = false
}) => {
  const [info, setInfo] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [rawResponse, setRawResponse] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [payloadData, setPayloadData] = useState(null);
  const [cargandoPayload, setCargandoPayload] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [comentario, setComentario] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('IN_REVIEW');

  const [tengoCandado, setTengoCandado] = useState(false);
  const [bloqueadoPorOtro, setBloqueadoPorOtro] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState('');
  
  const [esInmutable, setEsInmutable] = useState(false);

  // 🚀 CONTROL DE VISOR PARALELO
  const [showParallelEvents, setShowParallelEvents] = useState(false);

  const tengoCandadoRef = useRef(false);
  const idCandadoRef = useRef(null);
  const seGuardoExitosamenteRef = useRef(false);
  const formDictamenRef = useRef(null);
  const lastEstadoRef = useRef(estadoActual);
  
  const intentoDeLockRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (estadoActual !== lastEstadoRef.current) {
        onClose();
      }
    } else {
      lastEstadoRef.current = estadoActual;
      // 🧹 LIMPIEZA: Si cierran el cajón, reseteamos el visor paralelo
      setShowParallelEvents(false);
    }
  }, [isOpen, estadoActual, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (!entityId) {
        setCargando(false);
        setRawResponse({ error: "Identificador inválido." });
        return;
      }

      setCargando(true);
      setRawResponse(null);
      setInfo(null);
      setAlertas([]);
      setSelectedAlertId(null);
      setPayloadData(null);
      setHistorial([]);

      const cleanEntityId = String(entityId).trim();
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanEntityId);

      let urlEndpoint = `/api/alerts/entity/${cleanEntityId}?status=${estadoActual}`;
      if (!esUUID) {
        urlEndpoint = `/api/alerts/dni/${cleanEntityId}?status=${estadoActual}`;
      }

      api.get(urlEndpoint)
        .then(res => {
          const resJson = res.data;
          setRawResponse(resJson);

          let rawAlerts = [];
          if (Array.isArray(resJson)) {
            rawAlerts = resJson;
          } else if (resJson && Array.isArray(resJson.data)) {
            rawAlerts = resJson.data;
          } else if (resJson && typeof resJson === 'object') {
            const obj = resJson.data || resJson;
            if (obj && (obj.alert_id || obj.fecha || obj.monto || obj.dni || obj.cliente)) {
              rawAlerts = [obj];
            }
          }

          const alertsFiltered = rawAlerts.filter(al => {
            const s = al.status || al.estado;
            return !s || String(s).toUpperCase() === String(estadoActual).toUpperCase();
          });

          const sortedAlerts = [...alertsFiltered].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
          let infoObj = null;

          if (sortedAlerts.length > 0) {
            const primero = sortedAlerts[0];
            const ultimo = sortedAlerts[sortedAlerts.length - 1];
            const nombreEntidad = primero.entidad && typeof primero.entidad === 'string' ? primero.entidad.toLowerCase() : '';
            const esComercio = nombreEntidad.includes('comercio') || nombreEntidad.includes('merch');

            const txProcesadas = new Set();
            let totalMontoReal = 0;

            sortedAlerts.forEach(al => {
              const fechaSinSegundos = al.fecha ? new Date(al.fecha).setSeconds(0, 0) : '0';
              const txKey = al.transaction_id || al.operacion_id || al.payment_id || al.id_transaccion || `${fechaSinSegundos}_${al.monto}`;
              if (!txProcesadas.has(txKey)) {
                txProcesadas.add(txKey);
                totalMontoReal += parseFloat(al.monto || 0);
              }
            });

            const primeraCompra = resJson.fecha_primera_alerta || primero.fecha_primera_alerta || ultimo.fecha;
            const ultimaCompra = resJson.fecha_ultima_alerta || primero.fecha_ultima_alerta || primero.fecha;
            const statusEntidad = resJson.status || resJson.estado || primero.estado || primero.status || estadoActual;
            const idEntidadFinal = primero.codigo_entidad || primero.customer_id || primero.merchant_id || cleanEntityId;

            infoObj = {
              entidad_tipo: primero.entidad || 'customer',
              display_label: esComercio ? 'Comercio / Tienda' : 'Titular / Cliente',
              display_name: esComercio ? (primero.tienda || 'Comercio Registrado') : (primero.cliente || primero.full_name || 'No registrado'),
              id_label: 'Código de Entidad',
              id_value: idEntidadFinal,
              monto_total: totalMontoReal,
              codigo_entidad: idEntidadFinal,
              tipo_evento: primero.event_type || primero.tipo_evento || '—',
              entidad_nombre: primero.entidad || '—',
              fecha_primera: primeraCompra,
              fecha_ultima: ultimaCompra,
              status: statusEntidad
            };

            const alertaPorDefecto = sortedAlerts.find(al =>
              (al.dni && al.dni === clienteContexto) ||
              (al.document_number && al.document_number === clienteContexto) ||
              (al.cliente && al.cliente === clienteContexto) ||
              (al.full_name && al.full_name === clienteContexto)
            ) || sortedAlerts[0];

            if (alertaPorDefecto) {
              setSelectedAlertId(alertaPorDefecto.alert_id);
              setComentario(alertaPorDefecto.review_comment || alertaPorDefecto.comentario || alertaPorDefecto.comment || '');
            }
          }

          setInfo(infoObj);
          setAlertas(sortedAlerts);
          setNuevoEstado(estadoActual === 'OPEN' ? 'IN_REVIEW' : estadoActual);
          setCargando(false);
        })
        .catch(err => {
          console.error("❌ Error decodificando respuesta de entidad:", err);
          setRawResponse({ error_catch: err.message });
          setCargando(false);
        });
    }
  }, [isOpen, entityId, clienteContexto, estadoActual]);

  useEffect(() => {
    seGuardoExitosamenteRef.current = false;

    if (!selectedAlertId || !isOpen) {
      setBloqueadoPorOtro(false);
      setMensajeBloqueo('');
      setTengoCandado(false);
      setEsInmutable(false);
      tengoCandadoRef.current = false;
      idCandadoRef.current = null;
      intentoDeLockRef.current = null; 
      return;
    }

    if (intentoDeLockRef.current === selectedAlertId) {
      return; 
    }
    
    intentoDeLockRef.current = selectedAlertId;
    setBloqueadoPorOtro(false);
    setMensajeBloqueo('');
    setEsInmutable(false);

    let isDrawerActive = true; 

    const lockTimeoutId = setTimeout(() => {
      api.post(`/api/alerts/${selectedAlertId}/lock`)
        .then(() => {
          if (!isDrawerActive) {
            api.post(`/api/alerts/${selectedAlertId}/unlock`).catch(() => null);
          } else {
            setTengoCandado(true);
            tengoCandadoRef.current = true;
            idCandadoRef.current = selectedAlertId;
          }
        })
        .catch(err => {
          if (!isDrawerActive) return; 
          
          setTengoCandado(false);
          tengoCandadoRef.current = false;
          idCandadoRef.current = null;
          
          if (err.response && err.response.status === 409) {
            console.warn("[PowerControl] 409 Conflict:", err.response.data);
            setBloqueadoPorOtro(true);
            setEsInmutable(false);
            setMensajeBloqueo(err.response.data?.error || err.response.data?.message || 'Esta alerta ya está siendo revisada por otro analista.');
          } else if (err.response && err.response.status === 400) {
            setBloqueadoPorOtro(true);
            setEsInmutable(true); 
            setMensajeBloqueo(err.response.data?.error || err.response.data?.message || 'La alerta se encuentra en un estado inmutable de solo lectura.');
          }
        });
    }, 400);

    return () => {
      isDrawerActive = false; 
      intentoDeLockRef.current = null; 
      clearTimeout(lockTimeoutId);
      
      const idALiberar = idCandadoRef.current;
      const teniaCandado = tengoCandadoRef.current;
      
      if (teniaCandado && idALiberar && !seGuardoExitosamenteRef.current) {
        api.post(`/api/alerts/${idALiberar}/unlock`).catch(() => null);
      }
    };
  }, [selectedAlertId, isOpen]);

  useEffect(() => {
    const handleUnload = () => {
      const idALiberar = idCandadoRef.current;
      const teniaCandado = tengoCandadoRef.current;
      
      if (teniaCandado && idALiberar && !seGuardoExitosamenteRef.current) {
        const baseUrl = api.defaults.baseURL || window.location.origin;
        const url = `${baseUrl}/api/alerts/${idALiberar}/unlock`;
        navigator.sendBeacon(url); 
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  useEffect(() => {
    if (selectedAlertId) {
      setCargandoPayload(true);
      api.get(`/api/alerts/${selectedAlertId}/payload`)
        .then(res => {
          const pData = res.data;
          setPayloadData(pData);
          if (pData?.review_comment || pData?.comentario || pData?.comment) {
            setComentario(pData.review_comment || pData.comentario || pData.comment);
          }
          setCargandoPayload(false);
        })
        .catch(err => {
          console.error("Error trayendo payload:", err);
          setPayloadData(null);
          setCargandoPayload(false);
        });
    } else {
      setPayloadData(null);
    }
  }, [selectedAlertId]);

  useEffect(() => {
    const alertaActivaEnLista = alertas.find(a => a.alert_id === selectedAlertId);
    let targetCustomerId = payloadData?.customerid || payloadData?.customerId || payloadData?.customer_id || alertaActivaEnLista?.customer_id || alertaActivaEnLista?.codigo_entidad;
    
    if (!targetCustomerId && info?.id_value) {
      targetCustomerId = info.id_value;
    }

    if (targetCustomerId) {
      setCargandoHistorial(true);
      api.get(`/api/v1/alerts/customer/${targetCustomerId}/audit`)
        .then(res => {
          const hData = res.data;
          const listaEventosUnificada = hData?.data?.data || hData?.data || [];
          setHistorial(listaEventosUnificada);
          setCargandoHistorial(false);
        })
        .catch(err => {
          console.error(`Error trayendo historial para cliente ${targetCustomerId}:`, err);
          setHistorial([]);
          setCargandoHistorial(false);
        });
    } else {
      setHistorial([]);
    }
  }, [selectedAlertId, payloadData, alertas, info?.id_value]);

  const alertaActiva = alertas.find(a => a.alert_id === selectedAlertId);
  const alertasDelCliente = alertaActiva ? alertas.filter(a => (a.dni && a.dni === alertaActiva.dni) || (a.cliente && a.cliente === alertaActiva.cliente)) : alertas;
  const cantidadAlertasCliente = alertasDelCliente.length;
  const totalAlertasCargadas = alertas.length;

  const telefonoNativoEnLista = alertas.find(a => a.celular || a.telefono || a.phone || a.mobile);
  const rawTelefonoEncontrado = telefonoNativoEnLista ? (telefonoNativoEnLista.celular || telefonoNativoEnLista.telefono || telefonoNativoEnLista.phone || telefonoNativoEnLista.mobile) : '';

  const guardarRevisionMasiva = async () => {
    if (!comentario) return alert("Por favor, ingresa un comentario justificativo.");
    if (!alertaActiva) return alert("Por favor, selecciona un evento del historial.");
    if (cargandoPayload) return alert("Por favor, espera a que cargue la información del evento seleccionado.");
    if (!payloadData) return alert("El payload aún no ha cargado o está vacío.");

    let idParaRuta = payloadData.customerid || payloadData.customerId || payloadData.customer_id;
    if (!idParaRuta) idParaRuta = payloadData.document_number || payloadData.dni || alertaActiva.dni || alertaActiva.document_number;
    if (!idParaRuta) return alert("Error crítico: No se encontró el campo 'customerid' ni 'dni' en el Payload JSON de esta alerta.");

    const cleanIdParaRuta = String(idParaRuta).trim();
    const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanIdParaRuta);
    const reviewUrl = esUUID ? `/api/alerts/entity/${cleanIdParaRuta}/review` : `/api/alerts/dni/${cleanIdParaRuta}/review`;

    const userSession = JSON.parse(localStorage.getItem('user') || '{}');
    const analistaResponsable = userSession.email || userSession.username || "analista@powerpay.pe";

    const body = {
      status: nuevoEstado,
      reviewer_id: analistaResponsable,
      review_comment: comentario,
      entity_parent_id: String(entityId).trim(),
      target_dni: alertaActiva.dni || alertaActiva.document_number || null,
      target_cliente: alertaActiva.cliente || alertaActiva.full_name || null
    };

    try {
      const res = await api.patch(reviewUrl, body);
      if (res.status === 200 || res.status === 201) {
        seGuardoExitosamenteRef.current = true;
        if (haySiguiente && onSiguiente) onSiguiente();
        else onClose();
        setTimeout(() => { recargarTabla(); }, 800);
      }
    } catch (e) {
      alert(e.response?.data?.message || "Error de red al intentar guardar la revisión.");
    }
  };

  const esSoloLectura = estadoActual === 'DISCARDED' || bloqueadoPorOtro;
  const scrollToDictamen = () => { formDictamenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const agregarRespuestaRapida = (frase) => { setComentario(prev => prev ? `${prev} - ${frase}` : frase); };

  // 🧠 🌟 CRÍTICO: El DNI apunta SIEMPRE al DNI de la alerta actualmente seleccionada en el historial
  const dniParaParallelLookup = alertaActiva?.dni || alertaActiva?.document_number || info?.id_value || '';
  const appIdParaParallelLookup = payloadData?.application_id || payloadData?.applicationId || '';

  return (
    <>
      {/* CAPA DE FONDO (BACKDROP) */}
      <div 
        className={`fixed inset-0 z-40 bg-black transition-opacity ${isOpen ? 'visible' : 'invisible'} ${showParallelEvents ? 'opacity-15' : 'opacity-50'}`} 
        onClick={onClose}
      />

      {/* CONTENEDOR ENVOLVENTE INTEGRAL EN PARALELO */}
      <div className={`fixed inset-0 z-50 flex justify-end overflow-hidden pointer-events-none ${isOpen ? 'visible' : 'invisible'}`}>

        {/* 🚀 EL PANEL COMPAÑERO IZQUIERDO: Despliega el módulo forense en paralelo */}
        {showParallelEvents && (
          <div className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 shadow-2xl p-4 md:p-6 overflow-y-auto pointer-events-auto z-50 animate-slide-in-left w-full md:w-1/3 lg:w-3/5">
            <EventsSearch 
              isModal={true} 
              onClose={() => setShowParallelEvents(false)} 
              initialDni={dniParaParallelLookup}       // 👈 Envía el DNI de la alerta activa en caliente
              initialAppId={appIdParaParallelLookup}   // 👈 Envía el ID de Solicitud en caliente
            />
          </div>
        )}

        {/* EL CAJÓN DE REVISIÓN ORIGINAL */}
        <div className={`relative h-full w-full md:w-2/3 lg:w-2/5 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col pointer-events-auto z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="flex justify-between items-center border-b p-3 md:p-5 bg-white shrink-0 z-20 shadow-sm">
            <h3 className="text-xl font-bold text-power-blue truncate pr-2">Revisión de Entidad</h3>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-200 mr-1 md:mr-2 shadow-sm">
                <button onClick={onAnterior} disabled={!hayAnterior} className="px-2.5 py-1.5 text-gray-500 hover:text-power-purple hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95" title="Caso Anterior">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="w-[1px] bg-gray-200 my-1 mx-0.5"></div>
                <button onClick={onSiguiente} disabled={!haySiguiente} className="px-2.5 py-1.5 text-gray-500 hover:text-power-purple hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95" title="Caso Siguiente">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>

              {/* 🚀 🌟 BOTÓN ACTUALIZADO: "Eventos" */}
              <button 
                onClick={() => setShowParallelEvents(!showParallelEvents)}
                className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm border transition-all active:scale-95 ${
                  showParallelEvents 
                    ? 'bg-amber-500 text-white border-amber-600' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Cruzar tramas JSON de este cliente a la izquierda en tiempo real"
              >
                <span className={showParallelEvents ? 'text-white' : 'text-amber-500'}>⚡</span> 
                {showParallelEvents ? 'Ocultar Eventos' : 'Eventos'}
              </button>

              <button onClick={scrollToDictamen} className="text-[10px] md:text-xs bg-power-purple/10 text-power-purple px-3 py-1.5 rounded-full font-bold hover:bg-power-purple/20 transition-colors flex items-center gap-1 shadow-sm active:scale-95 border border-power-purple/20">
                ⬇️ <span className="hidden sm:inline">Dictamen</span>
              </button>
              <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 hover:text-gray-600 font-bold text-xl active:scale-90 w-8 h-8 flex items-center justify-center rounded-full transition-colors ml-1">✕</button>
            </div>
          </div>

          <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50">
          {cargando ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
               <div className="w-10 h-10 border-4 border-power-purple/30 border-t-power-purple rounded-full animate-spin"></div>
               <p className="text-gray-400 italic font-medium animate-pulse">Cargando expediente de la entidad...</p>
            </div>
          ) : (
            <div className="space-y-6">

              {bloqueadoPorOtro && (
                <div className={`border text-xs font-bold p-3.5 rounded-xl flex items-center gap-2.5 shadow-sm animate-fade-in ${
                  esInmutable 
                    ? 'bg-slate-100 border-slate-300 text-slate-800' 
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  <span className="text-base">{esInmutable ? '👁️' : '🔒'}</span>
                  <div>
                    <p className={`font-black uppercase tracking-wider text-[10px] mb-0.5 ${esInmutable ? 'text-slate-500' : 'text-amber-600'}`}>
                      {esInmutable ? 'Expediente Histórico (Solo Lectura)' : 'Control de Concurrencia'}
                    </p>
                    <p className="font-medium text-slate-700">{mensajeBloqueo}</p>
                  </div>
                </div>
              )}

              {info ? (
                <>
                  <div className="bg-white rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-4 shadow-sm text-sm">
                    <div className="col-span-2 border-b border-gray-100 pb-2 mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">{info.display_label}</p>
                        <p className="text-lg font-black text-gray-800 leading-tight">{info.display_name}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded shadow-xs ml-2 shrink-0 ${
                          info.status === 'FRAUD' ? 'bg-red-50 text-red-600 border border-red-200' :
                          info.status === 'DISCARDED' ? 'bg-gray-50 text-gray-600 border border-gray-200' :
                          info.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          info.status === 'ADDITIONAL_REVIEW' ? 'bg-purple-50 text-power-purple border border-purple-200' :
                          'bg-blue-50 text-blue-600 border border-blue-200'
                        }`}>
                        {traducirEstado(info.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{info.id_label}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="font-bold text-slate-700 font-mono text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-200 truncate max-w-[120px] md:max-w-[140px]" title={info.id_value}>
                          {info.id_value}
                        </p>
                        <button onClick={() => navigator.clipboard.writeText(info.id_value)} className="p-1 bg-white hover:bg-slate-100 text-slate-500 rounded border border-slate-200 shadow-xs hover:text-power-purple transition-all active:scale-95 text-xs flex items-center justify-center shrink-0" title="Copiar identificador completo">📋</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Riesgo Acumulado</p>
                      <p className="font-bold text-red-600 text-lg mt-0.5">S/ {parseFloat(info.monto_total || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">1° Compra</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-slate-50 px-1 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate" title={info.fecha_primera ? new Date(info.fecha_primera).toLocaleString() : '—'}>
                        {info.fecha_primera ? new Date(info.fecha_primera).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Última Compra</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-slate-50 px-1 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate" title={info.fecha_ultima ? new Date(info.fecha_ultima).toLocaleString() : '—'} >
                        {info.fecha_ultima ? new Date(info.fecha_ultima).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo Entidad</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate uppercase">
                        {info.entidad_nombre}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-slate-50 p-3 border-b border-gray-200 shrink-0">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Historial de Alertas ({totalAlertasCargadas})</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                      {alertas.map((al, idx) => {
                        const estaSeleccionado = selectedAlertId === al.alert_id;
                        const celularDelPayload = payloadData?.telephonenumber || payloadData?.phone || payloadData?.customer?.phone || payloadData?.mobile;
                        const phoneFinal = al.celular || al.telefono || al.phone || al.mobile || rawTelefonoEncontrado || celularDelPayload;
                        const textCelular = phoneFinal ? phoneFinal : (estaSeleccionado && cargandoPayload ? '⏳...' : 'No reg.');
                        const nombreComercio = al.tienda || al.comercio || al.merchant || al.merchant_name || '—';

                        return (
                          <div key={al.alert_id || `alerta-hija-${idx}`} onClick={() => setSelectedAlertId(al.alert_id)} className={`cursor-pointer rounded-xl border p-3.5 transition-all ${estaSeleccionado ? 'bg-power-purple/5 border-power-purple shadow-sm ring-1 ring-power-purple/30' : 'bg-white border-gray-200 hover:border-power-purple/40 hover:shadow-sm'}`}>
                             <div className="flex justify-between items-start mb-2">
                               <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                 <div className="mt-1 shrink-0"><input type="radio" checked={estaSeleccionado} readOnly className="h-3.5 w-3.5 text-power-purple focus:ring-power-purple border-gray-300 accent-power-purple cursor-pointer" /></div>
                                 <div className="min-w-0 flex-1">
                                   <div className="flex items-start gap-1.5 mb-1">
                                     <span className="font-mono text-[9px] md:text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase tracking-tight shrink-0 mt-0.5">{al.codigoregla}</span>
                                     <span className="text-[10px] md:text-[11px] font-black text-slate-700 break-all leading-snug" title={al.regla}>{al.regla || 'Alerta de riesgo'}</span>
                                   </div>
                                   <span className="text-[10px] md:text-[11px] text-gray-500 font-medium block">{new Date(al.fecha).toLocaleString()}</span>
                                 </div>
                               </div>
                               <div className="text-right shrink-0 ml-2"><span className="font-black text-gray-800 text-sm md:text-base block leading-tight">S/ {parseFloat(al.monto || 0).toFixed(2)}</span><span className="block text-[9px] md:text-[10px] text-slate-400 truncate max-w-[90px] md:max-w-[120px]" title={al.event_type}>{al.event_type || '—'}</span></div>
                             </div>
                             <div className="mb-2 bg-slate-50/80 rounded-lg p-2 md:p-2.5 border border-slate-100 text-[10px] md:text-[11px] space-y-1">
                               <div className="flex justify-between items-center"><span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">Comercio:</span><span className="font-medium text-gray-700 truncate text-right">{nombreComercio}</span></div>
                               <div className="flex justify-between items-center"><span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">Cliente:</span><span className="font-medium text-gray-700 truncate text-right">{al.cliente}</span></div>
                             </div>
                             <div className="flex items-center justify-between text-[10px] md:text-[11px] pt-1">
                                <div className="flex items-center gap-1.5"><span className="font-bold text-gray-400 uppercase tracking-wider">DNI:</span><span className="font-mono font-bold text-gray-600">{al.dni || '—'}</span>{al.dni && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(al.dni); }} className="p-0.5 bg-white hover:bg-slate-200 text-slate-500 rounded border border-slate-200 flex items-center justify-center shadow-xs">📋</button>}</div>
                                <div className="flex items-center gap-1.5"><span className="font-bold text-gray-400 uppercase tracking-wider">Telf:</span><span className="font-semibold text-gray-600">{textCelular}</span>{phoneFinal && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(phoneFinal); }} className="p-0.5 bg-white hover:bg-slate-200 text-slate-500 rounded border border-slate-200 flex items-center justify-center shadow-xs">📋</button>}</div>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-slate-50 p-3 border-b border-gray-200 shrink-0 flex justify-between items-center"><h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Línea de Tiempo del Cliente Seleccionado</h4>{cargandoHistorial && <span className="text-[9px] text-gray-400 animate-pulse font-bold tracking-widest uppercase">Consultando...</span>}</div>
                    <div className="p-4 max-h-80 overflow-y-auto">
                      {!cargandoHistorial && historial.length === 0 ? <p className="text-center text-xs text-gray-400 italic py-6">Aún no hay revisiones registradas en el historial de este cliente.</p> : (
                        <div className="relative border-l-2 border-gray-200 ml-2 md:ml-3 space-y-5 pb-2 mt-2">
                          {historial.map((item, idx) => {
                            const reviewerLower = String(item.reviewer_id || '').toLowerCase();
                            const isBot = reviewerLower.includes('bot') || reviewerLower.includes('auto') || reviewerLower.includes('agent') || reviewerLower.includes('sistema');
                            return (
                              <div key={item.audit_id || idx} className="relative pl-5 md:pl-6 group">
                                <div className={`absolute -left-[11px] md:-left-[13px] top-0 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-110 ${isBot ? 'bg-slate-500 text-white' : 'bg-power-blue text-white'}`}>{isBot ? '🤖' : '👤'}</div>
                                <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative top-[-6px]">
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1.5 sm:gap-0">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2"><span className="text-[11px] md:text-xs font-black text-gray-800">{item.reviewer_id || 'Sistema'}</span>{isBot && <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Automático</span>}</div>
                                      {(item.codigo_regla || item.regla_nombre) ? <span className="text-[9px] text-gray-500 bg-gray-100 font-mono px-1.5 py-0.5 rounded border border-gray-200/50 w-fit whitespace-normal break-all leading-tight" title={item.regla_nombre}>{item.codigo_regla ? `[${item.codigo_regla}] ` : ''}{item.regla_nombre || ''}</span> : <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-200/50 w-fit uppercase tracking-tight flex items-center gap-1"><span className="text-[10px]">🌐</span> Acción a Nivel Cliente</span>}
                                    </div>
                                    <span className="text-[9px] md:text-[10px] text-gray-400 font-medium font-mono shrink-0">{new Date(item.fecha_comentario).toLocaleString()}</span>
                                  </div>
                                  <div className="mb-2"><span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shadow-xs inline-flex items-center gap-1 ${item.status === 'FRAUD' ? 'bg-red-50 text-red-600 border-red-200' : item.status === 'DISCARDED' ? 'bg-gray-50 text-gray-600 border-gray-200' : item.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' : item.status === 'ADDITIONAL_REVIEW' ? 'bg-purple-50 text-power-purple border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}><svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>{traducirEstado(item.status)}</span></div>
                                  <div className="text-[11px] md:text-xs text-gray-600 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-100 whitespace-pre-wrap">{item.review_comment || <span className="italic text-gray-400">Sin comentario en este cambio de estado.</span>}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-4 shadow-inner border border-slate-800">
                    <div className="flex justify-between items-center mb-2"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payload JSON (Evento Seleccionado)</p>{payloadData && !cargandoPayload && <button onClick={() => navigator.clipboard.writeText(JSON.stringify(payloadData, null, 2))} className="text-[9px] font-black text-emerald-400 flex items-center bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors active:scale-95">Copiar JSON</button>}</div>
                    <pre className="text-emerald-400 text-[10px] overflow-x-auto max-h-40 font-mono scrollbar-thin">{cargandoPayload ? <span className="italic text-slate-500 animate-pulse">⏳ Descargando metadatos del evento...</span> : payloadData ? JSON.stringify(payloadData, null, 2) : <span className="italic text-slate-500">No hay información de payload mapeada para esta alerta.</span>}</pre>
                  </div>

                  <div ref={formDictamenRef} className="bg-white p-4 rounded-xl border border-gray-200 scroll-mt-6 shadow-sm">
                    <h4 className="font-bold text-sm mb-4 uppercase text-gray-500 tracking-wider">Dictamen Global en Lote</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Impactar a todas las alertas como:</label>
                        <select value={esSoloLectura ? 'DISCARDED' : nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} disabled={esSoloLectura} className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none disabled:bg-gray-50 disabled:text-gray-400">
                          {estadoActual === 'OPEN' && <option value="IN_REVIEW">Pasar a En Revisión</option>}
                          {estadoActual === 'IN_REVIEW' && (
                            <>
                              <option value="IN_REVIEW">Mantener En Revisión</option>
                              <option value="ADDITIONAL_REVIEW">En revisión adicional</option>
                            </>
                          )}
                          {estadoActual === 'ADDITIONAL_REVIEW' && <option value="ADDITIONAL_REVIEW">Mantener En revisión adicional</option>}
                          <option value="DISCARDED">Descartar Todas (Falso Positivo)</option>
                          <option value="SUSPICIOUS">Sospechoso (Monitorear)</option>
                          <option value="FRAUD">Fraude Confirmado (Bloquear)</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold mb-1.5">Nuevo Comentario de Revisión</label>
                        {!esSoloLectura && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {RESPUESTAS_RAPIDAS.map((frase, i) => (
                              <button key={i} type="button" onClick={() => agregarRespuestaRapida(frase)} className="text-[10px] md:text-[11px] bg-slate-50 border border-power-purple/20 text-power-purple hover:bg-power-purple hover:text-white px-2.5 py-1.5 rounded-md transition-colors active:scale-95 font-medium shadow-xs">{frase}</button>
                            ))}
                          </div>
                        )}
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={esSoloLectura} rows="3" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-power-purple outline-none resize-none disabled:bg-gray-50 disabled:text-gray-400" placeholder={esSoloLectura ? "Historial bloqueado o sin privilegios de edición..." : "Explica el motivo de tu decisión o usa un botón de arriba..."}></textarea>
                      </div>

                      {!esSoloLectura && (
                        <button onClick={guardarRevisionMasiva} className="w-full bg-power-purple text-white font-bold py-3 rounded-lg shadow-md hover:bg-power-purple/80 transition-all active:scale-95 text-sm md:text-base">
                          Guardar y Resolver {cantidadAlertasCliente} Alertas de Cliente
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-xl border border-gray-200 border-dashed">
                  <span className="text-4xl mb-4">📭</span>
                  <p className="text-slate-500 font-bold text-center">No se encontraron alertas activas en estado <span className="text-power-purple">{traducirEstado(estadoActual)}</span>.</p>
                </div>
              )}

            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ReviewDrawer;