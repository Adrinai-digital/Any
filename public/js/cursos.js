document.addEventListener("DOMContentLoaded", function () {
    // Almacena los reproductores
    let players = {};

    // Esta función se llama cuando la API de YouTube está lista
    function onYouTubeIframeAPIReady() {
        document.querySelectorAll(".lesson-video").forEach((iframe, index) => {
            let videoId = iframe.dataset.videoId;

            if (!videoId) {
                console.error(`No se encontró el ID de video en el iframe ${index}`);
                return;
            }

            // Crea el reproductor y asigna el evento para detectar el cambio de estado
            players[videoId] = new YT.Player(iframe, {
                events: {
                    'onStateChange': (event) => onPlayerStateChange(event, videoId)  // Aquí se llama a onPlayerStateChange
                }
            });
        });
    }

    // Función para manejar el estado del reproductor
    function onPlayerStateChange(event, videoId) {
        if (event.data === YT.PlayerState.ENDED) { // Si el video terminó
            marcarComoCompletado(videoId);
        }
    }

    // Función que marca el video como completado
    function marcarComoCompletado(videoId) {
        // Encuentra el elemento <span> dentro de la lección correspondiente con el ID del video
        let videoStatusText = document.querySelector(`[data-video-id="${videoId}"]`).closest('.lesson').querySelector('p span');

        console.log(videoStatusText); // Añadir un log aquí para ver si está encontrando el elemento correctamente.

        // Si el estado es encontrado, actualízalo
        if (videoStatusText) {
            videoStatusText.textContent = "Completado";
            videoStatusText.classList.add("completed");  // Cambia el color a verde
        } else {
            console.error(`No se encontró el estado del video con ID ${videoId}`);
        }

        // Guardar el estado en el backend
        const userId = "USER_ID_AQUI";  // Asegúrate de reemplazar con el ID del usuario real
        saveCompletionStatus(videoId, userId);
    }

    // Función para guardar el estado del video en el backend
    function saveCompletionStatus(videoId, userId) {
        fetch('/guardarEstado', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId: videoId,
                userId: userId,
                status: 'completado'
            })
        })
        .then(response => response.json())
        .then(data => console.log('Estado guardado', data))
        .catch(error => console.error('Error al guardar estado:', error));
    }

    // Agregar la API de YouTube dinámicamente
    let tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
});
