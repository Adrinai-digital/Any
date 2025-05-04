// Función para cambiar entre formularios de login y registro
function mostrarFormulario(formulario) {
    const formularios = ['login', 'registro'];

    // Ocultar ambos formularios y quitar clase 'active' a las pestañas
    formularios.forEach(id => document.getElementById(id).classList.remove("active"));
    document.querySelectorAll(".tab-link").forEach(tab => tab.classList.remove("active"));

    // Mostrar el formulario seleccionado y activar la pestaña correspondiente
    document.getElementById(formulario).classList.add("active");

    const tabIndex = formulario === "login" ? 0 : 1;
    document.querySelectorAll(".tab-link")[tabIndex].classList.add("active");
}
