const express = require('express');
const path = require('path');
const fs = require('fs'); // 🚀 Validar la existencia del HTML
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ==========================================
// 1. RUTAS DE LA API (DEBEN IR PRIMERO)
// ==========================================

// PROXY DE ALERTAS TRADICIONAL
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

// BUSQUEDA ESPECÍFICA POR DNI
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

// OBTENER LISTADO AGRUPADO POR ENTIDADES
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

// OBTENER EL DETALLE COMPLETO DE UNA ENTIDAD POR UUID
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

// PROXY ENVIAR REVISIÓN MASIVA POR ENTIDAD
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

// DETALLE ATÓMICO DE ALERTA INDIVIDUAL
app.get('/api/alerts/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// PAYLOAD INDIVIDUAL
app.get('/api/alerts/:id/payload', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/payload`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// ======================================================================================
// 🚀 NUEVO ENDPOINT: PROXY DE LÍNEA DE TIEMPO DE AUDITORÍA UNIFICADA POR CLIENTE (CUSTOMER)
// ======================================================================================
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

// ENVIAR REVISIÓN INDIVIDUAL
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

// RESOLVER CASO TRADICIONAL
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

// ESTADÍSTICAS DEL DASHBOARD
app.get('/api/stats/summary', async (req, res) => {
    try {
        const headers = { 'X-API-Key': 'pc-antifraude-local-key-2026' };

        const [resO, resR, resF, resS, resD, resAR] = await Promise.all([
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=100', { headers }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=IN_REVIEW&pageSize=100', { headers }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=100', { headers }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=SUSPICIOUS&pageSize=100', { headers }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=DISCARDED&pageSize=100', { headers }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=ADDITIONAL_REVIEW&pageSize=100', { headers })
        ]);

        const [dataO, dataR, dataF, dataS, dataD, dataAR] = await Promise.all([
            resO.json(), resR.json(), resF.json(), resS.json(), resD.json(), resAR.json()
        ]);

        const abiertas = dataO.data || [];
        const enRevision = dataR.data || [];
        const fraudes = dataF.data || [];
        const sospechosos = dataS.data || [];
        const descartadas = dataD.data || [];
        const enRevisionAdicional = dataAR.data || [];

        const activas = [...abiertas, ...enRevision, ...enRevisionAdicional];
        const riesgoCritico = [...sospechosos, ...fraudes];
        const globales = [...abiertas, ...enRevision, ...enRevisionAdicional, ...fraudes, ...sospechosos, ...descartadas];

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

        const totalAlertas = dataO.pagination ? dataO.pagination.totalItems : abiertas.length;
        const casosCriticos = dataF.pagination ? dataF.pagination.totalItems : fraudes.length;

        const procesarTop5 = (arreglo) => {
            const conteo = {};
            let total = 0;
            arreglo.forEach(al => {
                if (al.codigoregla) {
                    const nombre = `${al.codigoregla} - ${al.regla || 'Desconocida'}`;
                    conteo[nombre] = (conteo[nombre] || 0) + 1;
                    total++;
                }
            });
            return Object.entries(conteo)
                .map(([nombre, quantity]) => ({
                    nombre,
                    quantity,
                    porcentaje: total > 0 ? Math.round((quantity / total) * 100) : 0
                }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
        };

        res.json({
            alertas_abiertas: totalAlertas,
            dinero_en_riesgo: dineroRiesgoNeto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            efectividad: totalAlertas > 0 ? (100 - (casosCriticos / (totalAlertas + casosCriticos) * 100)).toFixed(1) + "%" : "100%",
            casos_criticos: casosCriticos,
            top_rules_activas: procesarTop5(activas),
            top_rules_riesgo: procesarTop5(riesgoCritico),
            top_rules_globales: procesarTop5(globales)
        });
    } catch (e) {
        console.error("Error en /api/stats/summary:", e);
        res.status(500).json({ error: 'Error en el proxy' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

// ==========================================
// 2. FALLBACK DE RUTAS (SIEMPRE AL FINAL)
// ==========================================
app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(reactAppPath)) {
        res.sendFile(reactAppPath);
    } else {
        res.send("🚀 Proxy de PowerControl activo. El Frontend aún no se ha fusionado.");
    }
});

app.listen(PORT, () => console.log(`🚀 PowerControl Pasarela/Proxy en puerto: ${PORT}`));