(function () {
  const list = document.getElementById("galleryList");
  if (!list) return;

  fetch("/api/gallery")
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((images) => {
      if (!images.length) return;
      list.replaceChildren();
      images.forEach((image) => {
        const item = document.createElement("figure");
        item.className = "gal-item";
        const photo = document.createElement("img");
        photo.src = image.image_url;
        photo.alt = image.judul;
        photo.loading = "lazy";
        const caption = document.createElement("figcaption");
        const title = document.createElement("strong");
        title.textContent = image.judul;
        caption.append(title);
        if (image.deskripsi) {
          const description = document.createElement("small");
          description.textContent = image.deskripsi;
          caption.append(description);
        }
        item.append(photo, caption);
        list.append(item);
      });
    })
    .catch(() => { list.innerHTML = '<p class="gallery-empty">Galeri belum dapat dimuat.</p>'; });
})();
