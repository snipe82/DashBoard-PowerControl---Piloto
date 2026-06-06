import React, { useState } from 'react';
import api from '../api';

const UserCreate = ({ setVistaActual }) => {
  // 🚀 Actualizamos el payload para usar "full_name"
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'ANALYST' });
  const [status, setStatus] = useState({ error: '', success: '', loading: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ error: '', success: '', loading: true });

    try {
      const res = await api.post('/api/users', formData);
      // Extraemos el mensaje de éxito del nuevo payload
      setStatus({ error: '', success: res.data?.message || 'Usuario creado exitosamente.', loading: false });
      setTimeout(() => setVistaActual('USERS_LIST'), 1500); 
    } catch (err) {
      setStatus({ 
        error: err.response?.data?.message || 'Error al crear el usuario. Verifica los datos.', 
        success: '', loading: false 
      });
    }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in h-full flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-black text-power-blue">Crear Nuevo Usuario</h2>
          <p className="text-gray-500 text-xs md:text-sm mt-1">Registra un nuevo analista o administrador en la plataforma.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {status.error && <div className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold p-3 rounded-lg mb-6">{status.error}</div>}
          {status.success && <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold p-3 rounded-lg mb-6">{status.success}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Completo</label>
              <input type="text" required value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-power-purple outline-none text-sm" placeholder="Ej. Juan Pérez" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Corporativo</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-power-purple outline-none text-sm" placeholder="juan@powerpay.pe" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Contraseña Temporal</label>
              <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-power-purple outline-none text-sm" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rol del Sistema</label>
              <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-power-purple outline-none text-sm font-medium text-slate-700">
                <option value="ANALYST">Analista (Triage)</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={status.loading} className="w-full bg-power-purple text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-70">
                {status.loading ? 'Registrando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserCreate;