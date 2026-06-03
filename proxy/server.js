const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ==========================================
// 1. RUTAS DE LA API
// ==========================================

app.get('/api/alerts', async (req, res) => {
    const { status, page, pageSize, dateFrom, dateTo } = req.query;
    let backendUrl = `http://127.0.0.1:3015/api/v1/alerts?status=${status}&page=${page}&pageSize=${pageSize}`;

    if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
    if (dateTo) backendUrl += `&dateTo=${dateTo}`;

    try {
        const response = await fetch(backendUrl, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        res.status(503).json({ error: 'Motor no disponible' });
    }
});

app.get('/api/alerts/dni/:dni', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/dni/${req.params.dni}`, {
            headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' }
        });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        console.error(`Error buscando DNI ${req.params.dni}:`, error);
        res.status(503).json({ error: 'Motor no disponible o DNI no encontrado' });
    }
});

app.get('/api/alerts/grouped', async (req, res) => {
    try {
        const { status, page, pageSize, dateFrom, dateTo, search } = req.query;
        let backendUrl = `http://127.0.0.1:3015/api/v1/alerts/grouped?status=${status}&page=${page}&pageSize=${pageSize}`;

        if (dateFrom) backendUrl += `&dateFrom=${dateFrom}`;
        if (dateTo) backendUrl += `&dateTo=${dateTo}`;
        if (search) backendUrl += `&search=${search}`;

        const response = await fetch(backendUrl, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        res.status(503).json({ error: 'Motor no disponible' });
    }
});

app.get('/api/alerts/entity/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}`, {
            headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' }
        });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        console.error("Error en proxy /api/alerts/entity/:id:", error);
        res.status(500).json({ error: "Error obteniendo entidad" });
    }
});

app.patch('/api/alerts/entity/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/entity/${req.params.id}/review`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'pc-antifraude-local-key-2026'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        console.error(`Error en revisión masiva para entidad ${req.params.id}:`, error);
        res.status(500).json({ error: "Error al procesar la revisión en lote" });
    }
});

app.get('/api/alerts/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/alerts/:id/payload', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/payload`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.patch('/api/alerts/:id/review', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/review`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'pc-antifraude-local-key-2026' },
            body: JSON.stringify(req.body)
        });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.patch('/api/cases/:id/resolve', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/cases/${req.params.id}/resolve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'pc-antifraude-local-key-2026' },
            body: JSON.stringify(req.body)
        });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/v1/alerts/customer/:customer_id/audit', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/customer/${req.params.customer_id}/audit`, {
            headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' }
        });
        if (!response.ok) throw new Error("Status " + response.status);
        res.json(await response.json());
    } catch (error) {
        console.error(`Error en proxy de auditoría de cliente para ${req.params.customer_id}:`, error);
        res.status(503).json({ error: 'Motor de auditoría de cliente no disponible' });
    }
});

// ESTADÍSTICAS DEL DASHBOARD
app.get('/api/stats/summary', async (req, res) => {
    try {
        const headers = { 'X-API-Key': 'pc-antifraude-local-key-2026' };

        const fetchSafe = async (url) => {
            try {
                const r = await fetch(url, { headers });
                if (!r.ok) return [];
                const d = await r.json();
                return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
            } catch (err) {
                console.error(`⚠️ Timeout o micro-corte evitado en: ${url.split('status=')[1]}`);
                return []; 
            }
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

            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                globalesMesActual.push(al);
            } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
                globalesMesAnterior.push(al);
            }
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

        const countUniqueClients = (arr) => {
            const uniqueClients = new Set();
            arr.forEach(al => {
                const id = al.customer_id || al.customerId || al.codigo_entidad || al.dni || al.document_number || al.cliente || al.alert_id;
                if (id) uniqueClients.add(id);
            });
            return uniqueClients.size;
        };

        const totalAlertas = countUniqueClients(abiertas);
        const casosCriticos = countUniqueClients(fraudes);
        const casosEnRevision = countUniqueClients([...enRevision, ...enRevisionAdicional]);
        const casosRevisados = countUniqueClients([...fraudes, ...sospechosos, ...descartadas]);

        // 🚀 NUEVA LÓGICA: Calcula el TOP 10 general
        const procesarTop10 = (arreglo) => {
            const conteo = {};
            let totalValidas = 0;
            const uniqueClientsPanel = new Set();

            arreglo.forEach(al => {
                const id = al.customer_id || al.customerId || al.codigo_entidad || al.dni || al.document_number || al.cliente || al.alert_id;
                if (id) uniqueClientsPanel.add(id);

                if (al.codigoregla) {
                    const nombre = `${al.codigoregla} - ${al.regla || 'Desconocida'}`;
                    conteo[nombre] = (conteo[nombre] || 0) + 1;
                    totalValidas++;
                }
            });

            const top = Object.entries(conteo)
                .map(([nombre, quantity]) => ({ nombre, quantity, porcentaje: totalValidas > 0 ? Math.round((quantity / totalValidas) * 100) : 0 }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10); // 🚀 AQUÍ APLICAMOS EL CORTE A 10 REGLAS

            return {
                top,
                totalAlertas: arreglo.length, 
                clientesImpactados: uniqueClientsPanel.size
            };
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
        console.error("Error general en /api/stats/summary:", e);
        res.status(500).json({ error: 'Error procesando estadísticas' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(reactAppPath)) {
        res.sendFile(reactAppPath);
    } else {
        res.send("🚀 Proxy de PowerControl activo.");
    }
});

app.listen(PORT, () => console.log(`🚀 PowerControl Backend/Proxy Seguro en puerto: ${PORT}`));