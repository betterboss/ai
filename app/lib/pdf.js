// PDF-to-image conversion utilities for takeoff analysis
// Converts PDF pages to base64 PNG images for Claude Vision

export async function pdfToImages(pdfBuffer) {
  // Dynamic import pdfjs-dist for server-side use
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const images = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);

    // Render at 2x scale for better OCR/vision quality
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    // Create canvas-like rendering context using OffscreenCanvas or node-canvas
    // For server-side, we use a simple approach with sharp
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    // Use OffscreenCanvas if available (Node 20+), otherwise fall back
    let imageData;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const arrayBuffer = await blob.arrayBuffer();
      imageData = Buffer.from(arrayBuffer);
    } else {
      // Fallback: extract text content instead of rendering
      // This handles environments where canvas isn't available
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      images.push({
        pageNumber: i,
        type: 'text',
        content: text,
        width,
        height
      });
      continue;
    }

    images.push({
      pageNumber: i,
      type: 'image',
      data: imageData.toString('base64'),
      mimeType: 'image/png',
      width,
      height
    });
  }

  return { pageCount: numPages, images };
}

// Convert a single page buffer to base64 for Claude Vision
export function imageToBase64Content(image) {
  if (image.type === 'text') {
    return {
      type: 'text',
      text: `[Blueprint Page ${image.pageNumber} - Text Content]\n${image.content}`
    };
  }

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: image.mimeType,
      data: image.data
    }
  };
}
