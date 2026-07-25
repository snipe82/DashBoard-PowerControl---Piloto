import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

const LIST_TYPES = [
  { id: 'BLACK', label: 'Lista Negra (Bloqueo en evaluación)' },
  { id: 'WHITE', label: 'Lista Blanca (Paso Libre / Excepción)' }
];

const ListsMaintenance = () => {
  const [activeTab, setActiveTab] = useState('CATALOG'); // CATALOG, RECORDS, MANUAL, BULK
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Catálogo Dinámico
  const [catalog, setCatalog] = useState([]);
  const [newCatalogId, setNewCatalogId] = useState('');
  const [newCatalogName, setNewCatalogName] = useState('');
  const [newCatalogDesc, setNewCatalogDesc] = useState('');

  // Estados Operativos
  const [selectedListId, setSelectedListId] = useState('');
  
  // Paginación y Tabla de Registros
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, total_pages: 1, total_records: 0, per_page: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Registro Manual
  const [manualValue, setManualValue] = useState('');
  const [manualListType, setManualListType] = useState('BLACK');
  const [manualReason, setManualReason] = useState('');

  // Carga Masiva
  const [bulkFile, setBulkFile] = useState(null);

  const showMessage = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 6000);
  };

  // --- 📥 Cargar Catálogo al Iniciar ---
  const fetchCatalog = async () => {
    try {
      const res = await api.get('/api/lists/catalog');
      if (res.data?.success) {
        setCatalog(res.data.data);
        if (res.data.data.length > 0 && !selectedListId) {
          setSelectedListId(res.data.data[0].list_id);
        }
      }
    } catch (err) {
      console.error("Error cargando catálogo", err);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // --- 📚 1. Gestión de Catálogo ---
  const handleCreateList = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        list_id: newCatalogId.toUpperCase().trim().replace(/\s+/g, '_'),
        display_name: newCatalogName.trim(),
        description: newCatalogDesc.trim()
      };
      const res = await api.post('/api/lists/catalog', payload);
      showMessage('success', res.data.message || 'Lista creada exitosamente.');
      setNewCatalogId(''); setNewCatalogName(''); setNewCatalogDesc('');
      fetchCatalog(); 
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Error al crear la lista.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (list_id) => {
    if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de eliminar permanentemente la lista '${list_id}' y TODOS SUS REGISTROS ASOCIADOS? Esta acción es irreversible.`)) return;
    setLoading(true);
    try {
      const res = await api.delete(`/api/lists/catalog/${list_id}`);
      showMessage('success', res.data.message || 'Lista eliminada exitosamente.');
      fetchCatalog();
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Error al eliminar la lista.');
    } finally {
      setLoading(false);
    }
  };

  // --- 📥 Descarga de Plantilla CSV ---
  const downloadTemplate = () => {
    const csvContent = "value,list_type,reason\n" +
                       "ejemplo@fraude.com,BLACK,Ataque coordinado detectado\n" +
                       "vip@cliente.com,WHITE,Cliente recurrente validado";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `plantilla_${selectedListId || 'carga'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 📖 2.5 Obtener Registros Paginados (BLINDADO) ---
  const fetchRecords = useCallback(async (page = 1, search = '') => {
    if (!selectedListId) return;
    setLoading(true);
    try {
      let url = `/api/lists/${selectedListId}?page=${page}&limit=10`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const res = await api.get(url);
      const payload = res.data;

      // 🛡️ Búsqueda Agresiva del Arreglo (Cubre múltiples formatos de backend)
      let arrayRegistros = [];
      let paginacionBackend = { current_page: 1, total_pages: 1, total_records: 0, per_page: 10 };

      if (payload.success || res.status === 200) {
          if (Array.isArray(payload.data)) arrayRegistros = payload.data;
          else if (payload.data && Array.isArray(payload.data.data)) arrayRegistros = payload.data.data;
          else if (payload.data && Array.isArray(payload.data.items)) arrayRegistros = payload.data.items;
          else if (Array.isArray(payload.items)) arrayRegistros = payload.items;
          
          paginacionBackend = payload.pagination || payload.data?.pagination || paginacionBackend;
      }

      setRecords(arrayRegistros);
      setPagination(paginacionBackend);

    } catch (err) {
      console.error("Error al cargar registros", err);
      showMessage('error', err.response?.data?.error || 'Error interno al obtener los registros.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    if (activeTab === 'RECORDS' && selectedListId) {
      fetchRecords(1, activeSearch);
    }
  }, [activeTab, selectedListId, fetchRecords, activeSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    fetchRecords(1, searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    fetchRecords(1, '');
  };

  // --- 🗑️ 2.4 Eliminación de Registro Individual ---
  const handleDeleteRecord = async (valueToDelete) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro '${valueToDelete}'?`)) return;
    setLoading(true);
    try {
      const safeValue = encodeURIComponent(valueToDelete);
      await api.delete(`/api/lists/${selectedListId}/${safeValue}`);
      showMessage('success', 'Registro eliminado exitosamente.');
      fetchRecords(pagination.current_page, activeSearch);
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Error al eliminar el registro.');
    } finally {
      setLoading(false);
    }
  };

  // --- 🚀 2.1 Carga Manual (UPSERT) ---
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualValue.trim()) return showMessage('error', 'El valor es obligatorio.');
    setLoading(true);
    try {
      const payload = {
        value: manualValue.trim(),
        list_type: manualListType,
        reason: manualReason.trim()
      };
      const res = await api.post(`/api/lists/${selectedListId}/manual`, payload);
      showMessage('success', res.data.message || 'Ítem registrado exitosamente.');
      setManualValue(''); setManualReason('');
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.response?.data?.error || 'Error al guardar el registro.');
    } finally {
      setLoading(false);
    }
  };

  // --- 📦 2.2 Carga Masiva (Parseo Inteligente Front -> JSON API) ---
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkFile) return showMessage('error', 'Debe seleccionar un archivo (.csv).');
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("El archivo está vacío o no tiene registros.");

        // 🚀 MEJORA: Detección automática del delimitador usado en el CSV
        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';

        const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
        const valueIdx = headers.indexOf('value');
        const typeIdx = headers.indexOf('list_type');
        const reasonIdx = headers.indexOf('reason');

        if (valueIdx === -1) throw new Error('El CSV debe contener obligatoriamente la cabecera "value"');

        const items = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map(c => c.trim());
          if (cols[valueIdx]) {
            items.push({
              value: cols[valueIdx],
              list_type: typeIdx !== -1 ? (cols[typeIdx] || 'BLACK').toUpperCase() : 'BLACK',
              reason: reasonIdx !== -1 ? cols[reasonIdx] : ''
            });
          }
        }

        const res = await api.post(`/api/lists/${selectedListId}/bulk`, { items });
        showMessage('success', `Carga Masiva Exitosa. Insertados: ${res.data.inserted || 0} | Actualizados: ${res.data.updated || 0}`);
        
        setBulkFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        showMessage('error', err.response?.data?.error || err.message || 'Error procesando el archivo CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      showMessage('error', 'Error leyendo el archivo local.');
      setLoading(false);
    };
    reader.readAsText(bulkFile);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-power-blue flex items-center gap-2">
          <svg className="w-6 h-6 text-power-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          Mantenimiento de Listas
        </h2>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Configuración global y operativa de Listas Antifraude (Dinámicas y Nativas).
        </p>
      </div>

      {status.message && (
        <div className={`mb-4 p-4 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 animate-fade-in ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          status.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
          'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {status.type === 'success' ? '✅' : status.type === 'info' ? 'ℹ️' : '🛑'} {status.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {/* Tabs Principales */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0 overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab('CATALOG')} className={`px-6 py-3 whitespace-nowrap text-sm font-black transition-colors border-b-2 ${activeTab === 'CATALOG' ? 'border-power-purple text-power-purple bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
            📚 Catálogo de Listas
          </button>
          <button onClick={() => setActiveTab('RECORDS')} className={`px-6 py-3 whitespace-nowrap text-sm font-black transition-colors border-b-2 ${activeTab === 'RECORDS' ? 'border-power-purple text-power-purple bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
            📖 Ver Registros
          </button>
          <button onClick={() => setActiveTab('MANUAL')} className={`px-6 py-3 whitespace-nowrap text-sm font-black transition-colors border-b-2 ${activeTab === 'MANUAL' ? 'border-power-purple text-power-purple bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
            ✍️ Registro Manual
          </button>
          <button onClick={() => setActiveTab('BULK')} className={`px-6 py-3 whitespace-nowrap text-sm font-black transition-colors border-b-2 ${activeTab === 'BULK' ? 'border-power-purple text-power-purple bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
            📦 Carga Masiva
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          
          {/* TAB 1: CATÁLOGO DE LISTAS */}
          {activeTab === 'CATALOG' && (
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              <div className="lg:col-span-1">
                <form onSubmit={handleCreateList} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="font-black text-power-blue uppercase tracking-wide text-xs mb-4">Crear Nueva Lista Genérica</h3>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">ID de Lista (list_id)</label>
                    <input type="text" value={newCatalogId} onChange={(e) => setNewCatalogId(e.target.value)} placeholder="Ej. ZONAS_ROJAS" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-power-purple outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Nombre Público</label>
                    <input type="text" value={newCatalogName} onChange={(e) => setNewCatalogName(e.target.value)} placeholder="Ej. Zonas Geográficas Peligrosas" className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Descripción</label>
                    <textarea value={newCatalogDesc} onChange={(e) => setNewCatalogDesc(e.target.value)} rows="3" placeholder="Contexto de uso para la lista..." className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none resize-none" required></textarea>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-power-blue hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm">
                    {loading ? 'Creando...' : 'Crear Lista +'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2">
                 <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-widest font-black">
                        <tr>
                          <th className="px-4 py-3">ID Lista</th>
                          <th className="px-4 py-3">Nombre Público</th>
                          <th className="px-4 py-3 text-center">Tipo</th>
                          <th className="px-4 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {catalog.length === 0 ? (
                          <tr><td colSpan="4" className="text-center py-6 italic text-gray-400">Cargando listas...</td></tr>
                        ) : (
                          catalog.map(c => (
                            <tr key={c.list_id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-power-blue text-xs">{c.list_id}</td>
                              <td className="px-4 py-3 text-gray-700">
                                <span className="font-bold block">{c.display_name}</span>
                                <span className="text-[10px] text-gray-400 block line-clamp-1">{c.description}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {c.is_generic 
                                  ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[9px] font-black uppercase shadow-sm border border-amber-200">Genérica</span>
                                  : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-black uppercase shadow-sm border border-emerald-200">Nativa</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-center">
                                {c.is_generic ? (
                                  <button onClick={() => handleDeleteList(c.list_id)} className="text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase active:scale-95">Borrar</button>
                                ) : (
                                  <span className="text-gray-300 text-[10px] uppercase font-bold">Bloqueada</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                 </div>
              </div>
            </div>
          )}

          {/* SELECTOR MAESTRO DE LISTAS (COMPARTIDO PARA OPERACIONES) */}
          {activeTab !== 'CATALOG' && (
            <div className="max-w-4xl mx-auto mb-6 bg-power-blue/5 border border-power-blue/20 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
               <div>
                  <p className="text-[10px] font-black text-power-blue uppercase tracking-widest mb-1">Operando sobre la Lista:</p>
                  <p className="text-xs font-medium text-slate-600">Selecciona la lista a la cual le aplicarás las operaciones.</p>
               </div>
               <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className="p-2 border border-power-blue/30 rounded-lg text-sm bg-white text-power-blue font-bold focus:ring-2 focus:ring-power-purple outline-none shadow-sm min-w-[200px]">
                  {catalog.map(t => <option key={t.list_id} value={t.list_id}>{t.display_name} ({t.list_id})</option>)}
               </select>
            </div>
          )}

          {/* TAB 2: VER REGISTROS (DATAGRID PAGINADO) */}
          {activeTab === 'RECORDS' && (
            <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
              
              {/* Barra de Búsqueda */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)} 
                  placeholder="Buscar registro por valor (ej. correo@fraude.com)..." 
                  className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-power-purple outline-none" 
                />
                <button type="submit" disabled={loading} className="bg-power-blue hover:bg-blue-800 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm">
                  Buscar
                </button>
                {activeSearch && (
                  <button type="button" onClick={handleClearSearch} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-4 py-2.5 rounded-lg transition-colors text-sm border border-gray-200">
                    Limpiar
                  </button>
                )}
              </form>

              {/* Tabla de Registros */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-white text-[10px] uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-4 py-3">Valor Registrado</th>
                      <th className="px-4 py-3">Motivo / Razón</th>
                      <th className="px-4 py-3 text-center">Tipo (Acción)</th>
                      <th className="px-4 py-3 text-center">Fecha Creación</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading && records.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-8 italic text-gray-400">Cargando registros...</td></tr>
                    ) : records.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-8 font-bold text-gray-500">No se encontraron registros en esta lista.</td></tr>
                    ) : (
                      records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 text-xs break-all">{r.value}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[200px]" title={r.reason}>{r.reason || 'N/A'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase shadow-xs border ${r.list_type === 'BLACK' ? 'bg-gray-800 text-white border-gray-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {r.list_type === 'BLACK' ? 'BLOQUEO' : 'PERMITIR'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500 font-medium">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeleteRecord(r.value)} className="text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase active:scale-95">Borrar</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {/* Controles de Paginación */}
                {!loading && records.length > 0 && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      Mostrando página {pagination.current_page} de {pagination.total_pages} ({pagination.total_records} registros totales)
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fetchRecords(pagination.current_page - 1, activeSearch)}
                        disabled={pagination.current_page <= 1}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Anterior
                      </button>
                      <button 
                        onClick={() => fetchRecords(pagination.current_page + 1, activeSearch)}
                        disabled={pagination.current_page >= pagination.total_pages}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REGISTRO MANUAL */}
          {activeTab === 'MANUAL' && (
            <div className="max-w-2xl mx-auto animate-fade-in">
              <form onSubmit={handleManualSubmit} className="space-y-5 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de Lista (Acción)</label>
                  <select value={manualListType} onChange={(e) => setManualListType(e.target.value)} className={`w-full p-2.5 border rounded-lg text-sm font-bold outline-none ${manualListType === 'BLACK' ? 'bg-gray-100 border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800 focus:ring-2 focus:ring-emerald-400'}`}>
                    {LIST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Valor a registrar (Clave exacta para {selectedListId})</label>
                  <input type="text" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Escribe el valor a bloquear/permitir..." className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Motivo (Opcional pero recomendado)</label>
                  <textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} rows="2" placeholder="Ej. Fraude confirmado en caso #4589" className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-power-purple outline-none resize-none"></textarea>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <button type="submit" disabled={loading} className="w-full bg-power-purple hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2">
                    {loading ? 'Guardando...' : <>💾 Guardar Registro en {selectedListId}</>}
                  </button>
                  <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">Si la clave ya existe, sus datos se actualizarán (UPSERT).</p>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: CARGA MASIVA */}
          {activeTab === 'BULK' && (
            <div className="max-w-2xl mx-auto animate-fade-in">
              <form onSubmit={handleBulkSubmit} className="space-y-5 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 mb-1">Estructura CSV para la Lista: {selectedListId}</h4>
                    <p className="text-xs text-amber-700 mb-2">La primera fila debe contener obligatoriamente estos encabezados:</p>
                    <code className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-1 rounded">value</code>
                    <code className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-1 rounded mx-2">list_type</code>
                    <code className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-1 rounded">reason</code>
                  </div>
                  <button type="button" onClick={downloadTemplate} className="shrink-0 flex flex-col items-center justify-center bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-xl transition-colors shadow-sm active:scale-95 w-full sm:w-auto">
                     <span className="text-xl">📥</span>
                     <span className="text-[10px] font-black uppercase mt-1">Plantilla CSV</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Archivo de carga (Formato .csv)</label>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={(e) => setBulkFile(e.target.files[0])} 
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-power-purple/10 file:text-power-purple hover:file:bg-power-purple/20 transition-all cursor-pointer" 
                    required 
                  />
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2">
                    {loading ? 'Procesando e ingestando...' : <>🚀 Iniciar Carga Masiva a {selectedListId}</>}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ListsMaintenance;