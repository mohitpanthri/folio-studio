(function () {
  "use strict";
  const txt = (value) => String(value == null ? "" : value).trim();
  const esc = (value) => window.ResumeRenderer.escapeHtml(value);
  const MAX_BYTES = 15 * 1024 * 1024;
  const MAX_TEXT = 250000;

  function filename(name, extension) {
    const clean =
      txt(name || "my-resume")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\.+$/, "")
        .slice(0, 100) || "my-resume";
    return clean.toLowerCase().endsWith("." + extension)
      ? clean
      : clean + "." + extension;
  }
  function download(blob, name) {
    const link = document.createElement("a"),
      url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function safeURL(value, email) {
    const original = txt(value);
    if (!original || /[\u0000-\u0020<>"']/.test(original)) return "";
    const candidate =
      email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(original)
        ? "mailto:" + original
        : /^[a-z][a-z\d+.-]*:/i.test(original)
          ? original
          : "https://" + original;
    try {
      const url = new URL(candidate);
      return ["https:", "http:", "mailto:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }
  function parseXML(source) {
    const xml = new DOMParser().parseFromString(source, "application/xml");
    if (xml.getElementsByTagName("parsererror").length)
      throw new Error(
        "The Word document contains invalid XML. Try saving it again as .docx.",
      );
    return xml;
  }
  async function extractDOCX(buffer) {
    if (!window.JSZip)
      throw new Error(
        "The Word import library is missing from the vendor folder.",
      );
    const zip = await JSZip.loadAsync(buffer);
    const xmlEntry = zip.file("word/document.xml");
    if (!xmlEntry)
      throw new Error(
        "This file is not a standard .docx document. Use Word’s Save As → .docx.",
      );
    if (xmlEntry._data && xmlEntry._data.uncompressedSize > MAX_BYTES)
      throw new Error(
        "This document is too large to import. Export a shorter resume first.",
      );
    const source = await xmlEntry.async("string");
    if (source.length > MAX_BYTES)
      throw new Error("This document is too large to import.");
    const doc = parseXML(source);
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const paragraphs = Array.from(doc.getElementsByTagNameNS(ns, "p")).map(
      (p) => {
        const pieces = [];
        const walk = (node) => {
          if (node.nodeType !== 1) return;
          if (node.localName === "del") return;
          if (node.localName === "t") {
            pieces.push(node.textContent);
            return;
          }
          if (node.localName === "tab") {
            pieces.push(" | ");
            return;
          }
          if (node.localName === "br" || node.localName === "cr") {
            pieces.push("\n");
            return;
          }
          Array.from(node.children).forEach(walk);
        };
        walk(p);
        let line = pieces.join("").trim();
        if (line && p.getElementsByTagNameNS(ns, "numPr").length)
          line = "- " + line;
        return line;
      },
    );
    const value = paragraphs
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!value)
      throw new Error(
        "No editable text was found in this Word document. Image-only resumes cannot be imported.",
      );
    return {
      text: value.slice(0, MAX_TEXT),
      sourceType: "DOCX",
      warnings: [
        "Text and bullets were extracted locally. Columns, images, headers, footers, and some formatting are not imported. Review names, dates, and section boundaries before creating a draft.",
      ].concat(
        value.length > MAX_TEXT
          ? ["Only the first 250,000 characters were extracted."]
          : [],
      ),
    };
  }
  async function extractPDF(buffer) {
    if (!window.pdfjsLib || !window.pdfjsWorker)
      throw new Error(
        "The local PDF import libraries are missing from the vendor folder.",
      );
    const task = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      enableXfa: false,
      stopAtErrors: true,
    });
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 40)
        throw new Error(
          "This PDF has more than 40 pages. Import a shorter resume PDF.",
        );
      const pages = [];
      let blankPages = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number),
          content = await page.getTextContent();
        const lines = [];
        let line = "",
          previous = null;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const newLine =
            previous &&
            Math.abs(item.transform[5] - previous.transform[5]) >
              Math.max(
                3,
                Math.min(item.height || 10, previous.height || 10) * 0.65,
              );
          if (newLine && line) {
            lines.push(line.trim());
            line = "";
          }
          const gap =
            previous && !newLine
              ? item.transform[4] - (previous.transform[4] + previous.width)
              : 0;
          line +=
            (line && !/\s$/.test(line) && !/^\s/.test(item.str) && gap > 1
              ? " "
              : "") + item.str;
          if (item.hasEOL) {
            lines.push(line.trim());
            line = "";
            previous = null;
          } else previous = item;
        }
        if (line.trim()) lines.push(line.trim());
        const value = lines.filter(Boolean).join("\n").trim();
        if (!value) blankPages++;
        pages.push(value);
        page.cleanup();
      }
      const value = pages.filter(Boolean).join("\n\n");
      if (!value.trim())
        throw new Error(
          "This PDF has no selectable text. Scanned or image-only PDFs need OCR first; Folio does not upload your document or run OCR.",
        );
      return {
        text: value.slice(0, MAX_TEXT),
        sourceType: "PDF",
        warnings: [
          "Selectable text was extracted locally. PDF columns can change reading order; review the extracted text before creating a draft.",
        ]
          .concat(
            blankPages
              ? [
                  blankPages +
                    " page(s) contained no selectable text and were skipped.",
                ]
              : [],
          )
          .concat(
            value.length > MAX_TEXT
              ? ["Only the first 250,000 characters were extracted."]
              : [],
          ),
      };
    } catch (error) {
      if (error && error.name === "PasswordException")
        throw new Error(
          "This PDF is password protected. Save an unlocked copy before importing.",
        );
      throw error;
    } finally {
      if (pdf) await pdf.destroy();
      else await task.destroy();
    }
  }
  async function extractFile(file) {
    if (!file || !file.size)
      throw new Error("Choose a non-empty PDF, DOCX, or text file.");
    if (file.size > MAX_BYTES)
      throw new Error("Choose a file smaller than 15 MB.");
    const extension = txt(file.name).split(".").pop().toLowerCase();
    if (extension === "pdf") return extractPDF(await file.arrayBuffer());
    if (extension === "docx") return extractDOCX(await file.arrayBuffer());
    if (
      ["txt", "md", "text"].includes(extension) ||
      file.type === "text/plain"
    ) {
      const text = (await file.text()).replace(/\u0000/g, "").trim();
      if (!text) throw new Error("This text file is empty.");
      return {
        text: text.slice(0, MAX_TEXT),
        sourceType: "TXT",
        warnings: [
          "Review the text and section boundaries before creating a draft.",
        ].concat(
          text.length > MAX_TEXT
            ? ["Only the first 250,000 characters were extracted."]
            : [],
        ),
      };
    }
    throw new Error(
      "Supported resume imports are PDF, DOCX, and TXT. For older .doc files, save a .docx copy first.",
    );
  }

  const parseText = window.FolioImport.parseText;

  function renderedDOM(data, settings, letter) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML =
      letter && ResumeRenderer.renderCoverLetter
        ? ResumeRenderer.renderCoverLetter(data, settings, letter)
        : ResumeRenderer.render(data, settings);
    return wrapper;
  }
  async function createDOCX(data, settings, letter) {
    if (!window.docx)
      throw new Error(
        "The Word export library is missing from the vendor folder.",
      );
    settings = settings || {};
    const D = window.docx,
      personal = data.personal || {},
      children = [];
    const font =
      settings.font === "serif"
        ? "Georgia"
        : settings.font === "mono"
          ? "Courier New"
          : "Arial";
    const size = Math.max(
      18,
      Math.min(28, Number(settings.fontSize || 11) * 2),
    );
    const accent = /^#[0-9a-f]{6}$/i.test(settings.accent || "")
      ? settings.accent.slice(1)
      : "B65C3A";
    const paragraph = (text, options) =>
      new D.Paragraph({
        children: [new D.TextRun({ text: String(text), font, size })],
        spacing: { after: 100 },
        ...options,
      });
    const root = renderedDOM(data, settings, letter);
    const photo = root.querySelector(".resume-photo");
    if (photo && /^data:image\/(png|jpeg);base64,/i.test(photo.src)) {
      const imageData = Uint8Array.from(atob(photo.src.split(",")[1]), (char) =>
        char.charCodeAt(0),
      );
      children.push(
        new D.Paragraph({
          children: [
            new D.ImageRun({
              data: imageData,
              type: photo.src.startsWith("data:image/png") ? "png" : "jpg",
              transformation: { width: 72, height: 72 },
            }),
          ],
          alignment: D.AlignmentType.RIGHT,
          spacing: { after: 60 },
        }),
      );
    }
    children.push(
      new D.Paragraph({
        text:
          [personal.firstName, personal.lastName]
            .map(txt)
            .filter(Boolean)
            .join(" ") || "Resume",
        heading: D.HeadingLevel.TITLE,
        spacing: { after: 100 },
      }),
    );
    if (personal.title)
      children.push(
        new D.Paragraph({
          children: [
            new D.TextRun({
              text: txt(personal.title),
              color: accent,
              bold: true,
              font,
              size: size + 2,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    const contactRuns = [];
    for (const field of ["email", "phone", "location", "website", "linkedin"]) {
      if (!txt(personal[field])) continue;
      if (contactRuns.length)
        contactRuns.push(
          new D.TextRun({ text: "  |  ", font, size: size - 2 }),
        );
      const url = ["email", "website", "linkedin"].includes(field)
        ? safeURL(personal[field], field === "email")
        : "";
      const run = new D.TextRun({
        text: txt(personal[field]),
        font,
        size: size - 2,
        ...(url ? { style: "Hyperlink" } : {}),
      });
      contactRuns.push(
        url ? new D.ExternalHyperlink({ children: [run], link: url }) : run,
      );
    }
    if (contactRuns.length)
      children.push(
        new D.Paragraph({ children: contactRuns, spacing: { after: 240 } }),
      );
    if (letter) {
      [
        letter.date,
        letter.recipient,
        letter.company,
        letter.role ? "Re: " + letter.role : "",
        letter.greeting || "Dear Hiring Manager,",
      ]
        .filter(Boolean)
        .forEach((line) => children.push(paragraph(line)));
      txt(letter.body)
        .split(/\n+/)
        .filter(Boolean)
        .forEach((line) =>
          children.push(paragraph(line, { spacing: { after: 200 } })),
        );
      children.push(paragraph(letter.closing || "Kind regards,"));
      children.push(
        paragraph(
          letter.signature ||
            [personal.firstName, personal.lastName].filter(Boolean).join(" "),
        ),
      );
    } else {
      for (const section of root.querySelectorAll(".resume-section")) {
        const title = section.querySelector(".resume-section-title");
        if (title)
          children.push(
            new D.Paragraph({
              text: title.textContent,
              heading: D.HeadingLevel.HEADING_1,
              keepNext: true,
              spacing: { before: 220, after: 120 },
            }),
          );
        const entries = section.querySelectorAll(".resume-entry");
        if (entries.length) {
          entries.forEach((entry) => {
            const title = entry.querySelector(".resume-entry-title");
            if (title && txt(title.textContent))
              children.push(
                new D.Paragraph({
                  children: [
                    new D.TextRun({
                      text: title.textContent,
                      font,
                      size,
                      bold: true,
                    }),
                  ],
                  keepNext: true,
                  spacing: { after: 60 },
                }),
              );
            const details = [
              entry.querySelector(
                ".resume-entry-meta, .resume-school, .resume-project-link",
              )?.textContent,
              entry.querySelector(".resume-dates")?.textContent,
            ]
              .map(txt)
              .filter(Boolean);
            if (details.length)
              children.push(
                paragraph(details.join(" | "), {
                  keepNext: true,
                  spacing: { after: 80 },
                }),
              );
            entry
              .querySelectorAll(".resume-description p")
              .forEach((p) =>
                children.push(
                  paragraph(
                    p.textContent.replace(/^•\s*/, ""),
                    p.classList.contains("resume-bullet")
                      ? { bullet: { level: 0 }, spacing: { after: 60 } }
                      : {},
                  ),
                ),
              );
            children.push(
              paragraph("", { spacing: { after: 50 }, children: [] }),
            );
          });
        } else {
          const skill = section.querySelector(".resume-skills");
          if (skill)
            children.push(
              paragraph(
                Array.from(skill.querySelectorAll(".resume-skill"))
                  .map((item) => item.textContent)
                  .join(", "),
              ),
            );
          else
            section
              .querySelectorAll(".resume-description p")
              .forEach((p) =>
                children.push(
                  paragraph(
                    p.textContent.replace(/^•\s*/, ""),
                    p.classList.contains("resume-bullet")
                      ? { bullet: { level: 0 } }
                      : {},
                  ),
                ),
              );
        }
      }
    }
    const doc = new D.Document({
      creator: "Folio Resume Studio",
      title:
        [personal.firstName, personal.lastName].filter(Boolean).join(" ") +
        (letter ? " Cover Letter" : " Resume"),
      description: "Editable resume created locally with Folio",
      styles: {
        default: {
          document: {
            run: { font, size, color: "253039" },
            paragraph: { spacing: { line: 260 } },
          },
          title: { run: { font, size: 44, bold: true, color: "17252A" } },
          heading1: {
            run: { font, size: size + 1, bold: true, color: accent },
            paragraph: { keepNext: true },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size:
                settings.paper === "letter"
                  ? { width: 12240, height: 15840 }
                  : { width: 11906, height: 16838 },
              margin: { top: 850, right: 850, bottom: 850, left: 850 },
            },
          },
          children,
        },
      ],
    });
    return D.Packer.toBlob(doc);
  }
  async function downloadDOCX(data, settings, name, letter) {
    const blob = await createDOCX(data, settings, letter);
    download(blob, filename(name, "docx"));
    return {
      size: blob.size,
      note: "Editable Word document with a clean single-column layout.",
    };
  }

  function stylesheetText() {
    const texts = [];
    for (const sheet of document.styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || [])
          .map((rule) => rule.cssText)
          .join("\n");
        if (rules.includes("resume-sheet")) texts.push(rules);
      } catch {
        /* file:// stylesheets may require the generated local CSS bundle */
      }
    }
    return (
      texts.join("\n") ||
      window.FolioResumeCSS ||
      ".resume-sheet{background:white;padding:48px;font:15px/1.5 Arial,sans-serif;max-width:794px;margin:auto;color:#253039}.resume-name{font-size:38px}.resume-section-title{font-size:16px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:6px}.resume-entry{margin:18px 0}.resume-entry-title{font-size:16px;margin:0}.resume-dates{font-size:13px;color:#64716d}.resume-description p{margin:6px 0}.resume-skill{margin-right:12px}.resume-contact-item{margin-right:8px}"
    );
  }
  function embeddedFonts() {
    const fonts = window.ResumePDFFonts || {};
    return Object.entries(fonts)
      .map(
        ([style, base64]) =>
          '@font-face{font-family:"Folio Embedded Sans";src:url(data:font/ttf;base64,' +
          base64 +
          ') format("truetype");font-weight:' +
          (style.includes("bold") ? "700" : "400") +
          ";font-style:" +
          (/italic/i.test(style) ? "italic" : "normal") +
          ";font-display:swap}",
      )
      .join("\n");
  }
  function createHTML(data, settings, name, options) {
    options = options || {};
    const root = renderedDOM(data, settings, options.letter),
      article = root.firstElementChild;
    root
      .querySelectorAll(
        "[contenteditable],[tabindex],[data-resume-path],[data-letter-path]",
      )
      .forEach((node) => {
        node.removeAttribute("contenteditable");
        node.removeAttribute("tabindex");
        node.removeAttribute("data-resume-path");
        node.removeAttribute("data-letter-path");
      });
    if (!settings || !["serif", "mono"].includes(settings.font))
      article.style.setProperty(
        "--resume-font",
        '"Folio Embedded Sans", Arial, sans-serif',
      );
    root
      .querySelectorAll(
        ".resume-contact-email,.resume-contact-website,.resume-contact-linkedin,.resume-project-link",
      )
      .forEach((node) => {
        const url = safeURL(
          node.textContent,
          node.classList.contains("resume-contact-email"),
        );
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.textContent = node.textContent;
          a.rel = "noopener noreferrer";
          node.replaceChildren(a);
        }
      });
    root.querySelectorAll("img").forEach((img) => {
      if (!/^data:image\/(png|jpeg);base64,/i.test(img.src)) img.remove();
    });
    const personal = data.personal || {},
      fullName =
        [personal.firstName, personal.lastName].filter(Boolean).join(" ") ||
        "My resume";
    const base = stylesheetText()
      .replace(/@import[^;]+;/gi, "")
      .replace(/url\(\s*["']?(?:https?:)?\/\/[^)]+\)/gi, "none")
      .replace(/<\/style/gi, "<\\/style");
    const fonts = embeddedFonts();
    let extra =
      'html{scroll-behavior:smooth}body{margin:0;background:#eef0ec;color:#263c37;font-family:"Folio Embedded Sans",Arial,sans-serif}a{color:inherit;text-underline-offset:3px}.resume-sheet{margin:40px auto;box-shadow:0 12px 50px #24392f12}.resume-sheet *{box-sizing:border-box}@media(max-width:850px){.resume-sheet{width:100%!important;min-height:0!important;margin:0;padding:28px!important;box-sizing:border-box}.resume-columns{display:block!important}.resume-sidebar{border:0!important;padding:0!important}.resume-name{font-size:30px!important}.resume-entry-top{flex-wrap:wrap}.resume-photo{max-width:80px}}@media print{body{background:white}.resume-sheet{margin:0;box-shadow:none}.portfolio-nav,.portfolio-footer{display:none}}';
    let before = "",
      after = "";
    if (options.portfolio) {
      article.classList.add("portfolio-resume");
      const ids = [];
      article.querySelectorAll(".resume-section").forEach((section, i) => {
        section.id = "section-" + i;
        const title = section.querySelector("h2")?.textContent;
        if (title) ids.push({ id: section.id, title });
      });
      before =
        '<nav class="portfolio-nav"><a class="portfolio-brand" href="#">' +
        esc(fullName) +
        "<span>Portfolio & resume</span></a><div>" +
        ids
          .slice(0, 5)
          .map(
            (item) => '<a href="#' + item.id + '">' + esc(item.title) + "</a>",
          )
          .join("") +
        "</div></nav>";
      const contact = safeURL(personal.email, true);
      after =
        '<footer class="portfolio-footer"><strong>Let’s connect.</strong>' +
        (contact
          ? '<a href="' + esc(contact) + '">' + esc(personal.email) + " ↗</a>"
          : "<span>" + esc(personal.location || fullName) + "</span>") +
        "</footer>";
      extra +=
        "body{background:#f6f7f2}.portfolio-nav{max-width:1120px;margin:0 auto;display:flex;justify-content:space-between;gap:30px;align-items:center;padding:30px}.portfolio-nav a{text-decoration:none;font-size:13px}.portfolio-brand{font-weight:bold;font-size:18px!important}.portfolio-brand span{display:block;font-size:11px;font-weight:normal;margin-top:5px;letter-spacing:1px;text-transform:uppercase;opacity:.65}.portfolio-nav>div{display:flex;gap:24px}.portfolio-resume{width:auto!important;max-width:1120px;min-height:0!important;margin:10px auto 50px;border:1px solid #dce2d7;border-radius:20px;overflow:hidden;box-shadow:none;padding:62px!important}.portfolio-resume .resume-header{padding-bottom:42px;margin-bottom:32px}.portfolio-resume .resume-name{font-size:50px}.portfolio-resume .resume-professional-title{font-size:20px;margin-top:14px}.portfolio-resume .resume-section{scroll-margin-top:24px}.portfolio-resume .resume-entry{padding:20px 0;border-bottom:1px solid #e4e8e0}.portfolio-resume .resume-section-title{font-size:14px;letter-spacing:1.3px}.portfolio-footer{max-width:1060px;margin:0 auto;padding:0 30px 50px;display:flex;justify-content:space-between;gap:20px}.portfolio-footer strong{font-size:26px}.portfolio-footer a{align-self:center}@media(max-width:700px){.portfolio-nav{padding:24px}.portfolio-nav>div{display:none}.portfolio-resume{margin:0!important;border-radius:0;padding:28px!important}.portfolio-footer{padding:30px 24px;display:grid}.portfolio-resume .resume-name{font-size:36px}}";
      extra +=
        ".portfolio-resume{font-size:16px;line-height:1.7}.portfolio-resume .resume-contact{font-size:12px;row-gap:8px}.portfolio-resume .resume-entry-title{font-size:18px}.portfolio-resume .resume-entry-meta,.portfolio-resume .resume-school,.portfolio-resume .resume-project-link{font-size:14px}.portfolio-resume .resume-dates{font-size:11px}.portfolio-resume .resume-sidebar{width:auto}.portfolio-resume .resume-section+.resume-section{margin-top:32px}@media(max-width:700px){.portfolio-resume .resume-entry-top{display:block}.portfolio-resume .resume-dates{margin-top:5px}.portfolio-resume .resume-header{padding-bottom:26px}.portfolio-resume .resume-contact{max-width:100%;margin-top:20px}.portfolio-resume .resume-sidebar{margin-top:32px}}";
    }
    return (
      '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' +
      esc(name || fullName) +
      '</title><meta name="description" content="' +
      esc(fullName + " — " + (personal.title || "Resume and portfolio")) +
      '"><style>' +
      fonts +
      "\n" +
      base +
      "\n" +
      extra +
      "</style></head><body>" +
      before +
      root.innerHTML +
      after +
      "</body></html>"
    );
  }
  async function downloadHTML(data, settings, name, options) {
    const html = createHTML(data, settings, name, options);
    download(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      filename(name, "html"),
    );
    return { size: html.length };
  }
  window.FolioFiles = {
    extractFile,
    parseText,
    downloadDOCX,
    createDOCX,
    downloadHTML,
    createHTML,
    safeURL,
  };
})();
