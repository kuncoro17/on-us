(function () {
  const form = document.getElementById("registrationForm");
  if (!form) return;

  const registrationType = document.getElementById("registrationType");
  const groupNameField = document.getElementById("groupNameField");
  const groupName = form.elements.nama_kelompok;
  const churchAccount = document.getElementById("churchAccount");
  const regionField = document.getElementById("regionField");
  const regionName = form.elements.nama_wilayah;
  const status = document.getElementById("registrationStatus");
  const eventSelect = document.getElementById("eventSelect");
  const eventBadge = document.getElementById("eventBadge");
  const eventTitle = document.getElementById("eventTitle");
  const eventDescription = document.getElementById("eventDescription");
  const dioceseSelect = document.getElementById("dioceseSelect");
  const parishSelect = document.getElementById("parishSelect");

  function appendOptions(select, rows, label) {
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = label(row);
      select.appendChild(option);
    });
  }

  function resetParishSelect() {
    parishSelect.innerHTML = '<option value="">Pilih paroki atau stasi</option>';
  }

  async function loadParishes(dioceseId = "") {
    resetParishSelect();
    const query = dioceseId ? `?keuskupan_id=${encodeURIComponent(dioceseId)}` : "";
    const response = await fetch(`/api/paroki-stasi${query}`);
    if (!response.ok) throw new Error("Paroki/Stasi tidak dapat dimuat.");
    appendOptions(parishSelect, await response.json(), (row) => `${row.nama} (${row.tipe})`);
  }

  async function loadMasterData() {
    try {
      const [eventsResponse, diocesesResponse] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/keuskupan"),
      ]);
      if (!eventsResponse.ok || !diocesesResponse.ok) return;

      appendOptions(eventSelect, await eventsResponse.json(), (row) => row.nama);
      syncEventCopy();
      appendOptions(dioceseSelect, await diocesesResponse.json(), (row) => row.nama);
      await loadParishes();
    } catch (_) {
      // Form tetap dapat digunakan bila master data belum tersedia.
    }
  }

  function syncConditionalFields() {
    const isGroup = registrationType.value === "KELOMPOK";
    groupNameField.hidden = !isGroup;
    groupName.required = isGroup;
    if (!isGroup) groupName.value = "";

    regionField.hidden = !churchAccount.checked;
    regionName.required = churchAccount.checked;
    if (!churchAccount.checked) regionName.value = "";
  }

  function syncEventCopy() {
    const eventName = eventSelect.options[eventSelect.selectedIndex]?.text;
    const hasEvent = eventSelect.value && eventName;

    eventBadge.textContent = hasEvent ? eventName : "Pilih event";
    eventTitle.textContent = hasEvent ? `Daftarkan langkahmu di ${eventName}.` : "Daftarkan langkahmu.";
    eventDescription.textContent = hasEvent
      ? `Isi data berikut untuk mengikuti ${eventName}, baik secara individu maupun bersama kelompok.`
      : "Pilih event yang ingin diikuti, lalu lengkapi data pendaftaranmu secara individu maupun kelompok.";
  }

  registrationType.addEventListener("change", syncConditionalFields);
  churchAccount.addEventListener("change", syncConditionalFields);
  eventSelect.addEventListener("change", syncEventCopy);
  dioceseSelect.addEventListener("change", () => {
    loadParishes(dioceseSelect.value).catch(() => resetParishSelect());
  });
  syncConditionalFields();
  syncEventCopy();
  loadMasterData();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.umur = Number(payload.umur);
    payload.keuskupan_id = payload.keuskupan_id || null;
    payload.paroki_stasi_id = payload.paroki_stasi_id || null;
    payload.nama_kelompok = payload.nama_kelompok || null;
    payload.nama_wilayah = payload.nama_wilayah || null;
    delete payload.is_church_account;

    submitButton.disabled = true;
    status.className = "form-status";
    status.textContent = "Mengirim pendaftaran…";

    try {
      const response = await fetch("/api/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Pendaftaran belum dapat disimpan.");
      form.reset();
      syncConditionalFields();
      status.classList.add("success");
      status.textContent = "Pendaftaran berhasil dikirim. Terima kasih!";
    } catch (error) {
      status.classList.add("error");
      status.textContent = "Gagal terhubung ke server pendaftaran. Silakan coba lagi.";
    } finally {
      submitButton.disabled = false;
    }
  });
})();
