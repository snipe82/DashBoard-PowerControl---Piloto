import React, { useState, useEffect, useRef } from 'react';

// 🚀 ADAPTACIÓN MÓVIL: StatCard ahora maneja su propio estado de tooltip táctil
const StatCard = ({ title, value, color, icon, tooltipText }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  // Cerrar tooltip si se toca afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
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
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105 h-full relative z-10">
        <div className={`p-2.5 md:p-3 rounded-lg text-white mr-3 md:mr-4 text-lg md:text-xl shadow-lg shrink-0 ${color}`}>
          {icon}
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{title}</p>
            
            {/* 🚀 EL BOTÓN TÁCTIL (i) para StatCard en móviles */}
            <button 
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-gray-400 hover:text-power-purple ml-2 p-1 rounded-full bg-gray-50 md:bg-transparent"
              aria-label="Más información"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          <p className="text-xl md:text-2xl font-black text-gray-800 truncate">{value}</p>
        </div>
      </div>

      {/* 🚀 Tooltip Táctil Adaptado */}
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
  const [stats, setStats] = useState({
    alertas_abiertas: 0,
    dinero_en_riesgo: "0.00",
    efectividad: "100%",
    casos_criticos: 0,
    top_rules_activas: [],
    top_rules_riesgo: [],
    top_rules_globales: []
  });
  const [cargando, setCargando] = useState(true);

  // 🚀 Memoria para tooltips de los gráficos inferiores
  const [activeChartTooltip, setActiveChartTooltip] = useState(null); // 'activa', 'riesgo', 'global' or null
  const chartTooltipRef = useRef(null);

  useEffect(() => {
    const cargarEstadisticas = () => {
      fetch('/api/stats/summary')
        .then(res => res.json())
        .then(data => {
          setStats({
            alertas_abiertas: data.alertas_abiertas || 0,
            dinero_en_riesgo: data.dinero_en_riesgo || "0.00",
            efectividad: data.efectividad || "100%",
            casos_criticos: data.casos_criticos || 0,
            top_rules_activas: data.top_rules_activas || [],
            top_rules_riesgo: data.top_rules_riesgo || [],
            top_rules_globales: data.top_rules_globales || []
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

  // Cerrar tooltips inferiores al tocar afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Si el click no fue en un icono de info ni dentro del tooltip abierto, cerrar.
      if (activeChartTooltip && !event.target.closest('.info-icon-trigger')) {
        setActiveChartTooltip(null);
      }
    };
    if (activeChartTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeChartTooltip]);

  const toggleChartTooltip = (tooltipId) => {
    setActiveChartTooltip(prev => (prev === tooltipId ? null : tooltipId));
  };

  const colores = ["bg-power-purple", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

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
          {/* Tarjetas Superiores Adaptadas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8 relative z-10">
            <StatCard
              title="Alertas Pendientes"
              value={stats.alertas_abiertas}
              color="bg-amber-500"
              icon="⚠️"
              tooltipText="Cantidad de alertas nuevas en estado Abiertas. Casos en cola que necesitan ser procesados por el equipo."
            />
            <StatCard
              title="Monto en Riesgo"
              value={`S/ ${stats.dinero_en_riesgo}`}
              color="bg-power-purple"
              icon="💰"
              tooltipText="Suma monetaria totalizada de las alertas activas (Abiertas, En Revisión, Revisión Adicional). Mide el impacto financiero investigado."
            />
            <StatCard
              title="Casos Bloqueados"
              value={stats.casos_criticos}
              color="bg-rose-500"
              icon="🚫"
              tooltipText="Historial acumulado de alertas marcadas como Fraude Confirmado. Representa los intentos de fraude real detenidos exitosamente."
            />
            <StatCard
              title="Efectividad"
              value={stats.efectividad}
              color="bg-emerald-500"
              icon="🛡️"
              tooltipText="Índice de precisión operativa. Evalúa la relación entre alertas gestionadas y fraudes confirmados."
            />
          </div>

          {/* Gráficos Inferiores con Tooltips Táctiles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pb-6 relative z-0">

            {/* PANEL 1: GESTIÓN ACTIVA */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center justify-between md:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Gestión Activa</h3>
                
                {/* 🚀 TRIGGER TÁCTIL (i) */}
                <button 
                  onClick={() => toggleChartTooltip('activa')}
                  className="info-icon-trigger md:ml-2 text-power-purple bg-power-purple/10 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold active:scale-95 transition-transform"
                >
                  i
                </button>

                {/* Tooltip Táctil/Adaptado */}
                {activeChartTooltip === 'activa' && (
                  <div className="absolute z-50 bottom-[calc(100%-40px)] md:bottom-full left-4 md:left-0 mb-2 w-[calc(100%-32px)] sm:w-80 bg-slate-900 text-white text-xs rounded-lg p-3.5 shadow-2xl border border-slate-700 leading-relaxed text-left animate-fade-in">
                    <p className="font-bold text-amber-400 mb-1.5 uppercase text-[10px]">Carga de Trabajo Actual</p>
                    Calcula el Top 5 considerando únicamente las alertas vivas (estados: <b>Abiertas</b>, <b>En Revisión</b> y <b>En Revisión Adicional</b>).
                    <div className="absolute top-full left-6 md:left-10 border-[6px] border-transparent border-t-slate-900"></div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {stats.top_rules_activas.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider">Sin alertas activas</p>
                  </div>
                ) : (
                  stats.top_rules_activas.map((r, idx) => {
                    const colorBarra = colores[idx % colores.length];
                    return (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-bold text-gray-700 truncate mr-2 md:mr-4 max-w-[60%] md:max-w-auto" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono shrink-0">
                            <span className="font-bold text-power-blue">{r.quantity}</span>
                            <span className="mx-1 md:mx-1.5 text-gray-300">|</span>
                            <b className="text-gray-800 font-black">{r.porcentaje}%</b>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className={`${colorBarra} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${r.porcentaje}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PANEL 2: RIESGO CRÍTICO */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center justify-between md:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Riesgo Crítico</h3>
                
                {/* 🚀 TRIGGER TÁCTIL (i) */}
                <button 
                  onClick={() => toggleChartTooltip('riesgo')}
                  className="info-icon-trigger md:ml-2 text-rose-500 bg-rose-50 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold border border-rose-100 active:scale-95 transition-transform"
                >
                  i
                </button>

                {/* Tooltip Táctil/Adaptado */}
                {activeChartTooltip === 'riesgo' && (
                  <div className="absolute z-50 bottom-[calc(100%-40px)] md:bottom-full left-4 md:left-0 mb-2 w-[calc(100%-32px)] sm:w-80 bg-slate-900 text-white text-xs rounded-lg p-3.5 shadow-2xl border border-slate-700 leading-relaxed text-left animate-fade-in">
                    <p className="font-bold text-rose-400 mb-1.5 uppercase text-[10px]">Ataques Confirmados y Monitoreados</p>
                    Muestra las reglas que han derivado en hallazgos peligrosos. Solo incluye alertas marcadas como <b>Fraude Confirmado</b> y <b>Sospechosas</b>.
                    <div className="absolute top-full left-6 md:left-10 border-[6px] border-transparent border-t-slate-900"></div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {stats.top_rules_riesgo.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider">Sin riesgo crítico</p>
                  </div>
                ) : (
                  stats.top_rules_riesgo.map((r, idx) => {
                    const colorBarra = colores[(idx + 4) % colores.length];
                    return (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-bold text-gray-700 truncate mr-2 md:mr-4 max-w-[60%] md:max-w-auto" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono shrink-0">
                            <span className="font-bold text-rose-500">{r.quantity}</span>
                            <span className="mx-1 md:mx-1.5 text-gray-300">|</span>
                            <b className="text-gray-800 font-black">{r.porcentaje}%</b>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className={`${colorBarra} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${r.porcentaje}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PANEL 3: VOLUMEN GLOBAL */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center justify-between md:justify-end lg:justify-start mb-6">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución Histórica</h3>
                
                {/* 🚀 TRIGGER TÁCTIL (i) */}
                <button 
                  onClick={() => toggleChartTooltip('global')}
                  className="info-icon-trigger md:ml-2 text-emerald-600 bg-emerald-50 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold border border-emerald-100 active:scale-95 transition-transform"
                >
                  i
                </button>

                {/* Tooltip Táctil/Adaptado - Alineado a la derecha en celular para no desbordar */}
                {activeChartTooltip === 'global' && (
                  <div className="absolute z-50 bottom-[calc(100%-40px)] md:bottom-full right-4 lg:right-auto lg:left-0 mb-2 w-[calc(100%-32px)] sm:w-80 bg-slate-900 text-white text-xs rounded-lg p-3.5 shadow-2xl border border-slate-700 leading-relaxed text-left animate-fade-in">
                    <p className="font-bold text-emerald-400 mb-1.5 uppercase text-[10px]">Universo Total de Alertas</p>
                    Calcula el acumulado mezclando todos los estados: Abiertas, En Revisión, Revisión Adicional, Sospechoso, Fraude Confirmado y Descartadas.
                    <div className="absolute top-full right-6 lg:right-auto lg:left-10 border-[6px] border-transparent border-t-slate-900"></div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {stats.top_rules_globales.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider">Sin alertas registradas</p>
                  </div>
                ) : (
                  stats.top_rules_globales.map((r, idx) => {
                    const colorBarra = colores[(idx + 2) % colores.length];
                    return (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-bold text-gray-700 truncate mr-2 md:mr-4 max-w-[60%] md:max-w-auto" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono shrink-0">
                            <span className="font-bold text-emerald-600">{r.quantity}</span>
                            <span className="mx-1 md:mx-1.5 text-gray-300">|</span>
                            <b className="text-gray-800 font-black">{r.porcentaje}%</b>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className={`${colorBarra} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${r.porcentaje}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};

export default DashboardView;