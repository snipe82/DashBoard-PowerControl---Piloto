const express = require('express');
const path = require('path');
const fs = require('fs'); // 🚀 Agregado para validar la existencia del HTML
const app = express();
const PORT = 4521;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ==========================================
// 1. RUTAS DE LA API (DEBEN IR PRIMERO)
// ==========================================

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

// BUSQUEDA ESPECÍFICA POR DNI (CONECTADO AL NUEVO ENDPOINT DEL MOTOR)
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

// RESOLVER CASO
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

// ESTADÍSTICAS DEL DASHBOARD (ALERTAS EN GESTIÓN ACTIVA)
app.get('/api/stats/summary', async (req, res) => {
    try {
        // Peticiones para las tarjetas superiores
        const resOpen = await fetch('http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=100', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        const dataOpen = await resOpen.json();

        const resFraud = await fetch('http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=1', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } });
        const dataFraud = await resFraud.json();

        // Peticiones en paralelo para armar la gráfica de "Gestión Activa"
        const [resO, resR, resF] = await Promise.all([
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=OPEN&pageSize=100', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=IN_REVIEW&pageSize=100', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } }),
            fetch('http://127.0.0.1:3015/api/v1/alerts?status=FRAUD&pageSize=100', { headers: { 'X-API-Key': 'pc-antifraude-local-key-2026' } })
        ]);

        const [dataO, dataR, dataF] = await Promise.all([resO.json(), resR.json(), resF.json()]);

        // Unimos los datos para contar las reglas activas
        const alertasActivas = [
            ...(dataO.data || []),
            ...(dataR.data || []),
            ...(dataF.data || [])
        ];

        const dineroRiesgo = dataOpen.data ? dataOpen.data.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0) : 0;
        const totalAlertas = dataOpen.pagination ? dataOpen.pagination.totalItems : 0;
        const casosCriticos = dataFraud.pagination ? dataFraud.pagination.totalItems : 0;

        const conteoReglas = {};
        let totalReglas = 0;

        alertasActivas.forEach(alerta => {
            if (alerta.codigoregla) {
                const nombreRegla = `${alerta.codigoregla} - ${alerta.regla || 'Desconocida'}`;
                conteoReglas[nombreRegla] = (conteoReglas[nombreRegla] || 0) + 1;
                totalReglas++;
            }
        });

        const topRules = Object.entries(conteoReglas)
            .map(([nombre, quantity]) => ({
                nombre: nombre,
                porcentaje: totalReglas > 0 ? Math.round((quantity / totalReglas) * 100) : 0
            }))
            .sort((a, b) => b.porcentaje - a.porcentaje)
            .slice(0, 5);

        // Devolvemos el JSON limpio y esperado por React
        res.json({
            alertas_abiertas: totalAlertas,
            dinero_en_riesgo: dineroRiesgo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            efectividad: totalAlertas > 0 ? (100 - (casosCriticos / totalAlertas * 100)).toFixed(1) + "%" : "100%",
            casos_criticos: casosCriticos,
            top_rules: topRules
        });
    } catch (e) {
        console.error("Error en /api/stats/summary:", e);
        res.status(500).json({ error: 'No se pudo conectar con el motor' });
    }
});

// ==========================================
// 2. FALLBACK DE RUTAS (SIEMPRE AL FINAL)
// ==========================================
app.use((req, res) => {
    const reactAppPath = path.join(__dirname, 'public', 'index.html');

    // Si el HTML compilado ya existe, se envía (Producción)
    if (fs.existsSync(reactAppPath)) {
        res.sendFile(reactAppPath);
    } else {
        // Si no existe (Desarrollo), responde con texto plano amigable
        res.send("🚀 Proxy de PowerControl activo. El Frontend aún no se ha fusionado. Para ver la app, entra al puerto de Vite (ej. http://localhost:5173)");
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

app.listen(PORT, () => console.log(`🚀 PowerControl Backend/Proxy en puerto: ${PORT}`));