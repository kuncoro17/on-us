(function () {
  const slideshow = document.querySelector(".slideshow");
  if (!slideshow) return;

  const slides = [...slideshow.querySelectorAll(".slide")];
  const dots = slideshow.querySelector(".slide-dots");
  let active = 0;
  let timer;

  slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", `Tampilkan foto ${index + 1}`);
    button.addEventListener("click", () => show(index));
    dots.appendChild(button);
  });

  const dotButtons = [...dots.querySelectorAll("button")];
  function show(index) {
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === active));
    dotButtons.forEach((dot, dotIndex) => dot.setAttribute("aria-selected", String(dotIndex === active)));
    restart();
  }
  function restart() {
    window.clearInterval(timer);
    timer = window.setInterval(() => show(active + 1), 5000);
  }

  slideshow.querySelector(".previous").addEventListener("click", () => show(active - 1));
  slideshow.querySelector(".next").addEventListener("click", () => show(active + 1));
  slideshow.addEventListener("mouseenter", () => window.clearInterval(timer));
  slideshow.addEventListener("mouseleave", restart);
  show(0);
})();
