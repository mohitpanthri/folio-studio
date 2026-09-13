# Folio Studio

Folio Studio is a browser-based resume and CV builder. Choose a template, customize your design, edit your details with a live preview, and download your finished resume. No account, backend, or AI service is required.

## Features

- 16 resume templates plus custom layouts, colors, typography, and saved designs
- Resume and matching cover-letter editing with live preview
- PDF, Word, text, and HTML downloads, plus JSON backups
- PDF, DOCX, and text imports with editable extracted content; scanned PDFs require external OCR
- Local resume content checks and job-description keyword matching
- Saved drafts and versions
- Light and dark themes with a remembered preference
- A fresh demo on every opening; editing it creates a separate personal draft

## Storage and privacy

Resume data, saved designs, versions, and theme preferences are stored locally in your browser using `localStorage`. Resume processing happens on your device, without uploading your documents to a backend or AI service.

There is no cloud backup or cross-device synchronization. Data is specific to the browser and website address you use. Clearing browser storage can remove saved drafts, and private browsing may discard them when the session ends. Download JSON backups to keep separate copies of your resumes.

## License

A project license has not yet been included in this folder. If you add a license through GitHub, the repository's `LICENSE` file will contain the applicable terms for the project code.

Bundled third-party libraries and fonts retain their own licenses. Their license notices are included in `vendor/`.

## Tech stack

- **Interface:** HTML5, CSS3, and vanilla JavaScript
- **Storage:** Browser `localStorage`
- **PDF export:** pdf-lib and fontkit with bundled fonts
- **PDF import:** PDF.js
- **Word export:** docx
- **Word import:** JSZip and the browser's XML parser
- **File downloads:** Browser Blob and object URL APIs
- **Hosting:** Static files compatible with GitHub Pages; no backend or build step required
