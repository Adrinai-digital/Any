document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Script cargado correctamente");

    // 👤 Recuperar el ID del usuario y acto seguido su progreso guardado de vídeos
    obtenerUsuarioId().then(id => {
        usuarioId = id;
        console.log("👤 ID de usuario recuperado para los videos:", usuarioId);
        if (usuarioId) {
            cargarProgresoVideos(); // 🌟 Evita que el estado vuelva a "no completado" al refrescar
        }
    });

    document.querySelectorAll('.plan-selector').forEach(select => {
        select.addEventListener('change', function () {
            const box     = this.closest('.box');
            const opt     = this.options[this.selectedIndex];
            const precio  = opt.getAttribute('data-precio');   // "20" o "30"
            const priceId = opt.value;                         // price_xxx

            // Refresca el texto del precio (sirve si la clase es .Precio o .precio)
            const pPrecio = box.querySelector('.Precio') || box.querySelector('.precio');
            if (pPrecio) pPrecio.textContent = `${precio}€`;

            // Actualiza el botón para que leerDatosElemento obtenga el priceId correcto
            const btn = box.querySelector('.agregar-carrito');
            if (btn) btn.setAttribute('data-price-id', priceId);
        });
    });

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
        if (!lista) return; // Seguridad si el elemento no está en el DOM actual
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
                amount: item.cantidad
            }));
    
            const totalPago = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    
            const payload = {
                productos,
                total: Math.round(totalPago * 100),
                userEmail: data.usuario.email
            };
    
            console.log('📦 Enviando datos a /crear-checkout:', payload);
    
            return fetch('/crear-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        })
        .then(async response => {
            if (!response || typeof response.headers?.get !== 'function') {
                throw new Error("Respuesta inválida del servidor");
            }
    
            const contentType = response.headers.get("content-type");
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Error inesperado (no 200):", errorText);
                throw new Error("No se pudo procesar el pago.");
            }
    
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("❌ La respuesta no es JSON:", text);
                throw new Error("La respuesta del servidor no es válida.");
            }
    
            const data = await response.json();
    
            if (!data || !data.url) {
                console.error("⚠️ Respuesta inesperada:", data);
                throw new Error("No se recibió una URL válida de Stripe.");
            }
    
            window.location.href = data.url;
        })
        .catch(error => {
            console.error('⚠️ Error en procesarPago():', error.message);
            alert("Hubo un problema con el pago. Inténtalo de nuevo.");
        });
    }

    cargarEventListeners();
});

/* ================= LÓGICA DE VIDEOS Y PROGRESO ================= */
let usuarioId = null;
let players = []; // Array para los reproductores de YouTube

// 🌟 Función para consultar y pintar las lecciones completadas desde la Base de Datos
async function cargarProgresoVideos() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/lecciones-completadas', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const leccionesVistas = data.completados || [];
            
            // Recorremos los IDs completados y cambiamos las etiquetas en el DOM
            leccionesVistas.forEach(videoId => {
                const estado = document.getElementById(`status-${videoId}`);
                if (estado) {
                    estado.textContent = 'Completado';
                    estado.classList.remove("not-completed");
                    estado.classList.add("completed");
                }
            });
        }
    } catch (error) {
        console.error("❌ Error cargando el progreso de los vídeos:", error);
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
        return data.usuario.id;
    } catch (err) {
        console.error("Error obteniendo usuarioId:", err);
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
            console.error('❌ Error al marcar el video como completado:', data);
        }
    })
    .catch(error => {
        console.error('❌ Error al marcar el video como completado:', error);
    });
}

// Llamar automáticamente cuando la API de YouTube Iframe esté lista
function onYouTubeIframeAPIReady() {
    const videoContainers = document.querySelectorAll('.lesson-video');
    videoContainers.forEach((container, index) => {
        const videoId = container.dataset.videoId;
        const cursoId = container.dataset.cursoId;

        const playerDiv = document.createElement('div');
        const divId = `Youtubeer-${index}`;
        playerDiv.id = divId;
        container.appendChild(playerDiv);

        players[index] = new YT.Player(divId, {
            height: "315",
            width: "560",
            videoId: videoId,
            events: {
                'onStateChange': function (event) {
                    if (event.data === YT.PlayerState.ENDED && usuarioId) {
                        marcarComoCompletado(videoId, cursoId);
                    }
                }
            }
        });
    });
}