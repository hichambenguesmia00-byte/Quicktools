(() => {
  // Helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Overlay & Modals
  const overlay = $("#modal-overlay");
  function openModal(id){
    overlay.hidden = false;
    $("#"+id).hidden = false;
  }
  function closeModal(id){
    $("#"+id].hidden = true;
    overlay.hidden = true;
  }
  $$(".open-modal").forEach(btn => btn.addEventListener("click", e => {
    const id = e.currentTarget.dataset.modal;
    openModal(id);
  }));
  $$(".close-modal").forEach(btn => btn.addEventListener("click", e => {
    closeModal(e.currentTarget.dataset.close);
  }));
  overlay.addEventListener("click", () => {
    $$(".modal").forEach(m => m.hidden = true);
    overlay.hidden = true;
  });

  // Tabs in PDF modal
  $$(".tab").forEach(tab => tab.addEventListener("click", e => {
    $$(".tab").forEach(t=>t.classList.remove("active"));
    e.currentTarget.classList.add("active");
    const t = e.currentTarget.dataset.tab;
    $$(".tabpane").forEach(p => p.classList.add("hidden"));
    document.querySelector(`[data-pane="${t}"]`).classList.remove("hidden");
  }));

  // --- Image Compressor ---
  const imgInput = $("#imgInput");
  const quality = $("#quality");
  const compressBtn = $("#compressBtn");
  const origPreview = $("#origPreview");
  const compPreview = $("#compPreview");
  const origInfo = $("#origInfo");
  const compInfo = $("#compInfo");
  const downloadImg = $("#downloadImg");

  let origBlob = null;
  imgInput.addEventListener("change", () => {
    const f = imgInput.files?.[0];
    if(!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert("Max image size is 10MB.");
      imgInput.value = "";
      return;
    }
    origBlob = f;
    origPreview.src = URL.createObjectURL(f);
    origInfo.textContent = `${(f.size/1024/1024).toFixed(2)} MB — ${f.type}`;
    compPreview.src = "";
    compInfo.textContent = "—";
    downloadImg.hidden = true;
  });

  compressBtn.addEventListener("click", async () => {
    const f = imgInput.files?.[0];
    if(!f) { alert("Please choose an image"); return; }
    const q = parseInt(quality.value, 10)/100;
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const mime = (f.type === "image/png") ? "image/png" : "image/jpeg";
      const blob = await new Promise(res => canvas.toBlob(res, mime, q));
      const url = URL.createObjectURL(blob);
      compPreview.src = url;
      compInfo.textContent = `${(blob.size/1024/1024).toFixed(2)} MB — ${mime} — quality ${Math.round(q*100)}`;
      downloadImg.href = url;
      downloadImg.hidden = false;
    };
    img.src = URL.createObjectURL(f);
  });

  // --- PDF Tools (merge & split with pdf-lib) ---
  const { PDFDocument } = window.PDFLib || {};
  const mergeFiles = $("#mergeFiles");
  const mergeBtn = $("#mergeBtn");
  const mergeStatus = $("#mergeStatus");
  const downloadMerged = $("#downloadMerged");

  mergeBtn.addEventListener("click", async () => {
    const files = Array.from(mergeFiles.files || []);
    if(files.length < 2){ alert("Select at least two PDF files."); return; }
    // size checks
    let total = 0;
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { alert("Each PDF must be ≤ 15MB."); return; }
      total += f.size;
    }
    if (total > 20 * 1024 * 1024) { alert("Combined PDFs must be ≤ 20MB."); return; }

    try {
      mergeStatus.textContent = "Merging PDFs…";
      const outPdf = await PDFDocument.create();
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const src = await PDFDocument.load(bytes);
        const pages = await outPdf.copyPages(src, src.getPageIndices());
        pages.forEach(p => outPdf.addPage(p));
      }
      const mergedBytes = await outPdf.save();
      const blob = new Blob([mergedBytes], {type:"application/pdf"});
      const url = URL.createObjectURL(blob);
      downloadMerged.href = url;
      downloadMerged.hidden = false;
      mergeStatus.textContent = `Done. Size: ${(blob.size/1024/1024).toFixed(2)} MB`;
    } catch (e) {
      console.error(e);
      mergeStatus.textContent = "Failed to merge PDFs.";
      alert("Failed to merge PDFs. Make sure files are valid.");
    }
  });

  const splitFile = $("#splitFile");
  const splitPages = $("#splitPages");
  const splitBtn = $("#splitBtn");
  const splitStatus = $("#splitStatus");
  const downloadSplit = $("#downloadSplit");

  function parsePages(text, maxPage){
    // e.g., "1-3,5,8-9"
    const out = new Set();
    const parts = text.split(",").map(s=>s.trim()).filter(Boolean);
    for (const part of parts){
      if (part.includes("-")){
        const [a,b] = part.split("-").map(n=>parseInt(n,10));
        if (!isNaN(a) && !isNaN(b) && a>=1 && b>=a){
          for (let i=a;i<=b;i++){ if (i<=maxPage) out.add(i-1); }
        }
      } else {
        const n = parseInt(part,10);
        if(!isNaN(n) && n>=1 && n<=maxPage) out.add(n-1);
      }
    }
    return Array.from(out).sort((x,y)=>x-y);
  }

  splitBtn.addEventListener("click", async () => {
    const f = splitFile.files?.[0];
    if(!f){ alert("Select a PDF"); return; }
    if (f.size > 15 * 1024 * 1024) { alert("PDF must be ≤ 15MB."); return; }
    const ranges = splitPages.value.trim();
    if(!ranges){ alert("Enter pages, e.g., 1-3,5"); return; }

    try {
      splitStatus.textContent = "Splitting…";
      const bytes = new Uint8Array(await f.arrayBuffer());
      const src = await PDFDocument.load(bytes);
      const max = src.getPageCount();
      const idxs = parsePages(ranges, max);
      if (idxs.length === 0){ alert("No valid pages found."); splitStatus.textContent=""; return; }
      const outPdf = await PDFDocument.create();
      const pages = await outPdf.copyPages(src, idxs);
      pages.forEach(p => outPdf.addPage(p));
      const outBytes = await outPdf.save();
      const blob = new Blob([outBytes], {type:"application/pdf"});
      const url = URL.createObjectURL(blob);
      downloadSplit.href = url;
      downloadSplit.hidden = false;
      splitStatus.textContent = `Done. Pages: ${idxs.length} — Size: ${(blob.size/1024/1024).toFixed(2)} MB`;
    } catch (error) {
      console.error(error);
      splitStatus.textContent = "Failed to split PDF.";
      alert("Failed to split PDF. Ensure the file is a valid PDF.");
    }
  });

  // --- QR Generator ---
  const qrText = $("#qrText");
  const qrSize = $("#qrSize");
  const qrMargin = $("#qrMargin");
  const qrBtn = $("#qrBtn");
  const qrCanvas = $("#qrCanvas");
  const qrDownload = $("#qrDownload");

  qrBtn.addEventListener("click", async () => {
    const txt = qrText.value.trim();
    if(!txt){ alert("Enter text or URL"); return; }
    const size = parseInt(qrSize.value, 10);
    const margin = parseInt(qrMargin.value, 10);
    try {
      await window.QRCode.toCanvas(qrCanvas, txt, { width: size, margin });
      qrDownload.href = qrCanvas.toDataURL("image/png");
      qrDownload.hidden = false;
    } catch (e) {
      console.error(e);
      alert("Failed to generate QR");
    }
  });
})();
