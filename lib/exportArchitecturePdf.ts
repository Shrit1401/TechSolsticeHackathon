import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const FILENAME = "multi-signal-anomaly-detection.pdf";

function stripClonedStylesheets(doc: Document) {
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((n) => n.remove());
  doc.querySelectorAll("style").forEach((n) => n.remove());
}

function hasStyleTarget(el: Element): el is HTMLElement | SVGElement {
  return "style" in el && !!(el as HTMLElement).style;
}

function inlineComputedStyles(original: Element, clone: Element) {
  if (original.nodeName !== clone.nodeName) return;
  if (original.nodeType !== Node.ELEMENT_NODE) return;

  const tag = original.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") return;

  if (hasStyleTarget(original) && hasStyleTarget(clone)) {
    const cs = window.getComputedStyle(original);
    for (let i = 0; i < cs.length; i++) {
      const name = cs.item(i);
      if (!name) continue;
      let value = cs.getPropertyValue(name);
      if (/oklab|oklch/i.test(value)) continue;
      const priority = cs.getPropertyPriority(name);
      if (value) {
        clone.style.setProperty(name, value, priority);
      }
    }
  }

  const oChildren = original.children;
  const cChildren = clone.children;
  const n = Math.min(oChildren.length, cChildren.length);
  for (let i = 0; i < n; i++) {
    inlineComputedStyles(oChildren[i]!, cChildren[i]!);
  }
}

export async function exportArchitecturePdf(target: HTMLElement) {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 400));

  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: "#000000",
    logging: false,
    useCORS: true,
    allowTaint: true,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: target.scrollWidth,
    windowHeight: target.scrollHeight,
    foreignObjectRendering: true,
    onclone: (doc, clonedRoot) => {
      stripClonedStylesheets(doc);
      const node = doc.getElementById("architecture-doc-pdf");
      if (node) {
        (node as HTMLElement).style.overflow = "visible";
        (node as HTMLElement).style.height = "auto";
      }
      doc.documentElement.style.background = "#000000";
      doc.body.style.background = "#000000";
      inlineComputedStyles(target, clonedRoot);
    },
  });

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(FILENAME);
}
