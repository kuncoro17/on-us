/* ============================================================
   ON-US / OFF-US classifier — mirrors on_us.py logic, runs
   entirely client-side (no server round trip).
   ============================================================ */

(function () {
  const rawInput = document.getElementById("rawInput");
  const bankCodeInput = document.getElementById("bankCode");
  const merchantListInput = document.getElementById("merchantList");
  const processBtn = document.getElementById("processBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const clearBtn = document.getElementById("clearBtn");
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const logList = document.getElementById("logList");

  const countOnUsEl = document.getElementById("countOnUs");
  const countOffUsEl = document.getElementById("countOffUs");
  const resultBody = document.getElementById("resultBody");
  const emptyState = document.getElementById("emptyState");
  const resultTable = document.getElementById("resultTable");
  const tabs = document.querySelectorAll(".result-tab");
  const downloadOnUsBtn = document.getElementById("downloadOnUs");
  const downloadOffUsBtn = document.getElementById("downloadOffUs");

  const SAMPLE = [
    "028|123456789012345|100000",
    "028|111111111111111|250000",
    "029|987654321098765|300000",
    "028|987654321098765|500000",
  ].join("\n");

  let lastResult = { onUs: [], offUs: [] };
  let activeTab = "on-us";

  function log(msg) {
    logList.style.display = "block";
    const line = document.createElement("div");
    line.textContent = msg;
    logList.appendChild(line);
    logList.scrollTop = logList.scrollHeight;
  }

  function clearLog() {
    logList.innerHTML = "";
    logList.style.display = "none";
  }

  function process() {
    clearLog();

    const bankCode = bankCodeInput.value.trim();
    const merchantSet = new Set(
      merchantListInput.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const lines = rawInput.value.split("\n");
    const onUs = [];
    const offUs = [];

    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) return;

      const fields = line.split("|");
      if (fields.length !== 3) {
        log(`Format tidak valid: ${line}`);
        return;
      }

      const acquiringBankCode = fields[0].trim();
      const mpan = fields[1].trim();
      const amount = fields[2].trim();

      const row = { bank: acquiringBankCode, mpan, amount };

      if (acquiringBankCode === bankCode && merchantSet.has(mpan)) {
        log(`ON-US: ${mpan}`);
        onUs.push(row);
      } else {
        log(`OFF-US: ${mpan}`);
        offUs.push(row);
      }
    });

    log("==============================");
    log(`Total ON-US: ${onUs.length}`);
    log(`Total OFF-US: ${offUs.length}`);
    log("==============================");

    lastResult = { onUs, offUs };
    countOnUsEl.textContent = onUs.length;
    countOffUsEl.textContent = offUs.length;
    renderTable();
  }

  function renderTable() {
    const rows = activeTab === "on-us" ? lastResult.onUs : lastResult.offUs;
    resultBody.innerHTML = "";

    if (!rows.length) {
      emptyState.style.display = "block";
      emptyState.textContent =
        lastResult.onUs.length === 0 && lastResult.offUs.length === 0
          ? 'Belum ada data diproses. Tempel data lalu klik "Proses data".'
          : `Tidak ada transaksi ${activeTab === "on-us" ? "ON-US" : "OFF-US"}.`;
      resultTable.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    resultTable.style.display = "table";

    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(r.bank)}</td><td>${escapeHtml(r.mpan)}</td><td>${escapeHtml(r.amount)}</td>`;
      resultBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function downloadText(filename, rows) {
    const content = rows.map((r) => `${r.bank}|${r.mpan}|${r.amount}`).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      rawInput.value = e.target.result;
    };
    reader.readAsText(file);
  }

  processBtn.addEventListener("click", process);

  sampleBtn.addEventListener("click", () => {
    rawInput.value = SAMPLE;
    process();
  });

  clearBtn.addEventListener("click", () => {
    rawInput.value = "";
    lastResult = { onUs: [], offUs: [] };
    countOnUsEl.textContent = "0";
    countOffUsEl.textContent = "0";
    clearLog();
    renderTable();
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) readFile(e.target.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag");
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeTab = tab.dataset.tab;
      renderTable();
    });
  });

  downloadOnUsBtn.addEventListener("click", () => downloadText("result_on_us.txt", lastResult.onUs));
  downloadOffUsBtn.addEventListener("click", () => downloadText("result_off_us.txt", lastResult.offUs));

  // initial state
  renderTable();
})();
