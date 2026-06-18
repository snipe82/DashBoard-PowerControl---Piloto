import React, { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import api from '../api';
import RuleDesigner from './RuleDesigner'; 

const MANDATORY_HEADER = `WITH params AS (
  SELECT $1::uuid AS customer_id, $2::varchar AS application_id,
         $3::uuid AS device_id,   $4::uuid AS merchant_id
)`;

const initialFormState = { 
  rule_code: '', 
  rule_name: '', 
  entity_type: 'customer', 
  event_type: 'FullApplicationRT', 
  severity: 'MEDIUM',
  lifecycle_status: 'DRAFT',
  version_number: 1,
  is_production: false,
  is_active: true,
  version_comment: ''
};

const defaultSql = '';

const RuleForm = ({ ruleToEdit, onCancel, onSuccess }) => {
  const isEdit = !!ruleToEdit;
  
  const [formData, setFormData] = useState(initialFormState);
  
  // FLAGS DE ENTORNO Y ETAPA
  const isReadOnly = ruleToEdit?._isReadOnly || false;
  const isFromWorkflow = ruleToEdit?._fromWorkflow || false;
  
  const statusUpper = (formData.lifecycle_status || '').toUpperCase();
  const isCurrentVersionDeployed = statusUpper === 'DEPLOYED' || formData.is_production === true;
  
  // ESCUDO
  const isLockedByStage = isEdit && statusUpper !== 'DRAFT';
  
  // Gobernador maestro
  const formDisabled = isReadOnly || isFromWorkflow || isLockedByStage;
  
  const [editableSql, setEditableSql] = useState('');
  
  const [originalData, setOriginalData] = useState(initialFormState);
  const [originalSql, setOriginalSql] = useState('');
  
  const [loadedHistoryVersion, setLoadedHistoryVersion] = useState(null);

  const [showDesigner, setShowDesigner] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  
  const [saveMode, setSaveMode] = useState('overwrite'); 
  
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

  const normalizeMetadata = (data) => {
    let evType = data.event_type || 'FullApplicationRT';
    if (evType.toLowerCase() === 'fullapplicationnrt') evType = 'FullApplicationNRT';
    else if (evType.toLowerCase() === 'fullapplicationrt') evType = 'FullApplicationRT';
    
    let entType = data.entity_type || 'customer';
    entType = entType.toLowerCase();

    return { 
      ...data, 
      event_type: evType, 
      entity_type: entType,
      lifecycle_status: (data.lifecycle_status || 'DRAFT').toUpperCase(),
      version_number: data.version_number || 1,
      is_production: !!data.is_production,
      is_active: data.is_active !== undefined ? !!data.is_active : true,
      version_comment: data.version_comment || ''
    };
  };

  useEffect(() => {
    if (isEdit) {
      api.get(`/api/v1/rules/${ruleToEdit.rule_code}/history`).then(res => {
          let arrayData = res.data?.data || res.data || [];
          
          let ruleData = null;
          
          if (Array.isArray(arrayData) && arrayData.length > 0) {
            ruleData = arrayData.find(r => r.is_latest === true || r.is_latest === 'true');
            if (!ruleData) {
              ruleData = arrayData.sort((a, b) => b.version_number - a.version_number)[0];
            }
          } else {
            ruleData = arrayData;
          }

          if (ruleData) {
            const combinedData = {
              ...initialFormState,
              ...ruleToEdit,
              ...ruleData, 
              lifecycle_status: ruleData.lifecycle_status || ruleToEdit.lifecycle_status || 'DRAFT',
              version_number: ruleData.version_number || ruleToEdit.version_number || 1,
              is_production: ruleData.is_production !== undefined ? ruleData.is_production : !!ruleToEdit.is_production,
              is_latest: ruleData.is_latest !== undefined ? ruleData.is_latest : !!ruleToEdit.is_latest,
              is_active: ruleData.is_active !== undefined ? ruleData.is_active : (ruleToEdit.is_active !== undefined ? ruleToEdit.is_active : true)
            };

            const normalizedData = normalizeMetadata(combinedData);
            setFormData(normalizedData);
            setOriginalData(normalizedData); 
            setLoadedHistoryVersion(normalizedData.version_number);
            
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

  const cleanSqlForCompare = (str) => {
    return (str || '').trim().replace(/\s+/g, ' ');
  };

  const hasChanges = 
    formData.rule_code !== originalData.rule_code ||
    formData.rule_name !== originalData.rule_name ||
    formData.entity_type !== originalData.entity_type ||
    formData.event_type !== originalData.event_type ||
    formData.severity !== originalData.severity ||
    formData.is_active !== originalData.is_active ||
    cleanSqlForCompare(editableSql) !== cleanSqlForCompare(originalSql);

  const handleOpenSaveModal = (mode) => {
    if (!hasChanges) {
      setErrorBackend('🛑 Operación denegada: La regla es idéntica a la última versión guardada. Debes realizar al menos un cambio en los metadatos o en el código SQL para generar o sobreescribir una versión.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaveMode(mode);
    setSaveModalOpen(true);
  };

  const confirmSave = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorBackend('');

    const completeSql = `${MANDATORY_HEADER}\n${editableSql}`;
    
    const finalComment = saveMode === 'new_version' 
      ? (versionComment || 'Nueva versión') 
      : (formData.version_comment || 'Actualización de borrador');

    const finalPayload = { 
      rule_code: formData.rule_code,
      rule_name: formData.rule_name,
      entity_type: formData.entity_type,
      event_type: formData.event_type,
      severity: formData.severity,
      is_active: Boolean(formData.is_active),
      query_sql: completeSql, 
      version_comment: finalComment,
      force_new_version: saveMode === 'new_version' 
    };

    try {
      const targetCode = formData.rule_code;
      await api.post(`/api/v1/rules/${targetCode}/draft`, finalPayload);
      setSaveModalOpen(false);
      
      if (saveMode === 'new_version') {
        onSuccess(); 
      } else {
        setOriginalData(formData);
        setOriginalSql(editableSql);
        setLoadedHistoryVersion(formData.version_number);
      }
      
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

  const handleChangeStatus = async (nextStatus, isBackward = false) => {
    const accionText = isBackward ? 'devolver/rechazar' : 'avanzar';
    if (!window.confirm(`¿Estás seguro de ${accionText} esta versión a la etapa: ${nextStatus}?`)) return;
    
    setGuardando(true);
    setErrorBackend('');

    if (nextStatus === 'TESTING' && !isBackward) {
      try {
        const completeSql = `${MANDATORY_HEADER}\n${editableSql}`;
        const valRes = await api.post('/api/v1/rules/validate', { query_sql: completeSql });
        
        if (valRes.data?.errors && valRes.data.errors.length > 0) {
          setErrorBackend(`❌ Linter de Seguridad: ${valRes.data.errors.join(' | ')}. Aborta y corrige en el editor.`);
          setGuardando(false);
          return; 
        }
      } catch (error) {
        const errs = error.response?.data?.errors;
        if (errs && errs.length > 0) {
          setErrorBackend(`❌ Linter de Seguridad: ${errs.join(' | ')}. Aborta y corrige en el editor.`);
        } else {
          setErrorBackend('🛑 Falló la conexión con el motor de validación. Intenta nuevamente.');
        }
        setGuardando(false);
        return; 
      }
    }

    try {
      await api.put(`/api/v1/rules/${ruleToEdit.rule_code}/status`, { status: nextStatus });
      onSuccess(); 
    } catch (error) {
      setErrorBackend('Error al cambiar de estado. (Asegúrate de que el Backend permite esta transición).');
    } finally {
      setGuardando(false);
    }
  };

  const loadOldVersion = (historyItem) => {
    const normalizedItem = normalizeMetadata(historyItem); 
    setEditableSql(parseIncomingSql(normalizedItem.query_sql));
    setFormData(prev => ({
      ...prev,
      rule_name: normalizedItem.rule_name || prev.rule_name,
      entity_type: normalizedItem.entity_type || prev.entity_type,
      event_type: normalizedItem.event_type || prev.event_type,
      severity: normalizedItem.severity || prev.severity,
      is_active: normalizedItem.is_active !== undefined ? normalizedItem.is_active : prev.is_active
    }));
    setLoadedHistoryVersion(normalizedItem.version_number);
    setHistoryModalOpen(false);
    setCompareData(null);
  };

  const handleRevertToCurrent = () => {
    setFormData(originalData);
    setEditableSql(originalSql);
    setLoadedHistoryVersion(originalData.version_number);
    setErrorBackend('');
  };

  const openCompare = (historyItem) => {
    const normalizedItem = normalizeMetadata(historyItem);
    setCompareData({
      ...normalizedItem,
      parsedSql: parseIncomingSql(normalizedItem.query_sql)
    });
  };

  const checkIsCurrentlyLoaded = (item) => {
    if (loadedHistoryVersion !== null) {
      return item.version_number === loadedHistoryVersion;
    }
    const normalizedItem = normalizeMetadata(item);
    const parsedSql = parseIncomingSql(normalizedItem.query_sql);
    return (
      formData.rule_name === (normalizedItem.rule_name || formData.rule_name) &&
      formData.severity === (normalizedItem.severity || formData.severity) &&
      formData.entity_type === (normalizedItem.entity_type || formData.entity_type) &&
      formData.event_type === (normalizedItem.event_type || formData.event_type) &&
      formData.is_active === (normalizedItem.is_active !== undefined ? !!normalizedItem.is_active : formData.is_active) &&
      cleanSqlForCompare(editableSql) === cleanSqlForCompare(parsedSql)
    );
  };

  // 🚀 LÓGICA DEL MOTOR DE DIFF LINEA POR LINEA (SIN LIBRERÍAS EXTERNAS)
  const { leftSqlNodes, rightSqlNodes } = useMemo(() => {
    if (!compareData) return { leftSqlNodes: null, rightSqlNodes: null };
    
    const currentLines = (editableSql || '').split('\n');
    const historyLines = (compareData.parsedSql || '').split('\n');
    const maxLines = Math.max(currentLines.length, historyLines.length);

    const left = [];
    const right = [];

    for (let i = 0; i < maxLines; i++) {
      const cLine = currentLines[i];
      const hLine = historyLines[i];
      const isDiff = cLine !== hLine;

      left.push(
        <div key={`c-${i}`} className={`px-3 py-0.5 font-mono text-[11px] whitespace-pre flex border-b border-transparent ${isDiff ? 'bg-emerald-900/30 text-emerald-200 border-emerald-500/20' : 'text-slate-300 hover:bg-slate-800/50'}`}>
          <span className="w-8 shrink-0 text-slate-600 text-right pr-3 select-none">{i + 1}</span>
          <span className="break-all">{cLine !== undefined ? cLine : ' '}</span>
        </div>
      );

      right.push(
        <div key={`h-${i}`} className={`px-3 py-0.5 font-mono text-[11px] whitespace-pre flex border-b border-transparent ${isDiff ? 'bg-rose-900/30 text-rose-200 border-rose-500/20' : 'text-slate-300 hover:bg-slate-800/50'}`}>
          <span className="w-8 shrink-0 text-slate-600 text-right pr-3 select-none">{i + 1}</span>
          <span className="break-all">{hLine !== undefined ? hLine : ' '}</span>
        </div>
      );
    }
    return { leftSqlNodes: left, rightSqlNodes: right };
  }, [editableSql, compareData]);


  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in relative">
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-2.5 rounded-full active:scale-95 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 className="text-2xl font-black text-power-blue leading-none">
              {isReadOnly ? 'Inspección de Regla (Producción)' : (isEdit ? 'Expediente de Regla' : 'Definición de Nueva Regla')}
            </h2>
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

      {isReadOnly && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl font-bold text-sm shadow-xs flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">👁️</span>
          <div>
            <p className="uppercase tracking-widest text-[10px] font-black opacity-80 mb-0.5">Modo de Inspección Seguro</p>
            <p className="font-medium text-xs">Estás visualizando el código que está operando en la <b>Vitrina de Producción</b>. Los cambios directos están bloqueados. Para modificar esta regla, entra a la pestaña "Laboratorio" y trabaja sobre su versión más reciente.</p>
          </div>
        </div>
      )}

      {isFromWorkflow && !isCurrentVersionDeployed && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-xl font-bold text-sm shadow-xs flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">📋</span>
          <div>
            <p className="uppercase tracking-widest text-[10px] font-black opacity-80 mb-0.5">Auditoría de Pipeline (CI/CD)</p>
            <p className="font-medium text-xs">El formulario está bloqueado contra cambios. Desde aquí solo puedes auditar la configuración y <b>gestionar la etapa de la regla</b> en el embudo de publicación a través del panel inferior.</p>
          </div>
        </div>
      )}

      {isLockedByStage && !isReadOnly && !isFromWorkflow && !isCurrentVersionDeployed && (
        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl font-bold text-sm shadow-xs flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="uppercase tracking-widest text-[10px] font-black opacity-80 mb-0.5">Versión Congelada</p>
            <p className="font-medium text-xs">Esta regla se encuentra en <b>{statusUpper}</b>. La edición de código o metadatos está bloqueada para garantizar la integridad de las pruebas. Usa los controles del ciclo de vida para avanzar o retroceder.</p>
          </div>
        </div>
      )}

      {isEdit && !isReadOnly && (
        <div className="mb-6 bg-slate-900 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md border border-slate-800 animate-fade-in">
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="w-10 h-10 rounded-full bg-power-purple/20 flex items-center justify-center text-xl shrink-0">
               {isCurrentVersionDeployed ? '🟢' : (statusUpper === 'TESTING' ? '🧪' : statusUpper === 'PENDING_APPROVAL' ? '⏳' : '📝')}
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Estado de la Versión Actual (v{formData.version_number})</p>
               <p className="text-base font-black text-white">
                 {isCurrentVersionDeployed ? 'DEPLOYED (En producción)' : statusUpper}
               </p>
             </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             {isCurrentVersionDeployed ? (
               <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-center w-full md:w-auto">
                 {isFromWorkflow 
                    ? `✅ Esta versión (v${formData.version_number}) ya se encuentra desplegada en producción.`
                    : `💡 Realiza cambios y guarda para abrir la Versión v${formData.version_number + 1} en DRAFT`
                 }
               </span>
             ) : (
               <>
                 {statusUpper === 'DRAFT' && (
                   <button type="button" onClick={() => handleChangeStatus('TESTING')} disabled={guardando || hasChanges} className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-amber-950 px-4 py-2 rounded-lg font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50" title={hasChanges ? "Guarda tus cambios pendientes antes de enviar a pruebas." : ""}>
                     ⏩ Enviar a Pruebas
                   </button>
                 )}
                 {statusUpper === 'TESTING' && (
                   <>
                     <button type="button" onClick={() => handleChangeStatus('DRAFT', true)} disabled={guardando} className="w-full md:w-auto bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50">
                       ⏪ Devolver a Borrador
                     </button>
                     <button type="button" onClick={() => handleChangeStatus('PENDING_APPROVAL')} disabled={guardando} className="w-full md:w-auto bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50">
                       ⏩ Solicitar Aprobación
                     </button>
                   </>
                 )}
                 {statusUpper === 'PENDING_APPROVAL' && (
                   <>
                     <button type="button" onClick={() => handleChangeStatus('TESTING', true)} disabled={guardando} className="w-full md:w-auto bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50">
                       ⏪ Rechazar a Pruebas
                     </button>
                     <button type="button" onClick={() => handleChangeStatus('DEPLOYED')} disabled={guardando} className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5 justify-center">
                       <span>🚀</span> Desplegar a Producción
                     </button>
                   </>
                 )}
               </>
             )}
          </div>
        </div>
      )}

      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6 ${formDisabled ? 'opacity-95' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6 border-b border-gray-100">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Código Único (Rule Code)</label>
            <input type="text" name="rule_code" value={formData.rule_code || ''} onChange={handleChange} disabled={isEdit || formDisabled} required placeholder="Ej: RP01" className="w-full p-2.5 border rounded-lg text-sm font-mono outline-none disabled:bg-slate-50 disabled:text-gray-400 font-bold" />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Nombre Descriptivo</label>
            <input type="text" name="rule_name" value={formData.rule_name || ''} onChange={handleChange} disabled={formDisabled} required placeholder="Ej: Bloqueo por montos inusuales de madrugada" className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-power-purple outline-none font-medium disabled:bg-slate-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Ámbito / Entidad Evaluada</label>
            <select name="entity_type" value={formData.entity_type || 'customer'} onChange={handleChange} disabled={formDisabled} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700 disabled:bg-slate-50 disabled:text-gray-500 disabled:opacity-100 cursor-auto">
              <option value="customer">Cliente (Customer)</option>
              <option value="merchant">Comercio (Merchant)</option>
              <option value="device">Dispositivo (Device)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 tracking-wide uppercase mb-1.5">Flujo del Evento</label>
            <select name="event_type" value={formData.event_type || 'FullApplicationRT'} onChange={handleChange} disabled={formDisabled} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700 disabled:bg-slate-50 disabled:text-gray-500 disabled:opacity-100 cursor-auto">
              <option value="FullApplicationRT">FullApplicationRT (Tiempo Real)</option>
              <option value="FullApplicationNRT">FullApplicationNRT (Asíncrono)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Severidad del Riesgo</label>
            <select name="severity" value={formData.severity || 'MEDIUM'} onChange={handleChange} disabled={formDisabled} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700 disabled:bg-slate-50 disabled:text-gray-500 disabled:opacity-100 cursor-auto">
              <option value="LOW">Baja (LOW)</option>
              <option value="MEDIUM">Media (MEDIUM)</option>
              <option value="HIGH">Alta (HIGH)</option>
              <option value="CRITICAL">Crítica (CRITICAL)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 tracking-wide uppercase mb-1.5">Estado Objetivo en Despliegue</label>
            <select 
              name="is_active" 
              value={formData.is_active ? "true" : "false"} 
              onChange={(e) => { setFormData({ ...formData, is_active: e.target.value === "true" }); setErrorBackend(''); }} 
              disabled={formDisabled} 
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none font-bold text-slate-700 disabled:bg-slate-50 disabled:text-gray-500 disabled:opacity-100 cursor-auto"
            >
              <option value="true">🟢 Activa (Evaluando Tráfico Vivo)</option>
              <option value="false">🔴 Apagada (Ignorar Alertas)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="block text-sm font-black text-power-blue uppercase tracking-wide">Estructura SQL (Modo Lectura)</label>
              <p className="text-[10px] text-gray-500 font-bold mt-0.5">La consulta actual de esta regla desplegada en BD.</p>
            </div>
            
            {!formDisabled && (
              <button type="button" onClick={() => setShowDesigner(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2">
                <span>🧑‍💻</span> Abrir Diseñador de Reglas
              </button>
            )}
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
              <CodeMirror value={editableSql} placeholder="-- No hay código SQL definido." height="auto" maxHeight="400px" theme="dark" extensions={[sql()]} readOnly={true} editable={false} basicSetup={{ lineNumbers: true, highlightActiveLine: false, foldGutter: false }} />
            </div>
          </div>
        </div>

        {!formDisabled && (
          <div className="flex justify-end pt-4 gap-3 items-center">
            
            <span className="text-xs font-bold text-gray-400 italic">
              {hasChanges ? '⚠️ Tienes modificaciones sin confirmar...' : 'No hay cambios pendientes...'}
            </span>
            
            {hasChanges && isEdit && (
              <button type="button" onClick={handleRevertToCurrent} className="px-6 py-3 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all active:scale-95 text-sm shadow-sm border border-rose-100">
                ↩️ Descartar
              </button>
            )}

            {statusUpper === 'DRAFT' && isEdit && (
              <button 
                type="button" 
                onClick={() => handleOpenSaveModal('new_version')}
                disabled={!formData.rule_code || !formData.rule_name}
                className={`px-6 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm shadow-sm border ${
                  hasChanges 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' 
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                🆕 Crear como Nueva Versión (v{formData.version_number + 1})
              </button>
            )}
            
            <button 
              type="button" 
              onClick={() => handleOpenSaveModal(isCurrentVersionDeployed || !isEdit ? 'new_version' : 'overwrite')} 
              disabled={!formData.rule_code || !formData.rule_name} 
              className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-lg ${
                hasChanges 
                  ? 'bg-power-purple text-white hover:bg-power-purple/90' 
                  : 'bg-slate-300 text-slate-500 hover:bg-slate-400 shadow-none'
              }`}
            >
              💾 {isCurrentVersionDeployed 
                ? `Guardar como Nueva Versión (v${formData.version_number + 1} Borrador)` 
                : (isEdit ? 'Sobreescribir Borrador Actual' : 'Crear Regla Borrador')}
            </button>
          </div>
        )}
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
            <h3 className="text-xl font-black text-power-blue mb-1">Guardar en Laboratorio</h3>
            <p className="text-xs text-gray-500 mb-5 font-medium">
              {isCurrentVersionDeployed 
                ? `Al confirmar, el sistema congelará la v${formData.version_number} e iniciará automáticamente un nuevo Borrador v${formData.version_number + 1} en el Laboratorio.`
                : (saveMode === 'new_version'
                    ? `Tus cambios se guardarán como una NUEVA versión (v${formData.version_number + 1}) y el borrador actual (v${formData.version_number}) quedará congelado en el historial.`
                    : 'Tus cambios sobreescribirán el Borrador (DRAFT) actual de forma segura sin cambiar el flujo actual de producción.')}
            </p>
            <form onSubmit={confirmSave}>
              {saveMode === 'new_version' ? (
                <textarea 
                  value={versionComment} 
                  onChange={e => setVersionComment(e.target.value)} 
                  rows="3" 
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-power-purple focus:ring-2 focus:ring-power-purple/20 resize-none mb-6 bg-gray-50" 
                  placeholder="Ej: Se ajustó el WHERE para la campaña CyberDays..."
                  required
                ></textarea>
              ) : (
                <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-2">
                   <span className="text-slate-400">ℹ️</span>
                   <p className="text-xs text-slate-500 font-medium">El comentario de esta versión se mantendrá sin cambios.</p>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSaveModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-power-purple text-white hover:bg-power-purple/90 disabled:opacity-50 transition-colors">
                  {guardando ? 'Guardando...' : 'Confirmar Guardado'}
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
                    const isLoaded = checkIsCurrentlyLoaded(item); 
                    
                    return (
                      <div key={idx} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm ${item.is_production ? 'bg-emerald-500' : (isLoaded ? 'bg-blue-500' : 'bg-power-purple')}`}></div>
                        <div className={`bg-white border p-4 rounded-xl shadow-sm transition-colors group ${item.is_production ? 'border-emerald-200 ring-2 ring-emerald-50/50' : (isLoaded ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-power-purple/50')}`}>
                          
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                {item.fecha_change_lima || item.created_at || 'Fecha Desconocida'}
                              </span>
                              {item.is_production && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase shadow-sm">🟢 EN VIVO</span>}
                              {isLoaded && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase border border-blue-200 shadow-sm animate-fade-in">👀 EN EDITOR</span>}
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${item.lifecycle_status === 'DEPLOYED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              v{item.version_number} - {item.lifecycle_status}
                            </span>
                          </div>
                          <p className="text-xs font-black text-gray-800 break-all mb-1">{item.changed_by || 'Sistema'}</p>
                          <p className="text-xs text-gray-600 bg-slate-50 p-2 rounded border border-slate-100 italic mb-4">"{item.version_comment || 'Sin comentario de versión'}"</p>
                          
                          <div className="flex flex-col gap-2">
                            {idx !== 0 && !formDisabled && (
                              <button onClick={() => openCompare(item)} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 py-2 rounded-lg transition-colors">
                                ⚖️ Comparar con el editor
                              </button>
                            )}
                            
                            <button 
                              onClick={() => loadOldVersion(item)} 
                              disabled={isLoaded || formDisabled}
                              className={`w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors ${
                                isLoaded || formDisabled
                                  ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed' 
                                  : 'text-power-purple bg-power-purple/5 hover:bg-power-purple hover:text-white border border-power-purple/20'
                              }`}
                            >
                              {isLoaded ? '✅ Cargada actualmente' : (formDisabled ? '🔒 Carga Bloqueada' : '🔄 Previsualizar en editor')}
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
              <p className="text-xs text-slate-400 mt-1">Revisa las diferencias de metadatos y código antes de clonar o revertir.</p>
            </div>
            <button onClick={() => setCompareData(null)} className="bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 px-4 py-2 rounded-lg font-bold text-sm border border-slate-700">Cerrar Comparador</button>
          </div>
          
          <div className="flex-1 flex overflow-hidden p-4 gap-4">
            
            {/* PANEL IZQUIERDO: ACTUAL */}
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
              <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-900">
                <span className="text-xs font-bold text-power-blue uppercase tracking-wider">📝 Tu Editor Actual</span>
              </div>
              
              <div className="bg-slate-800/50 p-4 grid grid-cols-2 gap-3 border-b border-slate-700 text-[11px] shrink-0">
                {[
                  { label: 'Nombre', key: 'rule_name', colSpan: true },
                  { label: 'Severidad', key: 'severity' },
                  { label: 'Estado', key: 'is_active', format: v => (v === true || v === 'true') ? '🟢 Activa' : '🔴 Apagada' },
                  { label: 'Entidad', key: 'entity_type' },
                  { label: 'Evento', key: 'event_type' }
                ].map(field => {
                  const currentVal = formData[field.key];
                  const historyVal = field.key === 'is_active' 
                    ? (compareData[field.key] !== undefined ? !!compareData[field.key] : true) 
                    : compareData[field.key];
                  const isDiff = currentVal !== historyVal;
                  return (
                    <div key={field.key} className={field.colSpan ? "col-span-2" : ""}>
                      <span className="text-slate-500 block mb-1 uppercase tracking-widest text-[9px] font-bold">{field.label}</span> 
                      {/* 🚀 HIGHLIGHT VERDE SI HAY CAMBIO */}
                      <span className={`font-bold px-1.5 py-0.5 rounded ${isDiff ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-inner' : 'text-slate-300'}`}>
                        {field.format ? field.format(currentVal) : (currentVal || 'N/A')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 🚀 RENDERIZADOR DE LÍNEAS DE SQL ACTUAL */}
              <div className="flex-1 bg-slate-950 overflow-auto py-2">
                {leftSqlNodes}
              </div>
            </div>

            {/* PANEL DERECHO: HISTÓRICO */}
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-power-purple/50 shadow-2xl">
              <div className="bg-power-purple/20 px-4 py-2 flex justify-between items-center border-b border-power-purple/30">
                <span className="text-xs font-bold text-power-purple uppercase tracking-wide">🕰️ Archivo Histórico v{compareData.version_number}</span>
              </div>
              
              <div className="bg-power-purple/5 p-4 grid grid-cols-2 gap-3 border-b border-power-purple/20 text-[11px] shrink-0">
                {[
                  { label: 'Nombre', key: 'rule_name', colSpan: true },
                  { label: 'Severidad', key: 'severity' },
                  { label: 'Estado', key: 'is_active', format: v => (v === true || v === 'true') ? '🟢 Activa' : '🔴 Apagada' },
                  { label: 'Entidad', key: 'entity_type' },
                  { label: 'Evento', key: 'event_type' }
                ].map(field => {
                  const currentVal = formData[field.key];
                  const historyVal = field.key === 'is_active' 
                    ? (compareData[field.key] !== undefined ? !!compareData[field.key] : true) 
                    : compareData[field.key];
                  const isDiff = currentVal !== historyVal;
                  return (
                    <div key={field.key} className={field.colSpan ? "col-span-2" : ""}>
                      <span className="text-power-purple/60 block mb-1 uppercase tracking-widest text-[9px] font-bold">{field.label}</span> 
                      {/* 🚀 HIGHLIGHT ROJO SI HAY CAMBIO */}
                      <span className={`font-bold px-1.5 py-0.5 rounded ${isDiff ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-inner' : 'text-slate-300'}`}>
                        {field.format ? field.format(historyVal) : (historyVal || 'N/A')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 🚀 RENDERIZADOR DE LÍNEAS DE SQL HISTÓRICO */}
              <div className="flex-1 bg-slate-950 overflow-auto py-2">
                {rightSqlNodes}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default RuleForm;