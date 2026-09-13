Folio V2 file helpers use locally bundled upstream packages. No CDN or remote document upload.
DOCX browser IIFE: docx 9.6.1 (MIT).
ZIP: JSZip 3.10.1 (MIT or GPLv3).
PDF text extraction: Mozilla pdfjs-dist 5.6.205 (Apache-2.0).
The PDF.js self-contained build and worker are wrapped in IIFEs, their final ESM exports removed, and import.meta.url replaced by the script URL. Global exports supplied by upstream are preserved. Preloading the worker implementation makes file:// text extraction work without dynamic module requests. PDF.js uses local fonts and performs no external fetch during the configured text extraction.
See adjacent LICENSE files.
