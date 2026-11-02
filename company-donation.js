(function () {
  const form = document.getElementById("companyDonationForm");
  if (!form) return;
  const eventSelect = document.getElementById("companyEvent");
  const paymentInfo = form.querySelector(".company-payment-info");
  const status = document.getElementById("companyDonationStatus");
  const productList = document.getElementById("productKnowledgeList");

  async function errorMessage(response, fallback) {
    try { return (await response.json()).message || fallback; } catch (_) { return fallback; }
  }

  async function setup() {
    paymentInfo.innerHTML = '<img src="payment-qris.jpeg" alt="QRIS PGDP PPG Stasi Sanpera" /><strong>Scan QRIS untuk melakukan donasi</strong>';
    try {
      const eventsResponse = await fetch("/api/events");
      if (eventsResponse.ok) (await eventsResponse.json()).forEach((row) => {
        const option = document.createElement("option"); option.value = row.id; option.textContent = row.nama; eventSelect.appendChild(option);
      });
    } catch (_) {}
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
      if (!response.ok) throw new Error(await errorMessage(response, "Pengajuan belum dapat dikirim."));
      form.reset(); status.classList.add("success"); status.textContent = "Pengajuan sponsor berhasil diterima. Terima kasih atas dukungan Anda.";
    } catch (error) { status.classList.add("error"); status.textContent = error.message || "Pengajuan belum dapat dikirim. Silakan coba lagi."; }
    finally { button.disabled = false; }
  });
  setup();
  loadProductKnowledge();
})();
