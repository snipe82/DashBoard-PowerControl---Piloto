import axios from 'axios';

const api = axios.create({
  // Configuración base de tu pasarela local
  headers: {
    'Content-Type': 'application/json'
  }
});

// =========================================================
// ⬆️ INTERCEPTOR DE PETICIONES (Adjuntar Token dinámicamente)
// =========================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// =========================================================
// ⬇️ INTERCEPTOR DE RESPUESTAS (Escudo Global Antiexpiración)
// =========================================================
api.interceptors.response.use(
  (response) => {
    // Si la operación es exitosa (200, 201), la data fluye sin obstrucciones
    return response;
  },
  (error) => {
    // 🔒 CAPTURA ATÓMICA DE SESIÓN EXPIRADA (401)
    if (error.response && error.response.status === 401) {
      console.warn("⚠️ [PowerControl] Detectado estado 401. Token vencido o revocado.");
      
      // 1. Evacuamos la data de sesión corrupta/expirada del navegador
      localStorage.clear();
      
      // 2. Alerta formal de seguridad para el operador analista
      alert("Tu sesión ha expirado por motivos de seguridad corporativa. Por favor, vuelve a ingresar tus credenciales.");
      
      // 3. Forzamos un refresco limpio de la ventana.
      // Al estar el localStorage vacío, App.jsx montará instantáneamente el LoginView.
      window.location.reload();
    }
    
    return Promise.reject(error);
  }
);

export default api;