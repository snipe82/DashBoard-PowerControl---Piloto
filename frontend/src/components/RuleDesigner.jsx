import React, { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { autocompletion } from '@codemirror/autocomplete'; 
import api from '../api';
import EventsSearch from './EventsSearch'; 

const MANDATORY_HEADER = `WITH params AS (
  SELECT $1::uuid AS customer_id, $2::varchar AS application_id,
         $3::uuid AS device_id,   $4::uuid AS merchant_id
)`;

const LOCKED_SELECT_FROM = `SELECT COUNT(*) AS total\nFROM`;

const HELP_CTE_CODE = `SELECT COUNT(*) AS total_dia\nFROM ...`;

const CLEAN_PRODUCTION_BODY = `fact_application fa
JOIN params p ON fa.application_id = p.application_id
WHERE fa.application_status = 'completed';`;

const HELP_BODY_CODE = `fact_application fa
JOIN dim_customer dc ON fa.customer_id = dc.customer_id
JOIN params p ON fa.application_id = p.application_id
WHERE fa.application_status = 'completed'
  -- DNI no debe estar en lista blanca
  AND NOT EXISTS (
    SELECT 1 FROM list_dni ld
    WHERE ld.document_number = dc.document_number
      AND ld.list_type = 'WHITE'
  )
  -- Debe ser un crédito — sin pago asociado
  AND NOT EXISTS (
    SELECT 1 FROM fact_payment fp
    WHERE fp.application_id = p.application_id
  )
  -- No debe haber pasado biometría anteriormente
  AND NOT EXISTS (
    SELECT 1 FROM fact_application fa2
    WHERE fa2.customer_id = p.customer_id
      AND fa2.application_id != p.application_id
      AND fa2.biometria = 'SI'
  )
  -- No debe haber tenido alertas descartadas previamente
  AND NOT EXISTS (
    SELECT 1 FROM fact_alert fa_al
    WHERE fa_al.customer_id = p.customer_id
      AND fa_al.status = 'DISCARDED'
  )`;

const PARAMS_STATIC_TABLE = {
  table_name: 'params',
  description: 'Tabla temporal mandatoria del motor. Mapea las variables de entrada de la transacción evaluada.',
  columns: [
    { column_name: 'customer_id', data_type: 'uuid ($1)', description: 'Identificador único del cliente/usuario bajo análisis.' },
    { column_name: 'application_id', data_type: 'varchar ($2)', description: 'Código único de la solicitud de crédito o compra analizada.' },
    { column_name: 'device_id', data_type: 'uuid ($3)', description: 'ID de hardware o huella digital del dispositivo (Device Fingerprint).' },
    { column_name: 'merchant_id', data_type: 'uuid ($4)', description: 'Identificador del comercio o tienda donde se origina el evento.' }
  ]
};

const parseSqlString = (sqlInput, isFromAI = false) => {
  let cleanSql = (sqlInput || '').trim();
  
  if (!isFromAI) {
    const isNewRule = cleanSql === '' || (cleanSql.includes('fact_application fa') && !cleanSql.includes('NOT EXISTS'));
    if (isNewRule) {
      return { ctes: [], body: HELP_BODY_CODE, isNew: true };
    }
  }
  
  let lowerSqlCheck = cleanSql.toLowerCase();
  if (lowerSqlCheck.startsWith('with params as')) {
    const firstParen = cleanSql.indexOf('(');
    if (firstParen !== -1) {
      let depth = 1;
      let i = firstParen + 1;
      while (i < cleanSql.length && depth > 0) {
        if (cleanSql[i] === '(') depth++;
        if (cleanSql[i] === ')') depth--;
        i++;
      }
      cleanSql = cleanSql.substring(i).trim();
      
      if (cleanSql.startsWith(',')) {
        cleanSql = 'WITH ' + cleanSql.substring(1).trim();
      }
    }
  }

  let depth = 0;
  let mainSelectIdx = -1;
  let lower = cleanSql.toLowerCase();
  
  for (let i = 0; i < cleanSql.length; i++) {
    if (cleanSql[i] === '(') depth++;
    else if (cleanSql[i] === ')') depth--;
    else if (depth === 0) {
      if (lower.substring(i).startsWith('select')) {
        let hasMoreCtes = false;
        let innerDepth = 0;
        for (let j = i; j < cleanSql.length; j++) {
          if (cleanSql[j] === '(') innerDepth++;
          if (cleanSql[j] === ')') innerDepth--;
          if (innerDepth === 0) {
            if (lower.substring(j).startsWith('as')) {
              if (lower.substring(j).replace(/\s+/g, '').startsWith('as(')) {
                hasMoreCtes = true;
                break;
              }
            }
          }
        }
        if (!hasMoreCtes) {
          mainSelectIdx = i;
          break;
        }
      }
    }
  }

  let extractedCtes = [];
  let extractedBody = '';

  if (mainSelectIdx !== -1) {
    const ctesPart = cleanSql.substring(0, mainSelectIdx).trim();
    const mainPart = cleanSql.substring(mainSelectIdx).trim();

    let cleanCtesPart = ctesPart.trim();
    if (cleanCtesPart.toUpperCase().startsWith('WITH')) {
        cleanCtesPart = cleanCtesPart.substring(4).trim();
    }
    if (cleanCtesPart.startsWith(',')) cleanCtesPart = cleanCtesPart.substring(1).trim();
    
    let idx = 0;
    while (idx < cleanCtesPart.length) {
      const remaining = cleanCtesPart.substring(idx);
      const cteRegex = /\b([a-zA-Z0-9_]+)\s+\bas\b\s*\(/i;
      const match = cteRegex.exec(remaining);
      
      if (match) {
        const nameToken = match[1];
        const matchOffset = match.index;
        const openParenOffset = match[0].indexOf('(');
        
        let startCodeIdx = idx + matchOffset + openParenOffset + 1;
        let parenCount = 1;
        let j = startCodeIdx;
        while (j < cleanCtesPart.length && parenCount > 0) {
          if (cleanCtesPart[j] === '(') parenCount++;
          if (cleanCtesPart[j] === ')') parenCount--;
          j++;
        }
        const codeToken = cleanCtesPart.substring(startCodeIdx, j - 1).trim();
        if (nameToken && nameToken.toLowerCase() !== 'params') {
          extractedCtes.push({
            id: Date.now() + Math.random() + idx,
            name: nameToken,
            code: codeToken,
            isHelp: false 
          });
        }
        idx = j;
      } else {
        break; 
      }
    }

    let mainLower = mainPart.toLowerCase();
    let fromIdx = -1;
    let mainDepth = 0;
    for (let k = 0; k < mainPart.length; k++) {
      if (mainPart[k] === '(') mainDepth++;
      if (mainPart[k] === ')') mainDepth--;
      if (mainDepth === 0) {
        if (mainLower.substring(k).startsWith('from')) {
          fromIdx = k;
          break;
        }
      }
    }
    if (fromIdx !== -1) extractedBody = mainPart.substring(fromIdx + 4).trim();
    else extractedBody = mainPart;

  } else if (cleanSql.length > 0) {
    let cleanLower = cleanSql.toLowerCase();
    let fIdx = cleanLower.indexOf('from');
    if (fIdx !== -1) extractedBody = cleanSql.substring(fIdx + 4).trim();
    else extractedBody = cleanSql;
  }

  return { ctes: extractedCtes, body: extractedBody, isNew: false };
};

const RuleDesigner = ({ initialSql, ruleEventType, ruleEntityType, ruleName, ruleDescription, onApplySql, onClose }) => {
  // 🚀 Nuevos estados estructurados para el Diccionario 
  const [dictionaryTables, setDictionaryTables] = useState([PARAMS_STATIC_TABLE]);
  const [dictionaryLists, setDictionaryLists] = useState([]);
  const [dictTab, setDictTab] = useState('TABLES'); // 'TABLES' o 'LISTS'
  
  const [openTable, setOpenTable] = useState(null);
  const [copiedItem, setCopiedItem] = useState(null);
  
  const [isValidated, setIsValidated] = useState(false); 
  const [validating, setValidating] = useState(false); 
  const [testing, setTesting] = useState(false); 
  
  const [hasTested, setHasTested] = useState(false);
  
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [viewFullQueryOpen, setViewFullQueryOpen] = useState(false); 
  const [testParams, setTestParams] = useState({ p1: '', p2: '', p3: '', p4: '' });
  const [testResult, setTestResult] = useState(null);
  const [lastExecutedSql, setLastExecutedSql] = useState('');

  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const parsedInitialData = useMemo(() => parseSqlString(initialSql, false), [initialSql]);
  
  const [prompt, setPrompt] = useState(() => {
    const desc = ruleDescription?.trim() || '';
    const baseText = 'Genera una regla que alerte cuando ';
    return desc ? `${baseText}${desc}` : baseText;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState(false);
  const [backupState, setBackupState] = useState(null); 

  const [ctes, setCtes] = useState(parsedInitialData.ctes);
  const [editableSql, setEditableSql] = useState(parsedInitialData.body);
  const [isBodyHelp, setIsBodyHelp] = useState(parsedInitialData.isNew); 

  const isModifyMode = editableSql.trim().length > 0 && editableSql.trim() !== HELP_BODY_CODE.trim();

  useEffect(() => {
    api.get('/api/v1/rules/dictionary')
      .then(res => {
        const payloadData = res.data?.data || res.data || {};
        
        // 🚀 Migración de payload para soportar el cambio estructural del backend
        if (Array.isArray(payloadData)) {
           // Compatibilidad retroactiva por si el backend revierte
           setDictionaryTables([PARAMS_STATIC_TABLE, ...payloadData]);
           setDictionaryLists([]);
        } else {
           const tables = Array.isArray(payloadData.tables) ? payloadData.tables : [];
           const lists = Array.isArray(payloadData.lists) ? payloadData.lists : [];
           setDictionaryTables([PARAMS_STATIC_TABLE, ...tables]);
           setDictionaryLists(lists);
        }
      })
      .catch(err => {
        console.error("Error cargando diccionario:", err);
        setDictionaryTables([PARAMS_STATIC_TABLE]);
        setDictionaryLists([]);
      });
  }, []);

  const hasChanges = useMemo(() => {
    if (editableSql !== parsedInitialData.body) return true;
    if (ctes.length !== parsedInitialData.ctes.length) return true;
    for (let i = 0; i < ctes.length; i++) {
      const current = ctes[i];
      const initial = parsedInitialData.ctes[i];
      if (!initial) return true;
      if (current.name !== initial.name || current.code !== initial.code) return true;
    }
    return false;
  }, [editableSql, ctes, parsedInitialData]);

  const handleCloseProtected = () => {
    if (hasChanges) {
      const confirmClose = window.confirm("⚠️ Tienes cambios sin aplicar en el diseñador. ¿Seguro que deseas cerrar? Perderás tus modificaciones.");
      if (!confirmClose) return;
    }
    onClose();
  };

  const handleAddCte = () => {
    setCtes([...ctes, { 
      id: Date.now() + Math.random(), 
      name: `compras_aux_${ctes.length + 1}`, 
      code: HELP_CTE_CODE, 
      isHelp: true 
    }]);
    setIsValidated(false);
    setHasTested(false);
    if (aiSuccess) setAiSuccess(false);
  };

  const handleRemoveCte = (id) => {
    setCtes(ctes.filter(c => c.id !== id));
    setIsValidated(false);
    setHasTested(false);
    if (aiSuccess) setAiSuccess(false);
  };

  const handleCteChange = (id, field, value) => {
    setCtes(ctes.map(c => c.id === id ? { 
      ...c, 
      [field]: value,
      isHelp: field === 'code' ? false : c.isHelp 
    } : c));
    setIsValidated(false);
    setHasTested(false);
    if (aiSuccess) setAiSuccess(false);
  };

  const handleMainBodyChange = (val) => {
    setEditableSql(val);
    setIsBodyHelp(false); 
    setIsValidated(false);
    setHasTested(false);
    if (aiSuccess) setAiSuccess(false);
  };

  const assembleFullSql = (includeParamsHeader = true, isExportingToParent = false) => {
    let sqlStr = includeParamsHeader ? MANDATORY_HEADER : "";
    const activeCtes = isExportingToParent ? ctes.filter(c => !c.isHelp) : ctes;

    if (activeCtes.length > 0) {
      sqlStr += ",\n";
      sqlStr += activeCtes.map((cte, idx) => {
        const isLast = idx === activeCtes.length - 1;
        return `${cte.name} AS (\n  ${cte.code || 'SELECT 1'}\n)${isLast ? '' : ','}`;
      }).join('\n');
      sqlStr += "\n";
    } else {
      sqlStr += "\n";
    }
    
    const finalBodyText = (isExportingToParent && isBodyHelp) ? CLEAN_PRODUCTION_BODY : (editableSql || 'SELECT 1');
    sqlStr += `${LOCKED_SELECT_FROM} ${finalBodyText}`;
    return sqlStr;
  };

  const handleGenerateAI = async () => {
    if (!prompt.trim()) {
      setAiError('Debes escribir un requerimiento en la caja de texto.');
      return;
    }
    setIsGenerating(true);
    setAiError('');
    setAiSuccess(false); 

    const endpoint = isModifyMode ? '/api/v1/rules/ai/modify' : '/api/v1/rules/ai/generate';
    const payload = isModifyMode 
      ? { instructions: prompt, existingSql: assembleFullSql(true, false) }
      : { prompt: prompt, baseSql: MANDATORY_HEADER };

    try {
      const res = await api.post(endpoint, payload);
      const returnedSql = res.data?.sql || res.data?.data?.sql || res.data?.result?.sql;
      
      if (returnedSql && res.data?.success !== false) {
        let cleanSql = returnedSql.trim();
        
        const bt = String.fromCharCode(96, 96, 96);
        const btSql = bt + 'sql';

        const lowerSql = cleanSql.toLowerCase();
        if (lowerSql.startsWith(btSql)) {
            cleanSql = cleanSql.substring(6);
        } else if (cleanSql.startsWith(bt)) {
            cleanSql = cleanSql.substring(3);
        }
        if (cleanSql.endsWith(bt)) {
            cleanSql = cleanSql.substring(0, cleanSql.length - 3);
        }
        cleanSql = cleanSql.trim();

        const parsedAI = parseSqlString(cleanSql, true);
        
        setBackupState({ ctes: [...ctes], body: editableSql, isBodyHelp });

        setCtes(parsedAI.ctes);
        setEditableSql(parsedAI.body);
        setIsBodyHelp(false);
        setIsValidated(false);
        setHasTested(false);
        setPrompt(''); 
        setAiSuccess(true); 
      } else {
        setAiError('La API respondió, pero no se encontró la llave "sql" en el JSON. Revisa la consola (F12).');
      }
    } catch (error) {
      const status = error.response?.status || 'Red/Desconocido';
      const msg = error.response?.data?.error || error.response?.data?.message || error.response?.data?.detail;

      if (status === 429) {
        setAiError('Has excedido el límite de peticiones gratuitas de Inteligencia Artificial por ahora. Intenta de nuevo en un minuto.');
      } else if (status === 503) {
        setAiError('El asistente de IA está experimentando alta demanda global en este momento. Por favor, espera unos segundos. ⏳');
      } else if (status === 400) {
        setAiError(msg || `Faltan parámetros obligatorios en la petición (HTTP 400).`);
      } else {
        setAiError(`🛑 Falla en el Backend (HTTP ${status}): ${msg || `Revisa si la ruta "${endpoint}" está desplegada y funcionando en el servidor.`}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevertAI = () => {
    if (backupState) {
      setCtes(backupState.ctes);
      setEditableSql(backupState.body);
      setIsBodyHelp(backupState.isBodyHelp);
      setBackupState(null);
      setAiSuccess(false);
      setIsValidated(false);
      setHasTested(false);
    }
  };

  const customCompletion = useMemo(() => {
    const basicKeywords = [
      'WITH', 'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'ON', 
      'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'GROUP BY', 'ORDER BY', 'LIMIT', 'EXISTS'
    ];
    let options = basicKeywords.map(kw => ({ label: kw, type: 'keyword', boost: -1 }));

    // 🚀 Ajuste: Ahora leemos desde dictionaryTables
    dictionaryTables.forEach(table => {
      if (table.table_name) {
        options.push({ label: table.table_name, type: 'class', detail: table.table_name === 'params' ? 'Motor' : 'BD' });
        if (table.columns) table.columns.forEach(col => options.push({ label: col.column_name, type: 'property', detail: col.data_type }));
      }
    });

    ctes.forEach(cte => {
      if (cte.name) options.push({ label: cte.name, type: 'class', detail: 'Tabla de Apoyo (WITH)', boost: 5 });
    });

    return (context) => {
      let word = context.matchBefore(/\w*/);
      if (word.from === word.to && !context.explicit) return null;
      return { from: word.from, options: options, validFor: /^\w*$/ };
    };
  }, [dictionaryTables, ctes]);

  const handleCopy = (e, text) => {
    e.stopPropagation(); 
    navigator.clipboard.writeText(text);
    setCopiedItem(text);
    setTimeout(() => setCopiedItem(null), 1500); 
  };

  const handleDragStart = (e, text) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleValidateCode = async (e) => {
    e.preventDefault();
    setValidating(true);
    setTestResult(null);

    const completeSql = assembleFullSql(true, false);

    try {
      const res = await api.post('/api/v1/rules/validate', { query_sql: completeSql });
      if (res.data && res.data.success === true) {
        setIsValidated(true);
        setTestResult({ type: 'validation_success', message: res.data.message });
      } else {
        setIsValidated(false);
        setTestResult({ type: 'error', message: 'Error de contrato API.', detail: 'Falta propiedad "success: true".' });
      }
    } catch (error) {
      setIsValidated(false); 
      const status = error.response?.status;
      const data = error.response?.data || {};
      if (status === 400) {
        setTestResult({ type: 'validation_error', message: data.error || 'Fallo de validación estática.', details: data.detalles || [] });
      } else {
        setTestResult({ type: 'error', message: `Error de conexión (HTTP ${status || 'Desconocido'}).`, detail: error.message });
      }
    } finally {
      setValidating(false);
    }
  };

  const handleRunTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const p1Val = testParams.p1 ? `'${testParams.p1}'` : 'NULL';
    const p2Val = testParams.p2 ? `'${testParams.p2}'` : 'NULL';
    const p3Val = testParams.p3 ? `'${testParams.p3}'` : 'NULL';
    const p4Val = testParams.p4 ? `'${testParams.p4}'` : 'NULL';

    let testQuery = assembleFullSql(true, false);
    
    testQuery = testQuery
      .replace(/\$1/g, p1Val)
      .replace(/\$2/g, p2Val)
      .replace(/\$3/g, p3Val)
      .replace(/\$4/g, p4Val);
      
    setLastExecutedSql(testQuery);

    try {
      const res = await api.post('/api/v1/rules/test', { query_sql: testQuery });
      const dataToRender = res.data?.result?.data || res.data?.data || res.data;
      setTestResult({ type: 'success', data: Array.isArray(dataToRender) ? dataToRender : [dataToRender] });
      
      setHasTested(true);
      setTestModalOpen(false);
    } catch (error) {
      const errData = error.response?.data || {};
      const errorMsg = errData.message || errData.error || errData.db_message || 'Error al ejecutar SQL en la BD';
      setTestResult({ 
        type: 'error', 
        message: errorMsg,
        hint: errData.db_hint || errData.hint, 
        position: errData.db_position || errData.position,
        detail: errData.detail || error.message
      });
      setTestModalOpen(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSelectRealEvent = (eventoReal) => {
    const evType = (eventoReal.event_type || '').toLowerCase();
    const rType = (ruleEventType || '').toLowerCase();
    
    if (rType && evType !== rType) {
      alert(`🛑 BLOQUEO DE INYECCIÓN:\n\nEstás diseñando una regla para el flujo [ ${ruleEventType} ], pero seleccionaste un evento del flujo [ ${eventoReal.event_type} ].\n\nPor favor, busca un evento que coincida con el flujo de tu regla para evitar falsos negativos.`);
      return;
    }

    const customerId = eventoReal.customer_id || '';
    const appId = eventoReal.application_id || '';
    const payloadRecepcion = eventoReal.payloads?.recepcion || {};
    const deviceId = payloadRecepcion.deviceid || payloadRecepcion.deviceId || payloadRecepcion.device_id || payloadRecepcion.device_fingerprint || '';
    const merchantId = payloadRecepcion.merchantid || payloadRecepcion.merchantId || payloadRecepcion.merchant_id || '';

    const evEntity = (eventoReal.entity_type || payloadRecepcion.entity_type || payloadRecepcion.entityType || '').toLowerCase();
    const rEntity = (ruleEntityType || '').toLowerCase();

    if (evEntity && rEntity && evEntity !== rEntity) {
      alert(`🛑 BLOQUEO DE INYECCIÓN:\n\nLa regla evalúa entidades tipo '${ruleEntityType}', pero seleccionaste un evento de '${evEntity}'.`);
      return;
    }

    if (!evEntity && rEntity) {
      let hasRequiredId = true;
      if (rEntity === 'customer' && !customerId) hasRequiredId = false;
      if (rEntity === 'device' && !deviceId) hasRequiredId = false;
      if (rEntity === 'merchant' && !merchantId) hasRequiredId = false;

      if (!hasRequiredId) {
        alert(`🛑 TRAMA INCOMPATIBLE:\n\nEl evento inyectado no tiene el identificador correspondiente para analizar a un '${ruleEntityType}'. Faltan datos base en el JSON de recepción.`);
        return;
      }
    }

    setTestParams({
      p1: customerId,
      p2: appId,
      p3: deviceId,
      p4: merchantId
    });

    setTestResult(null); 
    setEventPickerOpen(false); 
  };

  const handleApplyAndReturn = () => {
    if (!hasTested) {
      alert("⚠️ ACCIÓN REQUERIDA (BLOQUEO DE MOTOR):\n\nNo puedes anclar ni retornar el código al formulario hasta haber realizado una simulación real de Playground exitosa.\n\nPresiona 'Probar Regla' (botón verde si ya validaste sintaxis), inyecta o ingresa tus parámetros y ejecuta la consulta.");
      return;
    }
    onApplySql(assembleFullSql(false, true));
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col animate-fade-in">
      <style>{`
        .is-sql-help .cm-content {
          font-style: italic !important;
          opacity: 0.65 !important;
        }
      `}</style>

      {/* HEADER RESPONSIVE */}
      <div className="bg-slate-950 border-b border-slate-800 p-3 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center text-white shrink-0 shadow-sm gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-black text-power-blue tracking-wider flex items-center gap-2">🧑‍💻 Diseñador de Reglas</h2>
          <p className="text-[10px] md:text-xs text-slate-400">Diseño de Lógica de Reglas bajo consultas SQL de conteo (Postgres SQL)</p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
          <button type="button" onClick={() => setViewFullQueryOpen(true)} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-power-blue border border-slate-700 px-3 py-2 rounded-lg font-bold text-xs md:text-sm flex justify-center items-center gap-1 transition-colors">👁️ Ver Full Query</button>
          <button type="button" onClick={handleValidateCode} disabled={validating} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-bold text-xs md:text-sm flex justify-center items-center gap-1 transition-colors disabled:opacity-50">Validar Código</button>
          <button type="button" onClick={() => setTestModalOpen(true)} disabled={!isValidated} className={`flex-1 md:flex-none px-3 py-2 rounded-lg font-bold text-xs md:text-sm flex justify-center items-center gap-1 transition-colors ${isValidated ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}>▶️ Probar Regla</button>
          
          <button type="button" onClick={handleApplyAndReturn} className="flex-1 md:flex-none bg-power-purple hover:bg-purple-500 text-white px-3 py-2 rounded-lg font-bold text-xs md:text-sm shadow-md flex justify-center transition-colors">Anclaje y Volver</button>
          
          <button onClick={handleCloseProtected} className="flex-1 md:flex-none bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 px-3 py-2 rounded-lg font-bold text-xs md:text-sm border border-slate-700 flex justify-center">Cerrar</button>
        </div>
      </div>

      {/* WORKSPACE RESPONSIVE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 relative min-h-[40vh]">
          <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3">
            
            {/* 🤖 PANEL DE ASISTENCIA IA DUAL */}
            <div className="border border-power-purple/30 bg-gradient-to-r from-power-purple/5 to-transparent rounded-xl p-4 md:p-5 shadow-sm mb-3">
              <div className="flex items-start gap-3">
                <div className="bg-power-purple text-white p-2 rounded-xl shadow-md shrink-0 mt-1">
                  <span className="text-xl">{isModifyMode ? '🪄' : '🤖'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-power-blue uppercase tracking-wider mb-2 flex items-center gap-2">
                    Copiloto de Inteligencia Artificial
                    <span className="bg-power-purple/10 text-power-purple border border-power-purple/20 px-2 py-0.5 rounded text-[9px]">BETA</span>
                    
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold shadow-sm ${isModifyMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                      {isModifyMode ? 'MODO: REFACTORIZACIÓN' : 'MODO: CREACIÓN'}
                    </span>
                  </h3>

                  <div className="flex flex-col md:flex-row gap-3 items-end">
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      placeholder="Ej: Alertar si el cliente ha solicitado más de 3 créditos en las últimas 24 horas."
                      className="w-full h-20 p-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:ring-2 focus:ring-power-purple outline-none resize-none disabled:opacity-50 shadow-inner custom-scrollbar"
                    ></textarea>
                    
                    <button 
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !prompt.trim()}
                      className={`shrink-0 w-full md:w-auto text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed h-full min-h-[50px] ${
                        isModifyMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-power-blue hover:bg-blue-600'
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{isModifyMode ? 'Analizando...' : 'Diseñando...'}</span>
                        </>
                      ) : (
                        <><span>{isModifyMode ? '🪄' : '✨'}</span> {isModifyMode ? 'Refactorizar con IA' : 'Generar Regla'}</>
                      )}
                    </button>
                  </div>

                  {aiError && (
                    <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg text-xs font-bold animate-fade-in flex items-center gap-2 shadow-sm">
                      <span className="text-base">🛑</span> {aiError}
                    </div>
                  )}

                  {aiSuccess && (
                    <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-lg text-xs font-bold animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base">✅</span>
                        <span>¡Código generado! La IA ha reescrito la regla con éxito. Revisa el código en el editor inferior.</span>
                      </div>
                      <button 
                        onClick={handleRevertAI}
                        className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        ↩️ Deshacer Cambios
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 🔒 BLOQUE MANDATORIO 1 */}
            <div className="border border-slate-700 rounded-xl overflow-hidden opacity-75 shadow-sm">
              <div className="bg-slate-800 text-slate-400 text-[9px] px-3 py-1 font-mono uppercase tracking-widest flex justify-between items-center border-b border-slate-900">
                <span>⚙️ 1. Parámetros del Motor (Fijo)</span>
                <span className="font-bold text-amber-500/80">🔒 LOCK</span>
              </div>
              <CodeMirror 
                value={MANDATORY_HEADER} 
                theme="dark" 
                extensions={[sql({ dialect: PostgreSQL })]} 
                readOnly={true} 
                editable={false} 
                basicSetup={{ lineNumbers: true, foldGutter: false }} 
              />
            </div>

            {/* 🧩 SECCIÓN DINÁMICA: TABLAS WITH */}
            <div className="space-y-3">
              {ctes.map((cte, index) => (
                <div key={cte.id} className="border border-blue-900/40 rounded-xl overflow-hidden bg-slate-900 shadow-lg animate-fade-in">
                  <div className="bg-slate-800/80 border-b border-slate-900 px-3 py-1.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold font-mono shrink-0">WITH #{index + 1}</span>
                      <input 
                        type="text" 
                        value={cte.name} 
                        onChange={(e) => handleCteChange(cte.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        className="bg-slate-950 border border-slate-700 text-power-blue font-mono font-bold text-xs rounded px-3 py-1 outline-none focus:border-power-purple w-72 min-w-[280px] shrink-0"
                        placeholder="nombre_tabla_cte"
                      />
                      <span className="text-slate-400 font-mono text-xs font-bold shrink-0">AS (</span>
                      {cte.isHelp && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-500/60 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium tracking-wider animate-pulse whitespace-nowrap">
                          ✨ sql base de ayuda
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => handleRemoveCte(cte.id)} className="text-[10px] text-rose-400 bg-rose-50/10 hover:bg-rose-500 hover:text-white font-bold px-2.5 py-1 rounded transition-all ml-auto sm:ml-0">✕ Eliminar Tabla</button>
                  </div>
                  
                  <div className={cte.isHelp ? "is-sql-help" : ""}>
                    <CodeMirror 
                      value={cte.code} 
                      theme="dark" 
                      placeholder="Coloca aquí tu subquery..."
                      extensions={[sql({ dialect: PostgreSQL }), autocompletion({ override: [customCompletion] })]} 
                      onChange={(val) => handleCteChange(cte.id, 'code', val)} 
                      basicSetup={{ lineNumbers: true }}
                    />
                  </div>
                  <div className="bg-slate-950 text-right px-3 py-1 text-[10px] font-mono text-slate-500 border-t border-slate-900">
                    ) {index === ctes.length - 1 ? '-- Última tabla, continúa el SELECT' : ','}
                  </div>
                </div>
              ))}

              <button type="button" onClick={handleAddCte} className="w-full py-2.5 bg-slate-950 border border-dashed border-blue-900/40 hover:border-power-purple hover:bg-power-purple/5 text-blue-400 hover:text-power-blue rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
                ➕ Agregar Tabla de Apoyo Intermedia (WITH AS)
              </button>
            </div>

            {/* 🔒 BLOQUE MANDATORIO 2 */}
            <div className="border border-slate-700 rounded-xl overflow-hidden opacity-90 shadow-sm">
              <div className="bg-slate-800 text-slate-400 text-[9px] px-3 py-1 font-mono uppercase tracking-widest flex justify-between items-center border-b border-slate-900">
                <span>📊 2. Proyección Mandatoria de Activación (Fijo)</span>
                <span className="font-bold text-amber-500/80">🔒 LOCK</span>
              </div>
              <CodeMirror 
                value={LOCKED_SELECT_FROM} 
                theme="dark" 
                extensions={[sql({ dialect: PostgreSQL })]} 
                readOnly={true} 
                editable={false} 
                basicSetup={{ lineNumbers: true, foldGutter: false }} 
              />
            </div>

            {/* ✍️ BLOQUE 3 */}
            <div className="border border-power-purple/30 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl min-h-[220px]">
              <div className="bg-power-purple/20 text-power-blue text-[9px] px-3 py-1 font-mono uppercase tracking-widest flex justify-between items-center border-b border-power-purple/30 shrink-0 gap-2 flex-wrap">
                <span>✍️ 3. Cuerpo de la Consulta (Tabla, JOINs y filtros WHERE)</span>
                {isBodyHelp && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-500/60 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium tracking-wider animate-pulse shrink-0">
                    ✨ sql base de ayuda
                  </span>
                )}
                <span className="text-emerald-400 font-bold ml-auto shrink-0">EDITABLE</span>
              </div>
              
              <div className={`flex-1 bg-[#282c34] relative ${isBodyHelp ? "is-sql-help" : ""}`}>
                <CodeMirror 
                  value={editableSql} 
                  height="100%" 
                  theme="dark" 
                  placeholder="Coloca aquí tu query principal..."
                  extensions={[sql({ dialect: PostgreSQL }), autocompletion({ override: [customCompletion] })]} 
                  onChange={handleMainBodyChange}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
              </div>
            </div>
          </div>

          {/* CONSOLA DE RESULTADOS */}
          {testResult && (
            <div className="h-48 md:h-64 border-t-4 border-slate-800 bg-slate-950 p-3 md:p-4 shrink-0 overflow-y-auto shadow-inner animate-fade-in">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  {testResult.type.includes('validation') ? 'Resultados del Linter' : 'Resultado de Ejecución SQL'}
                </h3>
                <button onClick={() => setTestResult(null)} className="text-slate-500 hover:text-white bg-slate-800/50 w-6 h-6 rounded-full flex items-center justify-center">✕</button>
              </div>
              
              {testResult.type === 'validation_success' && ( 
                <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 md:p-4 rounded-xl flex flex-col">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">✅</span>
                    <div className="flex-1">
                      <h4 className="text-emerald-400 font-bold text-xs">¡Validación Estructural Exitosa!</h4>
                      <p className="text-emerald-200/80 text-[10px] mt-1">{testResult.message}</p>
                    </div>
                  </div>
                </div> 
              )}
              
              {testResult.type === 'validation_error' && ( 
                <div className="bg-orange-950/30 border border-orange-900/50 p-3 md:p-4 rounded-xl flex flex-col">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-orange-400 font-bold text-xs">Problemas Estructurales Detectados</h4>
                      <p className="text-orange-200/80 text-[10px] mt-1">{testResult.message}</p>
                    </div>
                  </div>
                  {testResult.details && ( 
                    <div className="mt-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <ul className="space-y-2">
                        {testResult.details.map((detail, idx) => ( 
                          <li key={idx} className="flex items-start gap-2 text-[10px] text-slate-300">
                            <span className="text-rose-50 shrink-0 mt-0.5">🔴</span>
                            <span className="font-mono leading-tight">{detail}</span>
                          </li> 
                        ))}
                      </ul>
                    </div> 
                  )}
                </div> 
              )}
              
              {testResult.type === 'error' && ( 
                <div className="bg-rose-950/30 border border-rose-900/50 p-3 md:p-4 rounded-xl flex flex-col">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🛑</span>
                    <div className="flex-1">
                      <h4 className="text-rose-400 font-black text-sm">{testResult.message}</h4>
                      <p className="text-rose-200/90 text-xs mt-1 font-mono leading-relaxed">
                        {testResult.hint ? `💡 Pista de Postgres: ${testResult.hint}` : (testResult.detail || 'Fallo interno de sintaxis o ejecución en BD PostgreSQL.')}
                      </p>
                      {testResult.position && (
                         <p className="text-rose-300/60 text-[10px] mt-1.5 font-mono bg-rose-900/20 px-2 py-1 rounded inline-block">Carácter de error (Posición): {testResult.position}</p>
                      )}
                    </div>
                  </div>
                </div> 
              )}
              
              {testResult.type === 'success' && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
                  {testResult.data && testResult.data[0] && testResult.data[0].total !== undefined ? (
                    <>
                      <span className="text-4xl mb-2 drop-shadow-lg">
                        {parseInt(testResult.data[0].total) > 0 ? '🚨' : '🛡️'}
                      </span>
                      <h4 className={`text-lg font-black tracking-tight ${parseInt(testResult.data[0].total) > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {parseInt(testResult.data[0].total) > 0 ? '¡La regla ATRAPÓ la transacción!' : 'Transacción Segura (No atrapada)'}
                      </h4>
                      <div className="text-slate-400 text-xs mt-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
                        Total Evaluado: <span className={`font-mono font-bold text-sm ml-1 px-1.5 py-0.5 rounded ${parseInt(testResult.data[0].total) > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{testResult.data[0].total}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-3 font-medium">
                        {parseInt(testResult.data[0].total) > 0 
                          ? 'El motor determinó que los parámetros de entrada cumplen las condiciones de riesgo configuradas.' 
                          : 'El evento inyectado no cumple las condiciones del query y el motor lo dejaría pasar.'}
                      </p>
                    </>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/50">
                          <tr>
                            {testResult.data && testResult.data.length > 0 ? Object.keys(testResult.data[0]).map(k => ( 
                              <th key={k} className="px-3 py-2 text-left text-[9px] font-bold text-emerald-500 uppercase tracking-wider">{k}</th> 
                            )) : <th className="px-3 py-2 text-[10px] text-slate-500">Resultado vacío</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {testResult.data && testResult.data.map((row, idx) => ( 
                            <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                              {Object.values(row).map((val, i) => ( 
                                <td key={i} className="px-3 py-2 text-[10px] font-mono text-slate-300 whitespace-nowrap">{String(val)}</td> 
                              ))}
                            </tr> 
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 📖 DICCIONARIO DE DATOS (NUEVO PANEL) */}
        <div className="w-full md:w-80 h-[35vh] md:h-auto bg-slate-950 overflow-y-auto shrink-0 flex flex-col z-10 relative select-none">
          <div className="p-2 md:p-4 border-b border-slate-800 bg-slate-900 shrink-0 sticky top-0 z-10 shadow-md">
            <h3 className="text-xs md:text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">📖 Diccionario</h3>
            <div className="flex bg-slate-800 mt-2 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setDictTab('TABLES')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${dictTab === 'TABLES' ? 'bg-power-purple text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>TABLAS BD</button>
                <button onClick={() => setDictTab('LISTS')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${dictTab === 'LISTS' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>LISTAS EAV</button>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 font-medium">Arrastra tarjetas hacia el editor o usa Copiar</p>
          </div>
          
          <div className="p-2 space-y-2">
            {/* VISTA TABLAS FÍSICAS */}
            {dictTab === 'TABLES' && dictionaryTables.map((table, idx) => {
              const isOpen = openTable === table.table_name;
              return (
                <div key={idx} className={`border rounded-lg overflow-hidden shadow-sm transition-colors ${table.table_name === 'params' ? 'bg-power-purple/10 border-power-purple/30' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="w-full flex items-stretch hover:bg-slate-800 transition-colors group">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing" draggable="true" onDragStart={(e) => handleDragStart(e, table.table_name)} onClick={() => setOpenTable(isOpen ? null : table.table_name)}>
                      <p className={`text-[11px] font-bold font-mono truncate ${table.table_name === 'params' ? 'text-power-purple' : 'text-power-blue'}`}>{table.table_name}</p>
                    </div>
                    <div className="flex items-center gap-1 pr-2 shrink-0">
                      <button onClick={(e) => handleCopy(e, table.table_name)} className="p-1 hover:bg-power-purple text-slate-300 rounded text-[10px]" title="Copiar Tabla">{copiedItem === table.table_name ? '✔️' : '📋'}</button>
                      <button onClick={() => setOpenTable(isOpen ? null : table.table_name)} className="text-slate-500 text-[10px] p-1">{isOpen ? '▼' : '▶'}</button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-slate-950 p-2 border-t border-slate-800 space-y-1">
                      <p className="text-[9px] text-slate-400 italic mb-2 px-1 leading-tight">{table.description}</p>
                      {table.columns?.map(col => (
                        <div key={col.column_name} draggable="true" onDragStart={(e) => handleDragStart(e, col.column_name)} className="flex justify-between items-start gap-2 p-2 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 group transition-colors cursor-grab active:cursor-grabbing">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-300 font-mono truncate">{col.column_name}</p>
                            <p className={`text-[8px] font-mono font-bold mt-0.5 ${table.table_name === 'params' ? 'text-power-purple' : 'text-emerald-500'}`}>{col.data_type}</p>
                            {col.description && (
                              <p className="text-[9px] text-slate-400/80 italic mt-1.5 leading-snug break-words pr-2">
                                {col.description}
                              </p>
                            )}
                          </div>
                          
                          <button onClick={(e) => handleCopy(e, col.column_name)} className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 bg-slate-800 hover:bg-power-purple text-slate-300 rounded text-[10px] shrink-0 mt-0.5" title="Copiar Columna">
                            {copiedItem === col.column_name ? '✔️' : '📋'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 🚀 VISTA LISTAS EAV (NUEVO) */}
            {dictTab === 'LISTS' && dictionaryLists.map((list) => (
               <div 
                 key={list.list_id} 
                 className="border border-amber-500/20 hover:border-amber-500/40 rounded-lg overflow-hidden shadow-sm bg-slate-900 cursor-grab active:cursor-grabbing transition-colors"
                 draggable="true" 
                 onDragStart={(e) => handleDragStart(e, list.sql_template)}
               >
                  <div className="flex justify-between items-start gap-2 p-2.5">
                     <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-amber-400 font-mono truncate" title={list.display_name}>{list.display_name}</p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-snug">{list.description}</p>
                        {list.is_generic ? (
                           <span className="inline-block mt-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">Genérica</span>
                        ) : (
                           <span className="inline-block mt-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">Nativa</span>
                        )}
                     </div>
                     <button
                        onClick={(e) => handleCopy(e, list.sql_template)}
                        className="p-1.5 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white rounded text-[10px] shrink-0 mt-0.5 flex flex-col items-center border border-slate-700 hover:border-amber-500 transition-colors"
                        title="Copiar Bloque SQL para Listas"
                     >
                        <span>{copiedItem === list.sql_template ? '✔️' : '📋'}</span>
                        <span className="text-[8px] font-bold mt-0.5">{copiedItem === list.sql_template ? 'Copiado' : 'Copiar'}</span>
                     </button>
                  </div>
               </div>
            ))}

            {dictTab === 'LISTS' && dictionaryLists.length === 0 && (
               <p className="text-center text-[10px] text-slate-500 py-6 italic">No hay listas creadas en el catálogo.</p>
            )}
          </div>
        </div>
      </div>

      {/* 👁️ MODAL ESPEJO PREVISUALIZADOR */}
      {viewFullQueryOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250] backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-black text-power-blue">🔮 Sintaxis Nativa Consolidada</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Vista integrada en tiempo real. Estructura inyectada en la BD.</p>
              </div>
              <button onClick={() => setViewFullQueryOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 transition-colors">Cerrar Vista</button>
            </div>
            <div className="flex-1 bg-[#282c34] overflow-auto p-2">
              <CodeMirror 
                value={assembleFullSql(true, false)} 
                theme="dark" 
                extensions={[sql({ dialect: PostgreSQL })]} 
                readOnly={true} 
                editable={false}
                basicSetup={{ lineNumbers: true, foldGutter: true }}
              />
            </div>
            <div className="bg-slate-950 p-3 text-center border-t border-slate-800 shrink-0">
              <span className="text-[10px] text-slate-500 font-mono">Modo de Inspección Estricta — Bloque Inmutable</span>
            </div>
          </div>
        </div>
      )}

      {/* 💥 MODAL DE TESTING REPOTENCIADO */}
      {testModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base font-black text-emerald-400">Ejecución en Motor Real</h3>
              <button 
                type="button" 
                onClick={() => setEventPickerOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                ⚡ Inyectar Evento
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 mb-4 font-medium">Linter aprobado. Ingresa UUIDs válidos para simular la ejecución:</p>
            <form onSubmit={handleRunTest} className="space-y-3">
              {['customer_id ($1)', 'application_id ($2)', 'device_id ($3)', 'merchant_id ($4)'].map((label, i) => (
                <div key={i}>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</label>
                  <input type="text" value={testParams[`p${i+1}`] || ''} onChange={e => setTestParams({...testParams, [`p${i+1}`]: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono outline-none focus:border-emerald-500 transition-colors" placeholder="00000000-0000-..." />
                </div>
              ))}
              <div className="flex gap-2 pt-3 border-t border-slate-800 mt-2">
                <button type="button" onClick={() => setTestModalOpen(false)} className="flex-1 py-2 rounded-lg text-[10px] font-bold text-slate-400 hover:bg-slate-800 border border-slate-700 transition-colors">Cancelar</button>
                
                <button 
                  type="submit" 
                  disabled={testing || (!testParams.p1.trim() && !testParams.p2.trim() && !testParams.p3.trim() && !testParams.p4.trim())} 
                  className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                >
                  {testing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '▶️ Ejecutar SQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 MODAL FLOTANTE MAESTRO PARA EL INYECTOR DE EVENTOS */}
      {eventPickerOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[260] flex items-center justify-center p-4 md:p-6 backdrop-blur-md animate-fade-in">
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden p-4 md:p-6 text-gray-800">
            <EventsSearch 
              isModal={true} 
              onClose={() => setEventPickerOpen(false)} 
              onSelectEvent={handleSelectRealEvent} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleDesigner;