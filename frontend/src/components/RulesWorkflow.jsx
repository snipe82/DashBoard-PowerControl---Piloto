import React, { useState, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import api from '../api';

const RulesWorkflow = ({ onEditRule }) => {
  const [rules, setRules] = useState([]);
  const [cargando, setCargando] = useState(true);

  // ESTADO PARA EXPANDIR DETALLES POR COLUMNA INDEPENDIENTE
  const [expandedColumns, setExpandedColumns] = useState({
    DRAFT: false,
    TESTING: false,
    PENDING_APPROVAL: false,
    STAGED: false,
    DEPLOYED: false
  });

  // RBAC: Control de accesos para despliegue
  const userSession = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (userSession.role || userSession.perfil || 'ANALYST').toUpperCase();
  const isManager = userRole === 'MANAGER' || userRole === 'ADMIN';

  // ESTADOS PARA EL DESPLIEGUE MASIVO
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');

  // 🚀 ESTADOS PARA EL VISOR DE DIFERENCIAS (AUDITORÍA DE PASE A PROD)
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedRuleForDiff, setSelectedRuleForDiff] = useState(null);
  const [prodVersionData, setProdVersionData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const fetchRules = async () => {
    setCargando(true);
    try {
      const res = await api.get('/api/v1/rules/latest');
      let fetchedData = res.data?.data || res.data || [];
      setRules(Array.isArray(fetchedData) ? fetchedData : []);
    } catch (error) {
      console.error("Error cargando el workflow:", error);
      setRules([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const workflow = {
    DRAFT: rules.filter(r => r.lifecycle_status === 'DRAFT'),
    TESTING: rules.filter(r => r.lifecycle_status === 'TESTING'),
    PENDING_APPROVAL: rules.filter(r => r.lifecycle_status === 'PENDING_APPROVAL'),
    STAGED: rules.filter(r => r.lifecycle_status === 'STAGED'), 
    DEPLOYED: rules.filter(r => r.lifecycle_status === 'DEPLOYED' || r.is_production)
  };

  const toggleColumnDetails = (columnKey) => {
    setExpandedColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const getSeverityColor = (sev) => {
    const colors = {
      'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
      'HIGH': 'bg-orange-100 text-orange-700 border-orange-200',
      'MEDIUM': 'bg-amber-100 text-amber-700 border-amber-200',
      'LOW': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[sev?.toUpperCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleMassDeploy = async () => {
    setDeploying(true);
    setDeployError('');
    
    let errores = [];
    let procesadas = 0;

    for (const rule of workflow.STAGED) {
      try {
        await api.put(`/api/v1/rules/${rule.rule_code}/status`, { status: 'DEPLOYED' });
        procesadas++;
      } catch (error) {
        console.error(`Error desplegando ${rule.rule_code}:`, error);
        const status = error.response?.status;
        const msg = error.response?.data?.error || error.response?.data?.message || 'Error desconocido';
        
        if (status === 403) {
          errores.push(`Acceso Denegado para ${rule.rule_code}.`);
        } else {
          errores.push(`Fallo en ${rule.rule_code} (HTTP ${status}): ${msg}`);
        }
        break; 
      }
    }

    await fetchRules(); 

    if (errores.length > 0) {
      setDeployError(`Despliegue interrumpido. ${procesadas} regla(s) pasaron a producción con éxito. Error en la cola: ${errores[0]}`);
    } else {
      setDeployModalOpen(false); 
    }
    
    setDeploying(false);
  };

  // 🚀 FUNCIÓN PARA CARGAR EL HISTORIAL Y BUSCAR LA VERSIÓN DE PRODUCCIÓN
  const handleOpenDiff = async (ruleStaged) => {
    setSelectedRuleForDiff(ruleStaged);
    setDiffModalOpen(true);
    setLoadingDiff(true);
    setProdVersionData(null);
    try {
      const res = await api.get(`/api/v1/rules/${ruleStaged.rule_code}/history`);
      const history = res.data?.data || res.data || [];
      const prodRule = history.find(r => r.is_production === true || r.is_production === 'true' || r.lifecycle_status === 'DEPLOYED');
      setProdVersionData(prodRule || null);
    } catch (e) {
      console.error("Error obteniendo historial para diff:", e);
    } finally {
      setLoadingDiff(false);
    }
  };

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

  const handleScrollLeft = (e) => {
    if (isSyncingLeft.current) { isSyncingLeft.current = false; return; }
    isSyncingRight.current = true;
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = e.target.scrollTop;
      rightScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleScrollRight = (e) => {
    if (isSyncingRight.current) { isSyncingRight.current = false; return; }
    isSyncingLeft.current = true;
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = e.target.scrollTop;
      leftScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // 🚀 GENERADOR DE NODOS DE DIFERENCIA (PROD vs STAGED)
  const { prodSqlNodes, stagedSqlNodes } = useMemo(() => {
    if (!selectedRuleForDiff || !prodVersionData) return { prodSqlNodes: null, stagedSqlNodes: null };
    
    const cLines = (parseIncomingSql(selectedRuleForDiff.query_sql) || '').replace(/\r\n/g, '\n').split('\n'); // NEW (Staged)
    const hLines = (parseIncomingSql(prodVersionData.query_sql) || '').replace(/\r\n/g, '\n').split('\n'); // OLD (Prod)
    
    const m = cLines.length, n = hLines.length;
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (cLines[i - 1].trim() === hLines[j - 1].trim()) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m, j = n;
    const lNodes = []; // Staged
    const rNodes = []; // Prod
    let lLine = m;
    let rLine = n;

    while (i > 0 || j > 0) {
      const cMatch = i > 0 ? cLines[i - 1].trim() : null;
      const hMatch = j > 0 ? hLines[j - 1].trim() : null;

      if (i > 0 && j > 0 && cMatch === hMatch) {
        lNodes.unshift({ type: 'equal', text: cLines[i - 1], line: lLine-- });
        rNodes.unshift({ type: 'equal', text: hLines[j - 1], line: rLine-- });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        lNodes.unshift({ type: 'empty', text: ' ', line: '-' });
        rNodes.unshift({ type: 'removed', text: hLines[j - 1], line: rLine-- });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        lNodes.unshift({ type: 'added', text: cLines[i - 1], line: lLine-- });
        rNodes.unshift({ type: 'empty', text: ' ', line: '-' });
        i--;
      }
    }

    const renderNode = (node, idx) => {
      let bgClass = 'text-slate-300 hover:bg-slate-800/50';
      let prefix = ' ';
      
      if (node.type === 'added') {
        bgClass = 'bg-emerald-900/40 text-emerald-200 border-l-[3px] border-emerald-500';
        prefix = '+';
      } else if (node.type === 'removed') {
        bgClass = 'bg-rose-900/40 text-rose-200 border-l-[3px] border-rose-500';
        prefix = '-';
      } else if (node.type === 'empty') {
        bgClass = 'bg-slate-900/20 text-slate-600 select-none';
        prefix = ' ';
      }

      return (
        <div key={`node-${idx}`} className={`px-2 py-[3px] font-mono text-[11px] whitespace-pre flex border-b border-transparent ${bgClass} min-h-[24px] items-center`}>
          <span className="w-8 shrink-0 text-slate-600 text-right pr-2 select-none border-r border-slate-700/50 mr-2 block">{node.line}</span>
          <span className="w-3 shrink-0 text-center font-bold opacity-70 select-none block">{prefix}</span>
          <span className="break-all block">{node.text}</span>
        </div>
      );
    };

    return { 
      prodSqlNodes: rNodes.map((n, idx) => renderNode(n, idx)), // Prod is OLD
      stagedSqlNodes: lNodes.map((n, idx) => renderNode(n, idx)) // Staged is NEW
    };
  }, [selectedRuleForDiff, prodVersionData]);


  const renderCard = (rule, stageKey) => {
    const isStageExpanded = expandedColumns[stageKey];
    
    return (
      <div key={`${rule.rule_code}_${rule.version_number}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3 relative overflow-hidden shrink-0">
        <div className={`absolute top-0 left-0 w-full h-1 ${
          rule.lifecycle_status === 'DRAFT' ? 'bg-slate-300' : 
          rule.lifecycle_status === 'TESTING' ? 'bg-amber-400' : 
          rule.lifecycle_status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 
          rule.lifecycle_status === 'STAGED' ? 'bg-blue-500' : 'bg-emerald-500'
        }`}></div>

        <div className="flex justify-between items-start mt-1">
          <span className="text-[10px] font-black font-mono text-power-blue bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[60%]">
            {rule.rule_code}
          </span>
          <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
            v{rule.version_number}
          </span>
        </div>

        <div>
          <h4 className={`text-sm font-bold text-gray-800 leading-tight mb-1 ${isStageExpanded ? '' : 'line-clamp-2'}`} title={rule.rule_name}>{rule.rule_name}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded shadow-2xs border ${getSeverityColor(rule.severity)}`}>
              {rule.severity}
            </span>
            <span className="text-[9px] text-slate-500 font-mono font-bold">
              {rule.entity_type}
            </span>
          </div>
        </div>

        {/* VISOR DE COMENTARIO DE VERSIÓN POR TARJETA EXPANDIDA */}
        {isStageExpanded && (
          <div className="mt-1 pt-2 border-t border-slate-100 animate-fade-in text-left">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-wider">Comentario de Versión:</p>
            <p className="text-[10px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100 break-words">
              "{rule.version_comment || 'Sin comentario registrado para esta versión.'}"
            </p>
            <p className="text-[8px] text-slate-400 mt-1.5 text-right font-medium">Auditoría: <span className="font-bold">{rule.changed_by || 'Usuario Sistema'}</span></p>
          </div>
        )}

        <div className="pt-3 border-t border-gray-100 flex justify-between items-center mt-auto">
          <span className={`w-2 h-2 rounded-full shrink-0 ${rule.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} title={rule.is_active ? 'Encendida' : 'Apagada'}></span>
          
          <button 
            onClick={() => onEditRule({ ...rule, _fromWorkflow: true })} 
            className="text-[10px] font-bold text-power-purple hover:text-white hover:bg-power-purple bg-power-purple/5 px-2 py-1.5 rounded-lg transition-colors border border-power-purple/20 truncate ml-2"
          >
            {rule.lifecycle_status === 'DEPLOYED' ? '👁️ Inspeccionar' : '✅ Auditar'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto animate-fade-in h-[calc(100vh-100px)] min-h-[600px] flex flex-col relative">
      
      <div className="mb-6 shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-power-blue">Gestión de Publicación (CI/CD)</h2>
          <p className="text-gray-500 text-xs md:text-sm mt-1">Monitorea el embudo de integración y despliegue de las reglas antifraude en tiempo real.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-3 shadow-sm shrink-0">
             <span className="text-xl">{isManager ? '👔' : '👤'}</span>
             <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Perfil Activo</p>
                <p className="text-xs font-bold text-power-blue">{isManager ? 'Aprobador / Manager' : 'Analista de Riesgos'}</p>
             </div>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-power-purple/30 border-t-power-purple rounded-full animate-spin"></div>
          <p className="text-gray-400 font-bold italic mt-4">Sincronizando pipeline...</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-0 select-none">
          
          {/* 📝 COLUMNA: DRAFT */}
          <div className="w-[85vw] sm:w-[280px] lg:w-auto shrink-0 lg:shrink flex flex-col bg-slate-50 rounded-2xl border border-slate-200 h-full min-h-0">
            <div className="p-3 xl:p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/50 rounded-t-2xl shrink-0 gap-2">
              <h3 className="font-black text-slate-700 flex items-center gap-1.5 text-sm truncate">
                <span>📝</span> Borradores
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => toggleColumnDetails('DRAFT')} 
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${expandedColumns.DRAFT ? 'bg-power-purple/10 border-power-purple/20 text-power-purple' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                  title="Mostrar comentarios de versión"
                >
                  👁️
                </button>
                <span className="bg-white text-slate-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-slate-200">
                  {workflow.DRAFT.length}
                </span>
              </div>
            </div>
            <div className="p-2 xl:p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.DRAFT.map(r => renderCard(r, 'DRAFT'))}
              {workflow.DRAFT.length === 0 && <p className="text-center text-xs text-slate-400 italic py-10">No hay borradores.</p>}
            </div>
          </div>

          {/* 🧪 COLUMNA: TESTING */}
          <div className="w-[85vw] sm:w-[280px] lg:w-auto shrink-0 lg:shrink flex flex-col bg-amber-50/30 rounded-2xl border border-amber-200/50 h-full min-h-0">
            <div className="p-3 xl:p-4 border-b border-amber-100 flex justify-between items-center bg-amber-100/30 rounded-t-2xl shrink-0 gap-2">
              <h3 className="font-black text-amber-800 flex items-center gap-1.5 text-sm truncate">
                <span>🧪</span> En Pruebas
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => toggleColumnDetails('TESTING')} 
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${expandedColumns.TESTING ? 'bg-power-purple/10 border-power-purple/20 text-power-purple' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-100/40'}`}
                  title="Mostrar comentarios de versión"
                >
                  👁️
                </button>
                <span className="bg-white text-amber-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-amber-200">
                  {workflow.TESTING.length}
                </span>
              </div>
            </div>
            <div className="p-2 xl:p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.TESTING.map(r => renderCard(r, 'TESTING'))}
              {workflow.TESTING.length === 0 && <p className="text-center text-xs text-amber-400/70 italic py-10">Ninguna regla.</p>}
            </div>
          </div>

          {/* ⏳ COLUMNA: PENDING_APPROVAL */}
          <div className="w-[85vw] sm:w-[280px] lg:w-auto shrink-0 lg:shrink flex flex-col bg-orange-50/30 rounded-2xl border border-orange-200/50 h-full min-h-0">
            <div className="p-3 xl:p-4 border-b border-orange-100 flex justify-between items-center bg-orange-100/30 rounded-t-2xl shrink-0 gap-2">
              <h3 className="font-black text-orange-800 flex items-center gap-1.5 text-sm truncate">
                <span>⏳</span> Por Aprobar
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => toggleColumnDetails('PENDING_APPROVAL')} 
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${expandedColumns.PENDING_APPROVAL ? 'bg-power-purple/10 border-power-purple/20 text-power-purple' : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-100/40'}`}
                  title="Mostrar comentarios de versión"
                >
                  👁️
                </button>
                <span className="bg-white text-orange-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-orange-200">
                  {workflow.PENDING_APPROVAL.length}
                </span>
              </div>
            </div>
            <div className="p-2 xl:p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.PENDING_APPROVAL.map(r => renderCard(r, 'PENDING_APPROVAL'))}
              {workflow.PENDING_APPROVAL.length === 0 && <p className="text-center text-xs text-orange-400/70 italic py-10">Bandeja limpia.</p>}
            </div>
          </div>

          {/* 📦 COLUMNA: STAGED */}
          <div className="w-[85vw] sm:w-[280px] lg:w-auto shrink-0 lg:shrink flex flex-col bg-blue-50/40 rounded-2xl border border-blue-200/60 shadow-inner h-full min-h-0">
            <div className="p-3 xl:p-4 border-b border-blue-200 flex flex-col gap-3 bg-blue-100/50 rounded-t-2xl shrink-0">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-black text-blue-900 flex items-center gap-1.5 text-sm truncate">
                  <span>📦</span> Staged
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => toggleColumnDetails('STAGED')} 
                    className={`p-1.5 rounded-lg border text-xs transition-colors ${expandedColumns.STAGED ? 'bg-power-purple/10 border-power-purple/20 text-power-purple' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-100/40'}`}
                    title="Mostrar comentarios de versión"
                  >
                    👁️
                  </button>
                  <span className="bg-white text-blue-700 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-blue-200">
                    {workflow.STAGED.length}
                  </span>
                </div>
              </div>
              
              {isManager && workflow.STAGED.length > 0 && (
                <button 
                  onClick={() => setDeployModalOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] xl:text-[10px] uppercase tracking-wider py-2 rounded-lg shadow-md transition-all active:scale-95 flex justify-center items-center gap-1.5 border border-blue-700 shrink-0"
                >
                  <span>🚀</span> Desplegar Todo
                </button>
              )}
            </div>
            <div className="p-2 xl:p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar relative">
              {workflow.STAGED.map(r => renderCard(r, 'STAGED'))}
              {workflow.STAGED.length === 0 && <p className="text-center text-xs text-blue-500/60 italic py-10">Sin reglas en espera.</p>}
            </div>
          </div>

          {/* 🚀 COLUMNA: DEPLOYED */}
          <div className="w-[85vw] sm:w-[280px] lg:w-auto shrink-0 lg:shrink flex flex-col bg-emerald-50/30 rounded-2xl border border-emerald-200/50 h-full min-h-0">
            <div className="p-3 xl:p-4 border-b border-emerald-100 flex justify-between items-center bg-emerald-100/30 rounded-t-2xl shrink-0 gap-2">
              <h3 className="font-black text-emerald-800 flex items-center gap-1.5 text-sm truncate">
                <span>🚀</span> Producción
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => toggleColumnDetails('DEPLOYED')} 
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${expandedColumns.DEPLOYED ? 'bg-power-purple/10 border-power-purple/20 text-power-purple' : 'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-100/40'}`}
                  title="Mostrar comentarios de versión"
                >
                  👁️
                </button>
                <span className="bg-white text-emerald-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-emerald-200">
                  {workflow.DEPLOYED.length}
                </span>
              </div>
            </div>
            <div className="p-2 xl:p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.DEPLOYED.map(r => renderCard(r, 'DEPLOYED'))}
              {workflow.DEPLOYED.length === 0 && <p className="text-center text-xs text-emerald-400/70 italic py-10">Sin despliegues activos.</p>}
            </div>
          </div>

        </div>
      )}

      {/* 🚀 MODAL DE CONFIRMACIÓN DE DESPLIEGUE MASIVO CON AUDITORÍA (Z-INDEX: 200) */}
      {deployModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[200] backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🚀</span>
              <div>
                <h3 className="text-xl font-black text-slate-800">Confirmación de Pase a Producción</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Las siguientes reglas entrarán a operar en tráfico en vivo.</p>
              </div>
            </div>

            {deployError && (
              <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg text-xs font-bold animate-fade-in flex items-start gap-2 shadow-sm">
                <span className="text-base mt-0.5">🛑</span> 
                <p>{deployError}</p>
              </div>
            )}
            
            <div className="mt-5 mb-5 bg-slate-50 border border-slate-200 rounded-xl overflow-y-auto flex-1 custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100/80 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Cód. Regla</th>
                      <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Nombre Descriptivo</th>
                      <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-center">Versión a Subir</th>
                      <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-center">Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {workflow.STAGED.map(rule => (
                       <tr key={rule.rule_code} className="hover:bg-slate-100/50 transition-colors">
                         <td className="px-4 py-3 text-xs font-mono font-bold text-power-purple">{rule.rule_code}</td>
                         <td className="px-4 py-3 text-xs font-medium text-slate-700 truncate max-w-[180px]" title={rule.rule_name}>{rule.rule_name}</td>
                         <td className="px-4 py-3 text-xs font-black text-slate-500 text-center">v{rule.version_number}</td>
                         <td className="px-4 py-3 text-center">
                           <button 
                             onClick={() => handleOpenDiff(rule)}
                             className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95"
                           >
                             🔍 Ver Detalles
                           </button>
                         </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button 
                type="button" 
                onClick={() => setDeployModalOpen(false)} 
                disabled={deploying}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleMassDeploy} 
                disabled={deploying} 
                className="flex-[2] py-3 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all shadow-md"
              >
                {deploying ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Procesando Despliegue...</span>
                  </div>
                ) : (
                  `Confirmar Despliegue (${workflow.STAGED.length} reglas)`
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🚀 MODAL INSPECTOR DE DIFERENCIAS (Z-INDEX: 210 - ENCIMA DEL MODAL DE DEPLOY) */}
      {diffModalOpen && selectedRuleForDiff && (
        <div className="fixed inset-0 bg-slate-900/95 flex flex-col z-[210] animate-fade-in backdrop-blur-md">
          <div className="p-4 flex justify-between items-center border-b border-slate-800 shrink-0 bg-slate-950">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                ⚖️ Auditoría de Cambios <span className="text-power-purple font-mono ml-2">{selectedRuleForDiff.rule_code}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Revisa el código exacto y las propiedades que entrarán a producción.</p>
            </div>
            <button onClick={() => setDiffModalOpen(false)} className="bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 px-5 py-2.5 rounded-lg font-bold text-sm border border-slate-700 transition-colors">
              Volver al Resumen
            </button>
          </div>
          
          <div className="flex-1 flex overflow-hidden p-4 gap-4">
            {loadingDiff ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-power-purple/30 border-t-power-purple rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-sm text-slate-400">Analizando historial y extrayendo diferencias...</p>
              </div>
            ) : !prodVersionData ? (
              
              /* 🟢 VISTA PARA REGLA COMPLETAMENTE NUEVA */
              <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-emerald-500/50 shadow-2xl bg-slate-900 max-w-4xl mx-auto w-full">
                <div className="bg-emerald-500/10 px-6 py-4 border-b border-emerald-500/30 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✨</span>
                    <div>
                      <h3 className="text-emerald-400 font-black text-base uppercase tracking-wider">REGLA COMPLETAMENTE NUEVA</h3>
                      <p className="text-xs text-emerald-200/60 font-medium">Esta regla operará en tráfico vivo por primera vez.</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500 text-slate-900 font-black px-3 py-1 rounded-md text-xs">A DESPLEGAR (v{selectedRuleForDiff.version_number})</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 p-6 bg-slate-800/50 border-b border-slate-700 shrink-0">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nombre Descriptivo</p>
                    <p className="text-xs text-white font-bold bg-slate-800 px-3 py-2 rounded border border-slate-700 truncate" title={selectedRuleForDiff.rule_name}>{selectedRuleForDiff.rule_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo de Evento</p>
                    <p className="text-xs text-white font-mono font-bold bg-slate-800 px-3 py-2 rounded border border-slate-700 truncate">{selectedRuleForDiff.event_type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado de Bloqueo</p>
                    <p className={`text-xs font-bold px-3 py-2 rounded border truncate ${selectedRuleForDiff.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                      {selectedRuleForDiff.is_active ? '🟢 ENCENDIDA (Activa)' : '🔴 APAGADA (Ignorar)'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-[#282c34] p-4">
                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Código SQL que se Inyectará:</p>
                   <CodeMirror 
                      value={parseIncomingSql(selectedRuleForDiff.query_sql)} 
                      theme="dark" 
                      extensions={[sql()]} 
                      readOnly={true} 
                      editable={false}
                      basicSetup={{ lineNumbers: true, foldGutter: false }}
                   />
                </div>
              </div>

            ) : (

              /* ⚖️ VISTA COMPARATIVA (PRODUCCIÓN VS NUEVA) */
              <>
                {/* PANEL IZQUIERDO: PRODUCCIÓN */}
                <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
                  <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-900">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">🏛️ Actualmente en Producción</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">Versión {prodVersionData.version_number}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 p-4 grid grid-cols-2 gap-3 border-b border-slate-700 text-[11px] shrink-0">
                    <div>
                      <span className="text-slate-500 block mb-1 uppercase tracking-widest text-[9px] font-bold">Evento Asignado</span> 
                      <span className="font-bold text-slate-300 px-1.5 py-0.5 rounded block truncate">{prodVersionData.event_type || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1 uppercase tracking-widest text-[9px] font-bold">Estado Actual</span> 
                      <span className="font-bold text-slate-300 px-1.5 py-0.5 rounded block truncate">
                        {(prodVersionData.is_active === true || prodVersionData.is_active === 'true') ? '🟢 Activa' : '🔴 Apagada'}
                      </span>
                    </div>
                  </div>

                  <div 
                    className="flex-1 bg-slate-950 overflow-auto py-2 custom-scrollbar"
                    ref={rightScrollRef} 
                    onScroll={handleScrollRight}
                  >
                    {prodSqlNodes}
                  </div>
                </div>

                {/* PANEL DERECHO: STAGED (LA QUE VA A SUBIR) */}
                <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-power-purple/50 shadow-2xl relative">
                  <div className="bg-power-purple/20 px-4 py-3 flex justify-between items-center border-b border-power-purple/30">
                    <div>
                      <span className="text-xs font-bold text-power-purple uppercase tracking-wider block">📦 Nueva Versión a Desplegar</span>
                      <span className="text-[10px] font-mono font-bold text-power-purple/60">Versión {selectedRuleForDiff.version_number}</span>
                    </div>
                  </div>
                  
                  <div className="bg-power-purple/5 p-4 grid grid-cols-2 gap-3 border-b border-power-purple/20 text-[11px] shrink-0">
                    <div>
                      <span className="text-power-purple/60 block mb-1 uppercase tracking-widest text-[9px] font-bold">Nuevo Evento</span> 
                      <span className={`font-bold px-1.5 py-0.5 rounded block truncate ${(selectedRuleForDiff.event_type !== prodVersionData.event_type) ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-inner' : 'text-slate-300'}`}>
                        {selectedRuleForDiff.event_type || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-power-purple/60 block mb-1 uppercase tracking-widest text-[9px] font-bold">Nuevo Estado</span> 
                      <span className={`font-bold px-1.5 py-0.5 rounded block truncate ${(String(selectedRuleForDiff.is_active) !== String(prodVersionData.is_active)) ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-inner' : 'text-slate-300'}`}>
                        {(selectedRuleForDiff.is_active === true || selectedRuleForDiff.is_active === 'true') ? '🟢 Activa' : '🔴 Apagada'}
                      </span>
                    </div>
                  </div>

                  <div 
                    className="flex-1 bg-slate-950 overflow-auto py-2 custom-scrollbar"
                    ref={leftScrollRef} 
                    onScroll={handleScrollLeft}
                  >
                    {stagedSqlNodes}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default RulesWorkflow;