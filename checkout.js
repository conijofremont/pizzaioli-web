// ══════════════════════════════════════════════
// PIZZAIOLI — Checkout: datos del cliente, guardado en
// Supabase, y envío del pedido a WhatsApp
// ══════════════════════════════════════════════

const WHATSAPP_NEGOCIO = '56932835518';

function abrirCheckout() {
  if (obtenerCarrito().length === 0) return;
  cerrarCarrito();
  document.getElementById('checkoutOverlay')?.classList.add('open');
  document.getElementById('checkoutModal')?.classList.add('open');
  renderizarResumenCheckout();
}

function cerrarCheckout() {
  document.getElementById('checkoutOverlay')?.classList.remove('open');
  document.getElementById('checkoutModal')?.classList.remove('open');
}

function renderizarResumenCheckout() {
  const cont = document.getElementById('checkoutResumen');
  if (!cont) return;
  const carrito = obtenerCarrito();
  const { subtotal, descuento, total, aplicaDescuento } = calcularTotalConDescuento();

  cont.innerHTML = `
    ${carrito.map(i => `<div class="cart-row"><span>${i.cantidad}× ${i.nombre}</span><span>${formatearCLP(i.precio * i.cantidad)}</span></div>`).join('')}
    <div class="cart-row"><span>Subtotal</span><span>${formatearCLP(subtotal)}</span></div>
    ${aplicaDescuento ? `<div class="cart-row cart-row-discount"><span>Descuento reserva (10%)</span><span>−${formatearCLP(descuento)}</span></div>` : ''}
    <div class="cart-row cart-row-total"><span>Total</span><span>${formatearCLP(total)}</span></div>
  `;
}

function construirMensajeWhatsApp(datos, codigo) {
  const carrito = obtenerCarrito();
  const { subtotal, descuento, total, aplicaDescuento } = calcularTotalConDescuento();

  let msg = `🍕 *Nuevo pedido Pizzaioli* — #${codigo}\n\n`;
  msg += `*Cliente:* ${datos.nombre}\n`;
  msg += `*Teléfono:* ${datos.telefono}\n`;
  msg += `*Comuna:* ${datos.comuna}\n`;
  if (datos.direccion) msg += `*Dirección:* ${datos.direccion}\n`;
  msg += `\n*Pedido:*\n`;
  carrito.forEach(i => { msg += `- ${i.cantidad}× ${i.nombre} — ${formatearCLP(i.precio * i.cantidad)}\n`; });
  msg += `\nSubtotal: ${formatearCLP(subtotal)}\n`;
  if (aplicaDescuento) msg += `Descuento reserva (10%): -${formatearCLP(descuento)}\n`;
  msg += `*Total: ${formatearCLP(total)}*\n`;
  if (aplicaDescuento) msg += `\n_Pedido reservado (lunes a jueves) — confirmar entrega viernes/sábado._`;

  return encodeURIComponent(msg);
}

async function guardarPedidoEnSupabase(datos) {
  const carrito = obtenerCarrito();
  const { subtotal, descuento, total, aplicaDescuento } = calcularTotalConDescuento();

  // 1. Buscar o crear cliente por teléfono
  let customerId = null;
  const { data: clienteExistente } = await db
    .from('customers')
    .select('id')
    .eq('telefono', datos.telefono)
    .maybeSingle();

  if (clienteExistente) {
    customerId = clienteExistente.id;
  } else {
    const { data: nuevoCliente, error: errCliente } = await db
      .from('customers')
      .insert({ telefono: datos.telefono, nombre: datos.nombre })
      .select('id')
      .single();
    if (errCliente) throw errCliente;
    customerId = nuevoCliente.id;
  }

  // 2. Crear el pedido
  const { data: pedido, error: errPedido } = await db
    .from('orders')
    .insert({
      customer_id: customerId,
      nombre_cliente: datos.nombre,
      telefono: datos.telefono,
      comuna: datos.comuna,
      direccion: datos.direccion || null,
      subtotal, descuento_aplicado: descuento, total,
      es_reserva_anticipada: aplicaDescuento,
      estado: 'recibido',
      estado_pago: 'pendiente',
    })
    .select('id, codigo_seguimiento')
    .single();

  if (errPedido) throw errPedido;

  // 3. Crear los items del pedido
  const items = carrito.map(i => ({
    order_id: pedido.id,
    menu_item_id: i.id,
    nombre_producto: i.nombre,
    precio_unitario: i.precio,
    cantidad: i.cantidad,
  }));
  const { error: errItems } = await db.from('order_items').insert(items);
  if (errItems) throw errItems;

  return pedido;
}

async function confirmarPedido(event) {
  event.preventDefault();

  const datos = {
    nombre: document.getElementById('checkoutNombre').value.trim(),
    telefono: document.getElementById('checkoutTelefono').value.trim(),
    comuna: document.getElementById('checkoutComuna').value,
    direccion: document.getElementById('checkoutDireccion').value.trim(),
  };

  if (!datos.nombre || !datos.telefono || !datos.comuna) {
    mostrarErrorCheckout('Completa nombre, teléfono y comuna para continuar.');
    return;
  }
  if (!COMUNAS_VALIDAS.includes(datos.comuna)) {
    mostrarErrorCheckout('Por ahora solo entregamos en Providencia, Santiago Centro y Bellavista.');
    return;
  }

  const btn = document.getElementById('btnConfirmarPedido');
  btn.disabled = true;
  btn.textContent = 'Guardando pedido...';

  try {
    const pedido = await guardarPedidoEnSupabase(datos);

    // Armar el mensaje de WhatsApp ANTES de vaciar el carrito
    // (si no, el resumen sale vacío porque ya no quedaría nada que leer)
    const mensaje = construirMensajeWhatsApp(datos, pedido.codigo_seguimiento);

    // Ahora sí, vaciar el carrito local
    guardarCarrito([]);
    renderizarCarrito();

    // Abrir WhatsApp con el resumen del pedido
    window.open(`https://wa.me/${WHATSAPP_NEGOCIO}?text=${mensaje}`, '_blank');

    mostrarConfirmacionFinal(pedido.codigo_seguimiento);
  } catch (err) {
    console.error('Error guardando pedido:', err);
    mostrarErrorCheckout('No pudimos guardar tu pedido. Intenta de nuevo o escríbenos directo por WhatsApp.');
    btn.disabled = false;
    btn.textContent = 'Confirmar pedido';
  }
}

function mostrarErrorCheckout(texto) {
  const el = document.getElementById('checkoutError');
  if (!el) return;
  el.textContent = texto;
  el.style.display = 'block';
}

function mostrarConfirmacionFinal(codigo) {
  const modal = document.getElementById('checkoutModal');
  modal.innerHTML = `
    <div class="checkout-success">
      <p class="checkout-success-icon">✓</p>
      <h3>¡Pedido enviado!</h3>
      <p>Tu código de seguimiento es <strong>#${codigo}</strong>.</p>
      <p>Se abrió WhatsApp con el resumen — confírmalo ahí para que empecemos a prepararlo.</p>
      <a href="seguimiento.html?codigo=${codigo}" class="btn-ghost" style="display:inline-block; margin-top:10px;">Ver estado de mi pedido →</a><br>
      <button class="btn-primary" onclick="cerrarCheckout(); location.reload();" style="margin-top:16px;">Cerrar</button>
    </div>
  `;
}