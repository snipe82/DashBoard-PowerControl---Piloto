const express = require('express');
const path = require('path');
const app = express();
const PORT = 4521;

// 1. Le decimos que sirva los archivos estáticos de React (que luego meteremos en "public")
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/* ... AQUÍ VAN TODAS TUS RUTAS DE LA API INTACTAS ...
 app.get('/api/alerts', ...)
 app.get('/api/stats/summary', ...)
*/

// 2. 🚀 EL CAMBIO MAGISTRAL: 
// Cualquier ruta que no sea de la API (/api/...), se la mandamos a React para que él maneje la navegación
// Usamos app.use general para atrapar cualquier ruta no definida y enviarla a React
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 PowerControl Backend/Proxy en puerto: ${PORT}`));