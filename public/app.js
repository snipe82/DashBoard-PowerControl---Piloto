const API_BASE_URL = '/api';
let estadoActual = 'OPEN';
let alertaSeleccionada = null;
let datosOriginales = [];
let paginaActual = 1;
let totalPaginas = 1;

document.addEventListener('DOMContentLoaded', () => {
    mostrarDashboard();
    const inputPag = document.getElementById('input-pagina-actual');
    if (inputPag) {
        inputPag.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const valor = parseInt(inputPag.value);
                if (valor >= 1 && valor <= totalPaginas) {
                    paginaActual = valor;
                    cargarAlertas(estadoActual);
                }
            }
        });
    }
});

window.mostrarDashboard = async function () {
    document.getElementById('contenedor-dashboard').style.display = 'block';
    document.getElementById('contenedor-tablas').style.display = 'none';

    const f = document.getElementById('controles-fechas');
    const b = document.getElementById('controles-busqueda');
    if (f) { f.style.display = 'none'; f.classList.remove('flex'); }
    if (b) { b.style.display = 'none'; }

    document.getElementById('vista-titulo').innerText = "Resumen Ejecutivo de Operaciones";
    actualizarMenuActivo('nav-DASHBOARD');
    renderizarStatsPrueba();
};

async function renderizarStatsPrueba() {
    let stats = { alertas_abiertas: 0, dinero_en_riesgo: "0.00", efectividad: "100%", casos_criticos: 0 };
    try {
        const res = await fetch('/api/stats/summary');
        if (res.ok) stats = await res.json();
    } catch (e) { console.warn("API de stats no disponible"); }

    const grid = document.getElementById('stats-grid');
    if (grid) {
        grid.innerHTML = `
            ${crearTarjetaStat("Pendientes", stats.alertas_abiertas, "bg-blue-500", "🚨")}
            ${crearTarjetaStat("En Riesgo", "S/ " + stats.dinero_en_riesgo, "bg-red-500", "💰")}
            ${crearTarjetaStat("Efectividad", stats.efectividad, "bg-green-500", "🎯")}
            ${crearTarjetaStat("Críticos", stats.casos_criticos, "bg-power-purple", "🔥")}
        `;
    }
    renderizarGraficoReglas();
}

window.cambiarBandeja = function (status, titulo) {
    document.getElementById('contenedor-dashboard').style.display = 'none';
    document.getElementById('contenedor-tablas').style.display = 'block';

    const f = document.getElementById('controles-fechas');
    const b = document.getElementById('controles-busqueda');
    if (f) { f.style.display = 'flex'; f.classList.remove('hidden'); }
    if (b) { b.style.display = 'block'; b.classList.remove('hidden'); }

    estadoActual = status;
    paginaActual = 1;
    document.getElementById('vista-titulo').innerText = titulo;

    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    document.getElementById('buscar-dni').value = '';

    actualizarMenuActivo(`nav-${status}`);
    cargarAlertas(status);
};

window.aplicarFiltros = () => { paginaActual = 1; cargarAlertas(estadoActual); };

window.filtrarEnTabla = () => {
    const busqueda = document.getElementById('buscar-dni').value.toLowerCase();
    if (!busqueda) { renderizarTabla(datosOriginales); return; }
    renderizarTabla(datosOriginales.filter(a => (a.dni?.includes(busqueda)) || (a.cliente?.toLowerCase().includes(busqueda))));
};

async function cargarAlertas(status) {
    const tbody = document.getElementById('tabla-alertas');
    const desde = document.getElementById('filtro-fecha-desde').value;
    const hasta = document.getElementById('filtro-fecha-hasta').value;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-gray-400 font-bold italic">Consultando motor...</td></tr>';
    document.getElementById('paginacion-container').classList.add('hidden');

    try {
        let url = `${API_BASE_URL}/alerts?status=${status}&page=${paginaActual}&pageSize=20`;
        if (desde) url += `&dateFrom=${desde}`;
        if (hasta) url += `&dateTo=${hasta}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Fallo en la red");
        const json = await response.json();

        datosOriginales = json.data || [];
        renderizarTabla(datosOriginales);

        if (json.pagination && json.pagination.totalItems > 0) {
            document.getElementById('paginacion-container').classList.remove('hidden');
            renderizarPaginacion(json.pagination);
        }

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500 font-bold">Error al procesar datos del servidor.</td></tr>`;
    }
}

