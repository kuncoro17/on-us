(function () {
  const form = document.getElementById("donationForm");
  if (!form) return;

  const eventSelect = document.getElementById("donationEvent");
  const paymentInfo = document.getElementById("paymentInfo");
  const status = document.getElementById("donationStatus");

  function appendOptions(rows) {
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.nama;
      eventSelect.appendChild(option);
    });
  }

  async function loadInitialData() {
    try {
      const [eventsResponse, paymentResponse] = await Promise.all([fetch("/api/events"), fetch("/api/payment-info")]);
      if (eventsResponse.ok) appendOptions(await eventsResponse.json());
      if (paymentResponse.ok) {
        const info = await paymentResponse.json();
        paymentInfo.innerHTML = `${info.qris_image_url ? `<img src="${info.qris_image_url}" alt="QRIS Gereja" />` : ""}<strong>${info.bank_name}</strong><span>${info.account_number}</span><small>a.n. ${info.account_holder}</small>${info.instructions ? `<p>${info.instructions}</p>` : ""}`;
      } else paymentInfo.textContent = "Informasi pembayaran belum tersedia.";
    } catch (_) { paymentInfo.textContent = "Informasi pembayaran belum tersedia."; }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true; status.className = "form-status"; status.textContent = "Mengirim donasi…";
    try {
      const response = await fetch("/api/donations", { method: "POST", body: new FormData(form) });
      if (!response.ok) throw new Error();
      form.reset();
      status.classList.add("success"); status.textContent = "Donasi berhasil dikirim dan menunggu verifikasi panitia.";
    } catch (_) { status.classList.add("error"); status.textContent = "Donasi belum dapat dikirim. Periksa kembali data dan coba lagi."; }
    finally { button.disabled = false; }
  });
  loadInitialData();
})();
