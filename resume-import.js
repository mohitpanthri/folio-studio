(() => {
  "use strict";
  const txt = (value) => String(value == null ? "" : value).trim();
  const uid = () =>
    "import-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 9);
  const MAX_TEXT = 250000;
  // Conservative, editable draft extraction. Facts are copied from the supplied
  // text; uncertain content stays visible in descriptions or a custom section.
  function parseText(source) {
    const text = txt(source)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/[▪●◦]/g, "•")
      .replace(
        /^(Skills|Technical skills|Summary|Profile|Languages|Certifications)\s*:\s*(\S.*)$/gim,
        "$1\n$2",
      )
      .slice(0, MAX_TEXT);
    if (!text) throw new Error("Add some resume text before creating a draft.");
    const data = {
      personal: {
        firstName: "",
        lastName: "",
        title: "",
        email: "",
        phone: "",
        location: "",
        website: "",
        linkedin: "",
      },
      summary: "",
      experience: [],
      education: [],
      skills: "",
      projects: [],
      customSections: [],
    };
    const warnings = [
      "This is a best-effort draft. Verify all contact details, job titles, dates, and section assignments; your text has not been rewritten.",
    ];
    const parsedFields = [];
    const headings = {
      summary:
        /^(?:professional |personal |career )?(?:summary|profile|objective|about(?: me)?)$/i,
      experience:
        /^(?:work |professional |relevant |employment |career )?(?:experience|history)$/i,
      education: /^(?:education|qualifications|academic background)$/i,
      skills:
        /^(?:(?:technical|core|key|professional) )?(?:skills|competencies|expertise|strengths)$/i,
      projects: /^(?:selected |personal |key )?projects$/i,
    };
    const customHeading =
      /^(?:certifications?|certificates?|awards?(?: and honors)?|honou?rs?|languages?|publications?|interests?|hobbies|volunteer(?:ing| experience)?|references|achievements|training|courses)$/i;
    const spacedHeadings = {
      PROFILE: "summary",
      SUMMARY: "summary",
      PROFESSIONALSUMMARY: "summary",
      ABOUTME: "summary",
      EXPERIENCE: "experience",
      WORKEXPERIENCE: "experience",
      PROFESSIONALEXPERIENCE: "experience",
      EMPLOYMENTHISTORY: "experience",
      EDUCATION: "education",
      QUALIFICATIONS: "education",
      ACADEMICBACKGROUND: "education",
      SKILLS: "skills",
      TECHNICALSKILLS: "skills",
      CORESKILLS: "skills",
      EXPERTISE: "skills",
      COMPETENCIES: "skills",
      PROJECTS: "projects",
      SELECTEDPROJECTS: "projects",
      PERSONALPROJECTS: "projects",
    };
    const sections = [];
    let active = { id: "intro", title: "", lines: [] };
    sections.push(active);
    for (const line of text.split("\n")) {
      const label = line
        .trim()
        .replace(/^#{1,4}\s*/, "")
        .replace(/:$/, "")
        .trim();
      const id =
        Object.keys(headings).find((key) => headings[key].test(label)) ||
        (/^(?:[A-Za-z]\s+){2,}[A-Za-z]$/.test(label)
          ? spacedHeadings[label.replace(/\s/g, "").toUpperCase()]
          : null);
      if (id || customHeading.test(label)) {
        active = { id: id || "custom", title: label, lines: [] };
        sections.push(active);
      } else active.lines.push(line);
    }
    const intro = sections[0].lines
      .map((line) => line.trim())
      .filter((line) => line && !/^(resume|curriculum vitae|cv)$/i.test(line));
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) {
      data.personal.email = email[0];
      parsedFields.push("Email");
    }
    const linkedin = intro
      .join("\n")
      .match(/(?:(?:https?:\/\/)?(?:www\.)?)?linkedin\.com\/in\/[^\s|<>]+/i);
    if (linkedin) {
      data.personal.linkedin = linkedin[0].replace(/[,.]$/, "");
      parsedFields.push("LinkedIn");
    }
    const website = intro
      .join("\n")
      .replace(linkedin ? linkedin[0] : /$^/, "")
      .match(/(?:https?:\/\/|www\.)[^\s|<>]+|\bgithub\.com\/[^\s|<>]+/i);
    if (website) {
      data.personal.website = website[0].replace(/[,.]$/, "");
      parsedFields.push("Website");
    }
    const phone = intro
      .join("\n")
      .match(
        /(?:^|[|•·\n]|(?:phone|mobile|tel(?:ephone)?)\s*:)\s*(\+?[\d(][\d() .-]{6,22}\d)(?=\s*(?:[|•·\n]|$))/i,
      );
    if (phone && phone[1].replace(/\D/g, "").length >= 7) {
      data.personal.phone = phone[1].trim();
      parsedFields.push("Phone");
    }
    const leftovers = intro
      .map((line) =>
        line
          .replace(
            /\b(?:email|e-mail|phone|mobile|telephone|tel|linkedin|website)\s*:\s*/gi,
            "",
          )
          .replace(email ? email[0] : /$^/, "")
          .replace(website ? website[0] : /$^/, "")
          .replace(linkedin ? linkedin[0] : /$^/, "")
          .replace(phone ? phone[1] : /$^/, "")
          .replace(/^[\s|·,]+|[\s|·,]+$/g, "")
          .trim(),
      )
      .filter(Boolean);
    if (
      leftovers[0] &&
      /^[\p{L}][\p{L}\p{M} .'’\-]{1,74}$/u.test(leftovers[0]) &&
      leftovers[0].split(/\s+/).length <= 7 &&
      !/^(resume|curriculum vitae|cv)$/i.test(leftovers[0])
    ) {
      const name = leftovers.shift().split(/\s+/);
      data.personal.firstName = name.shift();
      data.personal.lastName = name.join(" ");
      parsedFields.push("Name");
    }
    const locationIndex = leftovers.findIndex((line) =>
      /^(?:location|address|based in)\s*:/i.test(line),
    );
    if (locationIndex >= 0) {
      data.personal.location = leftovers
        .splice(locationIndex, 1)[0]
        .replace(/^[^:]+:\s*/, "");
      parsedFields.push("Location");
    }
    if (
      leftovers[0] &&
      leftovers[0].length < 100 &&
      !/[|@]/.test(leftovers[0])
    ) {
      data.personal.title = leftovers.shift();
      parsedFields.push("Professional title");
    }
    if (leftovers.length)
      data.customSections.push({
        id: uid(),
        title: "Imported details",
        content: leftovers.join("\n"),
      });
    const month =
      "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
    const date =
      "(?:" +
      month +
      "\\.?\\s+(?:19|20)\\d{2}|(?:1[0-2]|0?[1-9])[/](?:19|20)\\d{2}|(?:19|20)\\d{2}(?:[-/](?:1[0-2]|0?[1-9]))?)";
    const dateRange = new RegExp(
      "(" +
        date +
        ")\\s*(?:—|–|-|\\bto\\b)\\s*(" +
        date +
        "|Present|Current|Now|Ongoing)",
      "i",
    );
    for (const section of sections.slice(1)) {
      const content = section.lines.join("\n").trim();
      if (!content) continue;
      if (section.id === "summary") {
        data.summary += (data.summary ? "\n" : "") + content;
        parsedFields.push("Summary");
        continue;
      }
      if (section.id === "skills") {
        data.skills +=
          (data.skills ? ", " : "") +
          content.replace(/^\s*[-•*]\s*/gm, "").replace(/\n+/g, ", ");
        parsedFields.push("Skills");
        continue;
      }
      if (section.id === "custom") {
        data.customSections.push({ id: uid(), title: section.title, content });
        parsedFields.push(section.title);
        continue;
      }
      let blocks = content.split(/\n\s*\n/).filter(Boolean);
      const compactLines = content.split("\n").map(txt).filter(Boolean);
      // PDF text commonly has role and dates together but no blank paragraph
      // boundaries. A dated role starts an entry; bullet dates stay in the body.
      if (
        section.id === "experience" &&
        dateRange.test(compactLines[0]) &&
        compactLines[0].replace(dateRange, "").trim()
      ) {
        blocks = [];
        let block = [];
        for (const line of compactLines) {
          if (
            block.length &&
            !/^[-•*]/.test(line) &&
            dateRange.test(line) &&
            line.replace(dateRange, "").replace(/[|·\s]/g, "").length > 2
          ) {
            blocks.push(block.join("\n"));
            block = [];
          }
          block.push(line);
        }
        if (block.length) blocks.push(block.join("\n"));
      }
      for (const block of blocks) {
        const lines = block.split("\n").map(txt).filter(Boolean);
        if (!lines.length) continue;
        if (section.id === "projects") {
          const name = lines.shift(),
            candidate =
              lines[0] &&
              /^(https?:\/\/|www\.|[\w-]+\.[a-z]{2,}\/)/i.test(lines[0])
                ? lines.shift()
                : "";
          data.projects.push({
            id: uid(),
            name,
            link: candidate,
            description: lines.join("\n"),
          });
          continue;
        }
        const dateMatch = block.match(dateRange);
        let start = "",
          end = "";
        if (dateMatch) {
          start = dateMatch[1];
          end = dateMatch[2];
        }
        if (
          section.id === "education" &&
          lines.length >= 3 &&
          lines[1].length < 50 &&
          /\b(university|college|school|institute|academy|polytechnic)\b/i.test(
            lines[2],
          ) &&
          !/\b(university|college|school|institute|academy|polytechnic)\b/i.test(
            lines[1],
          ) &&
          !dateRange.test(lines[1])
        )
          lines.splice(0, 2, lines[0] + " " + lines[1]);
        const first = lines.shift(),
          firstNoDate = first
            .replace(dateRange, "")
            .replace(/\s*[|·]\s*$/, "")
            .trim();
        const headParts = firstNoDate.split(/\s+[|·]\s+|\s+at\s+/i);
        const title = headParts.shift() || firstNoDate;
        let organization = headParts.join(" | "),
          location = "";
        if (
          !organization &&
          lines[0] &&
          !/^[-•*]/.test(lines[0]) &&
          lines[0].length < 150 &&
          !/^[\d\s—–-]+$/.test(lines[0])
        ) {
          const second = lines
            .shift()
            .replace(dateRange, "")
            .replace(/^[\s|·]+|[\s|·]+$/g, "");
          const parts = second.split(/\s+[|·]\s+/);
          organization = parts.shift() || "";
          location = parts.join(" | ");
        }
        if (
          lines[0] &&
          dateRange.test(lines[0]) &&
          lines[0].replace(dateRange, "").replace(/[|·\s]/g, "") === ""
        )
          lines.shift();
        if (section.id === "experience")
          data.experience.push({
            id: uid(),
            role: title,
            company: organization,
            location,
            start,
            end,
            description: lines.join("\n"),
          });
        if (section.id === "education")
          data.education.push({
            id: uid(),
            degree: title,
            school: organization,
            start,
            end,
            description: [location, ...lines].filter(Boolean).join("\n"),
          });
      }
      parsedFields.push(
        section.id === "experience"
          ? "Experience"
          : section.id === "education"
            ? "Education"
            : "Projects",
      );
    }
    if (sections.length === 1)
      warnings.push(
        "No standard section headings were detected. Remaining text is preserved in Imported details; move it into the appropriate sections.",
      );
    if (!data.personal.firstName)
      warnings.push(
        "A name could not be identified confidently. Add it in Personal details.",
      );
    if (data.experience.length || data.education.length)
      warnings.push(
        "Blank lines are used to separate entries. Split or combine work and education entries if needed.",
      );
    return { data, warnings, parsedFields: [...new Set(parsedFields)] };
  }

  window.FolioImport = { parseText };
})();
