import React, { useState, useEffect } from 'react';
import api from '../api'; 

const StatCard = ({ title, value, color, icon, tooltipText, children, cardBg="bg-white", borderColor="border-gray-100", textColor="text-gray-800", titleColor="text-gray-500" }) => {
  const [showTooltip, setShowHoverTooltip] = useState(false);

  return (
    <div 
      onMouseEnter={() => setShowHoverTooltip(true)}
      onMouseLeave={() => setShowHoverTooltip(false)}
      className={`${cardBg} p-4 rounded-xl border ${borderColor} shadow-sm flex flex-col justify-between relative group hover:shadow-md transition-all duration-200 min-h-[100px]`}
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <p className={`text-[9px] lg:text-[10px] ${titleColor} font-black uppercase tracking-widest leading-tight truncate`}>{title}</p>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white shrink-0 shadow-md ${color}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-xl lg:text-lg xl:text-2xl font-black ${textColor} truncate mt-2 tracking-tight`}>{value}</p>
        {children}
      </div>
      
      {showTooltip && tooltipText && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] rounded-lg p-2 shadow-xl border border-slate-700 leading-snug text-center animate-fade-in pointer-events-none">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};

const DashboardView = () => {
  const defaultDist = { top: [], totalAlertas: 0, clientesImpactados: 0 };
  const [stats, setStats] = useState({
    alertas_abiertas: 0, casos_en_revision: 0, casos_revisados: 0, dinero_en_riesgo: "0.00", efectividad: "100%", casos_criticos: 0, casos_sospechosos: 0, casos_frustrados: 0,
    monto_sospechas: "0.00", monto_fraude_total: "0.00", monto_fraudes_frustrados: "0.00", monto_fraudes_con_perdida: "0.00", monto_fraudes_sin_perdida: "0.00",
    fraudes_con_perdida: 0, fraudes_sin_perdida: 0,
    top_rules_activas: defaultDist, top_rules_riesgo: defaultDist, top_rules_globales: defaultDist, top_rules_mes_actual: defaultDist, top_rules_mes_anterior: defaultDist
  });
  
  const [cargando, setCargando] = useState(true);
  const [activeChartTooltip, setActiveChartTooltip] = useState(null);
  const [periodoHistorico, setPeriodoHistorico] = useState('total'); 

  useEffect(() => {
    const cargarEstadisticas = () => {
      api.get('/api/stats/summary')
        .then(res => {
          const data = res.data;
          setStats({
            alertas_abiertas: data.alertas_abiertas || 0, casos_en_revision: data.casos_en_revision || 0, casos_revisados: data.casos_revisados || 0,
            dinero_en_riesgo: data.dinero_en_riesgo || "0.00", efectividad: data.efectividad || "100%", casos_criticos: data.casos_criticos || 0,
            casos_sospechosos: data.casos_sospechosos || 0, casos_frustrados: data.casos_frustrados || 0, 
            monto_sospechas: data.monto_sospechas || "0.00", 
            monto_fraude_total: data.monto_fraude_total || "0.00", 
            monto_fraudes_frustrados: data.monto_fraudes_frustrados || "0.00", 
            monto_fraudes_con_perdida: data.monto_fraudes_con_perdida || "0.00", 
            monto_fraudes_sin_perdida: data.monto_fraudes_sin_perdida || "0.00", 
            fraudes_con_perdida: data.fraudes_con_perdida || 0,   
            fraudes_sin_perdida: data.fraudes_sin_perdida || 0,   
            top_rules_activas: data.top_rules_activas || defaultDist, top_rules_riesgo: data.top_rules_riesgo || defaultDist, top_rules_globales: data.top_rules_globales || defaultDist,
            top_rules_mes_actual: data.top_rules_mes_actual || defaultDist, top_rules_mes_anterior: data.top_rules_mes_anterior || defaultDist
          });
          setCargando(false);
        })
        .catch(err => {
          console.error("Error al cargar dashboard:", err);
          setCargando(false);
        });
    };

    cargarEstadisticas();
    const intervalo = setInterval(cargarEstadisticas, 30000);
    return () => clearInterval(intervalo);
  }, []);

  const toggleChartTooltip = (id) => setActiveChartTooltip(prev => prev === id ? null : id);
  const colores = ["bg-power-purple", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500", "bg-fuchsia-500"];
  const dataHistoricaVisible = periodoHistorico === 'actual' ? stats.top_rules_mes_actual : periodoHistorico === 'anterior' ? stats.top_rules_mes_anterior : stats.top_rules_globales;

  const renderRow = (r, idx, colorOffset = 0) => {
    const colorBarra = colores[(idx + colorOffset) % colores.length];
    return (
      <div key={idx} className="text-xs animate-fade-in flex flex-col mb-1.5">
        <div className="flex justify-between items-start gap-3 mb-1.5 w-full">
          <span className="font-bold text-gray-700 break-words leading-tight flex-1" title={r.nombre}>{r.nombre}</span>
          <span className="text-gray-500 font-mono shrink-0 whitespace-nowrap text-right mt-0.5">
            <span className="font-bold text-power-blue">{r.quantity}</span><span className="mx-1.5 text-gray-300">|</span><b className="text-gray-800 font-black">{r.porcentaje}%</b>
          </span>
        </div>
        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className={`${colorBarra} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${r.porcentaje}%` }}></div></div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in h-full overflow-y-auto w-full bg-gray-50/50">
      <div className="mb-6 md:mb-8 text-center md:text-left">
        <h2 className="text-xl md:text-2xl font-black text-power-blue mb-1">Resumen de Control</h2>
        <p className="text-gray-500 text-xs md:text-sm">Monitoreo en tiempo real de transacciones y riesgo financiero operativo.</p>
      </div>

      {cargando ? (
        <div className="text-center py-20 text-gray-400 italic font-bold animate-pulse">Sincronizando con el motor de reglas...</div>
      ) : (
        <>
          {/* 🚀 GRILLA PERFECTA A 5 COLUMNAS (10 TARJETAS EN 2 FILAS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8 relative z-10">
            
            <StatCard title="Alertas Pendientes" value={stats.alertas_abiertas} color="bg-amber-500" icon="⚠️" tooltipText="Cantidad de alertas nuevas por atender (estado Abiertas)." cardBg="bg-amber-50/70" borderColor="border-amber-200" titleColor="text-amber-700/80" textColor="text-amber-900"/>
            
            {/* INVERSIÓN DE COLOR: Ahora es Naranja */}
            <StatCard title="Casos en Revisión" value={stats.casos_en_revision} color="bg-orange-500" icon="🔎" tooltipText="Casos actualmente bajo análisis." cardBg="bg-orange-50/70" borderColor="border-orange-200" titleColor="text-orange-700/80" textColor="text-orange-900"/>
            
            <StatCard title="Monto en Riesgo" value={`S/ ${stats.dinero_en_riesgo}`} color="bg-fuchsia-500" icon="💰" tooltipText="Suma financiera total investigada en las alertas vivas." cardBg="bg-fuchsia-50/70" borderColor="border-fuchsia-200" titleColor="text-fuchsia-700/80" textColor="text-fuchsia-900"/>
            <StatCard title="Casos Revisados" value={stats.casos_revisados} color="bg-indigo-500" icon="✅" tooltipText="Volumen total de casos que ya fueron dictaminados y cerrados." cardBg="bg-indigo-50/70" borderColor="border-indigo-200" titleColor="text-indigo-700/80" textColor="text-indigo-900"/>
            
            {/* BLOQUE AMARILLO: SOSPECHAS */}
            <StatCard title="Sospechas" value={stats.casos_sospechosos} color="bg-yellow-500" icon="👀" tooltipText="Casos únicos marcados bajo sospecha activa." cardBg="bg-yellow-50/70" borderColor="border-yellow-200" titleColor="text-yellow-700/80" textColor="text-yellow-900"/>
            <StatCard title="Monto en Sospecha" value={`S/ ${stats.monto_sospechas}`} color="bg-yellow-600" icon="⚖️" tooltipText="Monto total involucrado en casos marcados como sospechosos." cardBg="bg-yellow-100/60" borderColor="border-yellow-300" titleColor="text-yellow-800/80" textColor="text-yellow-950"/>
            
            {/* INVERSIÓN DE COLOR: Ahora son Azules */}
            <StatCard title="Fraudes Frustrados" value={stats.casos_frustrados} color="bg-blue-500" icon="🛡️" tooltipText="Ataques de fraude confirmados pero detenidos exitosamente (Sin pérdida real)." cardBg="bg-blue-50/70" borderColor="border-blue-200" titleColor="text-blue-700/80" textColor="text-blue-900" />
            <StatCard title="Monto Frustrados" value={`S/ ${stats.monto_fraudes_frustrados}`} color="bg-blue-600" icon="🏅" tooltipText="Monto financiero salvado y no defraudado." cardBg="bg-blue-100/60" borderColor="border-blue-300" titleColor="text-blue-800/80" textColor="text-blue-950" />

            {/* BLOQUE ROJO: FRAUDES MATERIALIZADOS (CON PÉRDIDA O ASUMIDOS) */}
            <StatCard title="Fraudes" value={stats.casos_criticos} color="bg-rose-500" icon="🚫" tooltipText="Ataques de fraude confirmados y materializados." cardBg="bg-rose-50/60" borderColor="border-rose-200" titleColor="text-rose-700/80" textColor="text-rose-900">
              <div className="mt-2 pt-2 border-t border-rose-200/60 text-[10px] text-rose-800 space-y-1 font-medium animate-fade-in">
                <div className="flex justify-between items-center"><span>💸 C/ Pérdida:</span> <span className="font-bold font-mono">{stats.fraudes_con_perdida}</span></div>
                <div className="flex justify-between items-center"><span>🏪 S/ Pérdida:</span> <span className="font-bold font-mono">{stats.fraudes_sin_perdida}</span></div>
              </div>
            </StatCard>
            
            <StatCard title="Monto Fraudes" value={`S/ ${stats.monto_fraude_total}`} color="bg-red-600" icon="💸" tooltipText="Monto real total defraudado consolidado (con pérdida para la empresa o el comercio)." cardBg="bg-red-100/60" borderColor="border-red-300" titleColor="text-red-800/80" textColor="text-red-950">
              <div className="mt-2 pt-2 border-t border-red-200/60 text-[10px] text-red-900 space-y-1 font-medium animate-fade-in">
                <div className="flex justify-between items-center gap-2"><span>💸 C/ Pérdida:</span> <span className="font-bold font-mono truncate">S/ {stats.monto_fraudes_con_perdida}</span></div>
                <div className="flex justify-between items-center gap-2"><span>🏪 S/ Pérdida:</span> <span className="font-bold font-mono truncate">S/ {stats.monto_fraudes_sin_perdida}</span></div>
              </div>
            </StatCard>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pb-6 relative z-0 items-stretch">
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative flex flex-col h-full">
              <div className="flex items-center justify-between md:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Gestión Activa</h3>
                <button onClick={() => toggleChartTooltip('activa')} className="info-icon-trigger md:ml-2 text-power-purple bg-power-purple/10 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold active:scale-95 transition-transform">i</button>
              </div>
              <div className="space-y-4 mb-6">
                {stats.top_rules_activas.top.length === 0 ? <p className="text-[10px] text-center uppercase text-gray-400">Sin alertas activas</p> : stats.top_rules_activas.top.map((r, idx) => renderRow(r, idx, 0))}
              </div>
              <div className="flex justify-between items-center mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl">
                <div><p className="text-[9px] uppercase font-bold text-slate-400">Total Alertas</p><p className="text-sm font-black text-slate-700">{stats.top_rules_activas.totalAlertas}</p></div>
                <div className="text-right"><p className="text-[9px] uppercase font-bold text-slate-400">Clientes Impactados</p><p className="text-sm font-black text-slate-700">{stats.top_rules_activas.clientesImpactados}</p></div>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative flex flex-col h-full">
              <div className="flex items-center justify-between md:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Riesgo Crítico</h3>
                <button onClick={() => toggleChartTooltip('riesgo')} className="info-icon-trigger md:ml-2 text-rose-500 bg-rose-50 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold active:scale-95 transition-transform border border-rose-100">i</button>
              </div>
              <div className="space-y-4 mb-6">
                {stats.top_rules_riesgo.top.length === 0 ? <p className="text-[10px] text-center uppercase text-gray-400">Sin riesgo crítico</p> : stats.top_rules_riesgo.top.map((r, idx) => renderRow(r, idx, 4))}
              </div>
              <div className="flex justify-between items-center mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl">
                <div><p className="text-[9px] uppercase font-bold text-slate-400">Total Alertas</p><p className="text-sm font-black text-slate-700">{stats.top_rules_riesgo.totalAlertas}</p></div>
                <div className="text-right"><p className="text-[9px] uppercase font-bold text-slate-400">Clientes Impactados</p><p className="text-sm font-black text-slate-700">{stats.top_rules_riesgo.clientesImpactados}</p></div>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative flex flex-col h-full">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-6">
                <div className="flex items-center">
                  <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución Histórica</h3>
                  <button onClick={() => toggleChartTooltip('global')} className="info-icon-trigger ml-2 text-emerald-600 bg-emerald-50 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold border border-emerald-100 active:scale-95 transition-transform">i</button>
                </div>
                <div className="flex bg-gray-100 rounded-md p-0.5 border border-gray-200 shadow-inner w-fit">
                  <button onClick={() => setPeriodoHistorico('actual')} className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${periodoHistorico === 'actual' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Actual</button>
                  <button onClick={() => setPeriodoHistorico('anterior')} className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${periodoHistorico === 'anterior' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Anterior</button>
                  <button onClick={() => setPeriodoHistorico('total')} className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${periodoHistorico === 'total' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Total</button>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                {dataHistoricaVisible.top.length === 0 ? <p className="text-center text-xs text-gray-400 italic py-6">Sin reglas en este rango.</p> : dataHistoricaVisible.top.map((r, idx) => renderRow(r, idx, 2))}
              </div>
              <div className="flex justify-between items-center mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl">
                <div><p className="text-[9px] uppercase font-bold text-slate-400">Total Alertas</p><p className="text-sm font-black text-slate-700">{dataHistoricaVisible.totalAlertas}</p></div>
                <div className="text-right"><p className="text-[9px] uppercase font-bold text-slate-400">Clientes Impactados</p><p className="text-sm font-black text-slate-700">{dataHistoricaVisible.clientesImpactados}</p></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardView;