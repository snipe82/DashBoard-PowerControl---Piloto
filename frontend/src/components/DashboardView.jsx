import React, { useState, useEffect, useRef } from 'react';
import api from '../api'; // 🚀 IMPORTAMOS AXIOS

const StatCard = ({ title, value, color, icon, tooltipText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) setShowTooltip(false);
    };
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showTooltip]);

  return (
    <div className="relative w-full" ref={tooltipRef}>
      <div className="bg-white p-3 md:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105 h-full relative z-10">
        <div className={`p-2 md:p-2.5 rounded-lg text-white mr-3 text-lg shadow-lg shrink-0 ${color}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[9px] lg:text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight break-words pr-1">{title}</p>
            <button onClick={() => setShowTooltip(!showTooltip)} className="text-gray-400 hover:text-power-purple shrink-0 p-0.5 rounded-full bg-gray-50 md:bg-transparent">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
          <p className="text-base lg:text-sm xl:text-lg font-black text-gray-800 truncate mt-0.5 tracking-tight" title={value}>{value}</p>
        </div>
      </div>
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-[260px] sm:w-64 bg-slate-900 text-white text-xs rounded-lg p-3.5 shadow-2xl transition-all duration-200 border border-slate-700 leading-relaxed text-center animate-fade-in">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};

const DashboardView = () => {
  const defaultDist = { top: [], totalAlertas: 0, clientesImpactados: 0 };
  const [stats, setStats] = useState({
    alertas_abiertas: 0, casos_en_revision: 0, casos_revisados: 0, dinero_en_riesgo: "0.00", efectividad: "100%", casos_criticos: 0,
    top_rules_activas: defaultDist, top_rules_riesgo: defaultDist, top_rules_globales: defaultDist, top_rules_mes_actual: defaultDist, top_rules_mes_anterior: defaultDist
  });
  
  const [cargando, setCargando] = useState(true);
  const [activeChartTooltip, setActiveChartTooltip] = useState(null);
  const [periodoHistorico, setPeriodoHistorico] = useState('total'); 

  useEffect(() => {
    const cargarEstadisticas = () => {
      // 🚀 AXIOS REEMPLAZA A FETCH
      api.get('/api/stats/summary')
        .then(res => {
          const data = res.data;
          setStats({
            alertas_abiertas: data.alertas_abiertas || 0, casos_en_revision: data.casos_en_revision || 0, casos_revisados: data.casos_revisados || 0,
            dinero_en_riesgo: data.dinero_en_riesgo || "0.00", efectividad: data.efectividad || "100%", casos_criticos: data.casos_criticos || 0,
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
    <div className="p-4 md:p-8 animate-fade-in h-full overflow-y-auto w-full">
      <div className="mb-6 md:mb-8 text-center md:text-left">
        <h2 className="text-xl md:text-2xl font-black text-power-blue mb-1">Resumen de Control</h2>
        <p className="text-gray-500 text-xs md:text-sm">Monitoreo en tiempo real de transacciones y riesgo operativo.</p>
      </div>

      {cargando ? (
        <div className="text-center py-20 text-gray-400 italic font-bold animate-pulse">Sincronizando con el motor de reglas...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8 relative z-10">
            <StatCard title="Alertas Pendientes" value={stats.alertas_abiertas} color="bg-amber-500" icon="⚠️" tooltipText="Cantidad de alertas nuevas por atender (estado Abiertas)." />
            <StatCard title="Casos en Revisión" value={stats.casos_en_revision} color="bg-blue-500" icon="🔎" tooltipText="Casos actualmente bajo análisis (En Revisión y Revisión Adicional)." />
            <StatCard title="Monto en Riesgo" value={`S/ ${stats.dinero_en_riesgo}`} color="bg-power-purple" icon="💰" tooltipText="Suma financiera total investigada en las alertas vivas." />
            <StatCard title="Casos Revisados" value={stats.casos_revisados} color="bg-indigo-500" icon="✅" tooltipText="Volumen total de casos que ya fueron dictaminados y cerrados." />
            <StatCard title="Casos Bloqueados" value={stats.casos_criticos} color="bg-rose-500" icon="🚫" tooltipText="Ataques de fraude confirmados y detenidos exitosamente." />
            <StatCard title="Efectividad" value={stats.efectividad} color="bg-emerald-500" icon="🛡️" tooltipText="Precisión operativa: relación alertas vs fraudes." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pb-6 relative z-0 items-stretch">
            {/* PANELS */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative flex flex-col h-full">
              <div className="flex items-center justify-between md:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Gestión Activa</h3>
                <button onClick={() => toggleChartTooltip('activa')} className="info-icon-trigger md:ml-2 text-power-purple bg-power-purple/10 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold active:scale-95 transition-transform">i</button>
              </div>
              <div className="space-y-4 mb-6">
                {stats.top_rules_activas.top.length === 0 ? <p className="text-[10px] text-center uppercase text-gray-400">Sin alertas activas</p> : stats.top_rules_activas.top.map((r, idx) => renderRow(r, idx, 0))}
              </div>
              <div className="mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl flex justify-between items-center">
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
              <div className="mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl flex justify-between items-center">
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
                {dataHistoricaVisible.top.length === 0 ? <p className="text-[10px] text-center uppercase text-gray-400">Sin alertas históricas</p> : dataHistoricaVisible.top.map((r, idx) => renderRow(r, idx, 2))}
              </div>
              <div className="mt-auto border-t border-gray-100 bg-gray-50 -mx-5 md:-mx-6 -mb-5 md:-mb-6 px-5 md:px-6 py-3 rounded-b-2xl flex justify-between items-center">
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