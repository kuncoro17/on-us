(function () {
  const form = document.getElementById("donationForm");
  if (!form) return;

  const eventSelect = document.getElementById("donationEvent");
  const paymentInfo = document.getElementById("paymentInfo");
  const status = document.getElementById("donationStatus");

  async function errorMessage(response, fallback) {
    try { return (await response.json()).message || fallback; } catch (_) { return fallback; }
  }

  function appendOptions(rows) {
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.nama;
      eventSelect.appendChild(option);
    });
  }

  async function loadInitialData() {
    paymentInfo.innerHTML = '<img src="payment-qris.jpeg" alt="QRIS PGDP PPG Stasi Sanpera" /><strong>Scan QRIS untuk melakukan donasi</strong>';
    try {
      const eventsResponse = await fetch("/api/events");
      if (eventsResponse.ok) appendOptions(await eventsResponse.json());
    } catch (_) {}
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true; status.className = "form-status"; status.textContent = "Mengirim donasi…";
    try {
      const response = await fetch("/api/donations", { method: "POST", body: new FormData(form) });
      if (!response.ok) throw new Error(await errorMessage(response, "Donasi belum dapat dikirim."));
      form.reset();
      status.classList.add("success"); status.textContent = "Donasi berhasil diterima. Terima kasih atas kontribusi Anda.";
    } catch (error) { status.classList.add("error"); status.textContent = error.message || "Donasi belum dapat dikirim. Periksa kembali data dan coba lagi."; }
    finally { button.disabled = false; }
  });
  loadInitialData();
})();
