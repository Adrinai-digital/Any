function mostrarFormulario(formulario) {
    document.querySelectorAll('.formulario').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));

    document.getElementById(formulario).classList.add('active');
    document.querySelector(`button[onclick="mostrarFormulario('${formulario}')"]`).classList.add('active');
}
