import React, { useState, useEffect } from 'react';
import api from '../api';

const RulesList = ({ onEditRule, onCreateRule, filtros }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('powerControl_activeRuleTab') || 'PROD';
  }); 
  
  const [rules, setRules] = useState([]);
  const [cargando, setCargando] = useState(true);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('powerControl_activeRuleTab', tab);
  };

  const fetchRules = async () => {
    setCargando(true);
    setRules([]); 
    try {
      const endpoint = activeTab === 'PROD' ? '/api/v1/rules' : '/api/v1/rules/latest';
      const res = await api.get(endpoint);
      
      let fetchedData = res.data;
      let arrayDefinitivo = [];

      if (Array.isArray(fetchedData)) {
        arrayDefinitivo = fetchedData; 
      } else if (fetchedData && Array.isArray(fetchedData.data)) {
        arrayDefinitivo = fetchedData.data; 
      } else if (fetchedData && typeof fetchedData === 'object') {
        arrayDefinitivo = Object.values(fetchedData).find(Array.isArray) || [];
      }

      setRules(arrayDefinitivo);
    } catch (error) {
      console.error("Error cargando reglas desde el motor:", error);
      setRules([]); 
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [activeTab]);

  const getSeverityColor = (sev) => {
    const colors = {
      'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
      'HIGH': 'bg-orange-100 text-orange-700 border-orange-200',
      'MEDIUM': 'bg-amber-100 text-amber-700 border-amber-200',
      'LOW': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[sev?.toUpperCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const renderLifecycleBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch(s) {
      case 'DRAFT': return <span className="bg-slate-100 text-slate-500 border border-slate-300 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">📝 DRAFT</span>;
      case 'TESTING': return <span className="bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">🧪 TESTING</span>;
      case 'PENDING_APPROVAL': return <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">⏳ PENDING</span>;
      case 'DEPLOYED': return <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">🚀 DEPLOYED</span>;
      case 'PREVIOUSLY_DEPLOYED': return <span className="bg-gray-200 text-gray-500 border border-gray-300 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">🕰️ RETIRADA</span>;
      default: return <span className="bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-sm">{s || 'UNKNOWN'}</span>;
    }
  };

  const reglasFiltradas = rules.filter(rule => {
    if (!filtros?.busqueda) return true;
    const textoBuscado = filtros.busqueda.toLowerCase().trim();
    const codigo = (rule.rule_code || '').toLowerCase();
    const nombre = (rule.rule_name || '').toLowerCase();
    return codigo.includes(textoBuscado) || nombre.includes(textoBuscado);
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-power-blue">Análisis & Motor de Reglas</h2>
          <p className="text-gray-500 text-xs md:text-sm">Arquitectura de Control de Versiones y Despliegue Continuo.</p>
          
          {!cargando && (
            <div className="flex flex-wrap gap-3 mt-3 animate-fade-in">
              <span className="bg-power-purple/10 text-power-purple border border-power-purple/20 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                📊 Total Listadas: {rules.length}
              </span>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                ✅ Operando (Activas): {rules.filter(r => r.is_active).length}
              </span>
            </div>
          )}
        </div>
        
        {activeTab === 'DEV' && (
          <button onClick={onCreateRule} className="bg-power-purple text-white px-5 py-2.5 rounded-xl font-bold hover:bg-power-purple/80 transition-all shadow-md active:scale-95 w-full md:w-auto mt-2 md:mt-0 flex items-center justify-center gap-2">
            <span>➕</span> Crear Regla Borrador
          </button>
        )}
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-t-xl shrink-0 border-b border-gray-300 w-fit">
        <button 
          onClick={() => handleTabChange('PROD')}
          className={`px-6 py-2.5 text-xs md:text-sm font-black rounded-lg transition-all flex items-center gap-2 ${activeTab === 'PROD' ? 'bg-white text-emerald-600 shadow-sm border border-gray-200' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
        >
          🟢 Vitrina Producción
        </button>
        <button 
          onClick={() => handleTabChange('DEV')}
          className={`px-6 py-2.5 text-xs md:text-sm font-black rounded-lg transition-all flex items-center gap-2 ${activeTab === 'DEV' ? 'bg-white text-power-purple shadow-sm border border-gray-200' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
        >
          🧑‍💻 Laboratorio (En Trabajo)
        </button>
      </div>

      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0 overflow-hidden">
        
        <div className={`px-4 py-2 border-b flex items-center gap-2 text-xs font-bold ${activeTab === 'PROD' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-power-purple/5 text-power-purple border-power-purple/10'}`}>
          {activeTab === 'PROD' 
            ? '👁️ Estás viendo el código inmutable que está evaluando transacciones en vivo en este momento. MODO SOLO LECTURA.'
            : '🛠️ Estás viendo las últimas versiones creadas por los analistas (Puntas de Lanza). MODO EDICIÓN HABILITADO.'}
        </div>

        {cargando ? (
          <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
            <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${activeTab === 'PROD' ? 'border-emerald-500/30 border-t-emerald-600' : 'border-power-purple/30 border-t-power-purple'}`}></div>
            <p className="text-gray-400 font-bold italic animate-pulse">
              {activeTab === 'PROD' ? 'Sincronizando reglas en vivo...' : 'Cargando espacio de trabajo...'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Regla / Identificador</th>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Metadatos (Foco)</th>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ciclo de Vida (V2)</th>
                  {/* 🚀 COLUMNA RESTAURADA: Copia fiel de cabecera original */}
                  <th className="px-4 md:px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado Motor</th>
                  <th className="px-4 md:px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {reglasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">
                      {filtros?.busqueda ? 'No se encontraron coincidencias.' : `No hay reglas en el entorno de ${activeTab === 'PROD' ? 'Producción' : 'Desarrollo'}.`}
                    </td>
                  </tr>
                ) : (
                  reglasFiltradas.map((rule) => (
                    <tr key={`${rule.rule_code}_${rule.version_number}`} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* COLUMNA 1: IDENTIFICADOR Y NOMBRE */}
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap md:whitespace-normal">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black font-mono text-power-blue bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {rule.rule_code}
                          </span>
                          {rule.is_latest && <span title="Esta es la versión más reciente en desarrollo" className="text-amber-400 text-sm drop-shadow-sm">⭐</span>}
                        </div>
                        <div className="text-sm font-bold text-gray-800 leading-tight max-w-[200px] md:max-w-md truncate" title={rule.rule_name}>{rule.rule_name}</div>
                      </td>
                      
                      {/* COLUMNA 2: METADATOS */}
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`px-2 py-0.5 inline-flex text-[9px] leading-5 font-black uppercase rounded border shadow-2xs ${getSeverityColor(rule.severity)}`}>
                            {rule.severity}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {rule.entity_type} | {rule.event_type}
                          </span>
                        </div>
                      </td>

                      {/* COLUMNA 3: CICLO DE VIDA (V2) */}
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-start">
                          {renderLifecycleBadge(rule.lifecycle_status)}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                              v{rule.version_number || '1'}
                            </span>
                            {rule.is_production && (
                              <span className="text-[8px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm animate-pulse">
                                EN VIVO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 🚀 COLUMNA 4 RESTAURADA: Badge informativo seguro de solo lectura */}
                      <td className="px-4 md:px-6 py-4 text-center whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-[10px] leading-5 font-black uppercase rounded-full border shadow-2xs ${rule.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {rule.is_active ? '🟢 Activa' : '🔴 Apagada'}
                        </span>
                      </td>

                      {/* COLUMNA 5: ACCIONES */}
                      <td className="px-4 md:px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        {activeTab === 'DEV' ? (
                          <button onClick={() => onEditRule(rule)} className="text-power-purple hover:text-power-blue font-black transition-colors flex items-center justify-end gap-1.5 ml-auto bg-power-purple/5 hover:bg-power-purple/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-power-purple/20 active:scale-95">
                            <span className="text-xs">✏️</span>
                            <span className="hidden md:inline text-[11px] uppercase tracking-wider">Editar / Avanzar</span>
                          </button>
                        ) : (
                          <button onClick={() => onEditRule({ ...rule, _isReadOnly: true })} className="text-slate-400 hover:text-slate-600 font-black transition-colors flex items-center justify-end gap-1.5 ml-auto bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95">
                            <span className="text-xs">👁️</span>
                            <span className="hidden md:inline text-[11px] uppercase tracking-wider">Inspeccionar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesList;