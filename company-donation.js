(function () {
  const form = document.getElementById("companyDonationForm");
  if (!form) return;
  const eventSelect = document.getElementById("companyEvent");
  const paymentInfo = form.querySelector(".company-payment-info");
  const status = document.getElementById("companyDonationStatus");
  const productList = document.getElementById("productKnowledgeList");

  async function setup() {
    try {
      const [eventsResponse, paymentResponse] = await Promise.all([fetch("/api/events"), fetch("/api/payment-info")]);
      if (eventsResponse.ok) (await eventsResponse.json()).forEach((row) => {
        const option = document.createElement("option"); option.value = row.id; option.textContent = row.nama; eventSelect.appendChild(option);
      });
      if (paymentResponse.ok) {
        const info = await paymentResponse.json();
        paymentInfo.innerHTML = `${info.qris_image_url ? `<img src="${info.qris_image_url}" alt="QRIS Gereja" />` : ""}<strong>${info.bank_name}</strong><span>${info.account_number}</span><small>a.n. ${info.account_holder}</small><p>${info.instructions || ""}</p>`;
      }
    } catch (_) { paymentInfo.textContent = "Informasi pembayaran belum tersedia."; }
  }

  async function loadProductKnowledge() {
    try {
      const response = await fetch("/api/product-knowledge");
      if (!response.ok) return;
      const rows = await response.json();
      productList.innerHTML = "";
      rows.forEach((row) => {
        const card = document.createElement("article"); card.className = "product-card";
        const photo = document.createElement("img"); photo.src = `/api/product-images/${encodeURIComponent(row.foto_produk_path)}`; photo.alt = row.nama_produk;
        const title = document.createElement("h4"); title.textContent = row.nama_produk;
        const company = document.createElement("p"); company.textContent = `${row.nama_perusahaan} · ${row.event_nama}`;
        const description = document.createElement("p"); description.textContent = row.deskripsi || "";
        card.append(photo, title, company, description); productList.appendChild(card);
      });
    } catch (_) {}
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    status.className = "form-status"; status.textContent = "Mengirim pengajuan sponsor…";
    try {
      const response = await fetch("/api/company-donations", { method: "POST", body: new FormData(form) });
      if (!response.ok) throw new Error();
      form.reset(); status.classList.add("success"); status.textContent = "Pengajuan sponsor berhasil dikirim dan menunggu verifikasi panitia.";
    } catch (_) { status.classList.add("error"); status.textContent = "Pengajuan belum dapat dikirim. Silakan coba lagi."; }
    finally { button.disabled = false; }
  });
  setup();
  loadProductKnowledge();
})();
