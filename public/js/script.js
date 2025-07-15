document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Script cargado correctamente");
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
        const existe = carrito.find(item =>item.id === nuevoElemento.id && item.priceId === nuevoElemento.priceId);
        if (existe) {
            existe.cantidad++;
        } else {
            carrito.push(nuevoElemento);
        }

        actualizarCarritoUI();
    }

    function actualizarCarritoUI() {
        lista.innerHTML = "";

        carrito.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${item.imagen}" style="width:100px;"></td>
                <td>${item.titulo}</td>
                <td>${item.precio.toFixed(2)}€</td>
                <td>${item.cantidad}</td>
               <td><a href="#" class="borrar"data-id="${item.id}"data-price-id="${item.priceId}">X</a></td>`;
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
           carrito = carrito.filter(item =>!(item.id === idProducto && item.priceId === priceId));
            actualizarCarritoUI();
        }
    }

    function vaciarCarrito() {
        carrito = [];
        actualizarCarritoUI();
    }

    function actualizarTotal() {
        total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
        totalElement.textContent = `Total: ${total.toFixed(2)} €`;
    }

    function guardarCarrito() {
        localStorage.setItem('carrito', JSON.stringify(carrito));
    }
    function actualizarContadorCarrito() {
        const contador = document.getElementById('contador-carrito');
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
        .then(response => {
            if (!response.ok) throw new Error("No se pudo obtener el perfil del usuario");
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
    
            if (total === 0) {
                // ✅ Agregar cursos gratuitos directamente con función autoejecutable
                (async () => {
                    for (const item of productos) {
                        try {
                            const response = await fetch('/agregar-al-carrito', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    cursoId: item.id
                                })
                            });
    
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`Error al agregar curso: ${errorText}`);
                            }
    
                            const responseData = await response.json();
                            console.log('✅ Curso agregado:', responseData);
    
                            window.location.href = responseData.redirectUrl;
                            return; // Redirige después del primer curso agregado
                        } catch (error) {
                            console.error('Error al agregar curso gratuito:', error);
                            alert('Error al agregar el curso gratuito al perfil');
                            return;
                        }
                    }
                })();
    
                return; // ✅ Evita continuar al flujo de Stripe
            }
    
            // 💳 Si hay total > 0, procede al pago con Stripe
            const payload = {
                productos,
                total: Math.round(total * 100),
                userEmail: data.usuario.email
            };
    
            console.log('📦 Enviando datos a /crear-checkout:', payload);
    
            return fetch('/crear-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
// Suponiendo que los videos están dentro de un contenedor con clase 'video-container'
// Asegúrate de tener un contenedor con todos los videos
const videos = document.querySelectorAll('.video-container video');

videos.forEach((video, index) => {
    // No marcar el video como completado al cargar la página, solo cuando termine
    video.addEventListener('ended', () => {
        marcarComoCompletado(video, index);
    });

    // Si el video ya ha sido completado previamente (por ejemplo, al recargar la página), no lo marca como completado automáticamente
    verificarEstadoCompletado(video, index);
});

// Función para verificar si un video ha sido completado antes
function verificarEstadoCompletado(video, index) {
    // Suponiendo que tienes una forma de saber si el video ya fue completado (puedes hacer esto con una base de datos o localStorage)
    const videoCompletado = false;  // Aquí deberías reemplazar con la lógica que tengas para verificar el estado en la base de datos

    if (videoCompletado) {
        video.classList.add('completado');  // Clase CSS para marcar visualmente como completado
        // También podrías cambiar el estado del video en el DOM si es necesario
    }
}

// Función para marcar el video como completado en la base de datos
let usuarioId = null;

async function obtenerUsuarioId() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await fetch('/perfil-data', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.usuario.id;
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
            video_id: videoId,   // ✔ correcto
            curso_id: cursoId    // ✔ correcto
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


// Llamar la función onYouTubeIframeAPIReady cuando la API de YouTube esté lista
function onYouTubeIframeAPIReady() {
    const videoContainers = document.querySelectorAll('.lesson-video');
    videoContainers.forEach((container, index) => {
        const videoId = container.dataset.videoId;
        const cursoId = container.dataset.cursoId;

        const playerDiv = document.createElement('div');
        const divId = `youtube-player-${index}`;
        playerDiv.id = divId;
        container.appendChild(playerDiv);

        // Crear un reproductor de YouTube para cada video
        players[index] = new YT.Player(divId, {
            height: "315",
            width: "560",
            videoId: videoId,
            events: {
                'onStateChange': function (event) {
                    if (event.data === YT.PlayerState.ENDED && usuarioId) {
                        // Llamar a la función para marcar el video como completado
                        marcarComoCompletado(videoId, cursoId);
                    }
                }
            }
        });
    });
}
