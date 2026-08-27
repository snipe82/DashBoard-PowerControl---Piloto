import React, { useState, useEffect, useRef } from 'react';
import api from '../api'; 
import EventsSearch from './EventsSearch';

const traducirEstado = (estado) => {
  const diccionario = {
    'OPEN': 'Abierta',
    'IN_REVIEW': 'En revisión',
    'ADDITIONAL_REVIEW': 'En revisión adicional',
    'SUSPICIOUS': 'Sospechosa',
    'FRAUD': 'Fraude Confirmado',
    'DISCARDED': 'Descartada (Falso Positivo)',
    'CLOSED_FALSE_POSITIVE': 'Falso Positivo (Cerrado)',
    'CLOSED_CONFIRMED_FRAUD': 'Fraude Confirmado (Cerrado)'
  };
  return diccionario[estado?.toUpperCase()] || estado || '—';
};

const RESPUESTAS_RAPIDAS = [
  "CLIENTE PASO BIOMETRIA PREVIAMENTE",
  "COINCIDE MOVIL CON TITULAR - YAPE",
  "COINCIDE MOVIL CON TITULAR - PLIN",
  "EN INVESTIGACIÓN"
];

const safeString = (val, fallback = '—') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// 🚀 EXTRAE MONTO DE FORMA SEGURA
const extractAmount = (m) => {
  if (m === null || m === undefined) return 0;
  if (typeof m === 'object') return parseFloat(m.value || m.amount || m.basevalue || 0);
  return parseFloat(m || 0);
};

// 🚀 EXTRAE MONEDA DE FORMA DINÁMICA
const extractCurrency = (m) => {
  if (m === null || m === undefined) return 'S/';
  if (typeof m === 'object') {
    const curr = String(m.currency || m.basecurrency || m.moneda || '').toUpperCase();
    if (curr === 'USD' || curr === 'UDS') return '$';
  }
  return 'S/';
};