function renderizarTabla(alertas) {
    const tbody = document.getElementById('tabla-alertas');
    tbody.innerHTML = '';
    if (!alertas || alertas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-gray-500 italic">No se encontraron alertas en esta bandeja.</td></tr>';
        return;
    }
    alertas.forEach(alerta => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 text-gray-500">${new Date(alerta.fecha).toLocaleString()}</td>
            <td class="px-6 py-4 font-bold text-gray-800">${alerta.cliente}<br><span class="text-[10px] text-gray-400 font-normal">DNI: ${alerta.dni}</span></td>
            <td class="px-6 py-4"><span class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">${alerta.codigoregla}</span></td>
            <td class="px-6 py-4">${alerta.tienda}</td>
            <td class="px-6 py-4 font-black">S/ ${alerta.monto}</td>
            <td class="px-6 py-4 text-right"><button onclick="abrirRevision('${alerta.alert_id}')" class="text-power-purple font-bold hover:underline">Revisar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarPaginacion(pagData) {
    totalPaginas = pagData.totalPages || 1;
    paginaActual = pagData.currentPage || 1;

    document.getElementById('page-info').innerText = `${((paginaActual - 1) * pagData.pageSize) + 1} a ${Math.min(paginaActual * pagData.pageSize, pagData.totalItems)} de ${pagData.totalItems}`;
    document.getElementById('input-pagina-actual').value = paginaActual;
    document.getElementById('total-paginas-display').innerText = totalPaginas;

    document.getElementById('btn-prev-page').disabled = (paginaActual <= 1);
    document.getElementById('btn-next-page').disabled = (paginaActual >= totalPaginas);
}

window.cambiarPagina = (dir) => {
    const n = paginaActual + dir;
    if (n >= 1 && n <= totalPaginas) { paginaActual = n; cargarAlertas(estadoActual); }
};

window.abrirRevision = async function (alertId) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const infoDiv = document.getElementById('drawer-info');

    const btnSubmit = document.getElementById('btn-submit-review');
    const selectStatus = document.getElementById('form-status');
    const commentBox = document.getElementById('form-comment');
    const titleStatus = document.getElementById('drawer-title-action');

    drawer.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    infoDiv.innerHTML = '<p class="text-center py-10 text-gray-400 italic">Cargando datos del cliente...</p>';

    try {
        const [resDetalle, resPayload] = await Promise.all([
            fetch(`/api/alerts/${alertId}`),
            fetch(`/api/alerts/${alertId}/payload`)
        ]);

        alertaSeleccionada = await resDetalle.json();
        const payload = await resPayload.json();

        const celular = payload.telephonenumber || payload.phone || payload.customer?.phone || payload.mobile || "No registrado";
        const dni = alertaSeleccionada.dni || "No disponible";

        commentBox.value = alertaSeleccionada.review_comment || '';

        if (estadoActual === 'DISCARDED') {
            titleStatus.innerText = "ALERTA FINALIZADA (Lectura)";
            selectStatus.innerHTML = `<option value="DISCARDED">Ya Descartada</option>`;
            selectStatus.disabled = true; commentBox.disabled = true; btnSubmit.style.display = 'none';
        } else {
            titleStatus.innerText = "ACCIONES DISPONIBLES";
            selectStatus.disabled = false; commentBox.disabled = false; btnSubmit.style.display = 'block';
            if (estadoActual === 'FRAUD' || estadoActual === 'SUSPICIOUS') {
                selectStatus.innerHTML = '<option value="CLOSED_CONFIRMED_FRAUD">Confirmar Fraude</option><option value="CLOSED_FALSE_POSITIVE">Falso Positivo</option>';
            } else {
                selectStatus.innerHTML = `<option value="IN_REVIEW" ${alertaSeleccionada.status === 'IN_REVIEW' ? 'selected' : ''}>En Revisión</option><option value="DISCARDED">Descartar</option><option value="SUSPICIOUS">Sospechoso</option><option value="FRAUD">Fraude</option>`;
            }
        }

        const veredicto = alertaSeleccionada.reviewer_id ? `<div class="mt-4 bg-power-purple/5 p-4 rounded-xl border border-power-purple/20"><p class="text-[10px] font-black text-power-purple uppercase tracking-widest mb-2">Veredicto Anterior</p><p class="text-xs italic text-gray-700 bg-white p-2 rounded border mt-1 leading-relaxed">"${alertaSeleccionada.review_comment}"</p></div>` : '';

        infoDiv.innerHTML = `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-4 shadow-sm text-sm">
                <div class="col-span-2 border-b border-gray-200 pb-2 mb-2"><p class="text-[10px] text-gray-400 uppercase font-bold">Cliente</p><p class="text-base font-black text-gray-800">${alertaSeleccionada.cliente}</p></div>
                <div><p class="text-[10px] text-gray-400 uppercase font-bold">DNI</p><p class="font-bold">${dni}</p></div>
                <div><p class="text-[10px] text-gray-400 uppercase font-bold">Celular</p><p class="font-bold text-green-600">📱 ${celular}</p></div>
                <div><p class="text-[10px] text-gray-400 uppercase font-bold">Monto</p><p class="font-bold text-power-purple">S/ ${alertaSeleccionada.monto}</p></div>
                <div><p class="text-[10px] text-gray-400 uppercase font-bold">Tienda</p><p class="truncate font-bold">${alertaSeleccionada.tienda}</p></div>
                <div class="col-span-2"><p class="text-[10px] text-gray-400 uppercase font-bold">Regla</p><p class="text-xs font-mono text-red-500 font-bold">${alertaSeleccionada.codigoregla} - ${alertaSeleccionada.regla}</p></div>
            </div>
            ${veredicto}
            <div class="mt-6">
                <div class="flex justify-between items-center mb-2">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payload JSON</p>
                    <button onclick="copiarAlPortapapeles()" id="btn-copy" class="text-[10px] font-black text-power-purple flex items-center bg-power-purple/5 px-2 py-1 rounded border border-power-purple/10">Copiar</button>
                </div>
                <pre id="payload-text" class="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[10px] overflow-x-auto max-h-48 font-mono">${JSON.stringify(payload, null, 2)}</pre>
            </div>
        `;
    } catch (e) {
        infoDiv.innerHTML = '<p class="text-red-500 text-center">Error al cargar datos.</p>';
    }
}

window.enviarRevision = async function () {
    const statusVal = document.getElementById('form-status').value;
    const commentVal = document.getElementById('form-comment').value;
    if (!commentVal) return alert("Justificación requerida.");

    const esCaso = (estadoActual === 'FRAUD' || estadoActual === 'SUSPICIOUS');
    const url = esCaso ? `/api/cases/${alertaSeleccionada.case_id}/resolve` : `/api/alerts/${alertaSeleccionada.alert_id}/review`;

    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(esCaso ? { case_status: statusVal, reviewer_id: "analista@powerpay.pe", resolution_comment: commentVal } : { status: statusVal, reviewer_id: "analista@powerpay.pe", review_comment: commentVal, priority: "HIGH" })
        });
        if (res.ok) { alert("✅ Gestión guardada."); cerrarDrawer(); cargarAlertas(estadoActual); }
    } catch (e) { alert("Error al guardar."); }
};

