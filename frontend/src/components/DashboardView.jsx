import React, { useState, useEffect } from 'react';

const StatCard = ({ title, value, color, icon }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105">
    <div className={`p-3 rounded-lg text-white mr-4 text-xl shadow-lg ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-gray-800">{value}</p>
    </div>
  </div>
);

const DashboardView = () => {
  const [stats, setStats] = useState({ 
    alertas_abiertas: 0, 
    dinero_en_riesgo: "0.00", 
    efectividad: "100%", 
    casos_criticos: 0,
    distribucion_reglas: [] 
  });
  const [cargando, setCargando] = useState(true);

  // REEMPLAZA SOLO ESTE BLOQUE EN DashboardView.jsx
  useEffect(() => {
    // 1. Envolvemos la petición en una función
    const cargarEstadisticas = () => {
      fetch('/api/stats/summary')
        .then(res => res.json())
        .then(data => {
          setStats({
            alertas_abiertas: data.alertas_abiertas || 0,
            dinero_en_riesgo: data.dinero_en_riesgo || "0.00",
            efectividad: data.efectividad || "100%",
            casos_criticos: data.casos_criticos || 0,
            distribucion_reglas: data.top_rules || [] 
          });
          setCargando(false); // Apaga el "Cargando" inicial
        })
        .catch(error => {
          console.error("Error al cargar estadísticas:", error);
          setCargando(false);
        });
    };

    // 2. Ejecutamos la primera vez apenas entra a la pantalla
    cargarEstadisticas();

    // 3. 🚀 EL TRUCO: Programamos que se repita cada 30 segundos (30000 ms)
    const intervalo = setInterval(cargarEstadisticas, 30000);

    // 4. Limpiamos el temporizador si el usuario cambia a otra pantalla
    return () => clearInterval(intervalo);
  }, []);

  const colores = ["bg-power-blue", "bg-power-purple", "bg-orange-500", "bg-red-500", "bg-green-500"];

  return (
    <div className="space-y-8 animate-fade-in p-8">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Pendientes" value={cargando ? '...' : stats.alertas_abiertas} icon="🚨" color="bg-status-open" />
        <StatCard title="En Riesgo" value={cargando ? '...' : `S/ ${stats.dinero_en_riesgo}`} icon="💰" color="bg-status-fraud" />
        <StatCard title="Efectividad" value={cargando ? '...' : stats.efectividad} icon="🎯" color="bg-status-discarded" />
        <StatCard title="Críticos" value={cargando ? '...' : stats.casos_criticos} icon="🔥" color="bg-power-purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          {/* 🚀 AQUÍ ESTÁ EL TÍTULO ACTUALIZADO */}
          <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-6">
            Distribución en Gestión Activa (Open / Revisión / Fraude)
          </h3>
          <div className="space-y-5">
            {cargando ? (
              <p className="text-sm text-gray-400 italic">Consultando motor...</p>
            ) : stats.distribucion_reglas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <p className="text-xs font-bold uppercase tracking-wider">Sin alertas registradas</p>
                <p className="text-[10px]">No hay datos activos para calcular distribución.</p>
              </div>
            ) : (
              stats.distribucion_reglas.map((r, idx) => {
                const colorBarra = colores[idx % colores.length];
                
                return (
                  <div key={idx} className="text-xs mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-gray-600 truncate mr-4">{r.nombre}</span>
                      <b className="text-gray-800">{r.porcentaje}%</b>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`${colorBarra} h-1.5 rounded-full`} style={{ width: `${r.porcentaje}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-6">Actividad Reciente</h3>
          <div className="space-y-4">
            <p className="text-sm text-gray-400 italic">Conectado al motor de reglas. Recibiendo datos...</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardView;