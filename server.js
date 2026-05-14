const express = require('express');
const path = require('path');
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// PROXY DE ALERTAS
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

// DETALLE DE ALERTA
app.get('/api/alerts/:id', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// PAYLOAD
app.get('/api/alerts/:id/payload', async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/payload`, { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// ENVIAR REVISIÓN
app.patch('/api/alerts/:id/review', express.json(), async (req, res) => {
    try {
        const response = await fetch(`http://127.0.0.1:3015/api/v1/alerts/${req.params.id}/review`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'pc-antifraude-local-key-2026' },
            body: JSON.stringify(req.body)
        });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

// RESOLVER CASO
app.patch('/api/cases/:id/resolve', express.json(), async (req, res) => {
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
        const resOpen = await fetch('http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=100', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        const dataOpen = await resOpen.json();

        const resFraud = await fetch('http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=1', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        const dataFraud = await resFraud.json();

        const dineroRiesgo = dataOpen.data.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
        const totalAlertas = dataOpen.pagination.totalItems;
        const casosCriticos = dataFraud.pagination.totalItems;

        res.json({
            alertas_abiertas: totalAlertas,
            dinero_en_riesgo: dineroRiesgo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            efectividad: totalAlertas > 0 ? (100 - (casosCriticos / totalAlertas * 100)).toFixed(1) + "%" : "100%",
            casos_criticos: casosCriticos
        });
    } catch (e) {
        res.status(500).json({ error: 'No se pudo conectar con el motor' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.listen(PORT, () => console.log(`🚀 PowerControl Dashboard en: http://localhost:${PORT}`));