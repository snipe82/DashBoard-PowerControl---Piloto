import React, { useState, useEffect } from 'react';
import api from '../api';

const UsersList = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Estados para Modal de Edición de Rol
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('ANALYST');
  const [modalLoading, setModalLoading] = useState(false);

  // Extraer datos del administrador actual logueado
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = currentUser.id || currentUser.user_id || '';

  useEffect(() => {
    api.get('/api/users')
      .then(res => {
        const data = res.data;
        setUsuarios(data.users || []);
        setCargando(false);
      })
      .catch(err => {
        console.error("Error cargando usuarios:", err);
        setCargando(false);
      });
  }, [refetchTrigger]);

  // 🚀 DISPARADOR: Desactivación / Baja Lógica (DELETE)
  const handleDesactivarUsuario = async (userId, userEmail) => {
    if (userId === currentUserId) {
      alert("Operación denegada: No puedes desactivar tu propia cuenta de administrador.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas revocar inmediatamente el acceso al sistema para el usuario ${userEmail}?`)) {
      return;
    }

    try {
      await api.delete(`/api/users/${userId}`);
      alert("Usuario desactivado correctamente.");
      setRefetchTrigger(prev => prev + 1); 
    } catch (err) {
      alert(err.response?.data?.message || "Error al intentar desactivar la cuenta.");
    }
  };

  // 🚀 DISPARADOR: Reactivación de Cuenta (PATCH)
  const handleActivarUsuario = async (userId, userEmail) => {
    if (!window.confirm(`¿Deseas restablecer las credenciales y reactivar el acceso al sistema para el usuario ${userEmail}?`)) {
      return;
    }

    try {
      await api.patch('/api/users/activate', { userId });
      alert("Usuario reactivado exitosamente. Ya puede iniciar sesión.");
      setRefetchTrigger(prev => prev + 1); 
    } catch (err) {
      alert(err.response?.data?.message || "Error al intentar reactivar la cuenta.");
    }
  };

  // Guardar Cambios de Rol (PATCH)
  const handleGuardarRol = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalLoading(true);

    try {
      await api.patch('/api/users/change-role', {
        userId: selectedUser.user_id,
        newRole: newRole
      });
      alert("Perfil de usuario actualizado exitosamente.");
      setSelectedUser(null);
      setRefetchTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || "Error al intentar actualizar el rol.");
    } finally {
      // 🚀 CORREGIDO: Se eliminó el typo "align:" que rompía la compilación
      setModalLoading(false);
    }
  };

  const abrirModalEdicion = (user) => {
    setSelectedUser(user);
    setNewRole(user.role || 'ANALYST');
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-black text-power-blue">Gestión de Usuarios</h2>
        <p className="text-gray-500 text-xs md:text-sm mt-1">Directorio de accesos al sistema PowerControl.</p>
      </div>

      <div className="bg-white md:rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-6 py-4 font-bold">Usuario</th>
                <th className="px-6 py-4 font-bold">Rol</th>
                <th className="px-6 py-4 font-bold">Estado</th>
                <th className="px-6 py-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-50">
              {cargando ? (
                <tr><td colSpan="4" className="text-center py-12 text-gray-400 font-bold italic">Consultando directorio...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-12 text-gray-500 italic">No se encontraron usuarios o permisos insuficientes.</td></tr>
              ) : (
                usuarios.map((user, idx) => {
                  const esCuentaInactiva = !user.is_active;
                  return (
                    <tr 
                      key={user.user_id || idx} 
                      className={`transition-all duration-150 ${
                        esCuentaInactiva ? 'bg-gray-50/70 opacity-60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${
                            esCuentaInactiva ? 'bg-gray-200 text-gray-400' : 'bg-power-purple/10 text-power-purple'
                          }`}>
                            {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-bold ${esCuentaInactiva ? 'text-gray-400 line-through font-medium' : 'text-gray-800'}`}>
                              {user.full_name || 'Sin Nombre'}
                            </p>
                            <p className="text-[10px] text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
                          esCuentaInactiva ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {user.role || 'ANALYST'}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-400 border border-gray-200 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center w-fit gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Inactivo / Baneado
                          </span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3.5">
                          <button 
                            disabled={esCuentaInactiva}
                            onClick={() => abrirModalEdicion(user)}
                            className="text-power-blue font-bold text-xs hover:underline disabled:opacity-30 disabled:no-underline"
                          >
                            Editar Rol
                          </button>
                          
                          {/* BOTÓN INTELIGENTE MUTABLE */}
                          {user.is_active ? (
                            <button 
                              disabled={user.user_id === currentUserId}
                              onClick={() => handleDesactivarUsuario(user.user_id, user.email)}
                              className="text-rose-500 font-bold text-xs hover:underline disabled:opacity-30 disabled:no-underline"
                              title={user.user_id === currentUserId ? "No puedes auto-desactivarte" : "Desactivar analista"}
                            >
                              Desactivar
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleActivarUsuario(user.user_id, user.email)}
                              className="text-emerald-600 font-bold text-xs hover:underline"
                              title="Restablecer accesos al sistema"
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR ROL DE USUARIO */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-lg font-black text-power-blue">Modificar Perfil</h3>
                <p className="text-[11px] text-gray-400 font-medium truncate max-w-[240px]">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
            </div>

            <form onSubmit={handleGuardarRol} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Asignar Privilegios</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full p-3 border border-gray-200 bg-gray-50 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-power-purple outline-none cursor-pointer">
                  <option value="ANALYST">ANALYST (Analista Triage)</option>
                  <option value="ADMIN">ADMIN (Permisos Totales)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setSelectedUser(null)} className="w-1/2 border border-gray-200 text-gray-500 font-bold py-3 rounded-xl hover:bg-gray-50 text-xs active:scale-95 transition-all">Cancelar</button>
                <button type="submit" disabled={modalLoading} className="w-1/2 bg-power-purple text-white font-bold py-3 rounded-xl hover:bg-purple-700 text-xs shadow-md active:scale-95 transition-all disabled:opacity-50">{modalLoading ? 'Guardando...' : 'Cambiar Rol'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;