document.addEventListener("DOMContentLoaded", async function () {
    console.log("✅ Script cargado correctamente");

    // ==========================================
    // 1. SELECTORES DE PLANES Y PRECIOS
    // ==========================================
    document.querySelectorAll('.plan-selector').forEach(select => {
        select.addEventListener('change', function () {
            const box     = this.closest('.box');
            const opt     = this.options[this.selectedIndex];
            const precio  = opt.getAttribute('data-precio');   // "20" o "30"
            const priceId = opt.value;                         // price_xxx

            const pPrecio = box.querySelector('.Precio') || box.querySelector('.precio');
            if (pPrecio) pPrecio.textContent = `${precio}€`;

            const btn = box.querySelector('.agregar-carrito');
            if (btn) btn.setAttribute('data-price-id', priceId);
        });
    });

    // ==========================================
    // 2. LÓGICA DEL CARRITO DE COMPRAS
    // ==========================================
    let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    let total = 0;

    const carritoContainer = document.getElementById('carrito');
    const elementos = document.getElementById('lista-1');
    const lista = document.querySelector('#lista-carrito tbody');
    const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
    const totalElement = document.getElementById('total');
    const btnPagar = document.getElementById('btn-pagar');

    function cargarEventListeners() {
        if (elementos) elementos.addEventListener('click', comprarElemento);
        if (carritoContainer) carritoContainer.addEventListener('click', eliminarElemento);
        if (vaciarCarritoBtn) vaciarCarritoBtn.addEventListener('click', vaciarCarrito);
        if (btnPagar) btnPagar.addEventListener('click', procesarPago);
        actualizarCarritoUI();
    }

    function comprarElemento(e) {
        e.preventDefault();
        if (e.target.classList.contains('agregar-carrito')) {
            const elemento = e.target.closest('.box');
            leerDatosElemento(elemento);
        }
    }

    function leerDatosElemento(elemento) {
        const precioTexto = elemento.querySelector('.Precio, .precio')?.textContent.trim();
        if (!precioTexto) {
            console.error("❌ No se pudo obtener el precio del elemento.");
            return;
        }

        const precio = parseFloat(precioTexto.replace(/[^\d.-]/g, '').replace(',', '.'));
        if (isNaN(precio)) {
            console.error("❌ El precio no es un número válido:", precioTexto);
            return;
        }
        const priceId = elemento.querySelector('.agregar-carrito')?.getAttribute('data-price-id');
        const infoElemento = {
            imagen: elemento.querySelector('img').src,
            titulo: elemento.querySelector('h3').textContent.trim(),
            precio: precio,
            id: elemento.querySelector('a').getAttribute('data-id'),
            priceId: priceId,
            cantidad: 1
        };

        if ((!infoElemento.priceId || infoElemento.priceId === '') && infoElemento.precio > 0) {
            console.error("⚠️ El producto de pago no tiene un priceId válido de Stripe");
            return;
        }

        agregarAlCarrito(infoElemento);
    }

    function agregarAlCarrito(nuevoElemento) {
        const existe = carrito.find(item => item.id === nuevoElemento.id && item.priceId === nuevoElemento.priceId);
        if (existe) {
            existe.cantidad++;
        } else {
            carrito.push(nuevoElemento);
        }
        actualizarCarritoUI();
    }

    function actualizarCarritoUI() {
        if (!lista) return;
        lista.innerHTML = "";

        carrito.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${item.imagen}" style="width:100px;"></td>
                <td>${item.titulo}</td>
                <td>${item.precio.toFixed(2)}€</td>
                <td>${item.cantidad}</td>
                <td><a href="#" class="borrar" data-id="${item.id}" data-price-id="${item.priceId}">X</a></td>`;
            lista.appendChild(row);
        });

        actualizarTotal();
        actualizarContadorCarrito();
        guardarCarrito();
    }

    function eliminarElemento(e) {
        e.preventDefault();
        if (e.target.classList.contains('borrar')) {
            const idProducto = e.target.getAttribute('data-id');
            const priceId    = e.target.getAttribute('data-price-id');
            carrito = carrito.filter(item => !(item.id === idProducto && item.priceId === priceId));
            actualizarCarritoUI();
        }
    }

    function vaciarCarrito() {
        carrito = [];
        actualizarCarritoUI();
    }

    function actualizarTotal() {
        if (!totalElement) return;
        total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
        totalElement.textContent = `Total: ${total.toFixed(2)} €`;
    }

    function guardarCarrito() {
        localStorage.setItem('carrito', JSON.stringify(carrito));
    }

    function actualizarContadorCarrito() {
        const contador = document.getElementById('contador-carrito');
        if (!contador) return;
        const cantidadTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    
        if (cantidadTotal > 0) {
            contador.textContent = cantidadTotal;
            contador.style.display = 'inline-block';
        } else {
            contador.style.display = 'none';
        }
    }

    function procesarPago() {
        if (carrito.length === 0) {
            alert("🛒 Tu carrito está vacío.");
            return;
        }
    
        const token = localStorage.getItem('token');
        if (!token) {
            alert("❌ Necesitas estar logueado para realizar el pago.");
            window.location.href = '/formulario.html';
            return;
        }
    
        fetch('/perfil-data', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(async response => {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                alert('Debes iniciar sesión para completar la compra.');
                window.location.href = '/formulario.html';
                throw new Error('No autenticado');
            }
            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`No se pudo obtener el perfil del usuario: ${txt}`);
            }
            return response.json();
        })
        .then(async data => {
            if (!data || data.error || !data.usuario) throw new Error("Error al obtener el perfil del usuario");
    
            localStorage.setItem('userData', JSON.stringify(data.usuario));
    
            const productos = carrito.map(item => ({
                id: item.id,
                priceId: item.priceId,
                cantidad: item.cantidad
            }));
    
            const total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    
            const payload = {
                productos,
                total: Math.round(total * 100),
                userEmail: data.usuario.email,
                userId: data.usuario.id
            };
    
            console.log('📦 Enviando datos a /crear-checkout:', payload);
    
            return fetch('/crear-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        })
        .then(async response => {
            if (!response) throw new Error("Respuesta inválida del servidor");
            const contentType = response.headers.get("content-type");
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error("No se pudo procesar el pago.");
            }
    
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("La respuesta del servidor no es válida.");
            }
    
            const data = await response.json();
            if (!data || !data.url) throw new Error("No se recibió una URL válida de Stripe.");
    
            window.location.href = data.url;
        })
        .catch(error => {
            console.error('⚠️ Error en procesarPago():', error.message);
            if (error.message !== 'No autenticado') {
                alert("Hubo un problema con el pago. Inténtalo de nuevo.");
            }
        });
    }

    // Inicializar listeners del carrito
    cargarEventListeners();

    // ==========================================
    // 3. LÓGICA DE REPRODUCTORES DE VÍDEO (HTML5)
    // ==========================================
    // Cargar ID de usuario global de forma asíncrona dentro del DOMContentLoaded
    window.usuarioId = await obtenerUsuarioId();

    const videosNativos = document.querySelectorAll('.video-container video');
    videosNativos.forEach((video, index) => {
        video.addEventListener('ended', () => {
            // Pasamos parámetros genéricos (puedes ajustar el ID según tu HTML)
            marcarComoCompletado(`video-nativo-${index}`, video.dataset.cursoId || '1');
        });
        verificarEstadoCompletado(video, index);
    });
    try {
        await cargarProgresoUsuario();
    } catch (e) {
        console.error("⚠️ No se pudo cargar el progreso de forma síncrona, reintentando...", e);
        // Si falla por culpa de la carga de otros scripts, lo reintentamos de forma asíncrona un milisegundo después
        setTimeout(() => {
            cargarProgresoUsuario().catch(err => console.error("Error definitivo:", err));
        }, 100);
    }
});

// ==========================================
// FUNCTIONS GLOBALES (Fuera de DOMContentLoaded)
// ==========================================

function verificarEstadoCompletado(video, index) {
    const videoCompletado = false; // Implementar lógica con DB o localStorage si se requiere
    if (videoCompletado) {
        video.classList.add('completado');
    }
}

async function obtenerUsuarioId() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        const response = await fetch('/perfil-data', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.usuario?.id || null;
    } catch (e) {
        return null;
    }
}

function marcarComoCompletado(videoId, cursoId) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('❌ No se encontró token');
        return;
    }

    fetch('/marcar-completado', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            video_id: videoId,
            curso_id: cursoId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.message) {
            console.log('✅ Video marcado como completado:', data);
            const estado = document.getElementById(`status-${videoId}`);
            if (estado) {
                estado.textContent = 'Completado';
                estado.classList.remove("not-completed");
                estado.classList.add("completed");
            }
        } else {
            console.error('❌ Error al marcar el video:', data);
        }
    })
    .catch(error => {
        console.error('❌ Error en petición marcar-completado:', error);
    });
}

// Global para almacenar los reproductores de YouTube
let players = {};

// Esta función DEBE ser global para que la API de YouTube la encuentre
// Agrega estas variables globales arriba en tu script.js (fuera de las funciones)
let playerActivo = null;
let idContenedorActivo = null;

function onYouTubeIframeAPIReady() {
    const videoContainers = document.querySelectorAll('.lesson-video');
    
    videoContainers.forEach((container, index) => {
        const videoId = container.dataset.videoId;
        const cursoId = container.dataset.cursoId;
        const divId = `Youtubeer-${index}`;

        if (!videoId) return;

        // 1. En lugar de crear el reproductor, metemos un diseño de portada falsa con el ID del video
        container.innerHTML = `
            <div class="video-placeholder" id="placeholder-${divId}" style="position:relative; width:100%; height:315px; background: #1a1a1a url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg') center center / cover no-repeat; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:8px;">
                <div class="play-button-icon" style="width: 70px; height: 70px; background: rgba(255, 0, 0, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>
        `;

        // 2. Al hacer clic en la portada, se monta el reproductor real
        container.querySelector('.video-placeholder').addEventListener('click', () => {
            cargarVideoOnDemand(container, divId, videoId, cursoId);
        });
    });
}

// Función auxiliar encargada de gestionar el ciclo de vida del reproductor único
function cargarVideoOnDemand(container, divId, videoId, cursoId) {
    // Si ya hay un reproductor reproduciéndose en OTRA lección, lo destruimos para liberar WebGL
    if (playerActivo && typeof playerActivo.destroy === 'function') {
        try {
            playerActivo.destroy();
            
            // Restauramos la portada del vídeo anterior que se acaba de cerrar
            const contenedorAnterior = document.getElementById(idContenedorActivo);
            if (contenedorAnterior) {
                const videoIdAnterior = contenedorAnterior.dataset.videoId;
                const cursoIdAnterior = contenedorAnterior.dataset.cursoId;
                
                contenedorAnterior.innerHTML = `
                    <div class="video-placeholder" id="placeholder-${idContenedorActivo}" style="position:relative; width:100%; height:315px; background: #1a1a1a url('https://img.youtube.com/vi/${videoIdAnterior}/hqdefault.jpg') center center / cover no-repeat; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:8px;">
                        <div class="play-button-icon" style="width: 70px; height: 70px; background: rgba(255, 0, 0, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                `;
                // Volvemos a escuchar el clic por si el usuario decide regresar a este vídeo
                contenedorAnterior.querySelector('.video-placeholder').addEventListener('click', () => {
                    cargarVideoOnDemand(contenedorAnterior, idContenedorActivo, videoIdAnterior, cursoIdAnterior);
                });
            }
        } catch (e) {
            console.warn("Aviso al limpiar memoria del player anterior:", e);
        }
    }

    // Guardamos qué contenedor aloja el vídeo actual
    idContenedorActivo = container.id || divId;
    if (!container.id) {
        container.id = divId; // Forzamos un ID al contenedor padre si no lo tuviera
    }

    // Creamos el div interno que YouTube va a transformar en un <iframe>
    container.innerHTML = `<div id="${divId}"></div>`;

    // Inicializamos el objeto de YouTube únicamente para este elemento
    playerActivo = new YT.Player(divId, {
        height: "315",
        width: "100%", // Usar 100% lo hace responsivo y se adapta mejor a tu contenedor css
        videoId: videoId,
        playerVars: {
            'autoplay': 1, // Se reproduce en automático tras la interacción del clic
            'enablejsapi': 1,
            'origin': window.location.origin
        },
        events: {
            'onStateChange': function (event) {
                if (event.data === YT.PlayerState.ENDED) {
                    marcarComoCompletado(videoId, cursoId);
                }
            }
        }
    });
}