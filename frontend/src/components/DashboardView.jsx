import React, { useState, useEffect } from 'react';

const StatCard = ({ title, value, color, icon, tooltipText }) => (
  <div className="relative group cursor-help">
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105">
      <div className={`p-3 rounded-lg text-white mr-4 text-xl shadow-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-gray-800">{value}</p>
      </div>
    </div>

    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none text-center border border-slate-700 leading-relaxed">
      {tooltipText}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

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

  const colores = ["bg-power-purple", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

  return (
    <div className="p-8 animate-fade-in h-full overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-power-blue mb-1">Resumen de Control</h2>
        <p className="text-gray-500 text-sm">Monitoreo en tiempo real de transacciones y riesgo operativo.</p>
      </div>

      {cargando ? (
        <div className="text-center py-20 text-gray-400 italic font-bold animate-pulse">Sincronizando con el motor de reglas...</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Alertas Pendientes"
              value={stats.alertas_abiertas}
              color="bg-amber-500"
              icon="⚠️"
              tooltipText="Cantidad de alertas nuevas en estado Abiertas. Casos en cola que necesitan ser procesados por el equipo."
            />
            {/* 🚀 FIX TEXTO: Ahora aclara que incluye la revisión adicional */}
            <StatCard
              title="Monto en Riesgo"
              value={`S/ ${stats.dinero_en_riesgo}`}
              color="bg-power-purple"
              icon="💰"
              tooltipText="Suma monetaria totalizada de las alertas activas (Abiertas, En Revisión y En Revisión Adicional). Permite medir el impacto financiero bajo investigación."
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

          <div className="grid grid-cols-3 gap-6">

            {/* PANEL 1: GESTIÓN ACTIVA */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center mb-6 group cursor-help w-fit">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Gestión Activa</h3>
                <span className="ml-2 text-power-purple bg-power-purple/10 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">i</span>

                {/* 🚀 FIX TEXTO */}
                <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none border border-slate-700 leading-relaxed text-left">
                  <p className="font-bold text-amber-400 mb-1 uppercase text-[10px]">Carga de Trabajo Actual</p>
                  Calcula el Top 5 considerando únicamente las alertas vivas (estados: <b>Abiertas</b>, <b>En Revisión</b> y <b>En Revisión Adicional</b>).
                  <div className="absolute top-full left-10 border-[6px] border-transparent border-t-slate-900"></div>
                </div>
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
                          <span className="font-bold text-gray-700 truncate mr-4" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono">
                            <span className="font-bold text-power-blue">{r.quantity}</span>
                            <span className="mx-1.5 text-gray-300">|</span>
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center mb-6 group cursor-help w-fit">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución: Riesgo Crítico</h3>
                <span className="ml-2 text-rose-500 bg-rose-50 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border border-rose-100">i</span>

                <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none border border-slate-700 leading-relaxed text-left">
                  <p className="font-bold text-rose-400 mb-1 uppercase text-[10px]">Ataques Confirmados y Monitoreados</p>
                  Muestra las reglas que han derivado en hallazgos peligrosos. Solo incluye alertas marcadas como <b>Fraude Confirmado</b> y <b>Sospechosas</b>.
                  <div className="absolute top-full left-10 border-[6px] border-transparent border-t-slate-900"></div>
                </div>
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
                          <span className="font-bold text-gray-700 truncate mr-4" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono">
                            <span className="font-bold text-rose-500">{r.quantity}</span>
                            <span className="mx-1.5 text-gray-300">|</span>
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
              <div className="flex items-center mb-6 group cursor-help w-fit">
                <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Distribución Histórica</h3>
                <span className="ml-2 text-emerald-600 bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border border-emerald-100">i</span>

                {/* 🚀 FIX TEXTO */}
                <div className="absolute z-50 bottom-full right-0 mb-2 w-72 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none border border-slate-700 leading-relaxed text-left">
                  <p className="font-bold text-emerald-400 mb-1 uppercase text-[10px]">Universo Total de Alertas</p>
                  Calcula el acumulado mezclando absolutamente todos los estados: <b>Abiertas, En Revisión, En Revisión Adicional, Sospechoso, Fraude Confirmado</b> y <b>Descartadas</b>.
                  <div className="absolute top-full right-10 border-[6px] border-transparent border-t-slate-900"></div>
                </div>
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
                          <span className="font-bold text-gray-700 truncate mr-4" title={r.nombre}>{r.nombre}</span>
                          <span className="text-gray-500 font-mono">
                            <span className="font-bold text-emerald-600">{r.quantity}</span>
                            <span className="mx-1.5 text-gray-300">|</span>
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