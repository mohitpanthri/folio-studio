(function () {
  'use strict';

  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const text = (value) => String(value == null ? '' : value).trim();
  const hasText = (value) => text(value).length > 0;
  const standardOrder = ['summary', 'experience', 'education', 'skills', 'projects'];
  const headings = { summary: 'Profile', experience: 'Experience', education: 'Education', skills: 'Expertise', projects: 'Selected projects' };
  const fonts = { sans: "'Inter', 'Helvetica Neue', Arial, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "'Courier New', Courier, monospace" };

  function editable(value, path, className, tag) {
    return '<' + (tag || 'span') + ' class="' + (className || '') + '" data-resume-path="' + escapeHtml(path) + '">' + escapeHtml(value) + '</' + (tag || 'span') + '>';
  }

  function description(value, path) {
    if (!hasText(value)) return '';
    const lines = text(value).split(/\r?\n/).filter(hasText);
    return '<div class="resume-description" data-resume-path="' + escapeHtml(path) + '">' + lines.map((line) => {
      const bullet = /^\s*[-*•]\s+/.test(line);
      return '<p class="' + (bullet ? 'resume-bullet' : 'resume-paragraph') + '">' + (bullet ? '<span class="resume-bullet-mark" aria-hidden="true">•</span>' : '') + escapeHtml(line.replace(/^\s*[-*•]\s+/, '')) + '</p>';
    }).join('') + '</div>';
  }

  function dateLabel(value) {
    const input = text(value);
    const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(input);
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(match[2]) - 1] + ' ' + match[1];
    return input;
  }

  function dates(entry, path) {
    if (!hasText(entry.start) && !hasText(entry.end)) return '';
    return '<div class="resume-dates">' + (hasText(entry.start) ? editable(dateLabel(entry.start), path + '.start') : '') + (hasText(entry.start) && hasText(entry.end) ? '<span class="resume-date-separator"> — </span>' : '') + (hasText(entry.end) ? editable(dateLabel(entry.end), path + '.end') : '') + '</div>';
  }

  function heading(title, path) {
    return path ? editable(title, path, 'resume-section-title', 'h2') : '<h2 class="resume-section-title">' + escapeHtml(title) + '</h2>';
  }

  function validEntries(entries, fields) {
    return (Array.isArray(entries) ? entries : []).map((entry, index) => ({ entry: entry || {}, index })).filter(({ entry }) => fields.some((field) => hasText(entry[field])));
  }

  function sectionContent(id, data, settings) {
    const labels = settings && settings.sectionLabels || {};
    const label = hasText(labels[id]) ? text(labels[id]) : headings[id];
    if (id === 'summary') return hasText(data.summary) ? heading(label) + description(data.summary, 'summary') : '';
    if (id === 'experience') {
      const entries = validEntries(data.experience, ['role', 'company', 'location', 'start', 'end', 'description']);
      return entries.length ? heading(label) + entries.map(({ entry, index }) => {
        const path = 'experience.' + index;
        return '<div class="resume-entry"><div class="resume-entry-top">' + editable(entry.role || '', path + '.role', 'resume-entry-title', 'h3') + dates(entry, path) + '</div><div class="resume-entry-meta">' + (hasText(entry.company) ? editable(entry.company, path + '.company', 'resume-company') : '') + (hasText(entry.company) && hasText(entry.location) ? '<span class="resume-meta-separator"> · </span>' : '') + (hasText(entry.location) ? editable(entry.location, path + '.location', 'resume-location') : '') + '</div>' + description(entry.description, path + '.description') + '</div>';
      }).join('') : '';
    }
    if (id === 'education') {
      const entries = validEntries(data.education, ['degree', 'school', 'start', 'end', 'description']);
      return entries.length ? heading(label) + entries.map(({ entry, index }) => {
        const path = 'education.' + index;
        return '<div class="resume-entry resume-education-entry">' + editable(entry.degree || '', path + '.degree', 'resume-entry-title', 'h3') + (hasText(entry.school) ? editable(entry.school, path + '.school', 'resume-school', 'div') : '') + dates(entry, path) + description(entry.description, path + '.description') + '</div>';
      }).join('') : '';
    }
    if (id === 'skills') {
      const skills = text(data.skills).split(/[,\n]+/).map(text).filter(Boolean);
      return skills.length ? heading(label) + '<div class="resume-skills" data-resume-path="skills">' + skills.map((skill) => '<span class="resume-skill">' + escapeHtml(skill) + '</span>').join(' ') + '</div>' : '';
    }
    if (id === 'projects') {
      const entries = validEntries(data.projects, ['name', 'link', 'description']);
      return entries.length ? heading(label) + entries.map(({ entry, index }) => {
        const path = 'projects.' + index;
        return '<div class="resume-entry"><div class="resume-entry-top">' + editable(entry.name || '', path + '.name', 'resume-entry-title', 'h3') + '</div>' + (hasText(entry.link) ? editable(entry.link, path + '.link', 'resume-project-link', 'div') : '') + description(entry.description, path + '.description') + '</div>';
      }).join('') : '';
    }
    const custom = (Array.isArray(data.customSections) ? data.customSections : []).findIndex((item) => item && String(item.id) === String(id));
    if (custom < 0) return '';
    const entry = data.customSections[custom];
    return hasText(entry.title) || hasText(entry.content) ? heading(entry.title || 'Additional information', 'customSections.' + custom + '.title') + description(entry.content, 'customSections.' + custom + '.content') : '';
  }

  function sectionIds(data, settings) {
    const all = standardOrder.concat((Array.isArray(data.customSections) ? data.customSections : []).filter(Boolean).map((entry) => String(entry.id)));
    const order = Array.isArray(settings.sectionOrder) ? settings.sectionOrder.map(String).concat(all) : all;
    const hidden = new Set(Array.isArray(settings.hiddenSections) ? settings.hiddenSections.map(String) : []);
    return Array.from(new Set(order)).filter((id) => all.includes(id) && !hidden.has(id));
  }

  function design(options) {
    const settings = options || {};
    const catalog = Array.isArray(window.FolioTemplates) ? window.FolioTemplates : [{ id: 'studio', defaultFont: 'sans', layout: 'two-column' }, { id: 'modern' }, { id: 'editorial', defaultFont: 'serif' }, { id: 'minimal' }];
    const selected = catalog.find((item) => item.id === settings.template);
    const template = selected ? selected.id : settings.template === 'custom' ? 'custom' : 'studio';
    const accent = /^#[0-9a-f]{6}$/i.test(settings.accent || '') ? settings.accent : selected && selected.accent || '#b65c3a';
    const font = Object.prototype.hasOwnProperty.call(fonts, settings.font) ? fonts[settings.font] : fonts[selected && selected.defaultFont] || fonts.sans;
    const fontSize = [10, 11, 12].includes(Number(settings.fontSize)) ? Number(settings.fontSize) : 11;
    const spacing = ['compact', 'comfortable', 'spacious'].includes(settings.spacing) ? settings.spacing : 'comfortable';
    const paper = settings.paper === 'letter' ? 'letter' : 'a4';
    const margin = [36, 48, 58, 68].includes(Number(settings.margin)) ? Number(settings.margin) : 58;
    const headingStyle = ['uppercase', 'title'].includes(settings.headingStyle) ? settings.headingStyle : 'template';
    const sidebarSide = settings.sidebarSide === 'left' ? 'left' : 'right';
    const twoColumn = template === 'custom' ? settings.layout === 'two-column' : !!(selected ? selected.layout === 'two-column' : template === 'studio');
    const photoShape = settings.photoShape === 'square' ? 'square' : 'circle';
    return { template, twoColumn, sidebarSide, classes: 'resume-template-' + template + ' resume-spacing-' + spacing + ' resume-paper-' + paper + ' resume-headings-' + headingStyle + ' resume-sidebar-' + sidebarSide + ' resume-photo-' + photoShape + (twoColumn ? ' resume-layout-two' : ' resume-layout-one'), style: '--resume-accent:' + accent + ';--resume-font:' + font + ';--resume-font-size:' + fontSize + 'pt;--resume-margin:' + margin + 'px' };
  }

  function safePhoto(value) {
    const source = text(value);
    return source.length <= 4000000 && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i.test(source) ? source : '';
  }

  function renderHeader(personal, theme) {
    const name = [text(personal.firstName), text(personal.lastName)].filter(Boolean).join(' ');
    const contact = ['email', 'phone', 'location', 'website', 'linkedin'].filter((field) => hasText(personal[field])).map((field) => editable(personal[field], 'personal.' + field, 'resume-contact-item resume-contact-' + field)).join('<span class="resume-contact-separator" aria-hidden="true">·</span>');
    const nameHtml = name ? editable(personal.firstName || '', 'personal.firstName', 'resume-first-name') + (hasText(personal.firstName) && hasText(personal.lastName) ? ' ' : '') + editable(personal.lastName || '', 'personal.lastName', 'resume-last-name') : '<span class="resume-name-placeholder" data-resume-path="personal.firstName">Your name</span>';
    const photo = safePhoto(personal.photo);
    const initials = [text(personal.firstName).slice(0, 1), text(personal.lastName).slice(0, 1)].join('') || 'CV';
    const portrait = photo ? '<img class="resume-photo" src="' + escapeHtml(photo) + '" alt="Portrait of ' + escapeHtml(name || 'resume owner') + '" width="88" height="88">' : theme.template === 'summit' ? '<div class="resume-monogram" aria-hidden="true">' + escapeHtml(initials) + '</div>' : '';
    return '<header class="resume-header' + (portrait ? ' resume-header-with-portrait' : '') + '"><div class="resume-header-rule"></div>' + portrait + '<div class="resume-identity"><h1 class="resume-name">' + nameHtml + '</h1>' + (hasText(personal.title) ? editable(personal.title, 'personal.title', 'resume-professional-title', 'div') : '') + '</div>' + (contact ? '<div class="resume-contact">' + contact + '</div>' : '') + '</header>';
  }

  function render(input, options) {
    const data = input || {};
    const settings = options || {};
    const personal = data.personal || {};
    const theme = design(settings);
    const ids = sectionIds(data, settings);
    const sections = ids.map((id) => ({ id, html: sectionContent(id, data, settings) })).filter((section) => section.html);
    const section = ({ id, html }) => '<section class="resume-section resume-section-' + (standardOrder.includes(id) ? id : 'custom') + '" data-resume-section="' + escapeHtml(id) + '">' + html + '</section>';
    const sideIds = ['education', 'skills'];
    let body;
    if (theme.twoColumn && sections.some((item) => sideIds.includes(item.id)) && sections.some((item) => !sideIds.includes(item.id))) {
      const main = '<div class="resume-main">' + sections.filter((item) => !sideIds.includes(item.id)).map(section).join('') + '</div>';
      const sidebar = '<aside class="resume-sidebar">' + sections.filter((item) => sideIds.includes(item.id)).map(section).join('') + '</aside>';
      body = '<div class="resume-columns">' + (theme.sidebarSide === 'left' ? sidebar + main : main + sidebar) + '</div>';
    } else body = '<div class="resume-single-column">' + sections.map(section).join('') + '</div>';
    const name = [text(personal.firstName), text(personal.lastName)].filter(Boolean).join(' ');
    return '<article class="resume-sheet ' + theme.classes + '" style="' + escapeHtml(theme.style) + '" aria-label="' + escapeHtml(name ? name + ' resume' : 'Resume preview') + '">' + renderHeader(personal, theme) + '<div class="resume-body">' + body + '</div></article>';
  }

  function plainText(input, options) {
    const data = input || {};
    const settings = options || {};
    const personal = data.personal || {};
    const lines = [[text(personal.firstName), text(personal.lastName)].filter(Boolean).join(' '), text(personal.title), ['email', 'phone', 'location', 'website', 'linkedin'].map((key) => text(personal[key])).filter(Boolean).join(' | ')].filter(Boolean);
    const dateRange = (entry) => [dateLabel(entry.start), dateLabel(entry.end)].filter(Boolean).join(' — ');
    sectionIds(data, settings).forEach((id) => {
      let content = [];
      let title = settings.sectionLabels && hasText(settings.sectionLabels[id]) ? text(settings.sectionLabels[id]) : headings[id];
      if (id === 'summary' && hasText(data.summary)) content.push(text(data.summary));
      if (id === 'skills' && hasText(data.skills)) content.push(text(data.skills));
      if (id === 'experience') content = validEntries(data.experience, ['role', 'company', 'location', 'start', 'end', 'description']).map(({ entry }) => [text(entry.role), [text(entry.company), text(entry.location), dateRange(entry)].filter(Boolean).join(' | '), text(entry.description)].filter(Boolean).join('\n'));
      if (id === 'education') content = validEntries(data.education, ['degree', 'school', 'start', 'end', 'description']).map(({ entry }) => [text(entry.degree), [text(entry.school), dateRange(entry)].filter(Boolean).join(' | '), text(entry.description)].filter(Boolean).join('\n'));
      if (id === 'projects') content = validEntries(data.projects, ['name', 'link', 'description']).map(({ entry }) => [text(entry.name), text(entry.link), text(entry.description)].filter(Boolean).join('\n'));
      if (!standardOrder.includes(id)) {
        const custom = (Array.isArray(data.customSections) ? data.customSections : []).find((entry) => entry && String(entry.id) === id);
        if (custom && (hasText(custom.title) || hasText(custom.content))) { title = text(custom.title) || 'Additional information'; content = [text(custom.content)]; }
      }
      if (content.length) lines.push('\n' + title.toUpperCase() + '\n' + content.join('\n\n'));
    });
    return lines.join('\n') + '\n';
  }

  function renderCoverLetter(input, options, inputLetter) {
    const data = input || {}, settings = options || {}, letter = inputLetter || {}, personal = data.personal || {};
    const theme = design(settings);
    const fullName = [text(personal.firstName), text(personal.lastName)].filter(Boolean).join(' ');
    const field = (value, key, className, tag) => '<' + (tag || 'div') + ' class="' + (className || '') + '" data-letter-path="' + key + '">' + escapeHtml(value) + '</' + (tag || 'div') + '>';
    const recipient = ['recipient', 'company'].filter((key) => hasText(letter[key])).map((key) => field(letter[key], key, 'letter-' + key)).join('');
    const paragraphs = text(letter.body).split(/\r?\n\s*\r?\n/).filter(hasText).map((paragraph) => '<p>' + escapeHtml(paragraph).replace(/\r?\n/g, '<br>') + '</p>').join('');
    const body = '<div class="letter-address-row">' + (recipient ? '<div class="letter-recipient-block">' + recipient + '</div>' : '') + (hasText(letter.date) ? field(letter.date, 'date', 'letter-date') : '') + '</div>' + (hasText(letter.role) ? '<div class="letter-subject"><span>Re: </span>' + field(letter.role, 'role', '', 'span') + '</div>' : '') + field(hasText(letter.greeting) ? letter.greeting : 'Dear Hiring Manager,', 'greeting', 'letter-greeting') + '<div class="letter-prose" data-letter-path="body">' + paragraphs + '</div><div class="letter-signoff">' + field(hasText(letter.closing) ? letter.closing : 'Kind regards,', 'closing', 'letter-closing') + field(hasText(letter.signature) ? letter.signature : fullName, 'signature', 'letter-signature') + '</div>';
    return '<article class="resume-sheet resume-cover-letter ' + theme.classes + '" style="' + escapeHtml(theme.style) + '" aria-label="' + escapeHtml(fullName ? fullName + ' cover letter' : 'Cover letter preview') + '">' + renderHeader(personal, theme) + '<div class="resume-body letter-body">' + body + '</div></article>';
  }

  function coverLetterPlainText(input, inputLetter) {
    const data = input || {}, letter = inputLetter || {}, personal = data.personal || {};
    const name = [text(personal.firstName), text(personal.lastName)].filter(Boolean).join(' ');
    return [name, text(personal.title), ['email', 'phone', 'location', 'website', 'linkedin'].map((key) => text(personal[key])).filter(Boolean).join(' | '), '', text(letter.date), [text(letter.recipient), text(letter.company)].filter(Boolean).join('\n'), hasText(letter.role) ? 'Re: ' + text(letter.role) : '', '', text(letter.greeting) || 'Dear Hiring Manager,', '', text(letter.body), '', text(letter.closing) || 'Kind regards,', text(letter.signature) || name].join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  window.ResumeRenderer = { render, escapeHtml, plainText, renderCoverLetter, coverLetterPlainText, safePhoto };
})();
