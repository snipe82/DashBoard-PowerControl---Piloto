import React, { useState, useEffect } from 'react';

const ReviewDrawer = ({ isOpen, onClose, alertId, estadoActual, recargarTabla }) => {
  const [alerta, setAlerta] = useState(null);
  const [payload, setPayload] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [comentario, setComentario] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('IN_REVIEW');

  useEffect(() => {
    if (isOpen && alertId) {
      setCargando(true);
      Promise.all([
        fetch(`/api/alerts/${alertId}`).then(res => res.json()),
        fetch(`/api/alerts/${alertId}/payload`).then(res => res.json())
      ])
        .then(([dataAlerta, dataPayload]) => {
          setAlerta(dataAlerta);
          setPayload(dataPayload);
          setComentario(dataAlerta.review_comment || '');
          setNuevoEstado(dataAlerta.status === 'OPEN' ? 'IN_REVIEW' : dataAlerta.status);
          setCargando(false);
        })
        .catch(err => {
          console.error("Error cargando detalle", err);
          setCargando(false);
        });
    }
  }, [isOpen, alertId]);

  const copiarJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    alert("¡JSON Copiado!");
  };

  const guardarRevision = async () => {
    if (!comentario) return alert("Por favor, ingresa un comentario justificativo.");

    const esCaso = (estadoActual === 'FRAUD' || estadoActual === 'SUSPICIOUS');
    const url = esCaso ? `/api/cases/${alerta.case_id}/resolve` : `/api/alerts/${alerta.alert_id}/review`;

    const body = esCaso
      ? { case_status: nuevoEstado, reviewer_id: "analista@powerpay.pe", resolution_comment: comentario }
      : { status: nuevoEstado, reviewer_id: "analista@powerpay.pe", review_comment: comentario, priority: "HIGH" };

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert("✅ Gestión guardada con éxito.");
        onClose();
        recargarTabla();
      }
    } catch (e) {
      alert("Error al guardar la revisión.");
    }
  };

  const celular = payload?.telephonenumber || payload?.phone || payload?.customer?.phone || payload?.mobile || "No registrado";
  const esSoloLectura = estadoActual === 'DISCARDED';

  return (
    <>
      <div
        className={`fixed inset-0 bg-black transition-opacity z-40 ${isOpen ? 'opacity-50 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      ></div>

      <div className={`fixed right-0 top-0 h-full w-1/3 bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center border-b pb-4 mb-6">
            <h3 className="text-xl font-bold text-power-blue">Detalle de Revisión</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
          </div>

          {cargando ? (
            <p className="text-center py-10 text-gray-400 italic">Cargando datos del cliente...</p>
          ) : alerta && (
            <div className="space-y-6">

              {/* 1. Info del Cliente */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-4 shadow-sm text-sm">
                <div className="col-span-2 border-b border-gray-200 pb-2 mb-2">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Cliente</p>
                  <p className="text-base font-black text-gray-800">{alerta.cliente}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">DNI</p>
                  <p className="font-bold">{alerta.dni || 'No disponible'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Celular</p>
                  <p className="font-bold text-green-600">📱 {celular}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Monto</p>
                  <p className="font-bold text-power-purple">S/ {alerta.monto}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Tienda</p>
                  <p className="truncate font-bold">{alerta.tienda}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Regla</p>
                  <p className="text-xs font-mono text-red-500 font-bold">{alerta.codigoregla} - {alerta.regla}</p>
                </div>
              </div>

              {/* 🚀 1.5 NUEVA SECCIÓN DE DATOS DE ENTIDAD Y EVENTO */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cód. Entidad
                  </span>
                  <span className="text-sm font-semibold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-block min-w-[60px] text-center shadow-xs">
                    {alerta.codigo_entidad || alerta.entity_code || '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tipo Evento
                  </span>
                  <span className="text-sm font-semibold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-block shadow-xs">
                    {alerta.tipo_evento || alerta.event_type || '—'}
                  </span>
                </div>

                {/* Tipo de Entidad - MODIFICADO PARA LEER 'alerta.entidad' */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tipo Entidad
                  </span>
                  <span className="text-sm font-semibold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-block shadow-xs">
                    {/* 🚀 LEEMOS DIRECTAMENTE EL CAMPO 'entidad' QUE VIENE DEL BACKEND */}
                    {alerta.entidad || alerta.tipo_entidad || alerta.entity_type || '—'}
                  </span>
                </div>
              </div>

              {/* 2. Veredicto Anterior */}
              {alerta.reviewer_id && (
                <div className="bg-power-purple/5 p-4 rounded-xl border border-power-purple/20">
                  <p className="text-[10px] font-black text-power-purple uppercase tracking-widest mb-2">Veredicto Anterior</p>
                  <p className="text-xs italic text-gray-700 bg-white p-2 rounded border mt-1 leading-relaxed shadow-sm">
                    "{alerta.review_comment}"
                  </p>
                </div>
              )}

              {/* 3. Payload JSON */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payload JSON</p>
                  <button onClick={copiarJSON} className="text-[10px] font-black text-power-purple flex items-center bg-power-purple/10 px-2 py-1 rounded border border-power-purple/20 hover:bg-power-purple/20 transition-colors">
                    Copiar
                  </button>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[10px] overflow-x-auto max-h-48 font-mono shadow-inner">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>

              {/* 4. Formulario de Acción / Lectura */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-sm mb-4 uppercase text-gray-500 tracking-wider">
                  {esSoloLectura ? 'ALERTA FINALIZADA (LECTURA)' : 'Acción de Analista'}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Dictamen / Nuevo Estado</label>
                    <select
                      value={esSoloLectura ? 'DISCARDED' : nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value)}
                      disabled={esSoloLectura}
                      className="w-full p-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-power-purple disabled:opacity-60 disabled:bg-gray-100"
                    >
                      {esSoloLectura ? (
                        <option value="DISCARDED">Ya Descartada</option>
                      ) : estadoActual === 'FRAUD' || estadoActual === 'SUSPICIOUS' ? (
                        <>
                          <option value="CLOSED_CONFIRMED_FRAUD">Confirmar Fraude</option>
                          <option value="CLOSED_FALSE_POSITIVE">Falso Positivo</option>
                        </>
                      ) : (
                        <>
                          <option value="IN_REVIEW">En Revisión</option>
                          <option value="DISCARDED">Descartar</option>
                          <option value="SUSPICIOUS">Sospechoso</option>
                          <option value="FRAUD">Fraude</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Comentario Justificativo</label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      disabled={esSoloLectura}
                      rows="3"
                      className="w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-power-purple disabled:opacity-60 disabled:bg-gray-100"
                      placeholder="Explica el motivo de tu decisión..."
                    ></textarea>
                  </div>

                  {/* El botón de guardar solo aparece si NO es de solo lectura */}
                  {!esSoloLectura && (
                    <button
                      onClick={guardarRevision}
                      className="w-full bg-power-purple text-white font-bold py-2 rounded-lg hover:bg-power-purple/80 transition-all shadow-md"
                    >
                      Guardar y Procesar
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReviewDrawer;