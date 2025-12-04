(() => {
  const DEFAULT_FIELDS = {
    solicitante: "",
    celular: "",
    correo: "",
    direccion: "",
    marca: "",
    tipo: "",
    color: "",
    modelo: "",
    placas: "",
    kilometraje: "",
    servicio: "",
    observaciones: "",
    iva: "",
    moneda: "MXN"
  };
  const DEFAULT_ITEMS = [
    { unidad: "", descripcion: "", precio: "", mo: "" }
  ];
  const FALLBACK_EMPTY = "-";
  const FALLBACK_OBSERVACIONES = "Sin observaciones.";

  const formatCurrency = (value = 0, currency = "MXN") =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2
    }).format(value || 0);
  const safeText = (value, fallback = "-") => {
    const trimmed = (value || "").trim();
    return trimmed || fallback;
  };

  class QuoteCalculator {
    compute(items, ivaPct) {
      const totalMo = items.reduce((acc, item) => acc + (Number(item.mo) || 0), 0);
      const totalRefacciones = items.reduce((acc, item) => acc + (Number(item.importe) || 0), 0);
      const subtotal = totalMo + totalRefacciones;
      const iva = subtotal * ivaPct;
      const total = subtotal + iva;
      return { totalMo, totalRefacciones, subtotal, iva, total };
    }
  }

  function createItemRow(initial = {}, onChange) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" min="0" step="1" class="inp-unit" value="${initial.unidad ?? ""}"></td>
      <td><input type="text" class="inp-desc" value="${initial.descripcion ?? ""}" placeholder="Descripción"></td>
      <td><input type="number" min="0" step="0.01" class="inp-precio" value="${initial.precio ?? ""}"></td>
      <td><input type="number" min="0" step="0.01" class="inp-mo" value="${initial.mo ?? ""}"></td>
      <td><button type="button" class="btn-delete remove-row">?</button></td>
    `;
    const notify = () => onChange && onChange();
    tr.querySelectorAll("input").forEach(input => input.addEventListener("input", notify));
    tr.querySelector(".remove-row").addEventListener("click", () => {
      tr.remove();
      notify();
    });
    return tr;
  }
  function readRows(container) {
    return Array.from(container.querySelectorAll("tr")).map(tr => {
      const unidad = parseFloat(tr.querySelector(".inp-unit").value) || 0;
      const precio = parseFloat(tr.querySelector(".inp-precio").value) || 0;
      const mo = parseFloat(tr.querySelector(".inp-mo").value) || 0;
      const descripcion = tr.querySelector(".inp-desc").value.trim();
      return { unidad, precio, mo, descripcion, importe: unidad * precio };
    });
  }
  function seedRows(container, items, onChange) {
    container.innerHTML = "";
    items.forEach(item => container.appendChild(createItemRow(item, onChange)));
  }

  class QuoteRenderer {
    constructor(previewRefs) {
      this.preview = previewRefs;
    }
    render(fields, items, totals) {
      this.renderHeader(fields);
      this.renderItems(items, fields.moneda);
      this.renderObservaciones(fields.observaciones);
      this.renderTotals(totals, fields.moneda);
    }
    renderHeader(fields) {
      this.preview.solicitante.textContent = safeText(fields.solicitante, FALLBACK_EMPTY);
      this.preview.celular.textContent = safeText(fields.celular, FALLBACK_EMPTY);
      this.preview.correo.textContent = safeText(fields.correo, FALLBACK_EMPTY);
      this.preview.direccion.textContent = safeText(fields.direccion, FALLBACK_EMPTY);
      this.preview.marca.textContent = safeText(fields.marca, FALLBACK_EMPTY);
      this.preview.tipo.textContent = safeText(fields.tipo, FALLBACK_EMPTY);
      this.preview.color.textContent = safeText(fields.color, FALLBACK_EMPTY);
      this.preview.modelo.textContent = safeText(fields.modelo, FALLBACK_EMPTY);
      this.preview.placas.textContent = safeText(fields.placas, FALLBACK_EMPTY);
      this.preview.kilometraje.textContent = safeText(fields.kilometraje, FALLBACK_EMPTY);
      this.preview.servicio.textContent = safeText(fields.servicio, FALLBACK_EMPTY);
    }
    renderItems(items, currency) {
      this.preview.items.innerHTML = "";
      items.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="center">${item.unidad || ""}</td>
          <td>${safeText(item.descripcion, "")}</td>
          <td class="right">${item.precio ? formatCurrency(item.precio, currency) : ""}</td>
          <td class="right">${item.importe ? formatCurrency(item.importe, currency) : ""}</td>
          <td class="right">${item.mo ? formatCurrency(item.mo, currency) : ""}</td>
        `;
        this.preview.items.appendChild(row);
      });
    }
    renderObservaciones(text) {
      this.preview.observaciones.textContent = safeText(text, FALLBACK_OBSERVACIONES);
    }
    renderTotals(totals, currency) {
      this.preview.mo.textContent = formatCurrency(totals.totalMo, currency);
      this.preview.refacciones.textContent = formatCurrency(totals.totalRefacciones, currency);
      this.preview.subtotal.textContent = formatCurrency(totals.subtotal, currency);
      this.preview.iva.textContent = formatCurrency(totals.iva, currency);
      this.preview.total.textContent = formatCurrency(totals.total, currency);
    }
  }

  class PdfExporter {
    constructor(previewElement) {
      this.previewElement = previewElement;
    }
    async export(filename) {
      const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
      if (!window.html2canvas || !jsPDFLib) {
        window.print();
        return;
      }
      const safeName = filename || "cotizacion.pdf";
      try {
        const canvas = await html2canvas(this.previewElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff"
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDFLib({ orientation: "p", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft * -1;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
          heightLeft -= pageHeight;
        }
        const isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem);
        if (isCapacitor) {
          const Filesystem = window.Capacitor.Plugins.Filesystem;
          try {
            await Filesystem.requestPermissions();
          } catch (e) {}
          const dataUri = pdf.output("datauristring");
          const base64 = dataUri.split(",")[1];
          await Filesystem.writeFile({
            path: safeName,
            data: base64,
            directory: "DOCUMENTS",
            recursive: true
          });
          return;
        }
        pdf.save(safeName);
      } catch (err) {
        window.print();
      }
    }
  }

  class QuoteController {
    constructor() {
      this.rowsContainer = document.getElementById("form-rows");
      this.inputs = {
        solicitante: document.getElementById("solicitante"),
        celular: document.getElementById("celular"),
        correo: document.getElementById("correo"),
        direccion: document.getElementById("direccion"),
        marca: document.getElementById("marca"),
        tipo: document.getElementById("tipo"),
        color: document.getElementById("color"),
        modelo: document.getElementById("modelo"),
        placas: document.getElementById("placas"),
        kilometraje: document.getElementById("kilometraje"),
        servicio: document.getElementById("servicio"),
        observaciones: document.getElementById("observaciones"),
        iva: document.getElementById("iva"),
        moneda: document.getElementById("moneda")
      };
      this.renderer = new QuoteRenderer({
        solicitante: document.getElementById("p-solicitante"),
        celular: document.getElementById("p-celular"),
        correo: document.getElementById("p-correo"),
        direccion: document.getElementById("p-direccion"),
        marca: document.getElementById("p-marca"),
        tipo: document.getElementById("p-tipo"),
        color: document.getElementById("p-color"),
        modelo: document.getElementById("p-modelo"),
        placas: document.getElementById("p-placas"),
        kilometraje: document.getElementById("p-kilometraje"),
        servicio: document.getElementById("p-servicio"),
        observaciones: document.getElementById("p-observaciones"),
        items: document.getElementById("p-items"),
        mo: document.getElementById("p-mo"),
        refacciones: document.getElementById("p-refacciones"),
        subtotal: document.getElementById("p-subtotal"),
        iva: document.getElementById("p-iva"),
        total: document.getElementById("p-total")
      });
      this.calculator = new QuoteCalculator();
      this.pdfExporter = new PdfExporter(document.getElementById("preview"));
    }

    init() {
      this.resetForm();
      this.bindEvents();
      this.update();
    }

    bindEvents() {
      document.getElementById("add-row").addEventListener("click", () => {
        this.rowsContainer.appendChild(createItemRow({}, () => this.update()));
      });
      document.getElementById("imprimir").addEventListener("click", () => this.handlePdf());
      document.getElementById("reiniciar").addEventListener("click", () => {
        this.resetForm();
        this.update();
      });
      [
        "solicitante",
        "celular",
        "correo",
        "direccion",
        "marca",
        "tipo",
        "color",
        "modelo",
        "placas",
        "kilometraje",
        "servicio",
        "observaciones",
        "iva",
        "moneda"
      ].forEach(id => this.inputs[id].addEventListener("input", () => this.update()));
    }

    resetForm() {
      Object.entries(DEFAULT_FIELDS).forEach(([key, value]) => {
        if (this.inputs[key]) this.inputs[key].value = value;
      });
      seedRows(this.rowsContainer, DEFAULT_ITEMS, () => this.update());
    }

    collectFields() {
      return {
        solicitante: this.inputs.solicitante.value,
        celular: this.inputs.celular.value,
        correo: this.inputs.correo.value,
        direccion: this.inputs.direccion.value,
        marca: this.inputs.marca.value,
        tipo: this.inputs.tipo.value,
        color: this.inputs.color.value,
        modelo: this.inputs.modelo.value,
        placas: this.inputs.placas.value,
        kilometraje: this.inputs.kilometraje.value,
        servicio: this.inputs.servicio.value,
        observaciones: this.inputs.observaciones.value,
        iva: parseFloat(this.inputs.iva.value) || 0,
        moneda: this.inputs.moneda.value || "MXN"
      };
    }

    update() {
      const fields = this.collectFields();
      const items = readRows(this.rowsContainer);
      const totals = this.calculator.compute(items, fields.iva / 100);
      this.renderer.render(fields, items, totals);
    }

    handlePdf() {
      const placas = safeText(this.inputs.placas.value, "vehiculo").replace(/\s+/g, "_");
      const filename = `Cotizacion-${placas}.pdf`;
      this.pdfExporter.export(filename);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const controller = new QuoteController();
    controller.init();
  });
})();
