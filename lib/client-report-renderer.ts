import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export async function renderClientReportElementToPdf(element: HTMLElement) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pages = Array.from(element.querySelectorAll<HTMLElement>(".client-report-page"));
  const targets = pages.length ? pages : [element];

  for (const [index, page] of targets.entries()) {
    const canvas = await html2canvas(page, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const image = canvas.toDataURL("image/jpeg", 0.95);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    if (index > 0) doc.addPage();
    doc.addImage(image, "JPEG", 0, 0, width, height);
  }

  return doc.output("blob");
}
