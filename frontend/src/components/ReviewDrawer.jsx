import React, { useState, useEffect } from 'react';

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

const ReviewDrawer = ({ isOpen, onClose, alertId: entityId, clienteContexto, estadoActual, recargarTabla }) => {
  const [info, setInfo] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [rawResponse, setRawResponse] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [payloadData, setPayloadData] = useState(null);
  const [cargandoPayload, setCargandoPayload] = useState(false);

  const [comentario, setComentario] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('IN_REVIEW');

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

      const cleanEntityId = String(entityId).trim();
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanEntityId);

      let urlEndpoint = `/api/alerts/entity/${cleanEntityId}?status=${estadoActual}`;
      if (!esUUID) {
        urlEndpoint = `/api/alerts/dni/${cleanEntityId}?status=${estadoActual}`;
      }

      fetch(urlEndpoint)
        .then(res => {
          if (!res.ok) throw new Error(`Error en el servidor: Código ${res.status}`);
          return res.json();
        })
        .then(resJson => {
          setRawResponse(resJson);

          // 🚀 BLINDAJE CONTRA ERRORES FANTASMAS DEL BACKEND
          let rawAlerts = [];
          if (Array.isArray(resJson)) {
            rawAlerts = resJson;
          } else if (resJson && Array.isArray(resJson.data)) {
            rawAlerts = resJson.data;
          } else if (resJson && typeof resJson === 'object') {
            const obj = resJson.data || resJson;
            // Solo creamos el array si realmente parece una alerta válida (con fecha, dni, alert_id, etc.)
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
    if (selectedAlertId) {
      setCargandoPayload(true);
      fetch(`/api/alerts/${selectedAlertId}/payload`)
        .then(res => {
          if (!res.ok) throw new Error("No se pudo descargar el payload");
          return res.json();
        })
        .then(pData => {
          setPayloadData(pData);
          if (pData?.review_comment || pData?.comentario || pData?.comment) {
            setComentario(pData.review_comment || pData.comentario || pData.comment);
          }
          setCargandoPayload(false);
        })
        .catch(err => {
          console.error("Error trayendo payload dinámico:", err);
          setPayloadData(null);
          setCargandoPayload(false);
        });
    } else {
      setPayloadData(null);
    }
  }, [selectedAlertId]);

  const alertaActiva = alertas.find(a => a.alert_id === selectedAlertId);

  const alertasDelCliente = alertaActiva
    ? alertas.filter(a => (a.dni && a.dni === alertaActiva.dni) || (a.cliente && a.cliente === alertaActiva.cliente))
    : alertas;

  const cantidadAlertasCliente = alertasDelCliente.length;
  const totalAlertasCargadas = alertas.length;

  const telefonoNativoEnLista = alertas.find(a => a.celular || a.telefono || a.phone || a.mobile);
  const rawTelefonoEncontrado = telefonoNativoEnLista
    ? (telefonoNativoEnLista.celular || telefonoNativoEnLista.telefono || telefonoNativoEnLista.phone || telefonoNativoEnLista.mobile)
    : '';

  // 🚀 LA SOLUCIÓN MAESTRA SE MANTIENE INTACTA
  const guardarRevisionMasiva = async () => {
    if (!comentario) return alert("Por favor, ingresa un comentario justificativo.");
    if (!alertaActiva) return alert("Por favor, selecciona un evento del historial.");
    if (cargandoPayload) return alert("Por favor, espera a que cargue la información del evento seleccionado.");
    if (!payloadData) return alert("El payload aún no ha cargado o está vacío.");

    let idParaRuta = payloadData.customerid || payloadData.customerId || payloadData.customer_id;

    if (!idParaRuta) {
      idParaRuta = payloadData.document_number || payloadData.dni || alertaActiva.dni || alertaActiva.document_number;
    }

    if (!idParaRuta) {
      return alert("Error crítico: No se encontró el campo 'customerid' ni 'dni' en el Payload JSON de esta alerta.");
    }

    const cleanIdParaRuta = String(idParaRuta).trim();
    const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanIdParaRuta);

    const reviewUrl = esUUID
      ? `/api/alerts/entity/${cleanIdParaRuta}/review`
      : `/api/alerts/dni/${cleanIdParaRuta}/review`;

    const body = {
      status: nuevoEstado,
      reviewer_id: "analista@powerpay.pe",
      review_comment: comentario,
      entity_parent_id: String(entityId).trim(),
      target_dni: alertaActiva.dni || alertaActiva.document_number || null,
      target_cliente: alertaActiva.cliente || alertaActiva.full_name || null
    };

    try {
      const res = await fetch(reviewUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        onClose();
        setTimeout(() => {
          recargarTabla();
        }, 800);
      } else {
        alert(`Hubo un problema al procesar la solicitud en el servidor. Código: ${res.status}`);
      }
    } catch (e) {
      alert("Error de red al intentar guardar la revisión.");
    }
  };

  const esSoloLectura = estadoActual === 'DISCARDED';

  return (
    <>
      <div className={`fixed inset-0 bg-black z-40 transition-opacity ${isOpen ? 'opacity-50 visible' : 'opacity-0 invisible'}`} onClick={onClose}></div>

        <div className={`fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-2/5 bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>        <div className="p-6">
          <div className="flex justify-between items-center border-b pb-4 mb-6">
            <h3 className="text-xl font-bold text-power-blue">Revisión de Entidad (Agrupada)</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
          </div>

          {cargando ? (
            <p className="text-center py-10 text-gray-400 italic">Cargando expediente de la entidad...</p>
          ) : (
            <div className="space-y-6">

              {info ? (
                <>
                  {/* Resumen Card */}
                  <div className="bg-power-purple/5 rounded-xl p-4 border border-power-purple/20 grid grid-cols-2 gap-4 shadow-sm text-sm">
                    <div className="col-span-2 border-b border-gray-200 pb-2 mb-2">
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{info.display_label}</p>
                      <p className="text-lg font-black text-gray-800">{info.display_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{info.id_label}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="font-bold text-slate-700 font-mono text-xs bg-white px-2 py-1 rounded-md border border-slate-200/60 truncate max-w-[140px]" title={info.id_value}>
                          {info.id_value}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(info.id_value);
                          }}
                          className="p-1 bg-white hover:bg-slate-100 text-slate-500 rounded border border-slate-200 shadow-xs hover:text-power-purple transition-all active:scale-95 text-xs flex items-center justify-center"
                          title="Copiar identificador completo"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Riesgo Acumulado (Transacciones)</p>
                      <p className="font-bold text-red-600 text-lg mt-0.5">S/ {parseFloat(info.monto_total || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Grid de Auditoría Adaptable */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm text-center">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">1° Compra</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-white px-1 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate" title={info.fecha_primera ? new Date(info.fecha_primera).toLocaleString() : '—'}>
                        {info.fecha_primera ? new Date(info.fecha_primera).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Última Compra</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-white px-1 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate" title={info.fecha_ultima ? new Date(info.fecha_ultima).toLocaleString() : '—'}>
                        {info.fecha_ultima ? new Date(info.fecha_ultima).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo Entidad</span>
                      <span className="text-[11px] font-semibold text-slate-800 bg-white px-2 py-1.5 rounded-lg border border-slate-200 block shadow-xs truncate uppercase">
                        {info.entidad_nombre}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border block shadow-xs truncate ${info.status === 'FRAUD' ? 'bg-red-50 text-red-600 border-red-200' :
                          info.status === 'DISCARDED' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                            info.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              info.status === 'ADDITIONAL_REVIEW' ? 'bg-purple-50 text-power-purple border-purple-200' :
                                'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                        {traducirEstado(info.status)}
                      </span>
                    </div>
                  </div>

                  {/* Historial de Eventos */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-200/50 p-3 border-b border-gray-200">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Historial de Eventos ({totalAlertasCargadas})</h4>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-gray-100 text-gray-500 sticky top-0 z-10 uppercase tracking-wider text-[9px] font-bold">
                          <tr>
                            <th className="p-2 text-center w-8">Sel.</th>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">DNI</th>
                            <th className="p-2">Cliente</th>
                            <th className="p-2">Celular</th>
                            <th className="p-2">Comercio</th>
                            <th className="p-2">Regla / Evento</th>
                            <th className="p-2 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {alertas.map((al, idx) => {
                            const estaSeleccionado = selectedAlertId === al.alert_id;

                            const celularDelPayload = payloadData?.telephonenumber ||
                              payloadData?.phone ||
                              payloadData?.customer?.phone ||
                              payloadData?.mobile;

                            const phoneFinal = al.celular || al.telefono || al.phone || al.mobile || rawTelefonoEncontrado || celularDelPayload;

                            let textCelular = '—';
                            let rawPhoneToCopy = '';

                            if (phoneFinal) {
                              textCelular = phoneFinal;
                              rawPhoneToCopy = phoneFinal;
                            } else if (estaSeleccionado && cargandoPayload) {
                              textCelular = '⏳...';
                            } else {
                              textCelular = 'No reg.';
                            }

                            const nombreComercio = al.tienda || al.comercio || al.merchant || al.merchant_name || '—';

                            return (
                              <tr
                                key={al.alert_id || `alerta-hija-${idx}`}
                                className={`transition-colors cursor-pointer ${estaSeleccionado ? 'bg-power-purple/5 hover:bg-power-purple/10' : 'hover:bg-gray-50'}`}
                                onClick={() => {
                                  setSelectedAlertId(al.alert_id);
                                  setComentario(al.review_comment || al.comentario || al.comment || '');
                                }}
                              >
                                <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="radio"
                                    name="eventSelector"
                                    checked={estaSeleccionado}
                                    onChange={() => {
                                      setSelectedAlertId(al.alert_id);
                                      setComentario(al.review_comment || al.comentario || al.comment || '');
                                    }}
                                    className="h-3 w-3 text-power-purple focus:ring-power-purple border-gray-300 accent-power-purple"
                                  />
                                </td>
                                <td className="p-2 text-gray-500 whitespace-nowrap">
                                  {new Date(al.fecha).toLocaleDateString()}
                                  <br />
                                  <span className="text-[9px] text-gray-400">{new Date(al.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </td>

                                <td className="p-2 font-mono font-bold text-gray-600 whitespace-nowrap">
                                  <div className="flex items-center space-x-1.5">
                                    <span>{al.dni || '—'}</span>
                                    {al.dni && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(al.dni);
                                        }}
                                        className="p-0.5 bg-slate-50 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 hover:text-power-purple transition-all active:scale-90 text-[10px] flex items-center justify-center shadow-xs"
                                        title="Copiar DNI"
                                      >
                                        📋
                                      </button>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2 font-medium text-gray-700 truncate max-w-[180px]" title={al.cliente}>
                                  {al.cliente}
                                </td>

                                <td className="p-2 font-semibold text-gray-700 whitespace-nowrap">
                                  <div className="flex items-center space-x-1.5">
                                    <span>{textCelular}</span>
                                    {rawPhoneToCopy && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(rawPhoneToCopy);
                                        }}
                                        className="p-0.5 bg-slate-50 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 hover:text-power-purple transition-all active:scale-90 text-[10px] flex items-center justify-center shadow-xs"
                                        title="Copiar número celular"
                                      >
                                        📋
                                      </button>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2 font-medium text-gray-600 truncate max-w-[150px]" title={nombreComercio}>
                                  {nombreComercio}
                                </td>

                                <td className="p-2">
                                  <span className="font-mono text-[9px] text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100 font-bold block w-fit mb-0.5" title={al.regla}>
                                    {al.codigoregla}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block truncate max-w-[100px]" title={al.event_type}>
                                    {al.event_type}
                                  </span>
                                </td>
                                <td className="p-2 font-black text-right text-gray-800 whitespace-nowrap">
                                  S/ {parseFloat(al.monto || 0).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Visor de JSON */}
                  <div className="bg-slate-900 rounded-xl p-4 shadow-inner border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        Payload JSON (Evento Seleccionado)
                      </p>
                      {payloadData && !cargandoPayload && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(payloadData, null, 2));
                          }}
                          className="text-[9px] font-black text-emerald-400 flex items-center bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          Copiar JSON
                        </button>
                      )}
                    </div>
                    <pre className="text-emerald-400 text-[10px] overflow-x-auto max-h-40 font-mono scrollbar-thin">
                      {cargandoPayload ? (
                        <span className="italic text-slate-500 animate-pulse">⏳ Descargando metadatos del evento...</span>
                      ) : payloadData ? (
                        JSON.stringify(payloadData, null, 2)
                      ) : (
                        <span className="italic text-slate-500">No hay información de payload mapeada para esta alerta.</span>
                      )}
                    </pre>
                  </div>

                  {/* Formulario Dictamen */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-sm mb-4 uppercase text-gray-500 tracking-wider">Dictamen Global en Lote</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Impactar a todas las alertas como:</label>
                        <select value={esSoloLectura ? 'DISCARDED' : nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} disabled={esSoloLectura} className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple">

                          {estadoActual === 'OPEN' && (
                            <option value="IN_REVIEW">Pasar a En Revisión</option>
                          )}

                          {estadoActual === 'IN_REVIEW' && (
                            <>
                              <option value="IN_REVIEW">Mantener En Revisión</option>
                              <option value="ADDITIONAL_REVIEW">En revisión adicional</option>
                            </>
                          )}

                          {estadoActual === 'ADDITIONAL_REVIEW' && (
                            <option value="ADDITIONAL_REVIEW">Mantener En revisión adicional</option>
                          )}

                          <option value="DISCARDED">Descartar Todas (Falso Positivo)</option>
                          <option value="SUSPICIOUS">Sospechoso (Monitorear)</option>
                          <option value="FRAUD">Fraude Confirmado (Bloquear)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Comentario de Evento Seleccionado</label>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={esSoloLectura} rows="3" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-power-purple" placeholder="Explica el motivo de tu decisión..."></textarea>
                      </div>
                      {!esSoloLectura && (
                        <button onClick={guardarRevisionMasiva} className="w-full bg-power-purple text-white font-bold py-2 rounded-lg shadow-md hover:bg-power-purple/80 transition-all">
                          Guardar y Resolver {cantidadAlertasCliente} Alertas de Cliente Seleccionado
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  <span className="text-4xl mb-4">📭</span>
                  <p className="text-slate-500 font-bold text-center">No se encontraron alertas activas en estado <span className="text-power-purple">{traducirEstado(estadoActual)}</span>.</p>
                  <p className="text-xs text-slate-400 mt-2 text-center">Esto ocurre si la búsqueda no retornó resultados o la alerta fue movida a otra bandeja.</p>
                </div>
              )}

              <div className="pt-2 text-center">
                <span className="text-[9px] font-mono text-slate-300 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  Sincronización de Eventos: {alertas.length} registros renderizados
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReviewDrawer;