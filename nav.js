(function () {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const open = links.style.display === "flex";
    links.style.display = open ? "none" : "flex";
    links.style.cssText += open
      ? ""
      : "position:absolute;top:68px;left:0;right:0;background:#F6F5F2;flex-direction:column;padding:16px 24px;gap:4px;border-bottom:1px solid #E1DED4;";
  });
})();
