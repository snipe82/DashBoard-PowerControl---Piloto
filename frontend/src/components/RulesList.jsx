import React, { useState, useEffect } from 'react';
import api from '../api';

const RulesList = ({ onEditRule, onCreateRule, filtros }) => {
  const [rules, setRules] = useState([]);
  const [cargando, setCargando] = useState(true);

  const fetchRules = async () => {
    setCargando(true);
    try {
      const res = await api.get('/api/v1/rules');
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
  }, []);

  const handleToggle = async (ruleCode, currentStatus) => {
    const newStatus = !currentStatus;
    const comment = window.prompt("Comentario para este cambio de estado (Opcional):", "Activación/Desactivación rápida");
    if (comment === null) return; 
    
    setRules(prev => prev.map(r => r.rule_code === ruleCode ? { ...r, is_active: newStatus } : r));

    try {
      await api.patch(`/api/v1/rules/${ruleCode}/activation`, { 
        is_active: newStatus, 
        version_comment: comment 
      });
    } catch (error) {
      setRules(prev => prev.map(r => r.rule_code === ruleCode ? { ...r, is_active: currentStatus } : r));
      alert("Error de red: No se pudo cambiar el estado de activación en el servidor.");
    }
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

  const reglasFiltradas = rules.filter(rule => {
    if (!filtros?.busqueda) return true;
    const textoBuscado = filtros.busqueda.toLowerCase().trim();
    const codigo = (rule.rule_code || '').toLowerCase();
    const nombre = (rule.rule_name || '').toLowerCase();
    return codigo.includes(textoBuscado) || nombre.includes(textoBuscado);
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-power-blue">Análisis & Motor de Reglas</h2>
          <p className="text-gray-500 text-xs md:text-sm">Validaciones dinámicas PostgreSQL operando en tiempo real.</p>
          
          {/* 📊 NUEVO: MICRO-KPIs DE REGLAS */}
          {!cargando && (
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="bg-power-purple/10 text-power-purple border border-power-purple/20 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                📊 Total Reglas: {rules.length}
              </span>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                ✅ Operando (Activas): {rules.filter(r => r.is_active).length}
              </span>
            </div>
          )}
        </div>
        <button onClick={onCreateRule} className="bg-power-purple text-white px-5 py-2.5 rounded-xl font-bold hover:bg-power-purple/80 transition-all shadow-md active:scale-95 w-full md:w-auto mt-2 md:mt-0">
          + Nueva Regla
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-power-purple/30 border-t-power-purple rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold italic animate-pulse">Sincronizando reglas vivas...</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Identificador / Nombre</th>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Foco / Canal</th>
                  <th className="px-4 md:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Severidad</th>
                  <th className="px-4 md:px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 md:px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reglasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">
                      {filtros?.busqueda ? 'No se encontraron reglas que coincidan con la búsqueda.' : 'No se encontraron reglas registradas en el servidor.'}
                    </td>
                  </tr>
                ) : (
                  reglasFiltradas.map((rule) => (
                    <tr key={rule.rule_code} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap md:whitespace-normal">
                        <div className="text-xs font-black font-mono text-power-purple mb-0.5">{rule.rule_code}</div>
                        <div className="text-sm font-bold text-gray-800 leading-tight max-w-[200px] md:max-w-md truncate" title={rule.rule_name}>{rule.rule_name}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-black text-slate-700 uppercase tracking-wide">{rule.entity_type}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{rule.event_type}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-black uppercase rounded-full border shadow-xs ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-center whitespace-nowrap">
                        <button onClick={() => handleToggle(rule.rule_code, rule.is_active)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${rule.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        <button onClick={() => onEditRule(rule)} className="text-indigo-600 hover:text-indigo-900 font-black transition-colors flex items-center justify-end gap-1 ml-auto">
                          <span className="md:hidden">✏️ Editar</span>
                          <span className="hidden md:inline">Editar Configuración</span>
                        </button>
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