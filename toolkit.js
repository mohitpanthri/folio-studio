// Legacy workspace fields remain readable so existing backups do not lose data.
(function () {
  "use strict";
  const F = window.Folio,
    C = window.FolioCoach,
    $ = (s, p = document) => p.querySelector(s),
    $$ = (s, p = document) => [...p.querySelectorAll(s)],
    e = F.esc,
    i = F.icon,
    copy = (x) => JSON.parse(JSON.stringify(x));
  const uid = () =>
    crypto.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const STORE = "folio-workspace-v2";
  let workspace = {
    jobs: [],
    designs: [],
    practice: {},
    plans: {},
    snapshots: [],
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (raw && typeof raw === "object") {
      for (const key of ["jobs", "designs", "snapshots"])
        if (Array.isArray(raw[key]))
          workspace[key] = raw[key].filter((x) => x && typeof x === "object");
      for (const key of ["practice", "plans"])
        if (
          raw[key] &&
          typeof raw[key] === "object" &&
          !Array.isArray(raw[key])
        )
          workspace[key] = raw[key];
    }
  } catch {}
  let currentTool = "",
    galleryFilter = "All",
    galleryQuery = "",
    importName = "",
    matchResult = null,
    pendingImport = null;
  const fields = (
    label,
    id,
    value = "",
    type = "text",
    full = false,
    placeholder = "",
  ) =>
    `<label class="form-field ${full ? "full" : ""}"><span>${e(label)}</span>${type === "textarea" ? `<textarea id="${id}" placeholder="${e(placeholder)}" rows="5">${e(value)}</textarea>` : `<input id="${id}" type="${type}" value="${e(value)}" placeholder="${e(placeholder)}">`}</label>`;
  function saveWorkspace() {
    try {
      localStorage.setItem(STORE, JSON.stringify(workspace));
      return true;
    } catch {
      F.toast(
        "Browser storage is full. Export a workspace backup to keep your changes.",
      );
      return false;
    }
  }
  function show(title, intro, body, kind = "tool", wide = false) {
    currentTool = kind;
    F.modal(
      `<p class="tool-eyebrow">FOLIO STUDIO / RESUME TOOLS</p><h2 id="modal-title">${e(title)}</h2><p class="modal-intro">${intro}</p>${body}`,
      kind,
      `tools-modal ${wide ? "gallery-modal" : ""}`,
    );
  }
  const btn = (action, text, primary = false, extra = "") =>
    `<button class="button ${primary ? "button-primary" : "button-secondary"}" data-tool="${action}" ${extra}>${text}</button>`;
  function dashboard() {
    const cards = [
      [
        "gallery",
        "sliders",
        "Templates",
        "Choose a template or use your own saved design.",
      ],
      [
        "import-resume",
        "upload",
        "Import a resume",
        "Start from an existing PDF, Word, or text file.",
      ],
      [
        "check",
        "check-circle",
        "Resume check",
        "Review your content before downloading.",
      ],
      [
        "match",
        "eye",
        "Match a job",
        "Check relevant keywords against a job description.",
      ],
      [
        "letter",
        "file",
        "Cover letter",
        "Create a letter that matches your resume.",
      ],
    ];
    show(
      "Tools for your resume.",
      "Create, edit, and prepare your resume in one place.",
      `<div class="tool-grid">${cards.map(([action, icon, title, desc]) => `<button class="tool-card" data-tool="${action}">${i(icon)}<strong>${title}</strong><small>${desc}</small></button>`).join("")}</div><div class="action-row">${btn("history", "Saved versions")}</div>`,
      "dashboard",
    );
  }
  function gallery() {
    show(
      "Find your kind of first impression.",
      "Sixteen original designs, from understated to expressive. Your content moves with you.",
      `<div class="gallery-controls"><input class="form-input" id="gallery-search" type="search" placeholder="Search templates…" aria-label="Search templates" value="${e(galleryQuery)}"><div class="filter-chips">${["All", "Professional", "Modern", "Creative", "Academic", "Saved"].map((c) => `<button class="${galleryFilter === c ? "active" : ""}" data-tool="gallery-filter" data-value="${c}">${c}</button>`).join("")}</div></div><div id="gallery-grid" class="gallery-grid"></div><div class="gallery-help"><span>All designs and downloads are included.</span><button class="subtle-button" data-tool="custom-design">${i("plus")} Create your own template</button></div>`,
      "gallery",
      true,
    );
    renderGallery();
  }
  function renderGallery() {
    const grid = $("#gallery-grid");
    if (!grid) return;
    if (galleryFilter === "Saved") {
      const saved = workspace.designs.filter((d) =>
        String(d.name).toLowerCase().includes(galleryQuery.toLowerCase()),
      );
      grid.innerHTML = saved.length
        ? saved
            .map(
              (d) =>
                `<div class="saved-style-row"><span class="saved-style-dot" style="background:${/^#[0-9a-f]{6}$/i.test(d.settings?.accent) ? d.settings.accent : "#b65c3a"}"></span><strong>${e(d.name)}</strong><button class="subtle-button" data-tool="apply-design" data-id="${e(d.id)}">Use</button><button class="icon-button" data-tool="delete-design" data-id="${e(d.id)}" aria-label="Delete saved template">${i("trash")}</button></div>`,
            )
            .join("")
        : '<div class="gallery-empty">Your saved styles will appear here. Start in Design, then save your template.</div>';
      return;
    }
    const list = F.templates.filter(
      (t) =>
        (galleryFilter === "All" || t.category === galleryFilter) &&
        `${t.name} ${t.description} ${t.category}`
          .toLowerCase()
          .includes(galleryQuery.toLowerCase()),
    );
    grid.innerHTML = list.length
      ? list
          .map(
            (t) =>
              `<button class="template-card ${F.current().settings.template === t.id ? "selected" : ""}" data-tool="choose-template" data-id="${t.id}" aria-label="Use ${e(t.name)} template"><div class="template-thumb"><div class="thumb-paper">${ResumeRenderer.render(F.sample, { ...F.defaultSettings, template: t.id, font: t.defaultFont })}</div></div><span class="template-name">${e(t.name)}${F.current().settings.template === t.id ? i("check-circle") : ""}</span><span class="template-desc">${e(t.description)}</span><span class="category-tag">${e(t.category)}</span></button>`,
          )
          .join("")
      : '<div class="gallery-empty">No matching templates. Try another name or category.</div>';
  }
  function advancedDesign() {
    const editor = $("#editor-content");
    if (
      !editor ||
      !$(".design-heading", editor) ||
      !$(".section-order-list", editor) ||
      $(".design-advanced", editor)
    )
      return;
    const s = F.current().settings;
    const section = document.createElement("div");
    section.className = "design-advanced";
    section.innerHTML = `<div class="control-label">More room to make it yours</div><div class="control-group select-row"><label class="form-field"><span>Page margins</span><select data-advanced="margin">${[36, 48, 58, 68].map((n) => `<option value="${n}" ${s.margin === n ? "selected" : ""}>${n} px</option>`).join("")}</select></label><label class="form-field"><span>Section headings</span><select data-advanced="headingStyle"><option value="uppercase" ${s.headingStyle === "uppercase" ? "selected" : ""}>UPPERCASE</option><option value="title" ${s.headingStyle === "title" ? "selected" : ""}>Title case</option></select></label></div><div class="control-group select-row"><label class="form-field"><span>Sidebar position</span><select data-advanced="sidebarSide"><option value="left" ${s.sidebarSide === "left" ? "selected" : ""}>Left</option><option value="right" ${s.sidebarSide === "right" ? "selected" : ""}>Right</option></select></label><label class="form-field"><span>Photo shape</span><select data-advanced="photoShape"><option value="circle" ${s.photoShape === "circle" ? "selected" : ""}>Circle</option><option value="square" ${s.photoShape === "square" ? "selected" : ""}>Square</option></select></label></div><button class="add-section-button" data-tool="section-labels">${i("pencil")} Rename section headings</button><button class="add-section-button" data-tool="save-design">${i("copy")} Save as my template</button><button class="subtle-button" data-tool="gallery">${i("sliders")} Browse all 16 templates</button>`;
    editor.append(section);
  }
  function checker() {
    const a = C.analyze(F.current().data, F.current().settings);
    show(
      "A little polish goes a long way.",
      "A transparent content review. These checks are writing guidance, not an employer’s ATS score.",
      `<div class="tool-score"><div class="score-ring">${a.score}</div><div class="score-text"><strong>Content readiness</strong><p>${a.passed} of ${a.total} checks met · ${a.wordCount} words<br>Review the points below in the context of your experience.</p></div></div>${a.checks.map((c) => `<div class="check-row ${c.pass ? "passed" : ""}">${i(c.pass ? "check-circle" : "pencil")}<div><strong>${e(c.title)}</strong><p>${e(c.detail)}</p></div></div>`).join("")}${a.warnings.map((w) => `<div class="tool-tip">${e(w)}</div>`).join("")}<div class="action-row">${btn("match", "Check a job description")}</div>`,
      "check",
    );
  }
  function matcher() {
    const j = F.current().data.targetJob || {};
    show(
      "Make the connection clear.",
      "Paste the actual job description. We’ll surface terms to review against the experience you really have.",
      `<div class="tool-form">${fields("Target job title", "match-title", j.title)}${fields("Company", "match-company", j.company)}${fields("Job description", "match-description", j.description, "textarea", true)}${fields("Extra keywords (comma-separated)", "match-custom", "", "text", true, "e.g. Java, Agile, stakeholder management")}</div><div class="action-row">${btn("run-match", i("eye") + " Compare keywords", true)}${btn("tailored-copy", i("copy") + " Create a targeted copy")}</div><div id="match-result"></div>`,
      "match",
    );
  }
  function runMatch() {
    const desc = $("#match-description").value;
    if (desc.trim().length < 30) {
      F.toast("Add a fuller job description so there is enough to compare.");
      return;
    }
    matchResult = C.match(
      F.current().data,
      F.current().settings,
      desc,
      $("#match-custom").value,
    );
    const m = matchResult;
    $("#match-result").innerHTML =
      `<div class="tool-score" style="margin-top:20px"><div class="score-ring">${m.score}%</div><div class="score-text"><strong>Keyword coverage</strong><p>${m.present.length} of ${m.terms.length} surfaced terms appear in your visible resume.<br>This is a text comparison, not a hiring prediction.</p></div></div><div class="keyword-group"><h3>Already in your resume</h3><div class="keyword-chips">${m.present.map((t) => `<span class="keyword-chip">${i("check")} ${e(t)}</span>`).join("") || '<span class="input-hint">No exact matches yet.</span>'}</div></div><div class="keyword-group"><h3>Review these terms</h3><div class="keyword-chips">${m.missing.map((t) => `<label class="keyword-chip missing"><input type="checkbox" name="match-skill" value="${e(t)}">${e(t)}</label>`).join("") || '<span class="input-hint">All surfaced terms are present.</span>'}</div></div><p class="tool-tip">Only select skills you actually have. Context, evidence, synonyms, and application requirements matter more than a percentage.</p>${btn("add-matched-skills", "Add selected skills")}`;
  }
  function targetJob() {
    return {
      title: $("#match-title").value.trim(),
      company: $("#match-company").value.trim(),
      description: $("#match-description").value,
    };
  }
  function letterDraft() {
    const d = F.current().data;
    show(
      "Start a conversation.",
      "A draft assembled from the details already in your resume. Review and personalize it before using it.",
      `<label class="form-field"><span>Cover letter draft</span><textarea class="large-text" id="letter-draft" rows="12">${e(C.letter(d))}</textarea></label><p class="tool-tip">Add why this specific company and role interest you. Keep every claim accurate.</p><div class="action-row">${btn("apply-letter", "Use this draft", true)}${btn("letter", "Back to cover letter")}</div>`,
      "letter-draft",
    );
  }
  function importer() {
    show(
      "Bring your story with you.",
      "Import a PDF, Word document, text file, or a PDF exported from LinkedIn. Your file stays on this device.",
      `<div class="tool-empty">${i("upload")}<p>Choose a resume to get started.</p><input id="resume-source" type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Choose resume file"></div><p class="tool-tip">PDF and Word layouts vary. You’ll review the extracted text before creating a draft. Image-only scans need OCR and are not automatically parsed.</p><div id="import-result"></div>${F.current().data.importSource ? btn("review-import", "Review this draft original imported text") : ""}`,
      "import",
    );
  }
  async function extractInput(file) {
    if (file.size > 15 * 1024 * 1024) {
      F.toast("Choose a file smaller than 15 MB.");
      return;
    }
    $("#import-result").innerHTML =
      '<div class="tool-result">Reading your document locally…</div>';
    try {
      const result = await FolioFiles.extractFile(file);
      if (currentTool !== "import") return;
      importName = file.name.replace(/\.[^.]+$/, "");
      pendingImport = result;
      $("#import-result").innerHTML =
        `${(result.warnings || []).map((w) => `<div class="tool-tip">${e(w)}</div>`).join("")}<label class="form-field"><span>Review extracted text</span><textarea id="import-text" class="large-text" rows="13">${e(result.text)}</textarea></label><div class="action-row">${btn("parse-import", "Create a draft from this text", true)}</div><p class="input-hint">Review dates, role boundaries, and contact details after importing. The original file is not changed.</p>`;
    } catch (error) {
      $("#import-result").innerHTML =
        `<div class="tool-tip">${e(error.message)}</div>`;
    }
  }
  function history() {
    const list = workspace.snapshots.filter(
      (s) => s.resumeId === F.current().id,
    );
    show(
      "Keep the versions that matter.",
      "Save a milestone before making a bigger change. Restoring creates a new draft and keeps your current resume.",
      `${fields("Version name", "snapshot-name", "", "text", true, "Before tailoring for Acme")}<div class="action-row">${btn("save-snapshot", i("copy") + " Save this version", true)}</div><div style="margin-top:20px">${list.length ? list.map((s) => `<div class="saved-style-row">${i("file")}<strong>${e(s.name)}<small style="display:block;font-size:9px;color:#9da68e;margin-top:4px">${e(new Date(s.at).toLocaleString())}</small></strong><button class="subtle-button" data-tool="restore-snapshot" data-id="${e(s.id)}">Restore copy</button><button class="icon-button" data-tool="delete-snapshot" data-id="${e(s.id)}" aria-label="Delete saved version">${i("trash")}</button></div>`).join("") : '<p class="tool-empty">Your saved milestones will appear here.</p>'}</div>`,
      "history",
    );
  }
  function fileName() {
    return F.filename() + (F.view() === "letter" ? "-cover-letter" : "");
  }
  async function busy(button, fn) {
    const html = button.innerHTML;
    button.disabled = true;
    button.textContent = "Preparing…";
    try {
      await fn();
      F.toast("Your download is ready.");
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = html;
      }
    }
  }
  async function photo(file) {
    if (!file || !["image/jpeg", "image/png"].includes(file.type)) {
      F.toast("Choose a JPG or PNG photo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      F.toast("Choose a photo smaller than 8 MB.");
      return;
    }
    const image = new Image(),
      url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(new Error("This image could not be read."));
        image.src = url;
      });
      const canvas = document.createElement("canvas"),
        side = 360;
      canvas.width = canvas.height = side;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, side, side);
      const size = Math.min(image.width, image.height);
      ctx.drawImage(
        image,
        (image.width - size) / 2,
        (image.height - size) / 2,
        size,
        size,
        0,
        0,
        side,
        side,
      );
      const data = canvas.toDataURL("image/jpeg", 0.88);
      F.mutate((doc) => (doc.data.personal.photo = data));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function action(button) {
    const tool = button.dataset.tool,
      id = button.dataset.id;
    if (tool === "dashboard") dashboard();
    else if (tool === "gallery") {
      gallery();
    } else if (tool === "gallery-filter") {
      galleryFilter = button.dataset.value;
      gallery();
    } else if (tool === "choose-template") {
      F.selectTemplate(id);
      F.closeModal();
      F.toast(F.templates.find((t) => t.id === id).name + " applied.");
    } else if (tool === "custom-design") {
      F.mutate((d) => (d.settings.template = "custom"));
      F.setTab("design");
      F.closeModal();
    } else if (tool === "save-design") {
      show(
        "A signature style, saved.",
        "Keep these colors, typography, spacing, and layout ready for your next resume.",
        fields(
          "Template name",
          "design-name",
          "",
          "text",
          true,
          "My signature style",
        ) +
          `<div class="action-row">${btn("confirm-save-design", "Save template", true)}</div>`,
        "save-design",
      );
    } else if (tool === "confirm-save-design") {
      const name = $("#design-name").value.trim();
      if (!name) {
        F.toast("Give your template a name.");
        return;
      }
      workspace.designs.push({
        id: uid(),
        name,
        settings: copy(F.current().settings),
      });
      saveWorkspace();
      galleryFilter = "Saved";
      gallery();
    } else if (tool === "apply-design") {
      const d = workspace.designs.find((x) => x.id === id);
      const checked = F.validateDocument({
        name: F.current().name,
        data: F.current().data,
        settings: d.settings,
      });
      F.mutate((doc) => (doc.settings = checked.settings));
      F.closeModal();
      F.toast("Your saved template is applied.");
    } else if (tool === "delete-design") {
      workspace.designs = workspace.designs.filter((d) => d.id !== id);
      saveWorkspace();
      renderGallery();
    } else if (tool === "section-labels") {
      show(
        "Use the words that fit.",
        "Rename your resume headings, including headings in another language.",
        `<div class="tool-form">${Object.entries({
          summary: "Profile",
          experience: "Experience",
          education: "Education",
          skills: "Expertise",
          projects: "Selected projects",
        })
          .map(([key, value]) =>
            fields(
              value,
              "label-" + key,
              F.current().settings.sectionLabels?.[key] || value,
            ),
          )
          .join(
            "",
          )}</div><div class="action-row">${btn("save-labels", "Apply headings", true)}</div>`,
        "labels",
      );
    } else if (tool === "save-labels") {
      const labels = Object.fromEntries(
        ["summary", "experience", "education", "skills", "projects"].map(
          (key) => [
            key,
            $("#label-" + key)
              .value.trim()
              .slice(0, 60),
          ],
        ),
      );
      F.mutate((d) => (d.settings.sectionLabels = labels));
      F.closeModal();
    } else if (tool === "check") checker();
    else if (tool === "match") matcher();
    else if (tool === "run-match") runMatch();
    else if (tool === "tailored-copy") {
      const job = targetJob();
      if (!job.title || !job.company) {
        F.toast("Add a target title and company first.");
        return;
      }
      const data = copy(F.current().data);
      data.targetJob = job;
      F.create(
        job.company + " · " + job.title,
        data,
        copy(F.current().settings),
      );
      F.toast("Targeted copy created. Your original remains saved.");
    } else if (tool === "add-matched-skills") {
      const skills = $$('input[name="match-skill"]:checked').map(
        (x) => x.value,
      );
      if (!skills.length) {
        F.toast("Select only the skills you already have.");
        return;
      }
      F.mutate(
        (d) =>
          (d.data.skills = [
            ...new Set(
              d.data.skills
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean)
                .concat(skills),
            ),
          ].join(", ")),
      );
      F.toast("Selected skills added.");
      runMatch();
    } else if (tool === "letter") {
      F.setView("letter");
      F.closeModal();
    } else if (tool === "resume") {
      F.setView("resume");
      F.closeModal();
    } else if (tool === "letter-draft") letterDraft();
    else if (tool === "apply-letter") {
      const text = $("#letter-draft").value;
      F.mutate((doc) => {
        doc.data.coverLetter.body = text;
        doc.data.coverLetter.signature = [
          doc.data.personal.firstName,
          doc.data.personal.lastName,
        ]
          .filter(Boolean)
          .join(" ");
      });
      F.setView("letter");
      F.closeModal();
    } else if (tool === "import-resume") importer();
    else if (tool === "parse-import") {
      const text = $("#import-text").value;
      if (text.trim().length < 15) {
        F.toast("Add enough text to create a draft.");
        return;
      }
      const parsed = FolioFiles.parseText(text);
      parsed.data.importSource = {
        text,
        sourceType: pendingImport?.sourceType || "text",
        warnings: [
          ...(pendingImport?.warnings || []),
          ...(parsed.warnings || []),
        ],
      };
      F.create(importName || "Imported resume", parsed.data, F.defaultSettings);
      F.toast(
        "Imported. Review all sections and dates; original text is saved in Import a resume.",
      );
    } else if (tool === "review-import") {
      const source = F.current().data.importSource;
      show(
        "Your original imported text.",
        "Kept with this draft so you can check the parsed sections against the source.",
        `<label class="form-field"><span>Reviewed source text</span><textarea rows="14" readonly>${e(source?.text || "")}</textarea></label>${(source?.warnings || []).map((w) => `<div class="tool-tip">${e(w)}</div>`).join("")}`,
        "original-import",
      );
    } else if (tool === "photo") {
      let input = $("#photo-file");
      if (!input) {
        input = document.createElement("input");
        input.id = "photo-file";
        input.type = "file";
        input.accept = "image/png,image/jpeg";
        input.hidden = true;
        document.body.append(input);
      }
      input.click();
    } else if (tool === "remove-photo")
      F.mutate((doc) => (doc.data.personal.photo = ""));
    else if (tool === "docx")
      await busy(button, () =>
        FolioFiles.downloadDOCX(
          F.current().data,
          F.current().settings,
          fileName() + ".docx",
          F.view() === "letter" ? F.current().data.coverLetter : null,
        ),
      );
    else if (tool === "html" || tool === "portfolio")
      await busy(button, () =>
        FolioFiles.downloadHTML(
          F.current().data,
          F.current().settings,
          F.filename() + (tool === "portfolio" ? "-website" : "") + ".html",
          { portfolio: tool === "portfolio" },
        ),
      );
    else if (tool === "history") history();
    else if (tool === "save-snapshot") {
      const name =
        $("#snapshot-name").value.trim() ||
        "Version " + new Date().toLocaleString();
      workspace.snapshots.push({
        id: uid(),
        resumeId: F.current().id,
        name,
        at: new Date().toISOString(),
        data: copy(F.current().data),
        settings: copy(F.current().settings),
      });
      saveWorkspace();
      history();
    } else if (tool === "restore-snapshot") {
      const s = workspace.snapshots.find((s) => s.id === id);
      F.create(s.name + " · restored", copy(s.data), copy(s.settings));
      F.toast("Saved version restored as a new draft.");
    } else if (tool === "delete-snapshot") {
      workspace.snapshots = workspace.snapshots.filter((s) => s.id !== id);
      saveWorkspace();
      history();
    } else if (tool === "show-demo") {
      F.showDemo();
      F.closeModal();
    } else if (tool === "undo") F.undo();
    else if (tool === "redo") F.undo(true);
    else if (tool === "workspace-backup") {
      F.downloadBlob(
        JSON.stringify(
          {
            format: "folio-workspace",
            version: 2,
            library: F.library(),
            workspace,
          },
          null,
          2,
        ),
        "folio-workspace-backup.json",
        "application/json",
      );
    } else if (tool === "workspace-import") $("#workspace-file").click();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (button && !button.disabled)
      action(button).catch((error) =>
        F.toast(error.message || "This action could not complete."),
      );
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "gallery-search") {
      galleryQuery = event.target.value;
      renderGallery();
    }
  });
  document.addEventListener("change", async (event) => {
    try {
      const input = event.target;
      if (input.dataset.advanced) {
        const key = input.dataset.advanced,
          value = key === "margin" ? Number(input.value) : input.value;
        F.mutate((doc) => (doc.settings[key] = value));
      }
      if (input.id === "photo-file" && input.files?.[0]) {
        await photo(input.files[0]);
        input.value = "";
      }
      if (input.id === "resume-source" && input.files?.[0])
        await extractInput(input.files[0]);
      if (input.id === "workspace-file" && input.files?.[0]) {
        if (input.files[0].size > 30 * 1024 * 1024)
          throw new Error("Workspace backup is larger than 30 MB.");
        const raw = JSON.parse(await input.files[0].text());
        if (
          raw.format !== "folio-workspace" ||
          raw.version !== 2 ||
          !Array.isArray(raw.library?.documents)
        )
          throw new Error("Choose a Folio version 2 workspace backup.");
        const docs = raw.library.documents
          .filter((d) => d.id !== "folio-demo-v2")
          .map(F.validateDocument);
        if (!docs.length)
          throw new Error("This workspace backup has no personal drafts.");
        pendingImport = {
          docs,
          workspace: raw.workspace,
          rawDocs: raw.library.documents.filter(
            (d) => d.id !== "folio-demo-v2",
          ),
        };
        show(
          "Restore these saved chapters?",
          "This adds drafts to your workspace. Existing drafts remain available.",
          `<p class="tool-tip">${docs.length} personal drafts found. Saved templates and versions will also be restored.</p><div class="action-row">${btn("confirm-workspace-import", "Add restored drafts", true)}</div>`,
          "restore-workspace",
        );
      }
    } catch (error) {
      F.toast(
        error instanceof SyntaxError
          ? "That file is not valid JSON."
          : error.message,
      );
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-tool="confirm-workspace-import"]')) {
      try {
        const info = pendingImport;
        if (!info?.docs) return;
        const remap = new Map();
        info.docs.forEach((d, n) => {
          const doc = F.create(d.name + " · restored", d.data, d.settings);
          remap.set(info.rawDocs[n].id, doc.id);
        });
        const imported = info.workspace || {};
        if (Array.isArray(imported.jobs))
          workspace.jobs.push(
            ...imported.jobs
              .filter(
                (j) =>
                  j &&
                  typeof j.company === "string" &&
                  typeof j.role === "string",
              )
              .map((j) => ({
                ...j,
                id: uid(),
                resumeId: remap.get(j.resumeId) || "",
                status: [
                  "Saved",
                  "Applied",
                  "Interview",
                  "Offer",
                  "Closed",
                ].includes(j.status)
                  ? j.status
                  : "Saved",
              })),
          );
        if (Array.isArray(imported.designs))
          workspace.designs.push(
            ...imported.designs
              .filter((d) => d && typeof d.name === "string" && d.settings)
              .map((d) => ({
                id: uid(),
                name: d.name,
                settings: F.validateDocument({
                  data: F.sample,
                  settings: d.settings,
                }).settings,
              })),
          );
        for (const [old, newId] of remap) {
          if (
            imported.practice?.[old] &&
            typeof imported.practice[old] === "object"
          )
            workspace.practice[newId] = imported.practice[old];
          if (imported.plans?.[old] && typeof imported.plans[old] === "object")
            workspace.plans[newId] = imported.plans[old];
        }
        if (Array.isArray(imported.snapshots))
          for (const s of imported.snapshots) {
            if (!s?.data?.personal) continue;
            const clean = F.validateDocument(s);
            workspace.snapshots.push({
              id: uid(),
              resumeId: remap.get(s.resumeId) || F.current().id,
              name: typeof s.name === "string" ? s.name : "Restored version",
              at: typeof s.at === "string" ? s.at : new Date().toISOString(),
              data: clean.data,
              settings: clean.settings,
            });
          }
        saveWorkspace();
        pendingImport = null;
        F.closeModal();
        F.toast("Workspace restored. Your existing drafts are still here.");
      } catch (error) {
        F.toast(error.message);
      }
    }
  });
  function updateChrome() {
    const letter = F.view() === "letter";
    $$('.main-nav [data-tool="resume"],.main-nav [data-tool="letter"]').forEach(
      (b) =>
        b.classList.toggle(
          "active",
          b.dataset.tool === (letter ? "letter" : "resume"),
        ),
    );
    $$(".mode-switch button").forEach((b) =>
      b.classList.toggle(
        "selected",
        b.dataset.tool === (letter ? "letter" : "resume"),
      ),
    );
    const score = C.analyze(F.current().data, F.current().settings).score;
    const scoreNode = $("#readiness-value");
    if (scoreNode) scoreNode.textContent = score;
    const demoNode = $("#demo-status");
    if (demoNode)
      demoNode.innerHTML =
        i("check-circle") +
        (F.current().id === "folio-demo-v2"
          ? "Demo · always here when you return"
          : "Personal draft · your changes are saved");
    advancedDesign();
  }
  // Only observe direct panel replacements, then add the advanced controls once.
  new MutationObserver(advancedDesign).observe($("#editor-content"), {
    childList: true,
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORE || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      if (
        incoming &&
        Array.isArray(incoming.jobs) &&
        Array.isArray(incoming.designs) &&
        Array.isArray(incoming.snapshots)
      ) {
        workspace = incoming;
        workspace.practice ||= {};
        workspace.plans ||= {};
      }
    } catch {}
  });
  document.addEventListener("folio:render", updateChrome);
  document.addEventListener("folio:changed", updateChrome);
  window.FolioToolkit = {
    workspace: () => workspace,
    open: dashboard,
    analyze: C.analyze,
    match: C.match,
  };
  updateChrome();
})();
