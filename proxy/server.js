const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const getHeaders = (req) => {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    return headers;
};

// ==========================================
// 🔐 1. RUTAS DE AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/refresh', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/logout', { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

app.post('/api/auth/change-password', async (req, res) => {
    try {
        const r = await fetch('http://127.0.0.1:3015/api/v1/auth/change-password', { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(r.status).json(await r.json());
    } catch (error) { res.status(503).json({ error: 'Motor Auth no disponible' }); }
});

// ==========================================
// 🛡️ 2. RUTAS PROTEGIDAS DE LA API (ALERTAS)
// ==========================================
app.get('/api/alerts', async (req, res) => {
    const { status, page, pageSize, dateFrom, dateTo, fraud_type } = req.query;
    let backendUrl = `http://127.0.0.1:3015/api/v1/alerts?status=${status}&page=${page}&pageSize=${pageSize}`;
    if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
    if (dateTo) backendUrl += `&dateTo=${dateTo}`;
    if (fraud_type) backendUrl += `&fraud_type=${fraud_type}`;
    try {
        const response = await fetch(backendUrl, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/alerts/:id/lock', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/lock`, { method: 'POST', headers: getHeaders(req) });
        const data = await response.json().catch(() => null);
        res.status(response.status).json(data);
    } catch (error) { res.status(502).json({ message: 'Error de pasarela al intentar adquirir llave.' }); }
});

app.post('/api/alerts/:id/unlock', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/unlock`, { method: 'POST', headers: getHeaders(req) });
        const data = await response.json().catch(() => null);
        res.status(response.status).json(data);
    } catch (error) { res.status(502).json({ message: 'Error de pasarela al intentar liberar llave.' }); }
});

app.get('/api/alerts/dni/:dni', async (req, res) => {
    try {
        const { status, fraud_type } = req.query;
        let url = `http://127.0.0.1:3015/api/v1/alerts/dni/${req.params.dni}?status=${status || ''}`;
        if (fraud_type) url += `&fraud_type=${fraud_type}`;
        const response = await fetch(url, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/alerts/grouped', async (req, res) => {
    try {
        const { status, page, pageSize, dateFrom, dateTo, search, fraud_type } = req.query;
        let backendUrl = `http://127.0.0.1:3015/api/v1/alerts/grouped?status=${status}&page=${page}&pageSize=${pageSize}`;
        if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
        if (dateTo) backendUrl += `&dateTo=${dateTo}`;
        if (search) backendUrl += `&search=${search}`;
        if (fraud_type) backendUrl += `&fraud_type=${fraud_type}`;
        const response = await fetch(backendUrl, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/alerts/entity/:id', async (req, res) => {
    try {
        const { status, fraud_type } = req.query;
        let url = `http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}?status=${status || ''}`;
        if (fraud_type) url += `&fraud_type=${fraud_type}`;
        const response = await fetch(url, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(500).json({ error: "Error obtuvo entidad" }); }
});

app.patch('/api/alerts/entity/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}/review`, { method: 'PATCH', headers: getHeaders(req), body: JSON.stringify(req.body) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(502).json({ error: "Error revisión pasarela" }); }
});

app.patch('/api/alerts/dni/:dni/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.dni}/review`, { method: 'PATCH', headers: getHeaders(req), body: JSON.stringify(req.body) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(502).json({ error: "Error revisión pasarela" }); }
});

app.get('/api/alerts/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}`, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/alerts/:id/payload', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/payload`, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.patch('/api/alerts/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/review`, { method: 'PATCH', headers: getHeaders(req), body: JSON.stringify(req.body) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/v1/alerts/customer/:customer_id/audit', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/customer/${req.params.customer_id}/audit`, { headers: getHeaders(req) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// ==========================================
// 🛡️ 2.1 RUTAS DE RESOLUCIÓN DE CASOS (FRAUDE)
// ==========================================
app.put('/api/v1/cases/:case_id/resolve', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/cases/${req.params.case_id}/resolve`, { method: 'PUT', headers: getHeaders(req), body: JSON.stringify(req.body) });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
    } catch (error) { res.status(502).json({ error: 'Error de pasarela al intentar resolver caso.' }); }
});

// ==========================================
// 👥 3. RUTAS DEL MÓDULO DE SEGURIDAD
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'Servicio no disponible.' }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'Error en pasarela.' }); }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/${req.params.id}`, { method: 'PUT', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'Error en pasarela.' }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/${req.params.id}`, { method: 'DELETE', headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'Error en pasarela.' }); }
});

// ==========================================
// 🛠️ 4. RUTAS DEL MÓDULO DE ANÁLISIS (REGLAS Y SIMULACIÓN)
// ==========================================
app.get('/api/v1/rules', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/v1/rules/latest', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/latest`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// 🚀 RUTA DEL SIMULADOR DE BACKTESTING
app.post('/api/v1/rules/simulate', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/simulate`, { 
            method: 'POST', 
            headers: getHeaders(req), 
            body: JSON.stringify(req.body) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor de simulación no disponible.' }); }
});

// 🚀 RUTA PARA PROGRAMAR EL SHADOW MODE
app.post('/api/v1/rules/:ruleCode/shadow', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/shadow`, { 
            method: 'POST', 
            headers: getHeaders(req), 
            body: JSON.stringify(req.body) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor de reglas no disponible.' }); }
});

// 🚀 RUTA PARA LEER LAS ALERTAS FANTASMA DEL SHADOW MODE
app.get('/api/v1/rules/:ruleCode/shadow/alerts', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/shadow/alerts`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// 🚀 NUEVO: RUTA PARA CANCELAR EL SHADOW MODE (BOTÓN DE PÁNICO)
app.delete('/api/v1/rules/:ruleCode/shadow', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/shadow`, { 
            method: 'DELETE', 
            headers: getHeaders(req) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor de reglas no disponible.' }); }
});

app.post('/api/v1/rules/:ruleCode/draft', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/draft`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.put('/api/v1/rules/:ruleCode/status', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/status`, { method: 'PUT', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/v1/rules/:ruleCode/restore/:versionNumber', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/restore/${req.params.versionNumber}`, { method: 'POST', headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/v1/rules/dictionary', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/dictionary`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/v1/rules/test', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/test`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/v1/rules/validate', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/validate`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor de validación no disponible.' }); }
});

app.get('/api/v1/rules/:ruleCode/history', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/history`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.get('/api/v1/rules/:ruleCode', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/v1/rules', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.put('/api/v1/rules/:ruleCode', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}`, { method: 'PUT', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.patch('/api/v1/rules/:ruleCode/activation', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/activation`, { method: 'PATCH', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// ==========================================
// 🔎 5. MÓDULO: BUSCADOR DE EVENTOS
// ==========================================
app.get('/api/v1/events/search', async (req, res) => {
    try {
        const queryString = req.url.split('?')[1] || '';
        const response = await fetch(`http://127.0.0.1:3015/api/v1/events/search?${queryString}`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ success: false, error: 'Servicio no disponible temporalmente.' }); }
});

app.post('/api/v1/events/manual-alert', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/events/manual-alert`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Servicio no disponible temporalmente.' }); }
});

// ==========================================
// 📊 6. PROCESADOR DE ESTADÍSTICAS DEL DASHBOARD
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

        const limit = 5000;
        const [abiertas, enRevision, fraudes, sospechosos, descartadas, enRevisionAdicional, fraudesCerrados] = await Promise.all([
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=IN_REVIEW&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=SUSPICIOUS&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=DISCARDED&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=ADDITIONAL_REVIEW&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=CLOSED_CONFIRMED_FRAUD&pageSize=${limit}`)
        ]);

        const fraudesTotalesArr = [...fraudes, ...fraudesCerrados];
        const fraudesFrustradosArr = fraudesTotalesArr.filter(al => al.fraud_type === 'FRAUD_FRUSTRATED');
        const fraudesMaterializadosArr = fraudesTotalesArr.filter(al => al.fraud_type !== 'FRAUD_FRUSTRATED'); 

        const activas = [...abiertas, ...enRevision, ...enRevisionAdicional];
        const riesgoCritico = [...sospechosos, ...fraudesTotalesArr];
        const globales = [...abiertas, ...enRevision, ...enRevisionAdicional, ...fraudesTotalesArr, ...sospechosos, ...descartadas];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const globalesMesActual = [];
        const globalesMesAnterior = [];

        const extractSafeDate = (al) => {
            let raw = al.fecha || al.fecha_creacion || al.created_at || al.dates?.utc;
            if (!raw) return null;
            if (typeof raw === 'string' && raw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                const parts = raw.split(/[\s/T:-]+/); 
                raw = `${parts[2]}-${parts[1]}-${parts[0]}T${parts[3]||'00'}:${parts[4]||'00'}:${parts[5]||'00'}`;
            }
            const d = new Date(raw);
            return isNaN(d.getTime()) ? null : d;
        };

        globales.forEach(al => {
            const d = extractSafeDate(al);
            if (!d) return;
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) globalesMesActual.push(al);
            else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) globalesMesAnterior.push(al);
        });

        const sumAmounts = (arr) => {
            const txProcesadas = new Set();
            let total = 0;
            arr.forEach(al => {
                const d = extractSafeDate(al);
                const fechaSinSegundos = d ? d.setSeconds(0, 0) : '0';
                const monto = al.monto || al.amount || al.payloads?.recepcion?.amount || 0;
                const txKey = al.transaction_id || al.application_id || al.operacion_id || al.payment_id || al.id_transaccion || `${fechaSinSegundos}_${monto}`;
                
                if (!txProcesadas.has(txKey)) {
                    txProcesadas.add(txKey);
                    total += parseFloat(monto || 0);
                }
            });
            return total;
        };

        const resolveEntityId = (item) => {
            if (!item) return Math.random().toString();
            let id = item.dni || item.document_number || item.customer_details?.dni || item.nro_documento;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.customer_id || item.codigo_entidad || item.merchant_id || item.entity_id;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.full_name || item.customer_details?.full_name || item.cliente || item.nombre;
            if (id && String(id).trim() !== '') return String(id).trim().toUpperCase();
            
            id = item.application_id || item.alert_id || item.id_transaccion;
            return id ? String(id).trim().toUpperCase() : Math.random().toString();
        };

        const countUniqueClients = (arr) => {
            const uniqueClients = new Set();
            arr.forEach(al => uniqueClients.add(resolveEntityId(al)));
            return uniqueClients.size;
        };

        const totalAlertas = countUniqueClients(abiertas);
        const casosEnRevision = countUniqueClients([...enRevision, ...enRevisionAdicional]);
        const casosRevisados = countUniqueClients([...fraudesCerrados, ...descartadas]);
        const casosSospechosos = countUniqueClients(sospechosos);
        const casosCriticos = countUniqueClients(fraudesMaterializadosArr); 
        const casosFrustrados = countUniqueClients(fraudesFrustradosArr);   

        const dineroRiesgoNeto = sumAmounts(activas);
        const monto_sospechas = sumAmounts(sospechosos);
        const monto_fraudes_totales = sumAmounts(fraudesMaterializadosArr); 
        const monto_fraudes_frustrados = sumAmounts(fraudesFrustradosArr);  
        const monto_fraudes_con_perdida = sumAmounts(fraudesMaterializadosArr.filter(al => al.fraud_type === 'FRAUD_LOSS'));
        const monto_fraudes_sin_perdida = sumAmounts(fraudesMaterializadosArr.filter(al => al.fraud_type === 'FRAUD_MERCHANT_ASSUMED'));

        const fraudesPerdidasCount = countUniqueClients(fraudesMaterializadosArr.filter(al => al.fraud_type === 'FRAUD_LOSS'));
        const fraudesAsumidosCount = countUniqueClients(fraudesMaterializadosArr.filter(al => al.fraud_type === 'FRAUD_MERCHANT_ASSUMED'));

        const formatSoles = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const procesarTop10 = (arreglo) => {
            const conteo = {};
            let totalValidas = 0;
            const uniqueClientsPanel = new Set();

            arreglo.forEach(al => {
                uniqueClientsPanel.add(resolveEntityId(al));
                const ruleCode = al.rule_code || al.codigoregla || al.ruleCode || al.alert_code || 'SIN_CÓDIGO';
                const ruleName = al.rule_name || al.regla || al.ruleName || 'Regla Histórica / Desconocida';
                
                const nombre = `${ruleCode} - ${ruleName}`;
                conteo[nombre] = (conteo[nombre] || 0) + 1;
                totalValidas++;
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
            casos_sospechosos: casosSospechosos,
            casos_criticos: casosCriticos,
            casos_frustrados: casosFrustrados,
            efectividad: totalAlertas > 0 ? (100 - ((casosCriticos + casosFrustrados) / (totalAlertas + casosCriticos + casosFrustrados) * 100)).toFixed(1) + "%" : "100%",
            dinero_en_riesgo: formatSoles(dineroRiesgoNeto),
            monto_sospechas: formatSoles(monto_sospechas),
            monto_fraude_total: formatSoles(monto_fraudes_totales),
            monto_fraudes_frustrados: formatSoles(monto_fraudes_frustrados),
            monto_fraudes_con_perdida: formatSoles(monto_fraudes_con_perdida),
            monto_fraudes_sin_perdida: formatSoles(monto_fraudes_sin_perdida),
            fraudes_con_perdida: fraudesPerdidasCount,
            fraudes_sin_perdida: fraudesAsumidosCount,
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
// 🤖 8. PROXY PARA EL MOTOR DE INTELIGENCIA ARTIFICIAL
// ==========================================
app.post('/api/v1/rules/ai/generate', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/ai/generate`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor AI no disponible' }); }
});

app.post('/api/v1/rules/ai/modify', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/ai/modify`, { method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor AI no disponible' }); }
});

// ==========================================
// 📋 10. MÓDULO DE LISTAS (CATÁLOGO DINÁMICO)
// ==========================================

// 10.1 Gestión del Catálogo
app.get('/api/lists/catalog', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/catalog`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

app.post('/api/lists/catalog', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/catalog`, { 
            method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

app.delete('/api/lists/catalog/:list_id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/catalog/${req.params.list_id}`, { 
            method: 'DELETE', headers: getHeaders(req) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

// 10.2 Gestión de Registros y Valores
app.post('/api/lists/:list_id/manual', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/${req.params.list_id}/manual`, { 
            method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

app.post('/api/lists/:list_id/bulk', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/${req.params.list_id}/bulk`, { 
            method: 'POST', headers: getHeaders(req), body: JSON.stringify(req.body) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

// 🚀 NUEVA RUTA PROXY: Listado Paginado de Registros (Escudada contra colisiones)
app.get('/api/lists/:list_id', async (req, res) => {
    try {
        if(req.params.list_id.toLowerCase() === 'catalog') return res.status(400).json({error: "Ruta reservada"});
        
        const { page, limit, search } = req.query;
        let url = `http://127.0.0.1:3015/api/v1/lists/${req.params.list_id}?page=${page || 1}&limit=${limit || 10}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

app.get('/api/lists/:list_id/:value', async (req, res) => {
    try {
        const safeValue = encodeURIComponent(req.params.value);
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/${req.params.list_id}/${safeValue}`, { 
            headers: getHeaders(req) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

app.delete('/api/lists/:list_id/:value', async (req, res) => {
    try {
        const safeValue = encodeURIComponent(req.params.value);
        const response = await fetch(`http://127.0.0.1:3015/api/v1/lists/${req.params.list_id}/${safeValue}`, { 
            method: 'DELETE', headers: getHeaders(req) 
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ error: 'Motor de listas no disponible' }); }
});

// ==========================================
// 🌐 11. MANEJO DE RUTAS ESTÁTICAS / WILDCARD
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(reactAppPath)) res.sendFile(reactAppPath);
    else res.send("🚀 Proxy de PowerControl activo.");
});

app.listen(PORT, () => console.log(`🚀 PowerControl Proxy Seguro en ejecución en el puerto: ${PORT}`));