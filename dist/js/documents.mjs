const maxBytes = 10 * 1024 * 1024;
export const maxCharacters = 150000;

async function pdfText(buffer) {
  const pdfjs = await import('../vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({data: buffer, isEvalSupported: false, useSystemFonts: true});
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('The PDF exceeds 100 pages.');
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      let text = '';
      let previousY;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(y - previousY) > 3 && !text.endsWith('\n')) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : ' ');
        previousY = y;
      }
      pages.push(text);
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

let mammothReady;
function mammoth() {
  if (!mammothReady) {
    mammothReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/mammoth.browser.min.js', import.meta.url).href;
      script.onload = () => resolve(window.mammoth);
      script.onerror = () => {
        script.remove();
        mammothReady = null;
        reject(new Error('The DOCX reader could not load.'));
      };
      document.head.append(script);
    });
  }
  return mammothReady;
}

export async function readDocument(file) {
  const type = file.name.split('.').at(-1).toLowerCase();
  if (!['txt', 'pdf', 'docx'].includes(type)) throw new Error('Choose a PDF, DOCX, or TXT file.');
  if (file.size > maxBytes) throw new Error('The file exceeds 10 MB.');
  let value;
  if (type === 'txt') {
    const bytes = await file.arrayBuffer();
    const bom = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    const encoding = bom[0] === 0xff && bom[1] === 0xfe ? 'utf-16le' : bom[0] === 0xfe && bom[1] === 0xff ? 'utf-16be' : 'utf-8';
    try { value = new TextDecoder(encoding, {fatal: true}).decode(bytes); }
    catch { throw new Error('Save this text file in UTF-8 encoding and try again.'); }
  } else if (type === 'pdf') {
    value = await pdfText(await file.arrayBuffer());
  } else {
    const parser = await mammoth();
    value = (await parser.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
  }
  const clean = value.trim();
  if (!clean) throw new Error(type === 'pdf' ? 'No selectable text found. Paste the text or upload a text-based PDF.' : 'This document contains no readable text.');
  if (clean.length > maxCharacters) throw new Error('The document exceeds 150,000 characters.');
  return clean;
}
