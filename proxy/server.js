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

app.post('/api/alerts/:id/lock', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/lock`, {
            method: 'POST',
            headers: getHeaders(req)
        });
        const data = await response.json().catch(() => null);
        res.status(response.status).json(data);
    } catch (error) {
        res.status(502).json({ message: 'Error de pasarela al intentar adquirir llave de concurrencia.' });
    }
});

app.post('/api/alerts/:id/unlock', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/unlock`, {
            method: 'POST',
            headers: getHeaders(req)
        });
        const data = await response.json().catch(() => null);
        res.status(response.status).json(data);
    } catch (error) {
        res.status(502).json({ message: 'Error de pasarela al intentar liberar llave de concurrencia.' });
    }
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
// 👥 3. RUTAS DEL MÓDULO DE SEGURIDAD (USUARIOS)
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users`, { headers: getHeaders(req) });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'Servicio de usuarios no disponible.' }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users`, {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'No se pudo crear el usuario.' }); }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/${req.params.id}`, {
            method: 'PUT',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'No se pudo actualizar el usuario.' }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/auth/users/${req.params.id}`, {
            method: 'DELETE',
            headers: getHeaders(req)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(502).json({ message: 'No se pudo eliminar el usuario.' }); }
});

// ==========================================
// 🛠️ 4. RUTAS DEL MÓDULO DE ANÁLISIS (REGLAS V2)
// ==========================================
app.get('/api/v1/rules', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules`, { headers: getHeaders(req) });
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.post('/api/v1/rules', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules`, {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
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
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/test`, {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// ⚔️ El pasaporte del Linter del Diseñador SQL
app.post('/api/v1/rules/validate', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/validate`, {
            method: 'POST',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
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

app.put('/api/v1/rules/:ruleCode', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}`, {
            method: 'PUT',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

app.patch('/api/v1/rules/:ruleCode/activation', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/rules/${req.params.ruleCode}/activation`, {
            method: 'PATCH',
            headers: getHeaders(req),
            body: JSON.stringify(req.body)
        });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { res.status(503).json({ error: 'Motor no disponible' }); }
});

// ==========================================
// 🔎 5. NUEVO MÓDULO: BUSCADOR DE EVENTOS TRANSACCIONALES (CAJA NEGRA)
// ==========================================
app.get('/api/v1/events/search', async (req, res) => {
    try {
        const queryString = req.url.split('?')[1] || '';
        const response = await fetch(`http://127.0.0.1:3015/api/v1/events/search?${queryString}`, { 
            headers: getHeaders(req) 
        });
        
        if (response.status === 401) return res.status(401).json({ error: 'Token expirado' });
        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) { 
        res.status(503).json({ success: false, error: 'Servicio de eventos (caja negra) no disponible temporalmente.' }); 
    }
});

// ==========================================
// 📊 6. PROCESADOR DE ESTADÍSTICAS DEL DASHBOARD (REPOTENCIADO V4)
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

        // 🚀 SUBIMOS A 5000 EL LÍMITE PARA ALCANZAR LOS DATOS DE MAYO (MES ANTERIOR)
        const limit = 5000;
        const [abiertas, enRevision, fraudes, sospechosos, descartadas, enRevisionAdicional] = await Promise.all([
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=IN_REVIEW&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=SUSPICIOUS&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=DISCARDED&pageSize=${limit}`),
            fetchSafe(`http://127.0.0.1:3015/api/v1/alerts?status=ADDITIONAL_REVIEW&pageSize=${limit}`)
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

        // 🧠 EXTRACTOR DEFENSIVO DE FECHAS A PRUEBA DE BALAS
        const extractSafeDate = (al) => {
            let raw = al.fecha || al.fecha_creacion || al.created_at || al.dates?.utc;
            if (!raw) return null;

            // Si el backend envía formato "DD/MM/YYYY" (Ej: 15/05/2026), JS lo voltea. Lo forzamos a estándar ISO.
            if (typeof raw === 'string' && raw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                const parts = raw.split(/[\s/T:-]+/); 
                // parts[0]=DD, parts[1]=MM, parts[2]=YYYY
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

        const txProcesadasDashboard = new Set();
        let dineroRiesgoNeto = 0;

        activas.forEach(al => {
            const d = extractSafeDate(al);
            const fechaSinSegundos = d ? d.setSeconds(0, 0) : '0';
            
            const monto = al.monto || al.amount || al.payloads?.recepcion?.amount || 0;
            const txKey = al.transaction_id || al.application_id || al.operacion_id || al.payment_id || al.id_transaccion || `${fechaSinSegundos}_${monto}`;
            
            if (!txProcesadasDashboard.has(txKey)) {
                txProcesadasDashboard.add(txKey);
                dineroRiesgoNeto += parseFloat(monto || 0);
            }
        });

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
        const casosCriticos = countUniqueClients(fraudes);
        const casosEnRevision = countUniqueClients([...enRevision, ...enRevisionAdicional]);
        const casosRevisados = countUniqueClients([...fraudes, ...sospechosos, ...descartadas]);

        const procesarTop10 = (arreglo) => {
            const conteo = {};
            let totalValidas = 0;
            const uniqueClientsPanel = new Set();

            arreglo.forEach(al => {
                uniqueClientsPanel.add(resolveEntityId(al));
                
                // 🚀 AQUÍ ESTABA EL BLOQUEADOR. Ahora, si no hay código de regla, igual la suma como "SIN_CODIGO"
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
// 🌐 7. MANEJO DE RUTAS ESTÁTICAS / WILDCARD (SIEMPRE AL FINAL)
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(reactAppPath)) res.sendFile(reactAppPath);
    else res.send("🚀 Proxy de PowerControl activo.");
});

app.listen(PORT, () => console.log(`🚀 PowerControl Proxy Seguro en ejecución en el puerto: ${PORT}`));