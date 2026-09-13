(function () {
  "use strict";

  const fontCache = new Map();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const segmenter =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;

  function safeFilename(name, extension) {
    const value =
      String(name || "my-resume")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\.+$/g, "")
        .trim()
        .slice(0, 100) || "my-resume";
    return value.toLowerCase().endsWith("." + extension)
      ? value
      : value + "." + extension;
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function parseColor(value) {
    if (!value || value === "transparent") return null;
    const channels = value.match(/[\d.]+/g);
    if (!channels || channels.length < 3) return null;
    const alpha = channels.length > 3 ? Number(channels[3]) : 1;
    return alpha > 0
      ? {
          red: Number(channels[0]) / 255,
          green: Number(channels[1]) / 255,
          blue: Number(channels[2]) / 255,
          alpha,
        }
      : null;
  }

  function pdfColor(color) {
    return PDFLib.rgb(
      Math.max(0, Math.min(1, color.red)),
      Math.max(0, Math.min(1, color.green)),
      Math.max(0, Math.min(1, color.blue)),
    );
  }

  function captureArticle(article) {
    const bounds = article.getBoundingClientRect();
    const width = article.offsetWidth;
    if (!width || !bounds.width)
      throw new Error("The resume preview must be visible before exporting.");
    const zoom = bounds.width / width;
    const rootStyle = getComputedStyle(article);
    const relative = (rect) => ({
      x: (rect.left - bounds.left) / zoom,
      y: (rect.top - bounds.top) / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
    });
    const fills = [];
    const borders = [];
    const runs = [];
    const blocks = [];
    const images = [];
    const visible = new WeakMap();
    const styles = new WeakMap();

    [article, ...article.querySelectorAll("*")].forEach((element) => {
      const style = getComputedStyle(element);
      styles.set(element, style);
      const shown =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        (element === article || visible.get(element.parentElement));
      visible.set(element, shown);
      if (!shown) return;
      const rect = relative(element.getBoundingClientRect());
      if (!rect.width || !rect.height) return;
      if (
        element.matches("img.resume-photo") &&
        /^data:image\/(png|jpeg);base64,/i.test(element.src)
      )
        images.push({
          ...rect,
          element,
          radius: style.borderTopLeftRadius,
          objectFit: style.objectFit,
        });
      const fill = parseColor(style.backgroundColor);
      if (fill && element !== article) fills.push({ ...rect, color: fill });
      ["Top", "Right", "Bottom", "Left"].forEach((side) => {
        const thickness = parseFloat(style["border" + side + "Width"]);
        const kind = style["border" + side + "Style"];
        const color = parseColor(style["border" + side + "Color"]);
        if (thickness > 0 && color && kind !== "none" && kind !== "hidden")
          borders.push({ ...rect, side, thickness, color, kind });
      });
      if (element.matches(".resume-entry, .resume-section-title"))
        blocks.push({
          ...rect,
          heading: element.matches(".resume-section-title"),
        });
    });

    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !visible.get(parent) || !node.textContent.trim()) continue;
      const style = styles.get(parent) || getComputedStyle(parent);
      const size = parseFloat(style.fontSize) || 14;
      const color = parseColor(style.color) || {
        red: 0.15,
        green: 0.15,
        blue: 0.15,
        alpha: 1,
      };
      context.font =
        style.font ||
        style.fontStyle +
          " " +
          style.fontWeight +
          " " +
          size +
          "px " +
          style.fontFamily;
      const metrics = context.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent || size * 0.9;
      const descent = metrics.fontBoundingBoxDescent || size * 0.22;
      const font = {
        family: style.fontFamily,
        weight:
          Number(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400),
        italic: style.fontStyle !== "normal",
        size,
        tracking: parseFloat(style.letterSpacing) || 0,
      };
      const source = node.textContent;
      const segments = segmenter
        ? Array.from(segmenter.segment(source), (part) => ({
            text: part.segment,
            index: part.index,
          }))
        : Array.from(source).reduce((all, text) => {
            all.push({
              text,
              index: all.length
                ? all[all.length - 1].index + all[all.length - 1].text.length
                : 0,
            });
            return all;
          }, []);
      let run = null;
      const flush = () => {
        if (run && run.text.trim()) runs.push(run);
        run = null;
      };
      for (const part of segments) {
        const range = document.createRange();
        range.setStart(node, part.index);
        range.setEnd(node, part.index + part.text.length);
        const rectangles = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0.01 && rect.height > 0,
        );
        if (!rectangles.length) continue;
        const rect = relative(rectangles[0]);
        let value = part.text;
        if (!style.whiteSpace.startsWith("pre"))
          value = value.replace(/\s/g, " ");
        if (style.textTransform === "uppercase")
          value = value.toLocaleUpperCase();
        if (style.textTransform === "lowercase")
          value = value.toLocaleLowerCase();
        if (
          !run ||
          Math.abs(run.y - rect.y) > 1 ||
          rect.x < run.x - 1 ||
          rect.x > run.x + run.width + 2
        ) {
          flush();
          run = {
            ...rect,
            text: value,
            font,
            color,
            baseline: rect.y + (rect.height * ascent) / (ascent + descent),
            underline: style.textDecorationLine.includes("underline"),
          };
        } else {
          run.text += value;
          run.width = Math.max(run.width, rect.x + rect.width - run.x);
          run.height = Math.max(run.height, rect.height);
        }
      }
      flush();
    }
    const bottom = Math.max(
      0,
      ...runs.map((run) => run.y + run.height),
      ...fills.map((fill) => fill.y + fill.height),
      ...images.map((image) => image.y + image.height),
    );
    return {
      width,
      runs,
      fills,
      borders,
      blocks,
      images,
      bottom,
      background: parseColor(rootStyle.backgroundColor),
      paddingTop: parseFloat(rootStyle.paddingTop) || 48,
      paddingBottom: parseFloat(rootStyle.paddingBottom) || 48,
    };
  }

  function paginate(capture, height) {
    const pages = [];
    const bottomMargin = Math.min(72, Math.max(32, capture.paddingBottom));
    const topMargin = Math.min(72, Math.max(32, capture.paddingTop));
    let start = 0;
    for (let index = 0; index < 100; index++) {
      const inset = index ? topMargin : 0;
      const target = start + height - inset - bottomMargin;
      if (capture.bottom <= target + 1) {
        pages.push({ start, end: Math.max(capture.bottom + 1, target), inset });
        break;
      }
      let end = target;
      // Keep short entries together when doing so leaves a reasonable amount of content on the page.
      capture.blocks.forEach((block) => {
        const blockEnd = block.y + block.height + (block.heading ? 26 : 0);
        if (
          block.y < end &&
          blockEnd > end &&
          block.y > start + 180 &&
          (block.heading ||
            (block.height < height * 0.4 && end - block.y < height * 0.28))
        )
          end = Math.min(end, block.y - 2);
      });
      // A page boundary must sit between every text line, including text in a second column.
      let changed = true;
      while (changed) {
        changed = false;
        for (const run of capture.runs) {
          if (run.y < end && run.y + run.height > end && run.y > start + 1) {
            end = run.y - 0.5;
            changed = true;
          }
        }
      }
      if (end <= start + 10) end = target;
      pages.push({ start, end, inset });
      start = end;
    }
    return pages;
  }

  function fontBytes(style) {
    if (!fontCache.has(style)) {
      const binary = atob(window.ResumePDFFonts[style]);
      fontCache.set(
        style,
        Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      );
    }
    return fontCache.get(style);
  }

  async function createPDF(article, settings) {
    if (!window.PDFLib)
      throw new Error(
        "The PDF library is missing. Keep the vendor folder next to index.html.",
      );
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all(
      Array.from(article.querySelectorAll("img.resume-photo"))
        .filter((img) => /^data:image\/(png|jpeg);base64,/i.test(img.src))
        .map((img) => img.decode()),
    );
    const capture = captureArticle(article);
    const options = settings || {};
    const isLetter =
      String(options.paper || "").toLowerCase() === "letter" ||
      article.classList.contains("resume-paper-letter");
    const pageSize = isLetter ? PDFLib.PageSizes.Letter : PDFLib.PageSizes.A4;
    const ratio = pageSize[0] / capture.width;
    const pageHeight = pageSize[1] / ratio;
    const slices = paginate(capture, pageHeight);
    const documentPDF = await PDFLib.PDFDocument.create();
    documentPDF.setTitle(
      (article.querySelector(".resume-name")?.textContent || "My") +
        " — Resume",
    );
    documentPDF.setCreator("Folio Resume Builder");
    documentPDF.setProducer("Folio / pdf-lib");
    const embedded = new Map();
    const customFonts = Boolean(window.fontkit && window.ResumePDFFonts);
    if (customFonts) documentPDF.registerFontkit(window.fontkit);
    const missing = new Set();
    const embeddedImages = [];
    for (const image of capture.images) {
      const raster = document.createElement("canvas");
      raster.width = Math.ceil(image.width * 3);
      raster.height = Math.ceil(image.height * 3);
      const ctx = raster.getContext("2d"),
        raw = image.element;
      const radius = Math.min(
        raster.width / 2,
        raster.height / 2,
        parseFloat(image.radius || 0) *
          (String(image.radius).includes("%")
            ? Math.min(raster.width, raster.height) / 100
            : 3),
      );
      ctx.beginPath();
      ctx.roundRect(0, 0, raster.width, raster.height, radius);
      ctx.clip();
      const scale =
        image.objectFit === "contain"
          ? Math.min(
              raster.width / raw.naturalWidth,
              raster.height / raw.naturalHeight,
            )
          : Math.max(
              raster.width / raw.naturalWidth,
              raster.height / raw.naturalHeight,
            );
      const width = raw.naturalWidth * scale,
        height = raw.naturalHeight * scale;
      ctx.drawImage(
        raw,
        (raster.width - width) / 2,
        (raster.height - height) / 2,
        width,
        height,
      );
      embeddedImages.push({
        ...image,
        pdfImage: await documentPDF.embedPng(raster.toDataURL("image/png")),
      });
    }

    async function getFont(font, text) {
      const bold = font.weight >= 600;
      const style = bold
        ? font.italic
          ? "boldItalic"
          : "bold"
        : font.italic
          ? "italic"
          : "regular";
      const serif =
        /georgia|times|(^|[, ])serif/i.test(font.family) &&
        !/sans-serif/i.test(font.family);
      const mono = /courier|monospace/i.test(font.family);
      let family = serif ? "times" : mono ? "courier" : "sans";
      // The standard PDF fonts cover Western text. Embedded Liberation adds Greek, Cyrillic and more.
      if (
        (serif || mono) &&
        /[^\u0000-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/.test(
          text,
        )
      )
        family = "sans";
      const key = family + "-" + style;
      if (!embedded.has(key)) {
        let pdfFont;
        let characterSet;
        if (family === "sans" && customFonts) {
          pdfFont = await documentPDF.embedFont(fontBytes(style), {
            subset: true,
          });
          characterSet = new Set(pdfFont.getCharacterSet());
        } else {
          const names =
            family === "times"
              ? [
                  "TimesRoman",
                  "TimesRomanBold",
                  "TimesRomanItalic",
                  "TimesRomanBoldItalic",
                ]
              : family === "courier"
                ? [
                    "Courier",
                    "CourierBold",
                    "CourierOblique",
                    "CourierBoldOblique",
                  ]
                : [
                    "Helvetica",
                    "HelveticaBold",
                    "HelveticaOblique",
                    "HelveticaBoldOblique",
                  ];
          pdfFont = await documentPDF.embedFont(
            PDFLib.StandardFonts[
              names[["regular", "bold", "italic", "boldItalic"].indexOf(style)]
            ],
          );
          characterSet = new Set(pdfFont.getCharacterSet());
        }
        embedded.set(key, { pdfFont, characterSet });
      }
      return embedded.get(key);
    }

    for (const slice of slices) {
      const page = documentPDF.addPage(pageSize);
      const y = (top) =>
        pageSize[1] - (top - slice.start + slice.inset) * ratio;
      const background = capture.background || {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 1,
      };
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageSize[0],
        height: pageSize[1],
        color: pdfColor(background),
      });

      for (const fill of capture.fills) {
        const top = Math.max(fill.y, slice.start);
        const bottom = Math.min(fill.y + fill.height, slice.end);
        if (bottom > top)
          page.drawRectangle({
            x: fill.x * ratio,
            y: y(bottom),
            width: fill.width * ratio,
            height: (bottom - top) * ratio,
            color: pdfColor(fill.color),
            opacity: fill.color.alpha,
          });
      }
      for (const border of capture.borders) {
        const horizontal = border.side === "Top" || border.side === "Bottom";
        const top = horizontal
          ? border.y +
            (border.side === "Bottom" ? border.height - border.thickness : 0)
          : Math.max(border.y, slice.start);
        const bottom = horizontal
          ? top + border.thickness
          : Math.min(border.y + border.height, slice.end);
        if (bottom <= slice.start || top >= slice.end || bottom <= top)
          continue;
        const x =
          border.x +
          (border.side === "Right" ? border.width - border.thickness : 0);
        if (horizontal && border.kind === "double") {
          [0, (border.thickness * 2) / 3].forEach((offset) =>
            page.drawRectangle({
              x: x * ratio,
              y: y(top + offset + border.thickness / 3),
              width: border.width * ratio,
              height: (border.thickness / 3) * ratio,
              color: pdfColor(border.color),
              opacity: border.color.alpha,
            }),
          );
        } else {
          page.drawRectangle({
            x: x * ratio,
            y: y(Math.min(bottom, slice.end)),
            width: (horizontal ? border.width : border.thickness) * ratio,
            height:
              (Math.min(bottom, slice.end) - Math.max(top, slice.start)) *
              ratio,
            color: pdfColor(border.color),
            opacity: border.color.alpha,
          });
        }
      }
      for (const image of embeddedImages) {
        if (image.y >= slice.start && image.y < slice.end)
          page.drawImage(image.pdfImage, {
            x: image.x * ratio,
            y: y(image.y + image.height),
            width: image.width * ratio,
            height: image.height * ratio,
          });
      }
      for (const run of capture.runs) {
        if (run.y < slice.start - 0.1 || run.y >= slice.end) continue;
        const { pdfFont, characterSet } = await getFont(run.font, run.text);
        const text = Array.from(run.text.replace(/[\r\n\t]/g, " "))
          .map((character) => {
            if (characterSet.has(character.codePointAt(0))) return character;
            if (/\p{Mark}|\u200b|\u200c|\u200d|\ufe0f/u.test(character))
              return "";
            missing.add(character);
            return characterSet.has(0x25a1) ? "□" : "?";
          })
          .join("");
        if (!text) continue;
        const fontSize = run.font.size * ratio;
        const tracking = run.font.tracking * ratio;
        const textWidth =
          pdfFont.widthOfTextAtSize(text, fontSize) +
          tracking * Math.max(0, Array.from(text).length - 1);
        const stretch =
          textWidth > 0
            ? ((run.width - run.font.tracking) * ratio) / textWidth
            : 1;
        page.pushOperators(
          PDFLib.pushGraphicsState(),
          PDFLib.translate(run.x * ratio, y(run.baseline)),
          PDFLib.scale(stretch, 1),
          PDFLib.setCharacterSpacing(tracking),
        );
        page.drawText(text, {
          x: 0,
          y: 0,
          size: fontSize,
          font: pdfFont,
          color: pdfColor(run.color),
          opacity: run.color.alpha,
        });
        page.pushOperators(PDFLib.popGraphicsState());
        if (run.underline)
          page.drawLine({
            start: { x: run.x * ratio, y: y(run.baseline) - fontSize * 0.12 },
            end: {
              x: (run.x + run.width) * ratio,
              y: y(run.baseline) - fontSize * 0.12,
            },
            thickness: Math.max(0.4, fontSize * 0.045),
            color: pdfColor(run.color),
          });
      }
    }
    return {
      bytes: await documentPDF.save(),
      pageCount: slices.length,
      unsupportedCharacters: Array.from(missing),
    };
  }

  async function downloadPDF(article, filename, settings) {
    const result = await createPDF(article, settings);
    downloadBlob(
      new Blob([result.bytes], { type: "application/pdf" }),
      safeFilename(filename, "pdf"),
    );
    return result;
  }

  function downloadText(text, filename) {
    downloadBlob(
      new Blob([String(text)], { type: "text/plain;charset=utf-8" }),
      safeFilename(filename, "txt"),
    );
  }

  function downloadJSON(data, filename) {
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      safeFilename(filename, "json"),
    );
  }

  function downloadHTML(article, filename, cssText) {
    const clone = article.cloneNode(true);
    clone
      .querySelectorAll("[contenteditable], [tabindex]")
      .forEach((element) => {
        element.removeAttribute("contenteditable");
        element.removeAttribute("tabindex");
      });
    clone.removeAttribute("contenteditable");
    clone.removeAttribute("style");
    if (article.getAttribute("style"))
      clone.setAttribute("style", article.getAttribute("style"));
    const title = String(filename || "My resume").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
    const html =
      '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      title +
      "</title><style>body{margin:0;background:#f0f0f0}.resume-sheet{margin:32px auto} @media print{body{background:white}.resume-sheet{margin:0}}\n" +
      String(cssText || "").replace(/<\/style/gi, "<\\/style") +
      "</style></head><body>" +
      clone.outerHTML +
      "</body></html>";
    downloadBlob(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      safeFilename(filename, "html"),
    );
  }

  window.ResumeExport = {
    downloadPDF,
    createPDF,
    downloadText,
    downloadJSON,
    downloadHTML,
  };
})();
