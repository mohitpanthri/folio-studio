# Folio Studio

A private, browser-based resume and CV builder. Choose a template, edit your details, and download a finished resume. No signup, backend, AI API key, or build step is required.

## Publish on GitHub Pages

1. Create a GitHub repository (a public repository is the simplest option for free Pages hosting).
2. Choose **Add file → Upload files**. In an empty repository, use the **uploading an existing file** link.
3. Open this folder and drag **all its contents**, including the `vendor` folder, into the upload area. Upload the extracted files, not the ZIP or the enclosing `folio-studio` folder.
4. Commit the upload. Confirm that `index.html` and `README.md` are at the repository root, alongside `vendor/`.
5. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select your uploaded branch (usually `main`) and **/ (root)**, then save.
6. Wait for deployment to finish. The Pages settings screen shows your published URL, typically `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

Official instructions: [Configure the GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The included `.nojekyll` file tells Pages to serve the static site without Jekyll processing. Keep every bundled script and stylesheet, including `vendor/`. There are no npm dependencies to install or environment variables to configure.

## Features

- 16 templates plus custom layouts, colors, typography, and saved designs
- Editable resumes and matching cover letters with live preview
- PDF, Word, text, and HTML downloads
- PDF, DOCX, and text imports with editable extracted text
- Local content checks and job-description keyword matching
- Saved drafts and versions
- Light and dark themes with a remembered preference
- A demo that opens each time; editing it creates a separate personal draft

## Storage and privacy

Resume data and theme preferences are stored locally in this browser on this device. They are not uploaded to a resume server or synchronized across devices. GitHub Pages serves the app files; resume processing happens in your browser.

Clearing browser storage can remove saved drafts. Use the JSON backup option in Download to keep a separate copy. Drafts saved on localhost do not automatically transfer to the published site. Private browsing may discard data when its session ends.

## Import and matching limits

Imports copy text into an editable draft; they do not reproduce every source layout. Review names, dates, columns, and section assignments. Scanned PDFs need OCR outside this app. Resume checks and job matching use local rules and keyword comparisons, not AI or an employer's ATS.

## Project files

- `index.html`: application entry point
- `styles.css`, `toolkit.css`: interface and theme styles
- `app.js`, `toolkit.js`: editing, local saving, and resume tools
- `templates.js`: template definitions
- `resume.js`, `resume.css`: resume rendering
- `export.js`, `file-tools.js`: downloads and imports
- `tools-core.js`: local content checks and keyword matching
- `vendor/`: bundled libraries, fonts, and their licenses

## Local use

Open `index.html` in a modern browser. GitHub Pages is recommended for a consistent hosted URL. This upload folder contains only the static website and documentation; no server is needed.

## Third-party licenses

Bundled library and font licenses are included in `vendor/`. Keep those notices with redistributed copies.
