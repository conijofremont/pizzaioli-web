function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const hamburger = document.getElementById('hamburger');
  links.classList.toggle('menu-open');
  hamburger.classList.toggle('active');
}