const extraerCorreoUniversal = (alerta, payload) => {
  let email = alerta?.email || alerta?.correo || payload?.email || payload?.correo || payload?.emailAddress || payload?.customer_email || payload?.customer?.email || payload?.client?.email || payload?.user?.email || payload?.buyer?.email;
  if (!email && payload) {
    const match = JSON.stringify(payload).match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    if (match) email = match[1];
  }
  return email;
};

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
  haySiguiente = false,
  isReadOnlyContext = false,
  targetAlertId = null 
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
  
  const [fraudType, setFraudType] = useState('');
  const [errorDictamen, setErrorDictamen] = useState('');

  const [tengoCandado, setTengoCandado] = useState(false);
  const [bloqueadoPorOtro, setBloqueadoPorOtro] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState('');
  
  const [esInmutable, setEsInmutable] = useState(false);
  const [showParallelEvents, setShowParallelEvents] = useState(false);

  const [speechModalOpen, setSpeechModalOpen] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechHtml, setSpeechHtml] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [speechCopied, setSpeechCopied] = useState(false);

  const [blacklistModalOpen, setBlacklistModalOpen] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistError, setBlacklistError] = useState('');
  const [blacklistSuccess, setBlacklistSuccess] = useState('');
  const [pendingReviewPayload, setPendingReviewPayload] = useState(null);

  const [whitelistModalOpen, setWhitelistModalOpen] = useState(false);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState('');
  const [whitelistSuccess, setWhitelistSuccess] = useState('');
  const [whitelistItems, setWhitelistItems] = useState([]);

  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [revertComment, setRevertComment] = useState('');
  const [revertLoading, setRevertLoading] = useState(false);
  const [revertError, setRevertError] = useState('');

  const tengoCandadoRef = useRef(false);
  const idCandadoRef = useRef(null);
  const seGuardoExitosamenteRef = useRef(false);
  const formDictamenRef = useRef(null);
  const lastEstadoRef = useRef(estadoActual);
  const intentoDeLockRef = useRef(null);

  const isFraudCaseContext = estadoActual === 'FRAUD'; 

  useEffect(() => {
    if (isOpen) {
      if (estadoActual !== lastEstadoRef.current) {
        onClose();
      }
    } else {
      lastEstadoRef.current = estadoActual;
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
      setErrorDictamen('');

      const cleanEntityId = String(entityId).trim();
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanEntityId);

      let url1 = `/api/alerts/${esUUID ? 'entity' : 'dni'}/${cleanEntityId}?status=${estadoActual}`;
      let url2 = null;

      if (isReadOnlyContext) {
          url1 = `/api/alerts/${esUUID ? 'entity' : 'dni'}/${cleanEntityId}`;
      } else if (estadoActual === 'FRAUD') {
          url1 = `/api/alerts/${esUUID ? 'entity' : 'dni'}/${cleanEntityId}?status=FRAUD`;
          url2 = `/api/alerts/${esUUID ? 'entity' : 'dni'}/${cleanEntityId}?status=CLOSED_CONFIRMED_FRAUD`;
      }

      const safeGet = (url) => api.get(url).catch(() => ({ data: [] }));
      const peticiones = [safeGet(url1)];
      if (url2) peticiones.push(safeGet(url2));

      Promise.all(peticiones)
        .then(responses => {
          let rawAlerts = [];
          let rawMetadata = null;

          responses.forEach((res) => {
            const resJson = res.data;
            if (!rawMetadata || (Array.isArray(rawMetadata) && rawMetadata.length === 0)) {
               rawMetadata = resJson;
            }

            let arr = [];
            if (Array.isArray(resJson)) arr = resJson;
            else if (resJson && Array.isArray(resJson.data)) arr = resJson.data;
            else if (resJson && typeof resJson === 'object') {
              const obj = resJson.data || resJson;
              if (obj && (obj.alert_id || obj.fecha || obj.monto || obj.dni || obj.cliente)) {
                arr = [obj];
              }
            }
            rawAlerts = [...rawAlerts, ...arr];
          });

          setRawResponse(rawMetadata);

          const uniqueAlertsMap = new Map();
          rawAlerts.forEach(al => { if (al.alert_id) uniqueAlertsMap.set(al.alert_id, al); });
          const uniqueAlerts = Array.from(uniqueAlertsMap.values());

          const alertsFiltered = isReadOnlyContext ? uniqueAlerts : uniqueAlerts.filter(al => {
            const s = al.status || al.estado;
            if (!s) return true;
            if (estadoActual === 'FRAUD') {
              return String(s).toUpperCase() === 'FRAUD' || String(s).toUpperCase() === 'CLOSED_CONFIRMED_FRAUD';
            }
            return String(s).toUpperCase() === String(estadoActual).toUpperCase();
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
            let currentCurrency = 'S/';

            sortedAlerts.forEach(al => {
              const fechaCorta = al.fecha ? new Date(al.fecha).toLocaleDateString() : '0';
              const montoDeduplicacion = extractAmount(al.monto);
              const dniDeduplicacion = al.dni || al.document_number || '0';
              
              const txKey = al.application_id || al.app_id || al.transaction_id || al.operacion_id || al.payment_id || al.id_transaccion || `${fechaCorta}_${dniDeduplicacion}_${montoDeduplicacion}`;
              
              if (!txProcesadas.has(txKey)) {
                txProcesadas.add(txKey);
                totalMontoReal += montoDeduplicacion;
              }
              
              if (extractCurrency(al.monto) === '$') currentCurrency = '$';
            });

            const primeraCompra = (rawMetadata && rawMetadata.fecha_primera_alerta) || primero.fecha_primera_alerta || ultimo.fecha;
            const ultimaCompra = (rawMetadata && rawMetadata.fecha_ultima_alerta) || primero.fecha_ultima_alerta || primero.fecha;
            const statusEntidad = (rawMetadata && (rawMetadata.status || rawMetadata.estado)) || primero.estado || primero.status || estadoActual;
            const idEntidadFinal = primero.codigo_entidad || primero.customer_id || primero.merchant_id || cleanEntityId;

            infoObj = {
              entidad_tipo: primero.entidad || 'customer',
              display_label: esComercio ? 'Comercio / Tienda' : 'Titular / Cliente',
              display_name: esComercio ? (primero.tienda || 'Comercio Registrado') : (primero.cliente || primero.full_name || 'No registrado'),
              id_label: 'Código de Entidad',
              id_value: idEntidadFinal,
              monto_total: totalMontoReal,
              currency_symbol: currentCurrency,
              codigo_entidad: idEntidadFinal,
              tipo_evento: primero.event_type || primero.tipo_evento || '—',
              entidad_nombre: primero.entidad || '—',
              fecha_primera: primeraCompra,
              fecha_ultima: ultimaCompra,
              status: statusEntidad
            };

            let alertaPorDefecto = null;
            if (targetAlertId) {
              alertaPorDefecto = sortedAlerts.find(al => al.alert_id === targetAlertId);
            }
            
            if (!alertaPorDefecto) {
              alertaPorDefecto = sortedAlerts.find(al =>
                (al.dni && al.dni === clienteContexto) ||
                (al.document_number && al.document_number === clienteContexto) ||
                (al.cliente && al.cliente === clienteContexto) ||
                (al.full_name && al.full_name === clienteContexto)
              ) || sortedAlerts[0];
            }

            if (alertaPorDefecto) {
              setSelectedAlertId(alertaPorDefecto.alert_id);
              setComentario(alertaPorDefecto.review_comment || alertaPorDefecto.comentario || alertaPorDefecto.comment || '');
            }
          }

          setInfo(infoObj);
          setAlertas(sortedAlerts);
          
          const estadoRealCargado = sortedAlerts[0]?.status || sortedAlerts[0]?.estado || estadoActual;
          setNuevoEstado(
            estadoRealCargado === 'OPEN' ? 'IN_REVIEW' : 
            (estadoRealCargado === 'FRAUD' || estadoRealCargado === 'CLOSED_CONFIRMED_FRAUD') ? 'CLOSED_CONFIRMED_FRAUD' :
            estadoRealCargado
          );
          
          setFraudType(sortedAlerts[0]?.fraud_type || '');
          setCargando(false);
        })
        .catch(err => {
          console.error("❌ Error decodificando respuesta de entidad:", err);
          setRawResponse({ error_catch: err.message });
          setCargando(false);
        });
    }
  }, [isOpen, entityId, clienteContexto, estadoActual, isReadOnlyContext, targetAlertId]);

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

    if (isReadOnlyContext) {
      setBloqueadoPorOtro(true);
      setEsInmutable(true);
      setMensajeBloqueo('Modo de Inspección Forense: El expediente se abre en modo estricto de solo lectura. No se bloqueará la alerta en BD.');
      return;
    }

    if (intentoDeLockRef.current === selectedAlertId) return; 
    
    intentoDeLockRef.current = selectedAlertId;
    setBloqueadoPorOtro(false);
    setMensajeBloqueo('');
    setEsInmutable(false);

    let isDrawerActive = true; 

    const safeErrorMsg = (data, defaultMsg) => {
        let m = data?.error || data?.message || defaultMsg;
        if (typeof m === 'object') return JSON.stringify(m);
        return String(m);
    };

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
            setBloqueadoPorOtro(true);
            setEsInmutable(false);
            setMensajeBloqueo(safeErrorMsg(err.response.data, 'Esta alerta ya está siendo revisada por otro analista.'));
          } else if (err.response && err.response.status === 400) {
            setBloqueadoPorOtro(true);
            setEsInmutable(true); 
            setMensajeBloqueo(safeErrorMsg(err.response.data, 'La alerta se encuentra en un estado inmutable de solo lectura.'));
          }
        });
    }, 400);

    return () => {
      isDrawerActive = false; 
      intentoDeLockRef.current = null; 
      clearTimeout(lockTimeoutId);
      const idALiberar = idCandadoRef.current;
      const teniaCandado = tengoCandadoRef.current;
      if (teniaCandado && idALiberar && !seGuardoExitosamenteRef.current && !isReadOnlyContext) {
        api.post(`/api/alerts/${idALiberar}/unlock`).catch(() => null);
      }
    };
  }, [selectedAlertId, isOpen, isReadOnlyContext]);

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

  const ejecutarResolucionDeAlerta = async (reviewBody) => {
      try {
        const userSession = JSON.parse(localStorage.getItem('user') || '{}');
        const analistaResponsable = userSession.email || userSession.username || "analista@powerpay.pe";

        const useCaseEndpoint = isFraudCaseContext && !reviewBody.is_revert;

        if (useCaseEndpoint) {
          const casePayload = {
            case_status: reviewBody.status,
            fraud_type: reviewBody.status === 'CLOSED_CONFIRMED_FRAUD' ? fraudType : null,
            resolution_comment: reviewBody.review_comment,
            reviewer_id: analistaResponsable
          };

          const targetCaseId = alertaActiva.case_id || alertaActiva.id_caso || alertaActiva.alert_id;
          const resolveUrl = `/api/v1/cases/${targetCaseId}/resolve`;
          const res = await api.put(resolveUrl, casePayload);
          
          if (res.status === 200 || res.status === 201) {
            seGuardoExitosamenteRef.current = true;
            if (haySiguiente && onSiguiente) onSiguiente();
            else onClose();
            setTimeout(() => { recargarTabla(); }, 800);
          }
        } else {
          let reviewUrl = '';
          
          if (reviewBody.is_revert) {
             reviewUrl = `/api/alerts/${alertaActiva.alert_id}/review`;
          } else {
             const cleanIdParaRuta = String(reviewBody.dni_rut_id).trim();
             const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanIdParaRuta);
             reviewUrl = esUUID ? `/api/alerts/entity/${cleanIdParaRuta}/review` : `/api/alerts/dni/${cleanIdParaRuta}/review`;
          }
          
          const body = {
            status: reviewBody.status,
            reviewer_id: analistaResponsable,
            review_comment: reviewBody.review_comment,
            entity_parent_id: String(entityId).trim(),
            target_dni: alertaActiva.dni || alertaActiva.document_number || null,
            target_cliente: alertaActiva.cliente || alertaActiva.full_name || null
          };
          
          const res = await api.patch(reviewUrl, body);
          if (res.status === 200 || res.status === 201) {
            seGuardoExitosamenteRef.current = true;
            
            if (reviewBody.is_revert) return true;

            if (haySiguiente && onSiguiente) onSiguiente();
            else onClose();
            setTimeout(() => { recargarTabla(); }, 800);
          }
        }
      } catch (e) {
        console.error("🚨 DEBUG ERROR BACKEND:", e.response?.data);
        const status = e.response?.status;
        let msg = e.response?.data?.message || e.response?.data?.error || "Error de red al intentar guardar la revisión.";
        if (e.response?.data && typeof e.response.data === 'object') {
            msg = `HTTP ${status}: ` + JSON.stringify(e.response.data, null, 2);
        }
        if (status === 400 || status === 404) setErrorDictamen(msg);
        else alert(msg);
        
        return false;
      }
  };

  const ejecutarReversaASospechoso = async () => {
    setRevertError('');
    if (!revertComment.trim()) {
        setRevertError('Debe ingresar un comentario justificando la reversión del caso.');
        return;
    }
    setRevertLoading(true);

    try {
        const userSession = JSON.parse(localStorage.getItem('user') || '{}');
        const analistaResponsable = userSession.email || userSession.username || "analista@powerpay.pe";

        const reviewUrl = `/api/alerts/${alertaActiva.alert_id}/review`;
        
        const body = {
          status: 'SUSPICIOUS',
          reviewer_id: analistaResponsable,
          review_comment: revertComment
        };
        
        const res = await api.patch(reviewUrl, body);
        
        if (res.status === 200 || res.status === 201) {
            seGuardoExitosamenteRef.current = true;
            setRevertModalOpen(false);
            setRevertLoading(false);
            
            setPendingReviewPayload(null); 
            setWhitelistError('');
            setWhitelistSuccess('');
            
            const dniValue = alertaActiva?.dni || alertaActiva?.document_number || payloadData?.document_number;
            const phoneValue = rawTelefonoEncontrado || payloadData?.telephonenumber || payloadData?.phone || payloadData?.mobile;
            const emailValue = extraerCorreoUniversal(alertaActiva, payloadData);
            
            const items = [];
            if (dniValue) items.push({ list_id: 'DNI', value: dniValue, checked: true });
            if (emailValue) items.push({ list_id: 'EMAIL', value: emailValue, checked: true });
            if (phoneValue) items.push({ list_id: 'USER_PHONE', value: phoneValue, checked: true });
            
            if (items.length > 0) {
                setWhitelistItems(items);
                setWhitelistModalOpen(true);
            } else {
                onClose();
                setTimeout(() => { recargarTabla(); }, 800);
            }
        }
    } catch (e) {
        console.error("🚨 DEBUG ERROR REVERSA:", e.response?.data);
        const status = e.response?.status;
        let msg = e.response?.data?.message || e.response?.data?.error || "Error de red al intentar revertir el estado.";
        setRevertError(msg);
        setRevertLoading(false);
    }
  };

  const guardarRevisionMasiva = async () => {
    if (isReadOnlyContext) return; 
    setErrorDictamen('');

    if (!comentario.trim()) {
      return setErrorDictamen("El comentario de resolución es obligatorio para cerrar/actualizar un caso.");
    }

    if (isFraudCaseContext && nuevoEstado === 'CLOSED_CONFIRMED_FRAUD' && !fraudType) {
      return setErrorDictamen("Para casos de fraude confirmado, debe especificar el tipo de fraude (fraud_type).");
    }

    if (!alertaActiva) return alert("Por favor, selecciona un evento del historial.");
    if (cargandoPayload) return alert("Por favor, espera a que cargue la información del evento seleccionado.");
    
    let idParaRuta = payloadData?.customerid || payloadData?.customerId || payloadData?.customer_id;
    if (!idParaRuta) idParaRuta = payloadData?.document_number || payloadData?.dni || alertaActiva.dni || alertaActiva.document_number || alertaActiva.customer_id || alertaActiva.codigo_entidad;
    if (!idParaRuta && info?.id_value) idParaRuta = info.id_value;
    if (!idParaRuta) idParaRuta = entityId;

    if (!idParaRuta) return alert("Error crítico: No se encontró un identificador válido para este cliente/entidad.");

    const isRevertAction = nuevoEstado === 'REVERT_TO_SUSPICIOUS';
    const finalStatusToSend = isRevertAction ? 'SUSPICIOUS' : nuevoEstado;

    const pendingReviewBody = {
        status: finalStatusToSend,
        review_comment: comentario,
        dni_rut_id: idParaRuta,
        is_revert: isRevertAction
    };

    if (nuevoEstado === 'SUSPICIOUS' || nuevoEstado === 'FRAUD' || nuevoEstado === 'CLOSED_CONFIRMED_FRAUD') {
        setPendingReviewPayload(pendingReviewBody);
        setBlacklistError('');
        setBlacklistSuccess('');
        setBlacklistModalOpen(true);
    } 
    else if ((nuevoEstado === 'DISCARDED' || nuevoEstado === 'CLOSED_FALSE_POSITIVE' || isRevertAction) && (estadoActual === 'SUSPICIOUS' || estadoActual === 'FRAUD')) {
        setPendingReviewPayload(pendingReviewBody);
        setWhitelistError('');
        setWhitelistSuccess('');
        
        const dniValue = alertaActiva?.dni || alertaActiva?.document_number || payloadData?.document_number;
        const phoneValue = rawTelefonoEncontrado || payloadData?.telephonenumber || payloadData?.phone || payloadData?.mobile;
        const emailValue = extraerCorreoUniversal(alertaActiva, payloadData);
        
        const items = [];
        if (dniValue) items.push({ list_id: 'DNI', value: dniValue, checked: true });
        if (emailValue) items.push({ list_id: 'EMAIL', value: emailValue, checked: true });
        if (phoneValue) items.push({ list_id: 'USER_PHONE', value: phoneValue, checked: true });
        
        if (items.length > 0) {
            if (isRevertAction) {
                const success = await ejecutarResolucionDeAlerta(pendingReviewBody);
                if (success) {
                   setWhitelistItems(items);
                   setWhitelistModalOpen(true);
                }
            } else {
                setWhitelistItems(items);
                setWhitelistModalOpen(true);
            }
        } else {
            ejecutarResolucionDeAlerta(pendingReviewBody);
        }
    } 
    else {
        ejecutarResolucionDeAlerta(pendingReviewBody);
    }
  };

  const handleSubmitToBlacklist = async () => {
      setBlacklistLoading(true);
      setBlacklistError('');
      
      const dniValue = alertaActiva?.dni || alertaActiva?.document_number || payloadData?.document_number;
      const phoneValue = rawTelefonoEncontrado || payloadData?.telephonenumber || payloadData?.phone || payloadData?.mobile;
      const emailValue = extraerCorreoUniversal(alertaActiva, payloadData);

      const itemsToSend = [];
      if (dniValue) itemsToSend.push({ list_id: 'DNI', value: String(dniValue).trim() });
      if (emailValue) itemsToSend.push({ list_id: 'EMAIL', value: String(emailValue).trim() });
      if (phoneValue) itemsToSend.push({ list_id: 'USER_PHONE', value: String(phoneValue).trim() });

      if (itemsToSend.length === 0) {
          setBlacklistError("No se extrajeron credenciales válidas (DNI, Email o Teléfono) para bloquear.");
          setBlacklistLoading(false);
          return;
      }

      try {
          await api.post(`/api/v1/alerts/${alertaActiva.alert_id}/blacklist`, {
              items: itemsToSend,
              reason: comentario 
          });
          
          setBlacklistSuccess("¡Datos inyectados en la Lista Negra exitosamente!");
          
          setTimeout(() => {
              setBlacklistModalOpen(false);
              ejecutarResolucionDeAlerta(pendingReviewPayload);
          }, 1500);

      } catch (error) {
          const msg = error.response?.data?.error || error.response?.data?.message || 'Error al intentar actualizar la Lista Negra.';
          setBlacklistError(msg);
          setBlacklistLoading(false);
      }
  };

  const handleSkipBlacklist = () => {
      setBlacklistModalOpen(false);
      ejecutarResolucionDeAlerta(pendingReviewPayload);
  };

  const toggleWhitelistItem = (idx) => {
      const newItems = [...whitelistItems];
      newItems[idx].checked = !newItems[idx].checked;
      setWhitelistItems(newItems);
  };

  const handleSubmitToWhitelist = async () => {
      setWhitelistLoading(true);
      setWhitelistError('');

      const itemsToSend = whitelistItems.filter(i => i.checked).map(i => ({
          list_id: i.list_id,
          value: String(i.value).trim()
      }));

      if (itemsToSend.length === 0) {
          handleSkipWhitelist();
          return;
      }

      try {
          await api.post(`/api/v1/alerts/${alertaActiva.alert_id}/blacklist/remove`, {
              items: itemsToSend
          });
          
          setWhitelistSuccess("¡Registros removidos de las listas de bloqueo exitosamente!");
          
          setTimeout(() => {
              setWhitelistModalOpen(false);
              if (pendingReviewPayload?.is_revert) {
                  onClose();
                  recargarTabla();
              } else {
                  ejecutarResolucionDeAlerta(pendingReviewPayload);
              }
          }, 1500);

      } catch (error) {
          const msg = error.response?.data?.error || error.response?.data?.message || 'Error al intentar limpiar la Lista Negra.';
          setWhitelistError(msg);
          setWhitelistLoading(false);
      }
  };

  const handleSkipWhitelist = () => {
      setWhitelistModalOpen(false);
      if (pendingReviewPayload?.is_revert) {
          onClose();
          setTimeout(() => { recargarTabla(); }, 800);
      } else {
          ejecutarResolucionDeAlerta(pendingReviewPayload);
      }
  };

  const handleGenerateSpeech = async () => {
    if (!payloadData) {
        setSpeechError('No se puede generar el mensaje porque no hay datos del payload en esta alerta.');
        setSpeechModalOpen(true);
        return;
    }
    
    setSpeechModalOpen(true);
    setSpeechLoading(true);
    setSpeechError('');
    setSpeechHtml('');
    setSpeechCopied(false);

    const userSession = JSON.parse(localStorage.getItem('user') || '{}');
    const analystName = userSession.name || userSession.full_name || userSession.username || userSession.email || "Área de Fraude";

    try {
        const res = await api.post('/api/v1/alerts/speech/generate', { 
            payload: payloadData,
            analystName: analystName 
        });
        if (res.data?.data?.html) {
            setSpeechHtml(res.data.data.html);
        } else {
            setSpeechError('El servidor respondió pero no incluyó la estructura HTML esperada.');
        }
    } catch (error) {
        const msg = error.response?.data?.error || error.response?.data?.message || 'Fallo de conexión al generar el mensaje.';
        setSpeechError(`Error: ${msg}`);
    } finally {
        setSpeechLoading(false);
    }
  };

  const handleCopySpeech = () => {
      if (!speechHtml) return;
      
      let cleanText = speechHtml
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '') 
          .replace(/<\/?br\s*\/?>/gi, '\n') 
          .replace(/<\/p>/gi, '\n') 
          .replace(/<[^>]+>/ig, '') 
          .replace(/&nbsp;/g, ' '); 

      cleanText = cleanText.split('\n')
          .map(line => line.trim()) 
          .filter(line => line.length > 0) 
          .join('\n\n'); 

      navigator.clipboard.writeText(cleanText).then(() => {
          setSpeechCopied(true);
          setTimeout(() => setSpeechCopied(false), 2000);
      }).catch(err => {
          console.error("Error copiando al portapapeles:", err);
          alert("Error al intentar copiar el mensaje. Asegúrate de tener permisos.");
      });
  };

  const esSoloLectura = estadoActual === 'DISCARDED' || bloqueadoPorOtro || isReadOnlyContext;
  const scrollToDictamen = () => { formDictamenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const agregarRespuestaRapida = (frase) => { setComentario(prev => prev ? `${prev} - ${frase}` : frase); };

  const dniParaParallelLookup = alertaActiva?.dni || alertaActiva?.document_number || info?.id_value || '';
  const appIdParaParallelLookup = payloadData?.application_id || payloadData?.applicationId || '';

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-black transition-opacity ${isOpen ? 'visible' : 'invisible'} ${showParallelEvents ? 'opacity-15' : 'opacity-50'}`} 
        onClick={onClose}
      />

      <div className={`fixed inset-0 z-50 flex justify-end overflow-hidden pointer-events-none ${isOpen ? 'visible' : 'invisible'}`}>
        {showParallelEvents && (
          <div className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 shadow-2xl p-4 md:p-6 overflow-y-auto pointer-events-auto z-50 animate-slide-in-left w-full md:w-1/3 lg:w-3/5">
            <EventsSearch 
              isModal={true} 
              onClose={() => setShowParallelEvents(false)} 
              initialDni={safeString(dniParaParallelLookup, '')}       
              initialAppId={safeString(appIdParaParallelLookup, '')}   
            />
          </div>
        )}

        <div className={`relative h-full w-full md:w-2/3 lg:w-2/5 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col pointer-events-auto z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-wrap justify-between items-center border-b p-3 md:p-5 bg-white shrink-0 z-20 shadow-sm gap-3">
            <h3 className="text-xl font-bold text-power-blue whitespace-nowrap shrink-0">Revisión de Entidad</h3>
            <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2 shrink-0 flex-1">
              <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-200 shadow-sm shrink-0">
                <button onClick={onAnterior} disabled={!hayAnterior} className="px-2.5 py-1.5 text-gray-500 hover:text-power-purple hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="w-[1px] bg-gray-200 my-1 mx-0.5"></div>
                <button onClick={onSiguiente} disabled={!haySiguiente} className="px-2.5 py-1.5 text-gray-500 hover:text-power-purple hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>

              {estadoActual === 'IN_REVIEW' && !isReadOnlyContext && (
                 <button 
                   onClick={handleGenerateSpeech}
                   disabled={cargandoPayload || !selectedAlertId}
                   className="shrink-0 text-[10px] md:text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-sm active:scale-95 border border-emerald-200 disabled:opacity-50"
                 >
                   💬 <span className="hidden sm:inline">Generar Speech</span>
                 </button>
              )}

              <button 
                onClick={() => setShowParallelEvents(!showParallelEvents)}
                className={`shrink-0 text-[10px] md:text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm border transition-all active:scale-95 ${showParallelEvents ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                <span className={showParallelEvents ? 'text-white' : 'text-amber-500'}>⚡</span> 
                {showParallelEvents ? 'Ocultar Eventos' : 'Eventos Cliente'}
              </button>

              <button onClick={scrollToDictamen} className="shrink-0 text-[10px] md:text-xs bg-power-purple/10 text-power-purple px-3 py-1.5 rounded-full font-bold hover:bg-power-purple/20 transition-colors flex items-center gap-1 shadow-sm active:scale-95 border border-power-purple/20">
                ⬇️ <span className="hidden sm:inline">Dictamen</span>
              </button>
              
              <button onClick={onClose} className="shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600 font-bold text-xl active:scale-90 w-8 h-8 flex items-center justify-center rounded-full transition-colors ml-1">✕</button>
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
                <div className={`border p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm animate-fade-in ${esInmutable ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <span className="text-2xl shrink-0 leading-none">{esInmutable ? '👁️' : '🔒'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-black uppercase tracking-widest text-[10px] mb-1 ${esInmutable ? 'text-slate-500' : 'text-amber-600'}`}>
                      {esInmutable ? 'Expediente Histórico (Solo Lectura)' : 'Control de Concurrencia'}
                    </p>
                    <p className="font-medium text-xs sm:text-sm leading-snug break-words">
                      {safeString(mensajeBloqueo)}
                    </p>
                  </div>
                </div>
              )}

              {info ? (
                <>
                  <div className="bg-white rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-4 shadow-sm text-sm">
                    <div className="col-span-2 border-b border-gray-100 pb-2 mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">{safeString(info.display_label)}</p>
                        <p className="text-lg font-black text-gray-800 leading-tight">{safeString(info.display_name)}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded shadow-xs ml-2 shrink-0 ${info.status === 'FRAUD' || info.status === 'CLOSED_CONFIRMED_FRAUD' ? 'bg-red-50 text-red-600 border border-red-200' : info.status === 'DISCARDED' ? 'bg-gray-50 text-gray-600 border border-gray-200' : info.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' : info.status === 'ADDITIONAL_REVIEW' ? 'bg-purple-50 text-power-purple border border-purple-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                        {traducirEstado(info.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{safeString(info.id_label)}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="font-bold text-slate-700 font-mono text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-200 truncate max-w-[120px] md:max-w-[140px]" title={safeString(info.id_value)}>
                          {safeString(info.id_value)}
                        </p>
                        <button onClick={() => navigator.clipboard.writeText(safeString(info.id_value, ''))} className="p-1 bg-white hover:bg-slate-100 text-slate-500 rounded border border-slate-200 shadow-xs hover:text-power-purple transition-all active:scale-95 text-xs flex items-center justify-center shrink-0">📋</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Riesgo Acumulado</p>
                      {/* 🚀 Renderizado dinámico de la moneda en la Cabecera */}
                      <p className="font-bold text-red-600 text-lg mt-0.5">{info.currency_symbol || 'S/'} {extractAmount(info.monto_total).toFixed(2)}</p>
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
                        {safeString(info.entidad_nombre)}
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
                        
                        const cuotasEncontradas = al.numberinstallments || al.cuotas || al.installments || al.plazo || al.term || al.numero_cuotas;
                        const cuotasPayload = payloadData?.numberinstallments ||
                                              payloadData?.cuotas || 
                                              payloadData?.installments || 
                                              payloadData?.plazo || 
                                              payloadData?.term || 
                                              payloadData?.numero_cuotas || 
                                              payloadData?.loan?.installments || 
                                              payloadData?.credit?.installments ||
                                              payloadData?.application?.installments ||
                                              payloadData?.application?.term ||
                                              payloadData?.transaction?.installments ||
                                              payloadData?.financing?.installments;
                                              
                        const finalCuotas = cuotasEncontradas || (estaSeleccionado ? cuotasPayload : null);
                        const finalCuotasNumero = finalCuotas ? String(finalCuotas).replace(/\D/g, '') : null;
                        const textCuotas = finalCuotasNumero ? `${finalCuotasNumero} meses` : (estaSeleccionado && cargandoPayload ? '⏳...' : 'No reg.');

                        const nombreComercio = al.tienda || al.comercio || al.merchant || al.merchant_name || '—';

                        return (
                          <div key={al.alert_id || `alerta-hija-${idx}`} onClick={() => setSelectedAlertId(al.alert_id)} className={`cursor-pointer rounded-xl border p-3.5 transition-all ${estaSeleccionado ? 'bg-power-purple/5 border-power-purple shadow-sm ring-1 ring-power-purple/30' : 'bg-white border-gray-200 hover:border-power-purple/40 hover:shadow-sm'}`}>
                             <div className="flex justify-between items-start mb-2">
                               <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                 <div className="mt-1 shrink-0"><input type="radio" checked={estaSeleccionado} readOnly className="h-3.5 w-3.5 text-power-purple focus:ring-power-purple border-gray-300 accent-power-purple cursor-pointer" /></div>
                                 <div className="min-w-0 flex-1">
                                   <div className="flex items-start gap-1.5 mb-1">
                                     <span className="font-mono text-[9px] md:text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase tracking-tight shrink-0 mt-0.5">{safeString(al.codigoregla)}</span>
                                     <span className="text-[10px] md:text-[11px] font-black text-slate-700 break-all leading-snug" title={safeString(al.regla)}>{safeString(al.regla, 'Alerta de riesgo')}</span>
                                   </div>
                                   <span className="text-[10px] md:text-[11px] text-gray-500 font-medium block">{al.fecha ? new Date(al.fecha).toLocaleString() : '—'}</span>
                                 </div>
                               </div>
                               <div className="text-right shrink-0 ml-2">
                                 {/* 🚀 Renderizado dinámico de la moneda en la Alerta */}
                                 <span className="font-black text-gray-800 text-sm md:text-base block leading-tight">{extractCurrency(al.monto)} {extractAmount(al.monto).toFixed(2)}</span>
                                 <span className="block text-[9px] md:text-[10px] text-slate-400 truncate max-w-[90px] md:max-w-[120px]" title={safeString(al.event_type)}>{safeString(al.event_type)}</span>
                               </div>
                             </div>
                             
                             <div className="mb-2 bg-slate-50/80 rounded-lg p-2 md:p-2.5 border border-slate-100 text-[10px] md:text-[11px] space-y-1">
                               <div className="flex justify-between items-center">
                                 <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">Comercio:</span>
                                 <span className="font-medium text-gray-700 truncate text-right">{safeString(nombreComercio)}</span>
                               </div>
                               <div className="flex justify-between items-center">
                                 <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">Cliente:</span>
                                 <span className="font-medium text-gray-700 truncate text-right">{safeString(al.cliente)}</span>
                               </div>
                               <div className="flex justify-between items-center">
                                 <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-2">Cuotas/Plazo:</span>
                                 <span className="font-medium text-gray-700 truncate text-right">{safeString(textCuotas)}</span>
                               </div>
                             </div>
                             
                             <div className="flex items-center justify-between text-[10px] md:text-[11px] pt-1">
                                <div className="flex items-center gap-1.5"><span className="font-bold text-gray-400 uppercase tracking-wider">DNI:</span><span className="font-mono font-bold text-gray-600">{safeString(al.dni)}</span>{al.dni && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(safeString(al.dni,'')); }} className="p-0.5 bg-white hover:bg-slate-200 text-slate-500 rounded border border-slate-200 flex items-center justify-center shadow-xs">📋</button>}</div>
                                <div className="flex items-center gap-1.5"><span className="font-bold text-gray-400 uppercase tracking-wider">Telf:</span><span className="font-semibold text-gray-600">{safeString(textCelular)}</span>{phoneFinal && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(safeString(phoneFinal,'')); }} className="p-0.5 bg-white hover:bg-slate-200 text-slate-500 rounded border border-slate-200 flex items-center justify-center shadow-xs">📋</button>}</div>
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
                                      <div className="flex items-center gap-2"><span className="text-[11px] md:text-xs font-black text-gray-800">{safeString(item.reviewer_id, 'Sistema')}</span>{isBot && <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Automático</span>}</div>
                                      {(item.codigo_regla || item.regla_nombre) ? <span className="text-[9px] text-gray-500 bg-gray-100 font-mono px-1.5 py-0.5 rounded border border-gray-200/50 w-fit whitespace-normal break-all leading-tight" title={safeString(item.regla_nombre)}>{item.codigo_regla ? `[${safeString(item.codigo_regla)}] ` : ''}{safeString(item.regla_nombre, '')}</span> : <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-200/50 w-fit uppercase tracking-tight flex items-center gap-1"><span className="text-[10px]">🌐</span> Acción a Nivel Cliente</span>}
                                    </div>
                                    <span className="text-[9px] md:text-[10px] text-gray-400 font-medium font-mono shrink-0">{item.fecha_comentario ? new Date(item.fecha_comentario).toLocaleString() : '—'}</span>
                                  </div>
                                  <div className="mb-2"><span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shadow-xs inline-flex items-center gap-1 ${item.status === 'FRAUD' || item.status === 'CLOSED_CONFIRMED_FRAUD' ? 'bg-red-50 text-red-600 border-red-200' : item.status === 'DISCARDED' || item.status === 'CLOSED_FALSE_POSITIVE' ? 'bg-gray-50 text-gray-600 border-gray-200' : item.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' : item.status === 'ADDITIONAL_REVIEW' ? 'bg-purple-50 text-power-purple border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}><svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>{traducirEstado(item.status)}</span></div>
                                  <div className="text-[11px] md:text-xs text-gray-600 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-100 whitespace-pre-wrap">{safeString(item.review_comment, <span className="italic text-gray-400">Sin comentario en este cambio de estado.</span>)}</div>
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
                    
                    <div className="flex flex-wrap justify-between items-center mb-4 gap-2 border-b border-gray-100 pb-3">
                      <h4 className="font-bold text-sm uppercase text-gray-500 tracking-wider">Dictamen Final del Caso</h4>
                      {isFraudCaseContext && !esSoloLectura && (
                         <button 
                           onClick={() => {
                               setRevertModalOpen(true);
                               setRevertComment('');
                               setRevertError('');
                           }}
                           className="text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 font-bold px-4 py-2 rounded-lg transition-all active:scale-95 text-xs flex items-center gap-2 shadow-sm"
                         >
                           <span className="text-base">↩️</span> Revertir a Sospechoso (Corregir)
                         </button>
                      )}
                    </div>
                    
                    {errorDictamen && (
                      <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold animate-fade-in flex items-start gap-2 shadow-sm overflow-x-auto">
                        <span className="text-sm mt-0.5">🛑</span> 
                        <pre className="font-mono whitespace-pre-wrap">{safeString(errorDictamen)}</pre>
                      </div>
                    )}

                    <div className="space-y-4">
                      {isFraudCaseContext ? (
                        <>
                          <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl shadow-sm mb-2">
                            <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-red-800">Resolución del Caso (Obligatorio):</label>
                            <select 
                              value={esSoloLectura ? 'CLOSED_FALSE_POSITIVE' : nuevoEstado} 
                              onChange={(e) => {
                                setNuevoEstado(e.target.value);
                                setFraudType(''); 
                                setErrorDictamen('');
                              }} 
                              disabled={esSoloLectura} 
                              className="w-full p-2 border border-red-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-400 outline-none disabled:bg-gray-50 disabled:text-gray-400 font-bold text-red-900"
                            >
                              <option value="CLOSED_CONFIRMED_FRAUD">🚨 Cerrar como Fraude Confirmado</option>
                              <option value="CLOSED_FALSE_POSITIVE">✅ Cerrar como Falso Positivo</option>
                            </select>
                          </div>

                          {nuevoEstado === 'CLOSED_CONFIRMED_FRAUD' && (
                            <div className="animate-fade-in pl-3 border-l-2 border-red-300">
                              <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-slate-600">Tipificación del Fraude (Obligatorio):</label>
                              <select 
                                value={fraudType} 
                                onChange={(e) => {
                                  setFraudType(e.target.value);
                                  setErrorDictamen('');
                                }} 
                                disabled={esSoloLectura} 
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-400 outline-none disabled:bg-gray-50 disabled:text-gray-400 font-medium"
                              >
                                <option value="" disabled>-- Selecciona un tipo de fraude --</option>
                                <option value="FRAUD_FRUSTRATED">Fraude Frustrado (Sin pérdida real)</option>
                                <option value="FRAUD_MERCHANT_ASSUMED">Asumido por Comercio</option>
                                <option value="FRAUD_LOSS">Pérdida Asumida (Impacto directo)</option>
                              </select>
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold mb-1">Impactar a todas las alertas como:</label>
                          <select 
                            value={esSoloLectura ? 'DISCARDED' : nuevoEstado} 
                            onChange={(e) => {
                              setNuevoEstado(e.target.value);
                              setErrorDictamen('');
                            }} 
                            disabled={esSoloLectura} 
                            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none disabled:bg-gray-50 disabled:text-gray-400 cursor-not-allowed"
                          >
                            {estadoActual === 'OPEN' && <option value="IN_REVIEW">Pasar a En Revisión</option>}
                            {estadoActual === 'IN_REVIEW' && (
                              <>
                                <option value="IN_REVIEW">Mantener En Revisión</option>
                                <option value="ADDITIONAL_REVIEW">En revisión adicional</option>
                              </>
                            )}
                            {estadoActual === 'ADDITIONAL_REVIEW' && <option value="ADDITIONAL_REVIEW">Mantener En revisión adicional</option>}
                            
                            <option value="DISCARDED">Descartar Todas (Falso Positivo)</option>
                            <option value="SUSPICIOUS">
                              {estadoActual === 'SUSPICIOUS' ? 'Mantener como Sospechoso (Monitorear)' : 'Sospechoso (Monitorear)'}
                            </option>
                            <option value="FRAUD">Fraude Confirmado (Escalar a Caso)</option>
                          </select>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-xs font-bold mb-1.5">Justificación de la Resolución</label>
                        {!esSoloLectura && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {RESPUESTAS_RAPIDAS.map((frase, i) => (
                              <button key={i} type="button" onClick={() => agregarRespuestaRapida(frase)} className="text-[10px] md:text-[11px] bg-slate-50 border border-power-purple/20 text-power-purple hover:bg-power-purple hover:text-white px-2.5 py-1.5 rounded-md transition-colors active:scale-95 font-medium shadow-xs">{frase}</button>
                            ))}
                          </div>
                        )}
                        <textarea 
                          value={comentario} 
                          onChange={(e) => {
                            setComentario(e.target.value);
                            setErrorDictamen('');
                          }} 
                          disabled={esSoloLectura} 
                          rows="3" 
                          className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-power-purple outline-none resize-none disabled:bg-gray-50 disabled:text-gray-400 cursor-not-allowed" 
                          placeholder={esSoloLectura ? (isReadOnlyContext ? "Este expediente ha sido abierto en modo estrictamente de Solo Lectura." : "Historial bloqueado o sin privilegios...") : "Explica detalladamente el motivo de tu decisión o resolución..."}
                        ></textarea>
                      </div>

                      {!esSoloLectura && (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={guardarRevisionMasiva} 
                            disabled={!comentario.trim() || (isFraudCaseContext && nuevoEstado === 'CLOSED_CONFIRMED_FRAUD' && !fraudType)}
                            className={`w-full text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 text-sm md:text-base ${
                               (!comentario.trim() || (isFraudCaseContext && nuevoEstado === 'CLOSED_CONFIRMED_FRAUD' && !fraudType)) ? 'bg-slate-300 cursor-not-allowed opacity-80' : 
                               nuevoEstado === 'REVERT_TO_SUSPICIOUS' ? 'bg-amber-500 hover:bg-amber-600' :
                               isFraudCaseContext ? 'bg-red-600 hover:bg-red-700' : 'bg-power-purple hover:bg-power-purple/90'
                            }`}
                          >
                            {nuevoEstado === 'REVERT_TO_SUSPICIOUS' ? 'Confirmar Reversa a Sospechoso' :
                             isFraudCaseContext ? 'Cerrar Caso Definitivamente' : `Guardar y Resolver ${cantidadAlertasCliente} Alerta(s)`}
                          </button>
                        </div>
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

      {/* 🚀 MODAL: CONFIRMACIÓN PARA BLACKLIST (LISTA NEGRA) */}
      {blacklistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-700 transform scale-100 transition-transform">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center gap-3">
              <span className="text-3xl text-rose-500">🚫</span>
              <div>
                <h3 className="font-black text-white text-lg leading-tight">Envío a Lista Negra</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Política Anti-Fraude Activa</p>
              </div>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">
                Estás escalando este expediente como <span className="font-black text-rose-600">{nuevoEstado === 'FRAUD' ? 'Fraude' : 'Sospechoso'}</span>. ¿Deseas inyectar las credenciales de este cliente en la lista negra central para bloquear transacciones futuras de manera automática?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 mb-4 shadow-inner">
                 <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">DNI Objetivo:</span>
                    <span className="font-mono font-black text-slate-700">{alertaActiva?.dni || alertaActiva?.document_number || payloadData?.document_number || 'No Detectado'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Telf / Celular:</span>
                    <span className="font-mono font-black text-slate-700">{rawTelefonoEncontrado || payloadData?.telephonenumber || payloadData?.phone || payloadData?.mobile || 'No Detectado'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Correo / Email:</span>
                    <span className="font-mono font-black text-slate-700">{extraerCorreoUniversal(alertaActiva, payloadData) || 'No Detectado'}</span>
                 </div>
              </div>

              {blacklistError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold animate-fade-in flex items-start gap-2 shadow-sm">
                  <span className="text-sm mt-0.5">🛑</span> 
                  <p>{blacklistError}</p>
                </div>
              )}
              
              {blacklistSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold animate-fade-in flex items-center justify-center gap-2 shadow-sm">
                  <span className="text-lg">✔️</span> 
                  <p>{blacklistSuccess}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button 
                  onClick={handleSkipBlacklist}
                  disabled={blacklistLoading || blacklistSuccess}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
                >
                  Omitir y Solo Cerrar Alerta
                </button>
                <button 
                  onClick={handleSubmitToBlacklist}
                  disabled={blacklistLoading || blacklistSuccess || (!alertaActiva?.dni && !rawTelefonoEncontrado && !payloadData?.document_number && !payloadData?.phone && !extraerCorreoUniversal(alertaActiva, payloadData))}
                  className="flex-[1.5] py-2.5 px-4 rounded-xl text-xs font-black bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  {blacklistLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Sí, Enviar a Lista Negra'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL: CONFIRMACIÓN PARA WHITELIST (REVERSA DE LISTA NEGRA Y REVERSA DE FRAUDE) */}
      {whitelistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-700 transform scale-100 transition-transform">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center gap-3">
              <span className="text-3xl text-emerald-500">🔓</span>
              <div>
                <h3 className="font-black text-white text-lg leading-tight">Reversa de Lista Negra</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Módulo de Whitelisting Activo</p>
              </div>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">
                {pendingReviewPayload?.is_revert ? (
                  <>Estás devolviendo la alerta al estado <span className="font-black text-amber-600">Sospechoso</span> exitosamente. ¿Deseas retirar los datos de este cliente de las Listas Negras para evitar rebotes en el motor?</>
                ) : (
                  <>Estás marcando este expediente como <span className="font-black text-emerald-600">Falso Positivo (Descartado)</span>. ¿Deseas remover las siguientes credenciales de las listas de bloqueo para evitar que el motor rechace futuras compras de este cliente?</>
                )}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 mb-4 shadow-inner max-h-48 overflow-y-auto">
                 {whitelistItems.map((item, idx) => (
                    <label key={idx} className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${item.checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                       <input 
                          type="checkbox" 
                          checked={item.checked} 
                          onChange={() => toggleWhitelistItem(idx)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                       />
                       <div className="flex-1">
                          <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] block leading-none">{item.list_id}</span>
                          <span className={`font-mono font-black ${item.checked ? 'text-emerald-700' : 'text-slate-500'}`}>{item.value}</span>
                       </div>
                    </label>
                 ))}
              </div>

              {whitelistError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold animate-fade-in flex items-start gap-2 shadow-sm">
                  <span className="text-sm mt-0.5">🛑</span> 
                  <p>{whitelistError}</p>
                </div>
              )}
              
              {whitelistSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold animate-fade-in flex items-center justify-center gap-2 shadow-sm">
                  <span className="text-lg">✔️</span> 
                  <p>{whitelistSuccess}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button 
                  onClick={handleSkipWhitelist}
                  disabled={whitelistLoading || whitelistSuccess}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
                >
                  Omitir y Solo Cerrar
                </button>
                <button 
                  onClick={handleSubmitToWhitelist}
                  disabled={whitelistLoading || whitelistSuccess || !whitelistItems.some(i => i.checked)}
                  className="flex-[1.5] py-2.5 px-4 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  {whitelistLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Limpiar Lista Negra'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL DEL GENERADOR DE MENSAJES (SPEECH) */}
      {speechModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-emerald-200 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden transform scale-100 transition-transform">
            
            <div className="bg-emerald-50 px-5 py-4 border-b border-emerald-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="font-black text-emerald-800 text-lg leading-tight">Generador de Validación</h3>
                  <p className="text-emerald-600/80 text-[10px] font-black uppercase tracking-widest">Plantilla Inteligente</p>
                </div>
              </div>
              <button 
                 onClick={() => setSpeechModalOpen(false)} 
                 className="text-emerald-600 hover:text-white hover:bg-emerald-600 bg-white border border-emerald-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm font-bold shadow-sm"
              >✕</button>
            </div>

            <div className="p-5 flex-1 bg-white">
               {speechLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                     <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                     <p className="text-sm font-bold text-slate-600">Construyendo mensaje dinámico...</p>
                  </div>
               ) : speechError ? (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2 shadow-sm">
                     <span className="text-base mt-0.5">🛑</span> 
                     <p>{speechError}</p>
                  </div>
               ) : (
                  <div className="flex flex-col h-full">
                     <p className="text-xs text-slate-500 mb-3 font-medium leading-relaxed">
                        Este mensaje ha sido redactado automáticamente usando los datos de la transacción en curso. Cópialo para contactar al cliente original.
                     </p>
                     
                     <div className="relative bg-[#f8f9fa] border border-slate-200 rounded-xl p-4 shadow-inner max-h-60 overflow-y-auto custom-scrollbar group">
                        <div 
                           className="text-slate-800 text-sm"
                           dangerouslySetInnerHTML={{ __html: speechHtml }}
                        />
                     </div>
                  </div>
               )}
            </div>

            {!speechLoading && !speechError && (
               <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">No modifiques variables clave</span>
                  <button 
                    onClick={handleCopySpeech}
                    className={`flex-1 sm:flex-none font-bold py-2.5 px-6 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${speechCopied ? 'bg-slate-800 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                  >
                    {speechCopied ? (
                       <><span>✔️</span> Copiado al Portapapeles</>
                    ) : (
                       <><span>📋</span> Copiar Mensaje</>
                    )}
                  </button>
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewDrawer;