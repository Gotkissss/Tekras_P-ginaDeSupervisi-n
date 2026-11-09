const e = new URLSearchParams(location.search).get('e');
const box = document.getElementById('err');
if (e === '1') box.textContent = 'Clave incorrecta. Inténtalo de nuevo.';
if (e === 'limit') box.textContent = 'Demasiados intentos. Espera 15 minutos.';
