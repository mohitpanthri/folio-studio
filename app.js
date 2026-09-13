(() => {
  "use strict";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];
  const esc = (value) => window.ResumeRenderer.escapeHtml(value);
  const uid = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const icon = window.FolioIcons.icon;
  const templates = window.FolioTemplates;
  const sectionNames = {
    summary: "Professional summary",
    experience: "Work experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
  };
  const defaultSettings = {
    template: "studio",
    accent: "#b65c3a",
    font: "sans",
    fontSize: 11,
    spacing: "comfortable",
    layout: "two-column",
    paper: "a4",
    sectionOrder: ["summary", "experience", "education", "skills", "projects"],
    hiddenSections: [],
    margin: 58,
    headingStyle: "uppercase",
    sidebarSide: "right",
    photoShape: "circle",
    sectionLabels: {},
  };
  const sample = window.FolioDemo;
  const STORAGE_KEY = "folio-resumes-v2",
    DEMO_ID = "folio-demo-v2";
  const emptyLetter = () => ({
    recipient: "Hiring team",
    company: "",
    role: "",
    date: new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    greeting: "Dear hiring team,",
    body: "",
    closing: "Kind regards,",
    signature: "",
  });
  sample.coverLetter = emptyLetter();
  sample.targetJob = { title: "", company: "", description: "" };
  let viewMode = "resume";
  const histories = new Map();
  let library = { version: 2, activeId: null, documents: [] },
    storageAvailable = true,
    savingTimer,
    zoom = null,
    tab = "content",
    openSection = "personal",
    currentModal = null,
    lastFocus = null;
  function makeDocument(name, data = sample, settings = defaultSettings) {
    return {
      id: uid(),
      name,
      updatedAt: new Date().toISOString(),
      data: clone(data),
      settings: clone(settings),
    };
  }
  function validateDocument(input) {
    if (
      !input ||
      typeof input !== "object" ||
      !input.data ||
      !input.data.personal
    )
      throw new Error("This file is not a Folio resume backup.");
    const source = input.data,
      data = {
        personal: {},
        summary: "",
        experience: [],
        education: [],
        skills: "",
        projects: [],
        customSections: [],
      };
    const clean = (v) => (typeof v === "string" ? v : "");
    for (const key of Object.keys(sample.personal))
      data.personal[key] = clean(source.personal[key]);
    data.summary = clean(source.summary);
    data.skills = clean(source.skills);
    for (const [key, fields] of Object.entries({
      experience: [
        "role",
        "company",
        "location",
        "start",
        "end",
        "description",
      ],
      education: ["degree", "school", "start", "end", "description"],
      projects: ["name", "link", "description"],
      customSections: ["title", "content"],
    })) {
      data[key] = (Array.isArray(source[key]) ? source[key] : [])
        .filter((x) => x && typeof x === "object")
        .map((x) =>
          Object.assign(
            {
              id:
                typeof x.id === "string" && /^[\w-]{1,100}$/.test(x.id)
                  ? x.id
                  : uid(),
            },
            Object.fromEntries(fields.map((f) => [f, clean(x[f])])),
          ),
        );
    }
    const options = input.settings || {},
      settings = clone(defaultSettings);
    for (const [key, allowed] of Object.entries({
      template: templates.map((t) => t.id).concat("custom"),
      font: ["sans", "serif", "mono"],
      fontSize: [10, 11, 12],
      spacing: ["compact", "comfortable", "spacious"],
      layout: ["one-column", "two-column"],
      paper: ["a4", "letter"],
      margin: [36, 48, 58, 68],
      headingStyle: ["uppercase", "title"],
      sidebarSide: ["left", "right"],
      photoShape: ["circle", "square"],
    }))
      if (allowed.includes(options[key])) settings[key] = options[key];
    if (/^#[0-9a-f]{6}$/i.test(options.accent || ""))
      settings.accent = options.accent;
    settings.sectionLabels = {};
    for (const key of Object.keys(sectionNames)) {
      if (typeof options.sectionLabels?.[key] === "string")
        settings.sectionLabels[key] = options.sectionLabels[key].slice(0, 60);
    }
    if (
      !/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(
        data.personal.photo,
      ) ||
      data.personal.photo.length > 650000
    )
      data.personal.photo = "";
    data.coverLetter = Object.fromEntries(
      Object.entries(emptyLetter()).map(([key, value]) => [
        key,
        typeof source.coverLetter?.[key] === "string"
          ? source.coverLetter[key]
          : value,
      ]),
    );
    data.targetJob = Object.fromEntries(
      ["title", "company", "description"].map((key) => [
        key,
        typeof source.targetJob?.[key] === "string"
          ? source.targetJob[key]
          : "",
      ]),
    );
    if (source.importSource && typeof source.importSource.text === "string")
      data.importSource = {
        text: source.importSource.text,
        sourceType:
          typeof source.importSource.sourceType === "string"
            ? source.importSource.sourceType
            : "text",
        warnings: Array.isArray(source.importSource.warnings)
          ? source.importSource.warnings.filter((w) => typeof w === "string")
          : [],
      };
    const ids = defaultSettings.sectionOrder.concat(
      data.customSections.map((s) => s.id),
    );
    settings.sectionOrder = [
      ...new Set(
        (Array.isArray(options.sectionOrder)
          ? options.sectionOrder
          : []
        ).concat(ids),
      ),
    ].filter((id) => ids.includes(id));
    settings.hiddenSections = (
      Array.isArray(options.hiddenSections) ? options.hiddenSections : []
    ).filter((id) => ids.includes(id));
    return {
      id: uid(),
      name: clean(input.name).slice(0, 80) || "Imported resume",
      updatedAt: new Date().toISOString(),
      data,
      settings,
    };
  }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.version === 2 && Array.isArray(stored.documents)) {
      const originalId = stored.activeId;
      stored.documents.forEach((raw) => {
        try {
          const doc = validateDocument(raw);
          if (typeof raw.id === "string") doc.id = raw.id;
          if (typeof raw.updatedAt === "string") doc.updatedAt = raw.updatedAt;
          library.documents.push(doc);
        } catch {}
      });
      library.activeId = library.documents.some((d) => d.id === originalId)
        ? originalId
        : library.documents[0]?.id;
    }
  } catch {
    storageAvailable = false;
  }
  // The bundled demo is recreated and selected on every full opening. Personal drafts remain intact.
  library.documents = library.documents.filter((doc) => doc.id !== DEMO_ID);
  const demo = makeDocument("Alex Morgan · Demo");
  demo.id = DEMO_ID;
  demo.kind = "demo";
  library.documents.unshift(demo);
  library.activeId = DEMO_ID;
  const current = () =>
    library.documents.find((d) => d.id === library.activeId) ||
    library.documents[0];
  function ensureEditable() {
    if (current().id === DEMO_ID) {
      const copy = makeDocument(
        "My resume",
        current().data,
        current().settings,
      );
      library.documents.push(copy);
      library.activeId = copy.id;
      $("#document-name").value = copy.name;
      $(".document-badge").textContent = "DRAFT";
      toast("Your own copy is ready. The demo stays available.");
    }
    return current();
  }
  function checkpoint(group = false) {
    const doc = ensureEditable();
    let h = histories.get(doc.id);
    if (!h) {
      h = { undo: [], redo: [], at: 0 };
      histories.set(doc.id, h);
    }
    if (!group || Date.now() - h.at > 700) {
      h.undo.push(
        clone({ name: doc.name, data: doc.data, settings: doc.settings }),
      );
      if (h.undo.length > 30) h.undo.shift();
      h.redo = [];
    }
    h.at = Date.now();
  }
  function undo(redo = false) {
    const h = histories.get(current().id);
    const source = redo ? h?.redo : h?.undo;
    if (!source?.length) {
      toast(redo ? "Nothing to redo yet." : "Nothing to undo yet.");
      return;
    }
    const target = redo ? h.undo : h.redo;
    target.push(
      clone({
        name: current().name,
        data: current().data,
        settings: current().settings,
      }),
    );
    Object.assign(current(), source.pop());
    renderAll();
    save();
    toast(redo ? "Change restored." : "Change undone.");
  }
  const getPath = (path) =>
    path.split(".").reduce((obj, key) => obj?.[key], current().data);
  function setPath(path, value) {
    const keys = path.split(".");
    let obj = current().data;
    for (const key of keys.slice(0, -1)) obj = obj[key];
    obj[keys.at(-1)] = value;
  }
  let dirty = false,
    storageConflict = false;
  function flushSave() {
    if (!dirty || storageConflict) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    dirty = false;
  }
  function save() {
    dirty = true;
    current().updatedAt = new Date().toISOString();
    $("#save-status").innerHTML = icon("check") + " Saving in this browser…";
    clearTimeout(savingTimer);
    savingTimer = setTimeout(() => {
      try {
        if (storageConflict) {
          $("#save-status").textContent =
            "Another tab changed · back up and reload";
          return;
        }
        flushSave();
        storageAvailable = true;
        $("#save-status").innerHTML = icon("check") + " Saved in this browser";
      } catch {
        storageAvailable = false;
        $("#save-status").innerHTML =
          icon("shield") + " Session only · download a backup";
      }
      document.dispatchEvent(new CustomEvent("folio:changed"));
      $(".editor-footer span").textContent = storageAvailable
        ? "Your story stays yours. Saved on this device."
        : "Storage unavailable. Download a backup to keep your work.";
    }, 350);
  }
  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 3500);
  }
  function field(label, path, type = "text", full = false, placeholder = "") {
    const value = getPath(path) || "",
      attr = `data-field="${esc(path)}" id="field-${path.replaceAll(".", "-")}"`;
    return `<label class="form-field${full ? " full" : ""}"><span>${esc(label)}</span>${type === "textarea" ? `<textarea ${attr} rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input ${attr} type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`}</label>`;
  }
  function entryFields(key, index) {
    const p = `${key}.${index}`;
    if (key === "experience")
      return (
        field("Job title", p + ".role", "text", true) +
        field("Company", p + ".company") +
        field("Location", p + ".location") +
        field("Start date", p + ".start", "text", false, "e.g. Jan 2022") +
        field("End date", p + ".end", "text", false, "Present") +
        field(
          "Highlights",
          p + ".description",
          "textarea",
          true,
          "Describe your impact. Start a line with - for a bullet.",
        )
      );
    if (key === "education")
      return (
        field("Degree / qualification", p + ".degree", "text", true) +
        field("School / university", p + ".school", "text", true) +
        field("Start date", p + ".start") +
        field("End date", p + ".end") +
        field("Details", p + ".description", "textarea", true)
      );
    return (
      field("Project name", p + ".name", "text", true) +
      field("Website or link", p + ".link", "text", true) +
      field("Description", p + ".description", "textarea", true)
    );
  }
  function entries(key) {
    const singular = {
      experience: "experience",
      education: "education",
      projects: "project",
    }[key];
    return (
      current()
        .data[key].map(
          (entry, index) =>
            `<div class="entry-card"><div class="entry-header"><span>${esc(entry.role || entry.degree || entry.name || `New ${singular}`)}</span><div class="entry-controls"><button class="icon-button" data-action="move-entry" data-key="${key}" data-index="${index}" data-direction="-1" aria-label="Move entry up" ${index === 0 ? "disabled" : ""}>${icon("chevron-up")}</button><button class="icon-button" data-action="remove-entry" data-key="${key}" data-index="${index}" aria-label="Remove ${singular}">${icon("trash")}</button></div></div><div class="form-grid">${entryFields(key, index)}</div></div>`,
        )
        .join("") +
      `<button class="subtle-button" data-action="add-entry" data-key="${key}">${icon("plus")} Add ${singular}</button>`
    );
  }
  function sectionHasContent(id) {
    const d = current().data;
    if (id === "personal") return d.personal.firstName || d.personal.lastName;
    return Array.isArray(d[id]) ? d[id].length : !!d[id];
  }
  function accordion(id, title, number, body, help = "") {
    return `<section class="accordion ${openSection === id ? "open" : ""}" data-section="${esc(id)}"><button class="accordion-heading" data-action="accordion" data-id="${esc(id)}" aria-expanded="${openSection === id}" aria-controls="section-${esc(id)}"><span class="section-num">${number}</span><span class="accordion-title">${esc(title)}</span>${sectionHasContent(id) ? icon("check-circle", "section-check") : ""}${icon("chevron-down", "chevron")}</button><div class="accordion-content" id="section-${esc(id)}">${help ? `<p class="section-help">${help}</p>` : ""}${body}</div></section>`;
  }
  function renderContent() {
    const d = current().data;
    if (viewMode === "letter") {
      renderLetterContent();
      return;
    }
    $("#editor-content").innerHTML =
      accordion(
        "personal",
        "Personal details",
        "01",
        `<div class="form-grid">${field("First name", "personal.firstName")}${field("Last name", "personal.lastName")}${field("Professional title", "personal.title", "text", true)}${field("Email address", "personal.email", "email", true)}${field("Phone number", "personal.phone", "tel", true)}${field("City, country", "personal.location", "text", true)}${field("Website or portfolio", "personal.website", "text", true)}${field("LinkedIn profile", "personal.linkedin", "text", true)}<div class="form-field full"><span>Photo · optional</span><div class="photo-control">${d.personal.photo ? '<img src="' + esc(d.personal.photo) + '" alt="Resume photo">' : ""}<button class="button button-secondary" data-tool="photo">${icon("upload")} ${d.personal.photo ? "Change" : "Add"} photo</button>${d.personal.photo ? '<button class="icon-button" data-tool="remove-photo" aria-label="Remove photo">' + icon("trash") + "</button>" : ""}</div><p class="input-hint">Use a photo only when it is appropriate for your application.</p></div></div>`,
        "Let’s start with the basics. How can they reach you?",
      ) +
      accordion(
        "summary",
        "Professional summary",
        "02",
        field(
          "Your professional story",
          "summary",
          "textarea",
          true,
          "What do you bring to the table?",
        ) +
          '<button class="subtle-button" data-tool="writer">' +
          icon("sparkles") +
          ' Open writing studio</button><p class="input-hint">Keep it human. A few clear sentences about your experience and what makes your work matter.</p>',
      ) +
      accordion(
        "experience",
        "Work experience",
        "03",
        entries("experience"),
        "Show the work. Highlight what changed because of you.",
      ) +
      accordion("education", "Education", "04", entries("education")) +
      accordion(
        "skills",
        "Skills",
        "05",
        field(
          "Your strengths",
          "skills",
          "textarea",
          true,
          "Product design, Research, Figma",
        ) +
          '<p class="input-hint">Separate each skill with a comma or a new line.</p>',
      ) +
      accordion("projects", "Projects", "06", entries("projects")) +
      d.customSections
        .map((s, i) =>
          accordion(
            s.id,
            s.title || "Custom section",
            String(i + 7).padStart(2, "0"),
            `<div class="form-grid">${field("Section title", `customSections.${i}.title`, "text", true)}${field("Content", `customSections.${i}.content`, "textarea", true)}</div><button class="subtle-button" data-action="remove-custom" data-index="${i}">${icon("trash")} Remove section</button>`,
          ),
        )
        .join("") +
      `<button class="add-section-button" data-action="add-section">${icon("plus")} Add a custom section</button>`;
  }
  function segment(key, options) {
    return `<div class="segmented">${options.map(([value, label]) => `<button class="${current().settings[key] === value ? "selected" : ""}" data-action="setting" data-key="${key}" data-value="${value}" aria-pressed="${current().settings[key] === value}">${label}</button>`).join("")}</div>`;
  }
  function renderDesign() {
    const s = current().settings;
    $("#editor-content").innerHTML =
      `<h2 class="design-heading">A style that feels like you.</h2><p class="design-description">Fine-tune the details. Your content stays right where you left it.</p><div class="template-chooser-inline" style="display:none;margin-bottom:25px"><div class="control-label">Template</div><div class="template-grid">${templateCards()}</div></div>
    <div class="control-group"><div class="control-label">Accent color <small>${esc(s.accent.toUpperCase())}</small></div><div class="color-swatches">${["#b65c3a", "#536b54", "#3d5b78", "#736184", "#303c40", "#bd8f42"].map((color) => `<button class="swatch ${color === s.accent ? "selected" : ""}" style="background:${color}" data-action="setting" data-key="accent" data-value="${color}" aria-label="Use ${color} accent" aria-pressed="${color === s.accent}"></button>`).join("")}<input class="color-input" type="color" value="${s.accent}" data-setting="accent" aria-label="Custom accent color"></div></div>
    <div class="control-group"><div class="control-label">Typography</div>${segment(
      "font",
      [
        ["sans", "Sans serif"],
        ["serif", "Serif"],
        ["mono", "Mono"],
      ],
    )}</div>
    <div class="control-group select-row"><label class="form-field"><span>Text size</span><select data-setting="fontSize">${[10, 11, 12].map((n) => `<option value="${n}" ${s.fontSize === n ? "selected" : ""}>${n} pt ${n === 11 ? "· Default" : ""}</option>`).join("")}</select></label><label class="form-field"><span>Page size</span><select data-setting="paper"><option value="a4" ${s.paper === "a4" ? "selected" : ""}>A4</option><option value="letter" ${s.paper === "letter" ? "selected" : ""}>US Letter</option></select></label></div>
    <div class="control-group"><div class="control-label">Spacing</div>${segment(
      "spacing",
      [
        ["compact", "Compact"],
        ["comfortable", "Regular"],
        ["spacious", "Relaxed"],
      ],
    )}</div>
    <div class="control-group"><div class="control-label">Custom layout <small>Switches to your own template</small></div>${segment(
      "layout",
      [
        ["one-column", "One column"],
        ["two-column", "Two columns"],
      ],
    )}</div>
    <div class="control-group"><div class="control-label">Section order & visibility</div><p class="input-hint" style="margin:-4px 0 12px">Move sections within their column, or hide what you don’t need.</p><div class="section-order-list">${s.sectionOrder
      .map((id, i) => {
        const name =
          sectionNames[id] ||
          current().data.customSections.find((x) => x.id === id)?.title ||
          "Custom section";
        return `<div class="order-row ${s.hiddenSections.includes(id) ? "hidden-section" : ""}">${icon("grip")}<span>${esc(name)}</span><button class="icon-button" data-action="move-section" data-id="${esc(id)}" data-direction="-1" aria-label="Move ${esc(name)} up" ${i === 0 ? "disabled" : ""}>${icon("chevron-up")}</button><button class="icon-button" data-action="move-section" data-id="${esc(id)}" data-direction="1" aria-label="Move ${esc(name)} down" ${i === s.sectionOrder.length - 1 ? "disabled" : ""}>${icon("chevron-down")}</button><button class="icon-button" data-action="toggle-section" data-id="${esc(id)}" aria-label="${s.hiddenSections.includes(id) ? "Show" : "Hide"} ${esc(name)}" aria-pressed="${!s.hiddenSections.includes(id)}">${icon(s.hiddenSections.includes(id) ? "eye-off" : "eye")}</button></div>`;
      })
      .join(
        "",
      )}</div></div><button class="subtle-button" data-action="reset-design">${icon("sliders")} Reset design to Studio</button>`;
  }
  function setTab(next) {
    tab = next;
    $$(".editor-tabs button").forEach((b) => {
      const selected = b.dataset.action === next;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-selected", selected);
      b.setAttribute("aria-controls", "editor-content");
      b.tabIndex = selected ? 0 : -1;
    });
    $("#editor-content").setAttribute("aria-labelledby", "tab-" + next);
    next === "content" ? renderContent() : renderDesign();
  }
  function templateCards() {
    return templates
      .slice(0, 4)
      .map(
        (t) =>
          `<button class="template-card ${current().settings.template === t.id ? "selected" : ""}" data-action="template" data-id="${t.id}" aria-label="Use ${t.name} template" aria-pressed="${current().settings.template === t.id}"><div class="template-thumb"><div class="thumb-paper">${ResumeRenderer.render(sample, { ...defaultSettings, template: t.id, font: t.defaultFont || "sans" })}</div></div><span class="template-name">${t.name}${current().settings.template === t.id ? icon("check-circle") : ""}</span><span class="template-desc">${t.description}</span></button>`,
      )
      .join("");
  }
  function renderTemplates() {
    $("#template-grid").innerHTML = templateCards();
    $(".custom-template").classList.toggle(
      "selected",
      current().settings.template === "custom",
    );
  }
  function fitPreview() {
    const article = $("#resume-preview .resume-sheet");
    if (!article) return;
    const scroll = $("#preview-scroll"),
      available = scroll.clientWidth - (window.innerWidth < 700 ? 24 : 56),
      width = article.offsetWidth;
    const pageHeight = current().settings.paper === "letter" ? 1056 : 1123;
    const heightScale =
      window.innerWidth < 700 ? 0.8 : (scroll.clientHeight - 75) / pageHeight;
    const scale =
      zoom ||
      Math.min(
        0.8,
        Math.max(0.23, available / width),
        Math.max(0.3, heightScale),
      );
    $("#resume-preview").style.transform = `scale(${scale})`;
    $("#paper-frame").style.width = `${width * scale}px`;
    $("#paper-frame").style.height = `${article.offsetHeight * scale}px`;
    $("#zoom-label").textContent = Math.round(scale * 100) + "%";
  }
  function renderPreview() {
    $("#resume-preview").innerHTML = renderDocument();
    $("#paper-label").textContent =
      current().settings.paper === "letter"
        ? "US Letter · 8.5 × 11 in"
        : "A4 · 210 × 297 mm";
    requestAnimationFrame(fitPreview);
    const p = current().data.personal;
    $(".avatar").textContent =
      ((p.firstName || "")[0] || "") + ((p.lastName || "")[0] || "") || "F";
  }
  function renderAll() {
    $("#document-name").value = current().name;
    $(".document-badge").textContent =
      current().id === DEMO_ID ? "DEMO" : "DRAFT";
    setTab(tab);
    renderPreview();
    renderTemplates();
    document.dispatchEvent(new CustomEvent("folio:render"));
  }
  function renderDocument() {
    return viewMode === "letter"
      ? ResumeRenderer.renderCoverLetter(
          current().data,
          current().settings,
          current().data.coverLetter || emptyLetter(),
        )
      : ResumeRenderer.render(current().data, current().settings);
  }
  function renderLetterContent() {
    const l = current().data.coverLetter || emptyLetter();
    current().data.coverLetter = l;
    $("#editor-content").innerHTML =
      '<h2 class="design-heading">Make it personal.</h2><p class="design-description">A matching cover letter, written in your voice.</p><div class="form-grid">' +
      field("Recipient", "coverLetter.recipient", "text", true) +
      field("Company", "coverLetter.company") +
      field("Target role", "coverLetter.role") +
      field("Date", "coverLetter.date", "text", true) +
      field("Greeting", "coverLetter.greeting", "text", true) +
      field("Letter body", "coverLetter.body", "textarea", true) +
      field("Closing", "coverLetter.closing") +
      field("Signature", "coverLetter.signature") +
      '</div><button class="add-section-button" data-tool="letter-draft">' +
      icon("sparkles") +
      ' Create a starting draft</button><button class="subtle-button" data-tool="writer">' +
      icon("pencil") +
      " Open writing studio</button>";
  }
  function updateSetting(key, value) {
    checkpoint();
    if (key === "fontSize" || key === "margin") value = Number(value);
    current().settings[key] = value;
    if (key === "layout") current().settings.template = "custom";
    renderPreview();
    renderTemplates();
    renderDesign();
    save();
  }
  function closeModal() {
    currentModal = null;
    $("#modal-root").innerHTML = "";
    document.body.style.overflow = "";
    lastFocus?.focus();
  }
  function modal(content, type = "", extraClass = "") {
    lastFocus = document.activeElement;
    currentModal = type;
    $("#modal-root").innerHTML =
      `<div class="modal-backdrop"><section class="modal ${extraClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="icon-button modal-close" data-action="close-modal" aria-label="Close dialog">${icon("x")}</button>${content}</section></div>`;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => $(".modal-close")?.focus());
  }
  function downloadModal() {
    const letter = viewMode === "letter";
    modal(
      '<h2 id="modal-title">Ready for your next chapter.</h2><p class="modal-intro">Download your ' +
        (letter ? "cover letter" : "resume") +
        ". Every format is included.</p>" +
        [
          [
            "export-pdf",
            "file",
            "PDF document",
            "Selectable text · ready to send",
            "PDF",
          ],
          [
            "tool-docx",
            "file",
            "Word document",
            "Editable single-column layout",
            "DOCX",
          ],
          [
            "export-text",
            "align-left",
            "Plain text",
            "Paste into application forms",
            "TXT",
          ],
          [
            "tool-html",
            "eye",
            "Standalone resume",
            "A portable web document",
            "HTML",
          ],
          [
            "tool-portfolio",
            "arrow-up-right",
            "Personal website",
            "Responsive portfolio from your resume",
            "HTML",
          ],
          [
            "export-json",
            "copy",
            "Editable backup",
            "Reopen in Folio with your design",
            "JSON",
          ],
          [
            "print-pdf",
            "download",
            "Browser PDF / print",
            "Supports additional writing systems",
            "PRINT",
          ],
        ]
          .filter(
            (row) =>
              !letter || !["tool-html", "tool-portfolio"].includes(row[0]),
          )
          .map(
            (row) =>
              '<button class="download-option" ' +
              (row[0].startsWith("tool-")
                ? 'data-tool="' + row[0].slice(5) + '"'
                : 'data-action="' + row[0] + '"') +
              ">" +
              icon(row[1]) +
              "<span><strong>" +
              row[2] +
              "</strong><small>" +
              row[3] +
              '</small></span><span class="download-tag">' +
              row[4] +
              "</span></button>",
          )
          .join("") +
        '<p class="modal-footnote">Files are created on your device. PDF follows your template; Word uses a clean, editable layout.</p>',
      "download",
    );
  }

  function documentsModal() {
    modal(
      `<h2 id="modal-title">Your next chapters.</h2><p class="modal-intro">A different resume for every possibility. Your drafts are saved in this browser.</p><div>${library.documents.map((d) => `<div class="document-card ${d.id === library.activeId ? "active-document" : ""}">${icon("file")}<button class="document-card-info" data-action="open-document" data-id="${esc(d.id)}"><strong>${esc(d.name)}</strong><small>${esc(templates.find((t) => t.id === d.settings.template)?.name || "Custom")} · ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${d.id === DEMO_ID ? " · Demo restores on opening" : d.id === library.activeId ? " · Currently editing" : ""}</small></button><button class="icon-button" data-action="duplicate-document" data-id="${esc(d.id)}" aria-label="Duplicate ${esc(d.name)}">${icon("copy")}</button><button class="icon-button" data-action="delete-document" data-id="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">${icon("trash")}</button></div>`).join("")}</div><button class="button button-primary" data-action="new-document">${icon("plus")} Create a new resume</button><button class="button button-secondary" data-tool="import-resume">${icon("upload")} Import PDF, Word or text</button><button class="button button-secondary" data-action="import">${icon("copy")} Import a Folio backup</button><input class="visually-hidden" id="import-file" type="file" accept=".json,application/json" aria-label="Import resume backup">`,
      "documents",
    );
  }
  function newDocument() {
    viewMode = "resume";
    const blank = {
      coverLetter: emptyLetter(),
      targetJob: { title: "", company: "", description: "" },
      personal: Object.fromEntries(
        Object.keys(sample.personal).map((k) => [k, ""]),
      ),
      summary: "",
      experience: [],
      education: [],
      skills: "",
      projects: [],
      customSections: [],
    };
    const doc = makeDocument("Untitled resume", blank);
    library.documents.push(doc);
    library.activeId = doc.id;
    tab = "content";
    openSection = "personal";
    zoom = null;
    closeModal();
    renderAll();
    save();
    toast("A fresh page. Make it yours.");
  }
  function previewModal() {
    modal(
      `<h2 id="modal-title">${esc(current().name)}</h2><p>Your resume, just as it should be.</p><div class="full-paper">${renderDocument()}</div><button class="button button-primary" data-action="export-pdf">${icon("download")} Download PDF</button>`,
      "preview",
      "preview-modal",
    );
  }
  function helpModal() {
    modal(
      `<h2 id="modal-title">A resume that feels like you.</h2><p class="modal-intro">From a blank page to your next opportunity.</p><div class="help-step"><span>01</span><div><strong>Tell your story</strong><p>Replace the example details with your own. Add your experience, education, skills, and projects. Custom sections work beautifully for certifications, languages, or anything else.</p></div></div><div class="help-step"><span>02</span><div><strong>Make it your own</strong><p>Choose a template, then explore Design to change colors, typography, spacing, section order, and page size. Select a custom layout for a fresh starting point.</p></div></div><div class="help-step"><span>03</span><div><strong>Take the next step</strong><p>Preview your work and download a PDF. An editable backup lets you bring the same resume back into Folio anytime.</p></div></div><p class="modal-footnote">No account needed. Your drafts stay in this browser and on this device. Clearing browser data removes saved drafts, so keep an editable backup.</p><button class="button button-primary" data-action="close-modal">Let’s make it happen ${icon("arrow-up-right")}</button>`,
      "help",
    );
  }
  function downloadBlob(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const filename = () =>
    `${current().data.personal.firstName || "My"}-${current().data.personal.lastName || "Resume"}`.replace(
      /[^\p{L}\p{N}_-]+/gu,
      "-",
    );
  let titleBeforePrint;
  function preparePrint() {
    if ($("#print-container")) return;
    const container = document.createElement("div");
    container.id = "print-container";
    container.style.display = "none";
    container.innerHTML = renderDocument();
    document.body.append(container);
    const style = document.createElement("style");
    style.id = "print-page-style";
    style.textContent =
      "@page{size:" +
      (current().settings.paper === "letter" ? "letter" : "A4") +
      ";margin:12mm}";
    document.head.append(style);
    titleBeforePrint = document.title;
    document.title = filename();
  }
  function printPDF() {
    preparePrint();
    window.print();
  }
  async function exportPDF(button) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = icon("download") + " Preparing your PDF…";
    const stage = document.createElement("div");
    stage.style.cssText =
      "position:fixed;left:-20000px;top:0;pointer-events:none";
    stage.setAttribute("aria-hidden", "true");
    stage.innerHTML = renderDocument();
    document.body.append(stage);
    try {
      if (!window.ResumeExport)
        throw new Error(
          "The PDF exporter could not load. Please reload the page.",
        );
      const result = await ResumeExport.createPDF(
        $(".resume-sheet", stage),
        current().settings,
      );
      if (result.unsupportedCharacters.length) {
        modal(
          `<h2 id="modal-title">Keep every character.</h2><p class="modal-intro">Your resume uses characters outside our bundled PDF fonts. Your browser can preserve them using the fonts on your device. Choose “Save as PDF” in the print dialog.</p><button class="button button-primary" data-action="print-pdf">${icon("download")} Save with browser PDF</button>`,
          "print",
        );
      } else {
        downloadBlob(
          result.bytes,
          filename() + (viewMode === "letter" ? "-cover-letter" : "") + ".pdf",
          "application/pdf",
        );
        toast("Your PDF is ready. Go make your next move.");
      }
    } catch (error) {
      toast(error.message || "Could not create the PDF. Please try again.");
    } finally {
      stage.remove();
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.field) {
      checkpoint(true);
      setPath(el.dataset.field, el.value);
      renderPreview();
      save();
    } else if (el.id === "document-name") {
      const value = el.value;
      checkpoint(true);
      current().name = value;
      el.value = value;
      save();
    } else if (el.dataset.setting === "accent") {
      checkpoint(true);
      current().settings.accent = el.value;
      renderPreview();
      save();
    }
  });
  document.addEventListener("change", async (event) => {
    const el = event.target;
    if (el.dataset.setting) {
      updateSetting(el.dataset.setting, el.value);
    }
    if (el.id === "import-file" && el.files?.[0]) {
      try {
        if (el.files[0].size > 10 * 1024 * 1024)
          throw new Error("Please choose a Folio backup smaller than 10 MB.");
        const input = JSON.parse(await el.files[0].text());
        const doc = validateDocument(input);
        library.documents.push(doc);
        library.activeId = doc.id;
        tab = "content";
        openSection = "personal";
        closeModal();
        renderAll();
        save();
        toast("Your resume is back. Pick up where you left off.");
      } catch (error) {
        toast(
          error instanceof SyntaxError
            ? "That file is not valid JSON. Choose a Folio backup."
            : error.message,
        );
      }
      el.value = "";
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeModal();
      return;
    }
    const letterTarget = event.target.closest(
      "#resume-preview [data-letter-path]",
    );
    if (letterTarget) {
      const path = "coverLetter." + letterTarget.dataset.letterPath;
      viewMode = "letter";
      tab = "content";
      renderAll();
      $(".studio").classList.remove("show-preview");
      $$(".mobile-switch button").forEach((x) =>
        x.classList.toggle("selected", x.dataset.action === "mobile-content"),
      );
      requestAnimationFrame(() => $(`[data-field="${path}"]`)?.focus());
      return;
    }
    const editTarget = event.target.closest(
      "#resume-preview [data-resume-path]",
    );
    if (editTarget) {
      const path = editTarget.dataset.resumePath;
      viewMode = "resume";
      openSection = path.startsWith("personal.")
        ? "personal"
        : path.startsWith("customSections.")
          ? current().data.customSections[Number(path.split(".")[1])].id
          : path.split(".")[0];
      tab = "content";
      renderAll();
      $(".studio").classList.remove("show-preview");
      $$(".mobile-switch button").forEach((x) =>
        x.classList.toggle("selected", x.dataset.action === "mobile-content"),
      );
      requestAnimationFrame(() => $(`[data-field="${path}"]`)?.focus());
      return;
    }
    const b = event.target.closest("[data-action]");
    if (!b || b.disabled) return;
    const action = b.dataset.action;
    if (action === "accordion") {
      openSection = openSection === b.dataset.id ? null : b.dataset.id;
      renderContent();
    } else if (action === "content" || action === "design") setTab(action);
    else if (action === "builder") {
      closeModal();
      setTab("content");
      $(".studio").classList.remove("show-preview");
      $$(".mobile-switch button").forEach((x) =>
        x.classList.toggle("selected", x.dataset.action === "mobile-content"),
      );
    } else if (action === "template") {
      checkpoint();
      current().settings.template = b.dataset.id;
      current().settings.font =
        templates.find((t) => t.id === b.dataset.id)?.defaultFont || "sans";
      renderPreview();
      renderTemplates();
      if (tab === "design") renderDesign();
      save();
      toast(
        `${templates.find((t) => t.id === b.dataset.id).name} looks good on you.`,
      );
    } else if (action === "custom") {
      checkpoint();
      current().settings.template = "custom";
      setTab("design");
      renderPreview();
      renderTemplates();
      save();
      toast("Your own template. Start with a color and layout.");
    } else if (action === "setting")
      updateSetting(b.dataset.key, b.dataset.value);
    else if (action === "reset-design") {
      checkpoint();
      current().settings = clone(defaultSettings);
      current().settings.sectionOrder.push(
        ...current().data.customSections.map((section) => section.id),
      );
      renderAll();
      save();
      toast("Back to a fresh Studio design.");
    } else if (action === "add-entry") {
      checkpoint();
      const key = b.dataset.key;
      current().data[key].push(
        key === "experience"
          ? {
              id: uid(),
              role: "",
              company: "",
              location: "",
              start: "",
              end: "",
              description: "",
            }
          : key === "education"
            ? {
                id: uid(),
                degree: "",
                school: "",
                start: "",
                end: "",
                description: "",
              }
            : { id: uid(), name: "", link: "", description: "" },
      );
      renderContent();
      renderPreview();
      save();
      const fields = $$(
        `[data-field^="${key}.${current().data[key].length - 1}."]`,
      );
      fields[0]?.focus();
    } else if (action === "remove-entry") {
      checkpoint();
      current().data[b.dataset.key].splice(Number(b.dataset.index), 1);
      renderContent();
      renderPreview();
      save();
      toast("Entry removed.");
    } else if (action === "move-entry") {
      checkpoint();
      const arr = current().data[b.dataset.key],
        i = Number(b.dataset.index),
        j = i + Number(b.dataset.direction);
      if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
      renderContent();
      renderPreview();
      save();
    } else if (action === "add-section") {
      checkpoint();
      const id = uid();
      current().data.customSections.push({
        id,
        title: "Additional information",
        content: "",
      });
      current().settings.sectionOrder.push(id);
      openSection = id;
      renderContent();
      renderPreview();
      save();
      $(
        `[data-field="customSections.${current().data.customSections.length - 1}.title"]`,
      )?.focus();
    } else if (action === "remove-custom") {
      checkpoint();
      const removed = current().data.customSections.splice(
        Number(b.dataset.index),
        1,
      )[0];
      current().settings.sectionOrder = current().settings.sectionOrder.filter(
        (id) => id !== removed.id,
      );
      current().settings.hiddenSections =
        current().settings.hiddenSections.filter((id) => id !== removed.id);
      renderAll();
      save();
    } else if (action === "move-section") {
      checkpoint();
      const order = current().settings.sectionOrder,
        i = order.indexOf(b.dataset.id),
        j = i + Number(b.dataset.direction);
      if (j >= 0 && j < order.length)
        [order[i], order[j]] = [order[j], order[i]];
      renderDesign();
      renderPreview();
      save();
    } else if (action === "toggle-section") {
      checkpoint();
      const hidden = current().settings.hiddenSections;
      hidden.includes(b.dataset.id)
        ? hidden.splice(hidden.indexOf(b.dataset.id), 1)
        : hidden.push(b.dataset.id);
      renderDesign();
      renderPreview();
      save();
    } else if (action === "preview") previewModal();
    else if (action === "close-modal") closeModal();
    else if (action === "download") downloadModal();
    else if (action === "documents") documentsModal();
    else if (action === "help") helpModal();
    else if (action === "zoom-in" || action === "zoom-out") {
      zoom = Math.max(
        0.25,
        Math.min(
          1.25,
          (zoom || parseInt($("#zoom-label").textContent) / 100) +
            (action === "zoom-in" ? 0.1 : -0.1),
        ),
      );
      fitPreview();
    } else if (action === "fit") {
      zoom = null;
      fitPreview();
    } else if (action === "mobile-content" || action === "mobile-preview") {
      $(".studio").classList.toggle(
        "show-preview",
        action === "mobile-preview",
      );
      $$(".mobile-switch button").forEach((x) =>
        x.classList.toggle("selected", x === b),
      );
      requestAnimationFrame(fitPreview);
    } else if (action === "export-pdf") exportPDF(b);
    else if (action === "print-pdf") printPDF();
    else if (action === "export-text") {
      downloadBlob(
        viewMode === "letter"
          ? ResumeRenderer.coverLetterPlainText(
              current().data,
              current().data.coverLetter,
            )
          : ResumeRenderer.plainText(current().data, current().settings),
        filename() + ".txt",
        "text/plain;charset=utf-8",
      );
      toast("Plain-text resume downloaded.");
    } else if (action === "export-json") {
      downloadBlob(
        JSON.stringify(
          { ...current(), format: "folio-resume", version: 2 },
          null,
          2,
        ),
        filename() + ".folio.json",
        "application/json",
      );
      toast("Editable backup downloaded.");
    } else if (action === "open-document") {
      library.activeId = b.dataset.id;
      openSection = "personal";
      closeModal();
      renderAll();
      save();
    } else if (action === "new-document") newDocument();
    else if (action === "duplicate-document") {
      const source = library.documents.find((d) => d.id === b.dataset.id);
      const doc = makeDocument(
        source.name + " (copy)",
        source.data,
        source.settings,
      );
      library.documents.push(doc);
      library.activeId = doc.id;
      renderAll();
      save();
      documentsModal();
      toast("A new copy, ready for a new opportunity.");
    } else if (action === "delete-document") {
      const id = b.dataset.id,
        doc = library.documents.find((d) => d.id === id);
      modal(
        `<h2 id="modal-title">Remove this draft?</h2><p class="modal-intro">“${esc(doc.name)}” will be removed from this browser. Download a backup first if you’d like to keep it.</p><button class="button button-primary" data-action="confirm-delete" data-id="${esc(id)}">Remove draft</button><button class="button button-secondary" data-action="documents">Keep my draft</button>`,
        "delete",
      );
    } else if (action === "confirm-delete") {
      library.documents = library.documents.filter(
        (d) => d.id !== b.dataset.id,
      );
      if (!library.documents.length) {
        newDocument();
        documentsModal();
      } else {
        if (library.activeId === b.dataset.id)
          library.activeId = library.documents[0].id;
        renderAll();
        save();
        documentsModal();
      }
      toast("Draft removed.");
    } else if (action === "import") $("#import-file").click();
    else if (action === "reload-workspace") location.reload();
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !event.target.matches("input,textarea")
    ) {
      event.preventDefault();
      undo(event.shiftKey);
      return;
    }
    if (
      event.target.closest(".editor-tabs") &&
      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      setTab(
        event.key === "Home"
          ? "content"
          : event.key === "End"
            ? "design"
            : tab === "content"
              ? "design"
              : "content",
      );
      $("#tab-" + tab).focus();
      return;
    }
    if (!currentModal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
    if (event.key === "Tab") {
      const nodes = $$(
        "button:not([disabled]), input:not(.visually-hidden), select, textarea, a[href]",
        $(".modal"),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("resize", () => requestAnimationFrame(fitPreview));
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", () => {
    $("#print-container")?.remove();
    $("#print-page-style")?.remove();
    if (titleBeforePrint) document.title = titleBeforePrint;
    titleBeforePrint = null;
  });
  window.addEventListener("beforeunload", () => {
    try {
      flushSave();
    } catch {}
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      if (incoming.version !== 2 || !Array.isArray(incoming.documents)) return;
      if (dirty) {
        storageConflict = true;
        clearTimeout(savingTimer);
        $("#save-status").textContent =
          "Another tab changed · back up and reload";
        modal(
          '<h2 id="modal-title">Another tab has newer changes.</h2><p class="modal-intro">Automatic saving is paused in this tab to protect both versions. Download a workspace backup of your edits, then reload to use the latest saved workspace.</p><button class="button button-primary" data-tool="workspace-backup">Download this workspace backup</button><button class="button button-secondary" data-action="reload-workspace">Reload latest saved workspace</button>',
          "storage-conflict",
        );
        return;
      }
      const active = library.activeId;
      const docs = incoming.documents.map((raw) => {
        const doc = validateDocument(raw);
        doc.id = raw.id;
        doc.updatedAt = raw.updatedAt;
        return doc;
      });
      if (!docs.length) return;
      library = {
        version: 2,
        activeId: docs.some((d) => d.id === active) ? active : docs[0].id,
        documents: docs,
      };
      renderAll();
      $("#save-status").innerHTML = icon("check") + " Updated from another tab";
    } catch {}
  });
  $$("[data-icon]").forEach(
    (el) => (el.outerHTML = icon(el.dataset.icon, el.className)),
  );
  window.Folio = {
    current,
    library: () => library,
    esc,
    icon,
    toast,
    modal,
    closeModal,
    renderAll,
    renderPreview,
    renderDesign,
    renderDocument,
    templates,
    sample,
    defaultSettings,
    downloadBlob,
    filename,
    save,
    validateDocument,
    ensureEditable,
    undo,
    emptyLetter,
    view: () => viewMode,
    setView(mode) {
      viewMode = mode === "letter" ? "letter" : "resume";
      setTab("content");
      renderAll();
    },
    setTab,
    mutate(fn) {
      checkpoint();
      fn(current());
      renderAll();
      save();
    },
    create(name, data, settings = defaultSettings) {
      const doc = validateDocument({ name, data, settings });
      library.documents.push(doc);
      library.activeId = doc.id;
      viewMode = "resume";
      openSection = "personal";
      tab = "content";
      closeModal();
      renderAll();
      save();
      return doc;
    },
    selectTemplate(id) {
      const t = templates.find((t) => t.id === id);
      if (!t) return;
      checkpoint();
      current().settings.template = id;
      current().settings.font = t.defaultFont || "sans";
      renderAll();
      save();
    },
    showDemo() {
      let demo = library.documents.find((d) => d.id === DEMO_ID);
      if (!demo) {
        demo = makeDocument("Alex Morgan · Demo");
        demo.id = DEMO_ID;
        library.documents.unshift(demo);
      }
      library.activeId = DEMO_ID;
      viewMode = "resume";
      renderAll();
      save();
    },
    documents: documentsModal,
    download: downloadModal,
  };
  renderAll();
  save();
})();
