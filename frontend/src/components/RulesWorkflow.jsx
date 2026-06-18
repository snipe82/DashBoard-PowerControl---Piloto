import React, { useState, useEffect } from 'react';
import api from '../api';

const RulesWorkflow = ({ onEditRule }) => {
  const [rules, setRules] = useState([]);
  const [cargando, setCargando] = useState(true);

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
    DEPLOYED: rules.filter(r => r.lifecycle_status === 'DEPLOYED' || r.is_production)
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

  const renderCard = (rule) => (
    <div key={`${rule.rule_code}_${rule.version_number}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${
        rule.lifecycle_status === 'DRAFT' ? 'bg-slate-300' : 
        rule.lifecycle_status === 'TESTING' ? 'bg-amber-400' : 
        rule.lifecycle_status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-emerald-500'
      }`}></div>

      <div className="flex justify-between items-start mt-1">
        <span className="text-[10px] font-black font-mono text-power-blue bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {rule.rule_code}
        </span>
        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
          v{rule.version_number}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-800 leading-tight mb-1 line-clamp-2" title={rule.rule_name}>{rule.rule_name}</h4>
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded shadow-2xs border ${getSeverityColor(rule.severity)}`}>
            {rule.severity}
          </span>
          <span className="text-[9px] text-slate-500 font-mono font-bold">
            {rule.entity_type}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 flex justify-between items-center mt-auto">
        <span className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} title={rule.is_active ? 'Encendida' : 'Apagada'}></span>
        
        {/* 🚀 INYECTAMOS LA BANDERA _fromWorkflow AQUÍ */}
        <button 
          onClick={() => onEditRule({ ...rule, _fromWorkflow: true })} 
          className="text-[10px] font-bold text-power-purple hover:text-white hover:bg-power-purple bg-power-purple/5 px-3 py-1.5 rounded-lg transition-colors border border-power-purple/20"
        >
          {rule.lifecycle_status === 'DEPLOYED' ? '👁️ Inspeccionar' : '✅ Auditar / Avanzar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto animate-fade-in h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <h2 className="text-xl md:text-2xl font-black text-power-blue">Gestión de Publicación (CI/CD)</h2>
        <p className="text-gray-500 text-xs md:text-sm mt-1">Monitorea el embudo de integración y despliegue de las reglas antifraude.</p>
      </div>

      {cargando ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-power-purple/30 border-t-power-purple rounded-full animate-spin"></div>
          <p className="text-gray-400 font-bold italic mt-4">Sincronizando pipeline...</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          
          <div className="flex-1 min-w-[240px] flex flex-col bg-slate-50 rounded-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/50 rounded-t-2xl">
              <h3 className="font-black text-slate-700 flex items-center gap-2 text-sm md:text-base">
                <span>📝</span> Borradores
              </h3>
              <span className="bg-white text-slate-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-slate-200">
                {workflow.DRAFT.length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.DRAFT.map(renderCard)}
              {workflow.DRAFT.length === 0 && <p className="text-center text-xs text-slate-400 italic py-10">No hay borradores en desarrollo.</p>}
            </div>
          </div>

          <div className="flex-1 min-w-[240px] flex flex-col bg-amber-50/30 rounded-2xl border border-amber-200/50">
            <div className="p-4 border-b border-amber-100 flex justify-between items-center bg-amber-100/30 rounded-t-2xl">
              <h3 className="font-black text-amber-800 flex items-center gap-2 text-sm md:text-base">
                <span>🧪</span> En Pruebas
              </h3>
              <span className="bg-white text-amber-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-amber-200">
                {workflow.TESTING.length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.TESTING.map(renderCard)}
              {workflow.TESTING.length === 0 && <p className="text-center text-xs text-amber-400/70 italic py-10">Ninguna regla en fase de testing.</p>}
            </div>
          </div>

          <div className="flex-1 min-w-[240px] flex flex-col bg-orange-50/30 rounded-2xl border border-orange-200/50">
            <div className="p-4 border-b border-orange-100 flex justify-between items-center bg-orange-100/30 rounded-t-2xl">
              <h3 className="font-black text-orange-800 flex items-center gap-2 text-sm md:text-base">
                <span>⏳</span> Por Aprobar
              </h3>
              <span className="bg-white text-orange-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-orange-200">
                {workflow.PENDING_APPROVAL.length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.PENDING_APPROVAL.map(renderCard)}
              {workflow.PENDING_APPROVAL.length === 0 && <p className="text-center text-xs text-orange-400/70 italic py-10">Bandeja de aprobaciones limpia.</p>}
            </div>
          </div>

          <div className="flex-1 min-w-[240px] flex flex-col bg-emerald-50/30 rounded-2xl border border-emerald-200/50">
            <div className="p-4 border-b border-emerald-100 flex justify-between items-center bg-emerald-100/30 rounded-t-2xl">
              <h3 className="font-black text-emerald-800 flex items-center gap-2 text-sm md:text-base">
                <span>🚀</span> Producción
              </h3>
              <span className="bg-white text-emerald-600 font-black text-xs px-2 py-1 rounded-md shadow-sm border border-emerald-200">
                {workflow.DEPLOYED.length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {workflow.DEPLOYED.map(renderCard)}
              {workflow.DEPLOYED.length === 0 && <p className="text-center text-xs text-emerald-400/70 italic py-10">Sin despliegues activos.</p>}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default RulesWorkflow;