window.cerrarDrawer = () => {
    document.getElementById('drawer').classList.add('translate-x-full');
    document.getElementById('drawer-overlay').classList.add('hidden');
};

window.copiarAlPortapapeles = () => {
    const texto = document.getElementById('payload-text').innerText;
    navigator.clipboard.writeText(texto).then(() => {
        const btn = document.getElementById('btn-copy');
        btn.innerText = '✅ ¡Copiado!';
        setTimeout(() => btn.innerText = 'Copiar', 2000);
    });
};

function crearTarjetaStat(titulo, valor, color, icono) {
    return `<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105"><div class="${color} p-3 rounded-lg text-white mr-4 text-xl shadow-lg">${icono}</div><div><p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${titulo}</p><p class="text-2xl font-black text-gray-800">${valor}</p></div></div>`;
}

function actualizarMenuActivo(navId) {
    document.querySelectorAll('#sidebar-nav a').forEach(l => l.className = "flex items-center justify-between px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors");
    const active = document.getElementById(navId);
    if (active) active.className = "flex items-center justify-between px-4 py-3 bg-power-purple bg-opacity-10 text-power-purple rounded-lg font-semibold border-l-4 border-power-purple transition-colors";
}

function renderizarGraficoReglas() {
    const contenedor = document.getElementById('grafico-reglas');
    const reglas = [{ nombre: "RP01 - Titular Diferente", p: 65, c: "bg-blue-500" }, { nombre: "RP34 - Multi-DNI", p: 40, c: "bg-power-purple" }, { nombre: "RP12 - Nocturna", p: 15, c: "bg-orange-500" }];
    contenedor.innerHTML = reglas.map(r => `<div class="text-xs mb-3"><div class="flex justify-between mb-1"><span>${r.nombre}</span><b>${r.p}%</b></div><div class="w-full bg-gray-100 h-1.5 rounded-full"><div class="${r.c} h-1.5 rounded-full" style="width: ${r.p}%"></div></div></div>`).join('');
}