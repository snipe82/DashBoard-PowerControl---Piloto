import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import api from '../api';
import RuleDesigner from './RuleDesigner'; 

const MANDATORY_HEADER = `WITH params AS (
  SELECT $1::uuid AS customer_id, $2::varchar AS application_id,
         $3::uuid AS device_id,   $4::uuid AS merchant_id
)`;

const initialFormState = { rule_code: '', rule_name: '', entity_type: 'customer', event_type: 'FullApplicationRT', severity: 'MEDIUM' };

const defaultSql = '';

const RuleForm = ({ ruleToEdit, onCancel, onSuccess }) => {
  const isEdit = !!ruleToEdit;
  
  const [formData, setFormData] = useState(initialFormState);
  const [editableSql, setEditableSql] = useState('');
  
  const [originalData, setOriginalData] = useState(initialFormState);
  const [originalSql, setOriginalSql] = useState('');
  
  const [showDesigner, setShowDesigner] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [versionComment, setVersionComment] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  
  const [compareData, setCompareData] = useState(null);
  
  const [guardando, setGuardando] = useState(false);
  const [errorBackend, setErrorBackend] = useState('');

  const parseIncomingSql = (fullSql) => {
    if (!fullSql) return '';
    const lowerSql = fullSql.toLowerCase();
    const withIndex = lowerSql.indexOf('with params as');
    if (withIndex !== -1) {
      const closingParenIndex = fullSql.indexOf(')', withIndex);
      if (closingParenIndex !== -1) return fullSql.substring(closingParenIndex + 1).trim();
    }
    return fullSql.trim(); 
  };

  // 🛡️ NORMALIZADOR: Evita errores de Case Sensitivity del Backend vs el <select>
  const normalizeMetadata = (data) => {
    let evType = data.event_type || 'FullApplicationRT';
    if (evType.toLowerCase() === 'fullapplicationnrt') evType = 'FullApplicationNRT';
    else if (evType.toLowerCase() === 'fullapplicationrt') evType = 'FullApplicationRT';
    
    let entType = data.entity_type || 'customer';
    entType = entType.toLowerCase();

    return { ...data, event_type: evType, entity_type: entType };
  };

  useEffect(() => {
    if (isEdit) {
      api.get(`/api/v1/rules/${ruleToEdit.rule_code}`).then(res => {
          let ruleData = res.data?.data || res.data?.rule || res.data;
          if (ruleData) {
            // 🚀 Aplicamos el normalizador antes de guardarlo en el estado
            const normalizedData = normalizeMetadata(ruleData);
            const mergedData = { ...initialFormState, ...normalizedData };
            
            setFormData(mergedData);
            setOriginalData(mergedData); 
            
            const cleanSql = parseIncomingSql(ruleData.query_sql);
            setEditableSql(cleanSql);
            setOriginalSql(cleanSql); 
          }
      }).catch(err => console.error(err));
    } else {
      setFormData(initialFormState);
      setOriginalData(initialFormState);
      setEditableSql(defaultSql);
      setOriginalSql(defaultSql);
    }
  }, [isEdit, ruleToEdit]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorBackend(''); 
  };

  const handleFetchHistory = async () => {
    setHistoryModalOpen(true);
    try {
      const res = await api.get(`/api/v1/rules/${ruleToEdit.rule_code}/history`);
      setHistoryData(res.data?.data || res.data || []);
    } catch (error) { console.error("Error trayendo historial"); }
  };

  const confirmSave = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorBackend('');

    const completeSql = `${MANDATORY_HEADER}\n${editableSql}`;
    const finalPayload = { ...formData, query_sql: completeSql, version_comment: versionComment || 'Sin comentario' };

    try {
      if (isEdit) {
        const { rule_code, ...putBody } = finalPayload;
        await api.put(`/api/v1/rules/${ruleToEdit.rule_code}`, putBody);
      } else {
        await api.post(`/api/v1/rules`, finalPayload);
      }
      setSaveModalOpen(false);
      onSuccess(); 
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.response?.data?.error;
      if (status === 400) setErrorBackend('Falla de validación SQL. Abre el diseñador para revisar.');
      else if (status === 409) setErrorBackend('El código ingresado ya está en uso.');
      else setErrorBackend(msg || 'Error procesando la regla.');
      setSaveModalOpen(false);
    } finally {
      setGuardando(false);
    }
  };

  const loadOldVersion = (historyItem) => {
    const normalizedItem = normalizeMetadata(historyItem); // 🚀 Normalizamos el histórico también
    setEditableSql(parseIncomingSql(normalizedItem.query_sql));
    setFormData(prev => ({
      ...prev,
      rule_name: normalizedItem.rule_name || prev.rule_name,
      entity_type: normalizedItem.entity_type || prev.entity_type,
      event_type: normalizedItem.event_type || prev.event_type,
      severity: normalizedItem.severity || prev.severity
    }));
    setHistoryModalOpen(false);
    setCompareData(null);
  };

  const handleRevertToCurrent = () => {
    setFormData(originalData);
    setEditableSql(originalSql);
    setErrorBackend('');
  };

  const openCompare = (historyItem) => {
    const normalizedItem = normalizeMetadata(historyItem);
    setCompareData({
      ...normalizedItem,
      parsedSql: parseIncomingSql(normalizedItem.query_sql)
    });
  };

  const hasChanges = 
    formData.rule_code !== originalData.rule_code ||
    formData.rule_name !== originalData.rule_name ||
    formData.entity_type !== originalData.entity_type ||
    formData.event_type !== originalData.event_type ||
    formData.severity !== originalData.severity ||
    editableSql !== originalSql;

  const isIdentical = compareData ? (
    formData.rule_name === (compareData.rule_name || formData.rule_name) &&
    formData.severity === (compareData.severity || formData.severity) &&
    formData.entity_type === (compareData.entity_type || formData.entity_type) &&
    formData.event_type === (compareData.event_type || formData.event_type) &&
    editableSql === compareData.parsedSql
  ) : false;

  const checkIsCurrentlyLoaded = (item) => {
    const normalizedItem = normalizeMetadata(item);
    const parsedSql = parseIncomingSql(normalizedItem.query_sql);
    return (
      formData.rule_name === (normalizedItem.rule_name || formData.rule_name) &&
      formData.severity === (normalizedItem.severity || formData.severity) &&
      formData.entity_type === (normalizedItem.entity_type || formData.entity_type) &&
      formData.event_type === (normalizedItem.event_type || formData.event_type) &&
      editableSql === parsedSql
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in relative">
      
      {/* HEADER DE FORMULARIO */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-2.5 rounded-full active:scale-95 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 className="text-2xl font-black text-power-blue leading-none">{isEdit ? 'Expediente de Regla' : 'Definición de Nueva Regla'}</h2>
            <p className="text-xs text-gray-400 mt-1 font-bold">Gestión de metadatos y versionamiento</p>
          </div>
        </div>
        
        {isEdit && (
          <button type="button" onClick={handleFetchHistory} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-colors">
            ⏳ Ver Historial / Versiones
          </button>
        )}
      </div>

      {errorBackend && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-bold text-sm shadow-xs animate-fade-in">🛑 {errorBackend}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Código Único (Rule Code)</label>
            <input type="text" name="rule_code" value={formData.rule_code || ''} onChange={handleChange} disabled={isEdit} required placeholder="Ej: RP01" className="w-full p-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-power-purple outline-none disabled:bg-slate-50 disabled:text-gray-400 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Nombre Descriptivo</label>
            <input type="text" name="rule_name" value={formData.rule_name || ''} onChange={handleChange} required placeholder="Ej: Bloqueo por montos inusuales de madrugada" className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-power-purple outline-none font-medium" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Ámbito / Entidad Evaluada</label>
            <select name="entity_type" value={formData.entity_type || 'customer'} onChange={handleChange} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700">
              <option value="customer">Cliente (Customer)</option>
              <option value="merchant">Comercio (Merchant)</option>
              <option value="device">Dispositivo (Device)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 tracking-wide uppercase mb-1.5">Flujo del Evento</label>
            <select name="event_type" value={formData.event_type || 'FullApplicationRT'} onChange={handleChange} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700">
              <option value="FullApplicationRT">FullApplicationRT (Tiempo Real)</option>
              <option value="FullApplicationNRT">FullApplicationNRT (Asíncrono)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="block text-sm font-black text-power-blue uppercase tracking-wide">Estructura SQL (Modo Lectura)</label>
              <p className="text-[10px] text-gray-500 font-bold mt-0.5">La consulta actual de esta regla desplegada en BD.</p>
            </div>
            <button type="button" onClick={() => setShowDesigner(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2">
              <span>🧑‍💻</span> Abrir Diseñador de Reglas
            </button>
          </div>
          
          <div className="rounded-xl overflow-hidden border border-slate-700 shadow-md flex flex-col">
            <div className="bg-slate-800 border-b border-slate-900">
              <div className="bg-slate-900 text-slate-400 text-[10px] px-3 py-1.5 font-mono uppercase tracking-widest flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5"><span>⚙️</span> Bloque CTE Obligatorio (Inmutable)</span>
                <span className="flex items-center gap-1 text-amber-500/70 font-bold">🔒 Fijo</span>
              </div>
              <CodeMirror value={MANDATORY_HEADER} height="auto" theme="dark" extensions={[sql()]} readOnly={true} editable={false} basicSetup={{ lineNumbers: true, highlightActiveLine: false, foldGutter: false }} />
            </div>

            <div className="bg-slate-950">
              <div className="bg-power-purple/10 text-power-blue text-[10px] px-3 py-1.5 font-mono uppercase tracking-widest flex justify-between items-center border-b border-power-purple/20">
                <span className="font-bold">Cuerpo de la Consulta</span>
                <span className="text-slate-400 font-bold">Solo lectura</span>
              </div>
              <CodeMirror value={editableSql} placeholder="-- No hay código SQL definido. Abre el Diseñador de Reglas para comenzar a estructurar tu query." height="auto" maxHeight="400px" theme="dark" extensions={[sql()]} readOnly={true} editable={false} basicSetup={{ lineNumbers: true, highlightActiveLine: false, foldGutter: false }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 gap-3 items-center">
          {!hasChanges && isEdit && <span className="text-xs font-bold text-gray-400 italic">No hay cambios pendientes...</span>}
          {hasChanges && isEdit && (
            <button type="button" onClick={handleRevertToCurrent} className="px-6 py-3 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all active:scale-95 text-sm shadow-sm border border-rose-100">
              ↩️ Descartar cambios sin guardar
            </button>
          )}
          <button type="button" onClick={() => setSaveModalOpen(true)} disabled={!formData.rule_code || !formData.rule_name || !hasChanges} className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-lg ${hasChanges && formData.rule_code && formData.rule_name ? 'bg-power-purple text-white hover:bg-power-purple/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}>
            💾 Guardar Versión
          </button>
        </div>
      </div>

      {showDesigner && (
        <RuleDesigner 
          initialSql={editableSql} 
          ruleEventType={formData.event_type} 
          ruleEntityType={formData.entity_type} 
          onApplySql={(newSql) => { setEditableSql(newSql); setShowDesigner(false); }} 
          onClose={() => setShowDesigner(false)} 
        />
      )}

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[50]">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h3 className="text-xl font-black text-power-blue mb-1">Confirmar Cambios</h3>
            <p className="text-xs text-gray-500 mb-5 font-medium">Ingresa un comentario para la bitácora de auditoría (Opcional).</p>
            <form onSubmit={confirmSave}>
              <textarea value={versionComment} onChange={e => setVersionComment(e.target.value)} rows="3" className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-power-purple focus:ring-2 focus:ring-power-purple/20 resize-none mb-6 bg-gray-50" placeholder="Ej: Se ajustó el WHERE para la campaña CyberDays..."></textarea>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSaveModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-power-purple text-white hover:bg-power-purple/90 disabled:opacity-50 transition-colors">
                  {guardando ? 'Guardando...' : 'Confirmar e Impactar BD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex justify-end z-[40]">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-fade-in-right">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg font-black text-power-blue">Línea de Tiempo</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formData.rule_code}</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {historyData.length === 0 ? (
                <p className="text-center text-sm text-gray-400 italic mt-10">No hay historial registrado.</p>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                  {historyData.map((item, idx) => {
                    const isCurrent = idx === 0; 
                    const isLoaded = checkIsCurrentlyLoaded(item); 
                    
                    return (
                      <div key={idx} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm ${isCurrent ? 'bg-emerald-500' : (isLoaded ? 'bg-blue-500' : 'bg-power-purple')}`}></div>
                        <div className={`bg-white border p-4 rounded-xl shadow-sm transition-colors group ${isCurrent ? 'border-emerald-200' : (isLoaded ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-power-purple/50')}`}>
                          
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                {item.fecha_change_lima || item.created_at || 'Fecha Desconocida'}
                              </span>
                              {isCurrent && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase shadow-sm">🌟 ACTUAL</span>}
                              {isLoaded && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase border border-blue-200 shadow-sm animate-fade-in">👀 EN EDITOR</span>}
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${item.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                              {item.is_active ? 'Activa' : 'Apagada'}
                            </span>
                          </div>
                          <p className="text-xs font-black text-gray-800 break-all mb-1">{item.changed_by || 'Sistema'}</p>
                          <p className="text-xs text-gray-600 bg-slate-50 p-2 rounded border border-slate-100 italic mb-4">"{item.version_comment || 'Sin comentario de versión'}"</p>
                          
                          <div className="flex flex-col gap-2">
                            {!isCurrent && (
                              <button onClick={() => openCompare(item)} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 py-2 rounded-lg transition-colors">
                                ⚖️ Comparar con el editor
                              </button>
                            )}
                            
                            <button 
                              onClick={() => loadOldVersion(item)} 
                              disabled={isLoaded}
                              className={`w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors ${
                                isLoaded 
                                  ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed' 
                                  : 'text-power-purple bg-power-purple/5 hover:bg-power-purple hover:text-white border border-power-purple/20'
                              }`}
                            >
                              {isLoaded ? '✅ Cargada actualmente' : '🔄 Cargar en el editor'}
                            </button>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {compareData && (
        <div className="fixed inset-0 bg-slate-900/95 flex flex-col z-[60] animate-fade-in backdrop-blur-sm">
          <div className="p-4 flex justify-between items-center border-b border-slate-800 shrink-0 bg-slate-950">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">⚖️ Comparador de Versiones</h2>
              <p className="text-xs text-slate-400 mt-1">Revisa las diferencias en campos y lógica antes de restaurar.</p>
            </div>
            <div className="flex gap-3 items-center">
              <button 
                onClick={() => loadOldVersion(compareData)} 
                disabled={isIdentical}
                className={`px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-colors ${isIdentical ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-power-purple hover:bg-purple-500 text-white'}`}
              >
                {isIdentical ? 'Versiones Idénticas' : '🔄 Restaurar Versión Histórica (Sobreescribir)'}
              </button>
              <button onClick={() => setCompareData(null)} className="bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-slate-700 hover:border-rose-800">
                Cerrar
              </button>
            </div>
          </div>

          {isIdentical && (
            <div className="mx-4 mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-center gap-3 animate-fade-in shadow-inner shrink-0">
               <span className="text-xl">✨</span>
               <p className="text-emerald-400 text-sm font-bold tracking-wide">
                 ¡Esta versión histórica es exactamente igual a lo que tienes en tu editor actual! No hay diferencias.
               </p>
            </div>
          )}
          
          <div className="flex-1 flex overflow-hidden p-4 gap-4">
            
            {/* 📝 PANEL IZQUIERDO: ACTUAL */}
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
              <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-900">
                <span className="text-xs font-bold text-power-blue uppercase tracking-widest">📝 Tu Editor Actual</span>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded">Versión de Trabajo</span>
              </div>
              
              <div className="bg-slate-800/50 p-4 grid grid-cols-2 gap-3 border-b border-slate-700 text-[11px]">
                <div><span className="text-slate-500 block mb-1">Nombre:</span> <span className="text-slate-200 font-bold">{formData.rule_name}</span></div>
                <div><span className="text-slate-500 block mb-1">Severidad:</span> <span className="text-slate-200 font-bold">{formData.severity}</span></div>
                <div><span className="text-slate-500 block mb-1">Entidad:</span> <span className="text-slate-200 font-bold">{formData.entity_type}</span></div>
                <div><span className="text-slate-500 block mb-1">Evento:</span> <span className="text-slate-200 font-bold">{formData.event_type}</span></div>
              </div>

              <div className="flex-1 bg-slate-950 overflow-auto">
                <CodeMirror value={editableSql} theme="dark" extensions={[sql()]} readOnly={true} basicSetup={{ lineNumbers: true }} />
              </div>
            </div>

            {/* 🕰️ PANEL DERECHO: HISTÓRICO */}
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-power-purple/50 shadow-2xl">
              <div className="bg-power-purple/20 px-4 py-2 flex justify-between items-center border-b border-power-purple/30">
                <span className="text-xs font-bold text-power-purple uppercase tracking-widest">🕰️ Archivo Histórico</span>
                <span className="text-[10px] text-power-purple bg-power-purple/10 border border-power-purple/20 px-2 py-1 rounded font-bold">
                  {compareData.fecha_change_lima || compareData.created_at || 'Fecha Desconocida'}
                </span>
              </div>

              <div className="bg-power-purple/5 p-4 grid grid-cols-2 gap-3 border-b border-power-purple/20 text-[11px]">
                {[
                  { label: 'Nombre', key: 'rule_name' },
                  { label: 'Severidad', key: 'severity' },
                  { label: 'Entidad', key: 'entity_type' },
                  { label: 'Evento', key: 'event_type' }
                ].map(field => {
                  const isDiff = formData[field.key] !== compareData[field.key];
                  return (
                    <div key={field.key}>
                      <span className="text-power-purple/60 block mb-1">{field.label}:</span> 
                      <span className={`font-bold px-1.5 py-0.5 rounded ${isDiff ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-inner' : 'text-slate-300'}`}>
                        {compareData[field.key] || 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 bg-slate-950 overflow-auto">
                <CodeMirror value={compareData.parsedSql} theme="dark" extensions={[sql()]} readOnly={true} basicSetup={{ lineNumbers: true }} />
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default RuleForm;