const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 🚀 EXTRACTOR JWT: Pasa el token del Frontend al Backend de forma transparente
const getHeaders = (req) => {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }
    return headers;
};

// ==========================================
// 🔐 1. RUTAS DE AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/refresh', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/logout', {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/change-password', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/change-password', {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

// ==========================================
// 🛡️ 2. RUTAS PROTEGIDAS DE LA API (ALERTAS)
// ==========================================
app.get('/api/alerts', async (req, res) => {
    const { status, page, pageSize, dateFrom, dateTo } = req.query;
    let backendUrl = `http://127.0.0.1:3015/api/v1/alerts?status=${status}&page=${page}&pageSize=${pageSize}`;
    if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
    if (dateTo) backendUrl += `&dateTo=${dateTo}`;

    try {
        const response = await fetch(backendUrl, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/alerts/dni/:dni', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/dni/${req.params.dni}`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/alerts/grouped', async (req, res) => {
    try {
        const { status, page, pageSize, dateFrom, dateTo, search } = req.query;
        let backendUrl = `http://127.0.0.1:3015/api/v1/alerts/grouped?status=${status}&page=${page}&pageSize=${pageSize}`;
        if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
        if (dateTo) backendUrl += `&dateTo=${dateTo}`;
        if (search) backendUrl += `&search=${search}`;

        const response = await fetch(backendUrl, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/alerts/entity/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(500).json({ error: "Error obtuvo entidad" }); }
});

app.patch('/api/alerts/entity/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}/review`, {
            method: 'PATCH',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(500).json({ error: "Error revisión" }); }
});

app.get('/api/alerts/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/alerts/:id/payload', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/payload`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.patch('/api/alerts/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/review`, {
            method: 'PATCH',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/v1/alerts/customer/:customer_id/audit', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/customer/${req.params.customer_id}/audit`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// ==========================================
// 👥 3. RUTAS DEL MÓDULO DE SEGURIDAD (CRUD)
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users`, { headers: getHeaders(req) });
        
        // Si no es un estado exitoso (200), manejamos el error de forma segura sin romper el JSON
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            return res.status(response.status).json({ 
                message: errorData?.message || `Error en el servidor backend al listar usuarios (Código ${response.status})` 
            });
        }
        res.json(await response.json());
    } catch (error) { 
        res.status(502).json({ message: 'El servicio central de gestión de usuarios no responde (502).' }); 
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/register`, {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            return res.status(response.status).json({ 
                message: data?.message || `Error en el servidor al registrar el usuario (Código ${response.status})` 
            });
        }
        res.status(response.status).json(data);
    } catch (error) { 
        res.status(502).json({ message: 'Error interno de red: No se pudo procesar el alta del usuario.' }); 
    }
});

app.patch('/api/users/change-role', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/change-role`, {
            method: 'PATCH',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            return res.status(response.status).json({ 
                message: data?.message || `Error en el servidor al modificar los privilegios (Código ${response.status})` 
            });
        }
        res.status(response.status).json(data);
    } catch (error) { 
        res.status(502).json({ message: 'Error de comunicación: El servidor de cambio de roles no responde.' }); 
    }
});

app.patch('/api/users/activate', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/activate`, {
            method: 'PATCH',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            return res.status(response.status).json({ 
                message: data?.message || `Error en el servidor central al reactivar la cuenta (Código ${response.status})` 
            });
        }
        res.status(response.status).json(data);
    } catch (error) { 
        res.status(502).json({ message: 'Error en la pasarela intermedia al intentar activar la cuenta de analista.' }); 
    }
});

app.delete('/api/users/:userId', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/${req.params.userId}`, {
            method: 'DELETE',
            headers: getHeaders(req)
        });
        
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            return res.status(response.status).json({ 
                message: data?.message || `Error en el servidor central al revocar el acceso (Código ${response.status})` 
            });
        }
        res.status(response.status).json(data);
    } catch (error) { 
        res.status(502).json({ message: 'Error de red: No se pudo completar el bloqueo de credenciales.' }); 
    }
});

// ==========================================
// 📊 4. ESTADÍSTICAS DEL DASHBOARD
// ==========================================
app.get('/api/stats/summary', async (req, res) => {
    try {
        const headers = getHeaders(req);

        const fetchSafe = async (url) => {
            const r = await fetch(url, { headers });
            if (r.status === 401) throw new Error('401_UNAUTHORIZED'); 
            if (!r.ok) return [];
            
            const d = await r.json();
            if (Array.isArray(d)) return d;
            if (Array.isArray(d?.data)) return d.data;
            if (Array.isArray(d?.data?.data)) return d.data.data;
            return [];
        };

        const [abiertas, enRevision, fraudes, sospechosos, descartadas, enRevisionAdicional] = await Promise.all([
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=1000'),
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=IN_REVIEW&pageSize=1000'),
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=1000'),
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=SUSPICIOUS&pageSize=1000'),
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=DISCARDED&pageSize=1000'),
            fetchSafe('http://127.0.0.1:3015/api/v1/alerts?status=ADDITIONAL_REVIEW&pageSize=1000')
        ]);

        const activas = [...abiertas, ...enRevision, ...enRevisionAdicional];
        const riesgoCritico = [...sospechosos, ...fraudes];
        const globales = [...abiertas, ...enRevision, ...enRevisionAdicional, ...fraudes, ...sospechosos, ...descartadas];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const globalesMesActual = [];
        const globalesMesAnterior = [];

        globales.forEach(al => {
            const fechaRaw = al.fecha || al.fecha_creacion || al.created_at;
            if (!fechaRaw) return;
            const d = new Date(fechaRaw);
            if (isNaN(d.getTime())) return;

            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) globalesMesActual.push(al);
            else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) globalesMesAnterior.push(al);
        });

        const txProcesadasDashboard = new Set();
        let dineroRiesgoNeto = 0;

        activas.forEach(al => {
            const fechaSinSegundos = al.fecha ? new Date(al.fecha).setSeconds(0, 0) : '0';
            const txKey = al.transaction_id || al.operacion_id || al.payment_id || al.id_transaccion || `${fechaSinSegundos}_${al.monto}`;
            if (!txProcesadasDashboard.has(txKey)) {
                txProcesadasDashboard.add(txKey);
                dineroRiesgoNeto += parseFloat(al.monto || 0);
            }
        });

        const resolveEntityId = (item) => {
            if (!item) return Math.random().toString();
            let id = item.dni || item.document_number || item.documentNumber || item.nro_documento || item.numero_documento;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.codigo_entidad || item.customer_id || item.customerId || item.merchant_id || item.entity_id;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.cliente || item.full_name || item.fullName || item.merchant_name || item.nombre;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.alert_id || item.id_transaccion || item.payment_id;
            return id ? String(id).trim().toUpperCase() : Math.random().toString();
        };

        const countUniqueClients = (arr) => {
            const uniqueClients = new Set();
            arr.forEach(al => uniqueClients.add(resolveEntityId(al)));
            return uniqueClients.size;
        };

        const totalAlertas = countUniqueClients(abiertas);
        const casosCriticos = countUniqueClients(fraudes);
        const casosEnRevision = countUniqueClients([...enRevision, ...enRevisionAdicional]);
        const casosRevisados = countUniqueClients([...fraudes, ...sospechosos, ...descartadas]);

        const procesarTop10 = (arreglo) => {
            const conteo = {};
            let totalValidas = 0;
            const uniqueClientsPanel = new Set();

            arreglo.forEach(al => {
                uniqueClientsPanel.add(resolveEntityId(al));
                if (al.codigoregla) {
                    const nombre = `${al.codigoregla} - ${al.regla || 'Desconocida'}`;
                    conteo[nombre] = (conteo[nombre] || 0) + 1;
                    totalValidas++;
                }
            });

            const top = Object.entries(conteo)
                .map(([nombre, quantity]) => ({ nombre, quantity, porcentaje: totalValidas > 0 ? Math.round((quantity / totalValidas) * 100) : 0 }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

            return { top, totalAlertas: arreglo.length, clientesImpactados: uniqueClientsPanel.size };
        };

        res.json({
            alertas_abiertas: totalAlertas,
            casos_en_revision: casosEnRevision,
            casos_revisados: casosRevisados,
            dinero_en_riesgo: dineroRiesgoNeto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            efectividad: totalAlertas > 0 ? (100 - (casosCriticos / (totalAlertas + casosCriticos) * 100)).toFixed(1) + "%" : "100%",
            casos_criticos: casosCriticos,
            top_rules_activas: procesarTop10(activas),
            top_rules_riesgo: procesarTop10(riesgoCritico),
            top_rules_globales: procesarTop10(globales),
            top_rules_mes_actual: procesarTop10(globalesMesActual),
            top_rules_mes_anterior: procesarTop10(globalesMesAnterior)
        });
    } catch (e) {
        if (e.message === '401_UNAUTHORIZED') return res.status(401).json({ error: 'Token inválido o expirado' });
        res.status(500).json({ error: 'Error procesando estadísticas' });
    }
});

// ==========================================
// 🌐 5. MANEJO DE RUTAS ESTÁTICAS / WILDCARD (SIEMPRE AL FINAL)
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(reactAppPath)) res.sendFile(reactAppPath);
    else res.send("🚀 Proxy de PowerControl activo.");
});

app.listen(PORT, () => console.log(`🚀 PowerControl Proxy Seguro en ejecución en el puerto: ${PORT}`));