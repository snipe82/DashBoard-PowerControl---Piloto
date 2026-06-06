import axios from 'axios';

const api = axios.create({
    baseURL: '/', 
});

// Interceptor de PETICIONES (Inyecta el token)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor de RESPUESTAS (Maneja el Refresh Token)
api.interceptors.response.use((response) => {
    return response;
}, async (error) => {
    const originalRequest = error.config;

    // 🚀 LA CURA: Si el error 401 viene del intento de Login, detenemos el interceptor aquí mismo 
    // y dejamos que LoginView.jsx muestre su mensaje de error tranquilamente.
    if (originalRequest.url.includes('/api/auth/login')) {
        return Promise.reject(error);
    }

    // Si nos da 401 en CUALQUIER OTRA RUTA, intentamos renovar
    if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
            const refreshToken = localStorage.getItem('refreshToken');
            
            // Si ni siquiera hay refreshToken en memoria, cerramos directo
            if (!refreshToken) throw new Error("No hay refresh token");

            const { data } = await axios.post('/api/auth/refresh', { refreshToken });
            
            localStorage.setItem('accessToken', data.accessToken);
            originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
            
            return api(originalRequest);
        } catch (refreshError) {
            localStorage.clear();
            window.location.href = '/'; // Expulsar si caducó
            return Promise.reject(refreshError);
        }
    }
    return Promise.reject(error);
});

export default api;