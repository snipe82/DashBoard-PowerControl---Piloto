import React, { useState } from 'react';
import api from '../api';

const Sidebar = ({ moduloActual, setModuloActual, vistaActual, setVistaActual, onLogout }) => {
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdStatus, setPwdStatus] = useState({ error: '', success: '', loading: false });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.name || 'Analista Antifraude';
  const userRole = user.role || 'ANALYST';
  const userInitials = userName.charAt(0).toUpperCase();

  const handleLogoutClick = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (e) {
      console.error("Error al invalidar la sesión en el servidor:", e);
    } finally {
      onLogout(); 
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdStatus({ error: '', success: '', loading: true });
    try {
      await api.post('/api/auth/change-password', { oldPassword, newPassword });
      setPwdStatus({ error: '', success: '¡Contraseña actualizada con éxito!', loading: false });
      setTimeout(() => {
        setIsPwdModalOpen(false);
        setOldPassword('');
        setNewPassword('');
        setPwdStatus({ error: '', success: '', loading: false });
        setIsProfileMenuOpen(false);
      }, 2000);
    } catch (err) {
      setPwdStatus({ 
        error: err.response?.data?.message || 'Error al cambiar la contraseña. Verifica tu clave actual.', 
        success: '', 
        loading: false 
      });
    }
  };

  const menuAlertas = [
    { id: 'DASHBOARD', label: 'Panel de Resumen', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> },
    { id: 'OPEN', label: 'Triage de Alertas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> },
    { id: 'IN_REVIEW', label: 'En Revisión', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> },
    { id: 'ADDITIONAL_REVIEW', label: 'Revisión Adicional', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> },
    { id: 'FRAUD', label: 'Casos Críticos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> },
    { id: 'DISCARDED', label: 'Historial', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg> },
  ];

  const menuAnalisis = [
    { id: 'RULES_LIST', label: 'Motor de Reglas SQL', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg> },
    // 🚀 NUEVO: Item de Gestión de Publicación
    { id: 'RULES_WORKFLOW', label: 'Gestión de Publicación', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg> }
  ];

  const menuEventos = [
    { id: 'EVENTS_SEARCH', label: 'Buscador de Eventos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> }
  ];

  const menuSeguridad = [
    { id: 'USERS_LIST', label: 'Directorio de Usuarios', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> },
    { id: 'USER_CREATE', label: 'Crear Nuevo Usuario', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg> },
  ];

  const menuActivo = moduloActual === 'ALERTAS' 
    ? menuAlertas 
    : moduloActual === 'ANALISIS' 
      ? menuAnalisis 
      : moduloActual === 'EVENTOS'
        ? menuEventos
        : menuSeguridad;

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full shadow-sm shrink-0">
        
        <div className="p-5 flex flex-col items-center border-b border-gray-50 text-center">
          <h1 className="text-2xl font-black text-power-blue tracking-tight italic">
            Power<span className="text-power-purple">Control</span>
          </h1>
          
          <div className="mt-2 flex items-center justify-center gap-1.5 w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.6)]"></span>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Motor Antifraude
            </p>
          </div>
          
          <div className="mt-5 w-full">
            <select 
              value={moduloActual} 
              onChange={(e) => setModuloActual(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-power-purple focus:ring-1 focus:ring-power-purple cursor-pointer shadow-sm transition-all"
            >
              <option value="ALERTAS">🛡️ Módulo de Alertas</option>
              <option value="EVENTOS">🔎 Módulo de Eventos</option>
              <option value="ANALISIS">📊 Módulo de Análisis</option>
              {userRole === 'ADMIN' && (
                <option value="SEGURIDAD">🔐 Módulo de Seguridad</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 space-y-1.5 scrollbar-thin">
          {menuActivo.map((item) => {
            const isActive = vistaActual === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setVistaActual(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-power-purple/5 text-power-purple shadow-sm ring-1 ring-power-purple/20' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <div className={`${isActive ? 'text-power-purple' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>{item.icon}</div>
                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 mt-auto">
          <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors">
            <div className="w-10 h-10 rounded-full bg-power-blue text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">{userInitials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{userName}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate">{userRole}</p>
            </div>
            <div className="shrink-0 text-gray-400">
              <svg className={`w-4 h-4 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isProfileMenuOpen ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col gap-2">
              <button onClick={() => setIsPwdModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-power-purple hover:text-power-purple py-2.5 rounded-lg transition-colors active:scale-95 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg> 
                Cambiar Clave
              </button>
              <button onClick={handleLogoutClick} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 py-2.5 rounded-lg transition-colors active:scale-95 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> 
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

      </div>

      {isPwdModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black text-power-blue">Cambiar Contraseña</h3>
              <button onClick={() => setIsPwdModalOpen(false)} className="text-gray-400 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>
            {pwdStatus.error && <div className="bg-rose-50 text-rose-600 text-xs font-bold p-3 rounded-lg mb-4 text-center border border-rose-200">{pwdStatus.error}</div>}
            {pwdStatus.success && <div className="bg-emerald-50 text-emerald-600 text-xs font-bold p-3 rounded-lg mb-4 text-center border border-emerald-200">{pwdStatus.success}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:border-power-purple focus:ring-1 focus:ring-power-purple" placeholder="Contraseña Actual" />
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:border-power-purple focus:ring-1 focus:ring-power-purple" placeholder="Nueva Contraseña" />
              <button type="submit" disabled={pwdStatus.loading || !oldPassword || !newPassword} className="w-full bg-power-purple hover:bg-purple-700 text-white font-bold py-3 rounded-lg mt-2 transition-colors disabled:opacity-50">
                {pwdStatus.loading ? 'Guardando...' : 'Guardar Clave'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;