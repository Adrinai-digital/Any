document.addEventListener('DOMContentLoaded', () => {
  const boxes = document.querySelectorAll('#lista-1 .box');
  const loadMoreBtn = document.getElementById('load-more');
  let visibleCount = 3; // mostrar inicialmente 3

  // Ocultar todos menos los primeros visibles
  boxes.forEach((box, i) => {
    if (i < visibleCount) {
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  });

  loadMoreBtn.addEventListener('click', () => {
    visibleCount += 3; // mostrar 3 más
    boxes.forEach((box, i) => {
      if (i < visibleCount) {
        box.style.display = 'block';
      }
    });

    if (visibleCount >= boxes.length) {
      loadMoreBtn.style.display = 'none'; // ocultar botón si no quedan más
    }
  });
});
