// ══════════════════════════════════════════════
// PIZZAIOLI — Carrito de compras
// ══════════════════════════════════════════════

const CARRITO_KEY = 'pizzaioli_carrito';

const HORARIO = { dias: [5, 6], horaInicio: 18, horaFin: 3 };
const COMUNAS_VALIDAS = ['Providencia', 'Santiago Centro', 'Bellavista'];

function estaAbierto() {
  const ahora = new Date();
  const dia = ahora.getDay();
  const hora = ahora.getHours();
  const abiertoNoche = HORARIO.dias.includes(dia) && hora >= HORARIO.horaInicio;
  const abiertoMadrugada = (dia === 6 || dia === 0) && hora < HORARIO.horaFin;
  return abiertoNoche || abiertoMadrugada;
}

function esDiaConDescuento() {
  const dia = new Date().getDay();
  return dia >= 1 && dia <= 4;
}

function formatearCLP(valor) {
  return '$' + valor.toLocaleString('es-CL');
}

function obtenerCarrito() {
  try {
    const data = localStorage.getItem(CARRITO_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function guardarCarrito(carrito) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  actualizarContadorCarrito();
  sincronizarBotonesCarta();
  actualizarStickyBar();
}

function agregarAlCarrito(item) {
  const carrito = obtenerCarrito();
  const existente = carrito.find(p => p.id === item.id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ ...item, cantidad: 1 });
  }
  guardarCarrito(carrito);
  mostrarConfirmacionAgregado(item.nombre);
  renderizarCarrito();
}

function cambiarCantidad(id, delta) {
  const carrito = obtenerCarrito();
  const item = carrito.find(p => p.id === id);
  if (!item) return;
  item.cantidad += delta;
  const carritoFiltrado = item.cantidad <= 0 ? carrito.filter(p => p.id !== id) : carrito;
  guardarCarrito(carritoFiltrado);
  renderizarCarrito();
}

function eliminarDelCarrito(id) {
  const carrito = obtenerCarrito().filter(p => p.id !== id);
  guardarCarrito(carrito);
  renderizarCarrito();
}

function calcularSubtotal() {
  return obtenerCarrito().reduce((sum, item) => sum + item.precio * item.cantidad, 0);
}

function calcularTotalConDescuento() {
  const subtotal = calcularSubtotal();
  const aplicaDescuento = esDiaConDescuento();
  const descuento = aplicaDescuento ? Math.round(subtotal * 0.10) : 0;
  return { subtotal, descuento, total: subtotal - descuento, aplicaDescuento };
}

function contarItemsCarrito() {
  return obtenerCarrito().reduce((sum, item) => sum + item.cantidad, 0);
}

function actualizarContadorCarrito() {
  const contador = document.getElementById('cartCount');
  if (!contador) return;
  const cantidad = contarItemsCarrito();
  contador.textContent = cantidad;
  contador.style.display = cantidad > 0 ? 'flex' : 'none';
}

// ── Barra fija inferior (estilo apps de delivery) ──
function actualizarStickyBar() {
  const bar = document.getElementById('stickyCartBar');
  if (!bar) return;
  const cantidad = contarItemsCarrito();
  const { total } = calcularTotalConDescuento();

  if (cantidad > 0) {
    document.getElementById('stickyCartCount').textContent = `${cantidad} ${cantidad === 1 ? 'item' : 'items'}`;
    document.getElementById('stickyCartTotal').textContent = formatearCLP(total);
    bar.classList.add('visible');
    document.body.classList.add('has-cart-items');
  } else {
    bar.classList.remove('visible');
    document.body.classList.remove('has-cart-items');
  }
}

// ── Sincroniza cada tarjeta: botón "Agregar" ↔ stepper inline ──
function sincronizarBotonesCarta() {
  const carrito = obtenerCarrito();
  document.querySelectorAll('.pizza-cta[data-id]').forEach(cta => {
    const id = cta.getAttribute('data-id');
    const nombre = cta.getAttribute('data-nombre');
    const precio = parseInt(cta.getAttribute('data-precio'), 10);
    const enCarrito = carrito.find(p => p.id === id);

    if (enCarrito) {
      cta.innerHTML = `
        <div class="stepper-inline">
          <button onclick="cambiarCantidad('${id}', -1)" aria-label="Restar">−</button>
          <span class="stepper-qty">${enCarrito.cantidad}</span>
          <button onclick="cambiarCantidad('${id}', 1)" aria-label="Sumar">+</button>
        </div>`;
    } else {
      cta.innerHTML = `
        <button class="btn-agregar" onclick="agregarAlCarrito({id:'${id}', nombre:'${nombre}', precio:${precio}})">
          Agregar
        </button>`;
    }
  });
}

function mostrarConfirmacionAgregado(nombre) {
  const toast = document.createElement('div');
  toast.className = 'cart-toast';
  toast.textContent = `${nombre} agregada al carrito`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

function abrirCarrito() {
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  renderizarCarrito();
}

function cerrarCarrito() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
}

function renderizarCarrito() {
  const lista = document.getElementById('cartItems');
  if (!lista) return;

  const carrito = obtenerCarrito();
  const { subtotal, descuento, total, aplicaDescuento } = calcularTotalConDescuento();

  if (carrito.length === 0) {
    lista.innerHTML = '<p class="cart-empty">Tu carrito está vacío. ¡Agrega alguna pizza de la carta!</p>';
  } else {
    lista.innerHTML = carrito.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <p class="cart-item-name">${item.nombre}</p>
          <p class="cart-item-price">${formatearCLP(item.precio)} c/u</p>
        </div>
        <div class="cart-item-qty">
          <button onclick="cambiarCantidad('${item.id}', -1)" aria-label="Restar">−</button>
          <span>${item.cantidad}</span>
          <button onclick="cambiarCantidad('${item.id}', 1)" aria-label="Sumar">+</button>
        </div>
        <button class="cart-item-remove" onclick="eliminarDelCarrito('${item.id}')" aria-label="Eliminar">×</button>
      </div>
    `).join('');
  }

  const resumen = document.getElementById('cartSummary');
  if (resumen) {
    resumen.innerHTML = `
      <div class="cart-row"><span>Subtotal</span><span>${formatearCLP(subtotal)}</span></div>
      ${aplicaDescuento ? `<div class="cart-row cart-row-discount"><span>Descuento reserva (10%)</span><span>−${formatearCLP(descuento)}</span></div>` : ''}
      <div class="cart-row cart-row-total"><span>Total</span><span>${formatearCLP(total)}</span></div>
    `;
  }

  const aviso = document.getElementById('cartHorarioAviso');
  if (aviso) {
    if (estaAbierto()) {
      aviso.innerHTML = `<span class="aviso-ok">● Abierto ahora — pedidos en el momento</span>`;
    } else if (aplicaDescuento) {
      aviso.innerHTML = `<span class="aviso-info">Estamos cerrados hoy, pero puedes reservar tu pedido para el próximo viernes o sábado con 10% de descuento.</span>`;
    } else {
      aviso.innerHTML = `<span class="aviso-cerrado">Cerrado en este momento. Abrimos viernes y sábado de 18:00 a 03:00.</span>`;
    }
    aviso.style.display = 'block';
  }

  const btnCheckout = document.getElementById('btnCheckout');
  if (btnCheckout) btnCheckout.disabled = carrito.length === 0;
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarContadorCarrito();
  actualizarStickyBar();
});