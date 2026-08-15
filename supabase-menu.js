// ══════════════════════════════════════════════
// PIZZAIOLI — Conexión a Supabase y menú dinámico
// ══════════════════════════════════════════════

const SUPABASE_URL = 'https://myjlesckaqiohmxyjppp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VIFT-ZGkZ7_wGjtzCRIgiA_EXB3xHu8';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function nombreCorto(nombre) {
  return nombre.replace(/[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1FAFF}]/gu, '').trim();
}

function tarjetaPizzaHTML(item, esFusion) {
  const emoji = item.nombre.match(/[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1FAFF}]/gu)?.join('') || '';
  const nombreLimpio = nombreCorto(item.nombre);
  const nombreEscapado = nombreLimpio.replace(/'/g, "\\'");

  return `
    <article class="pizza-card ${esFusion ? 'fusion-card' : ''}">
      <div class="pizza-photo" data-short="${nombreLimpio}"></div>
      <div class="pizza-body">
        <div class="pizza-head">
          <h4>${emoji ? emoji + ' ' : ''}${nombreLimpio}</h4>
          <span class="pizza-price">$${item.precio.toLocaleString('es-CL')}</span>
        </div>
        <div class="pizza-badge-row"><span class="badge-48">48H</span></div>
        <p class="pizza-desc">${item.descripcion}</p>
        <div class="pizza-cta" data-id="${item.id}" data-nombre="${nombreEscapado}" data-precio="${item.precio}">
          <button class="btn-agregar" onclick="agregarAlCarrito({id:'${item.id}', nombre:'${nombreEscapado}', precio:${item.precio}})">
            Agregar
          </button>
        </div>
      </div>
    </article>
  `;
}

async function cargarMenu() {
  const contClasicas = document.getElementById('cartaClasicas');
  const contFusion = document.getElementById('cartaFusion');
  if (!contClasicas || !contFusion) return;

  const { data, error } = await db
    .from('menu_items')
    .select('*')
    .eq('disponible', true)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando menú:', error);
    contClasicas.innerHTML = '<p style="color:var(--ink-faint)">No se pudo cargar la carta. Intenta recargar la página.</p>';
    return;
  }

  const clasicas = data.filter(i => i.categoria === 'clasica');
  const fusion = data.filter(i => i.categoria === 'fusion');

  contClasicas.innerHTML = clasicas.map(i => tarjetaPizzaHTML(i, false)).join('');
  contFusion.innerHTML = fusion.map(i => tarjetaPizzaHTML(i, true)).join('');

  // Sincronizar botones/steppers con lo que ya haya en el carrito (localStorage)
  if (typeof sincronizarBotonesCarta === 'function') sincronizarBotonesCarta();
}

// ── Pestañas de categoría: scroll suave + estado activo ──
function initCartaPills() {
  const pills = document.querySelectorAll('.pill');
  const grupos = [
    { id: 'carta-clasicas', pill: document.querySelector('.pill[href="#carta-clasicas"]') },
    { id: 'carta-fusion', pill: document.querySelector('.pill[href="#carta-fusion"]') },
  ];

  pills.forEach(p => {
    p.addEventListener('click', (e) => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const match = grupos.find(g => g.id === entry.target.id);
        if (match && match.pill) {
          pills.forEach(x => x.classList.remove('active'));
          match.pill.classList.add('active');
        }
      }
    });
  }, { rootMargin: '-140px 0px -60% 0px' });

  grupos.forEach(g => {
    const el = document.getElementById(g.id);
    if (el) observer.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cargarMenu();
  initCartaPills();
});