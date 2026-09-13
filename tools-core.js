(function(){
  'use strict';
  const words=text=>String(text||'').trim().split(/\s+/).filter(Boolean);
  const normalize=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
  const textOf=(data,settings)=>ResumeRenderer.plainText(data,settings);
  function analyze(data,settings){
    data={...data};for(const key of settings.hiddenSections||[]){if(['summary','skills'].includes(key))data[key]='';else if(['experience','education','projects'].includes(key))data[key]=[];}
    const p=data.personal||{},exp=data.experience||[],summary=words(data.summary),bullets=exp.flatMap(e=>(e.description||'').split('\n').filter(Boolean));
    const checks=[
      {id:'name',title:'Make your name easy to find',pass:!!(p.firstName&&p.lastName),detail:'Use your first and last name.'},
      {id:'contact',title:'Include a valid contact email',pass:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||''),detail:'A working email gives recruiters a direct way to reach you.'},
      {id:'title',title:'Give your professional direction',pass:words(p.title).length>=2,detail:'Use a clear professional title or field of study.'},
      {id:'summary',title:'Keep your summary focused',pass:summary.length>=20&&summary.length<=100,detail:`Your summary has ${summary.length} words. Aim for roughly 20–100.`},
      {id:'experience',title:'Include experience or a project',pass:exp.some(e=>e.role&&e.description)||(data.projects||[]).some(e=>e.name&&e.description),detail:'Work, volunteering, internships, and personal projects all count.'},
      {id:'dates',title:'Give your experience context',pass:exp.length===0||exp.every(e=>e.company&&e.start&&e.end),detail:'Use organization names plus start and end dates for each position.'},
      {id:'impact',title:'Show evidence of your impact',pass:/\d+[%+]?/.test(bullets.join(' ')),detail:'Add an honest count, scale, time saving, or outcome when you have one.'},
      {id:'concise',title:'Keep experience points readable',pass:bullets.length>0&&bullets.every(b=>words(b).length<=45),detail:'Break long paragraphs into focused points of about 45 words or fewer.'},
      {id:'skills',title:'Name relevant skills',pass:String(data.skills||'').split(/[,\n]/).filter(s=>s.trim()).length>=4,detail:'Include at least four specific skills you can demonstrate.'},
      {id:'language',title:'Prefer clear, specific language',pass:!!data.summary&&!/hard.worker|go.getter|synergy|responsible for|results.driven/i.test([data.summary,...bullets].join(' ')),detail:'Replace generic phrases with what you actually did and achieved.'}
    ];
    const warnings=[];if(data.personal?.photo)warnings.push('Photo expectations vary by country and employer. Check before applying.');
    if(['studio','slate','grid','summit','atelier'].includes(settings.template)||settings.template==='custom'&&settings.layout==='two-column')warnings.push('For a parser-sensitive application, consider a one-column template or the Word export.');
    if((settings.hiddenSections||[]).length)warnings.push('Some sections are hidden. Review the exported document before sending.');
    const count=words(textOf(data,settings)).length;
    return {score:Math.round(checks.filter(c=>c.pass).length/checks.length*100),checks,warnings,wordCount:count,passed:checks.filter(c=>c.pass).length,total:checks.length};
  }
  const stop=new Set(('the and for with you your our are will that this from have has be to of in on a an is as at by or we us it they their all work team role about must able well can may more also such other new within across through into strong good great excellent working including using required requirements preferred responsibilities experience years year skills knowledge ability qualifications candidate position looking job company opportunity join support business related relevant highly proven demonstrate understanding degree equivalent please application employer applicants equal opportunity employment time full part looking seeking plus minimum least take make deliver ensure help build develop provide need needs world best workday candidates apply').split(' '));
  const known=['project management','product design','user research','design systems','machine learning','data analysis','data science','cloud computing','stakeholder management','customer service','financial analysis','problem solving','quality assurance','continuous integration','react','typescript','javascript','python','java','c++','c#','.net','sql','aws','azure','docker','kubernetes','figma','excel','tableau','power bi','agile','scrum','leadership','communication','accessibility','prototyping','html','css','node.js','budgeting','forecasting','accounting','sales','marketing','research','testing','security','analytics','mentoring','strategy','recruiting','operations','onboarding'];
  function contains(haystack,needle){const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(haystack);}
  function match(data,settings,description,custom=''){
    const job=normalize(description),resume=normalize(textOf(data,settings)),freq=new Map();
    for(const word of job.match(/[a-z][a-z0-9.+#-]{2,}/g)||[]){const term=word.replace(/[.,-]+$/,'');if(!stop.has(term))freq.set(term,(freq.get(term)||0)+1);}
    const selected=known.filter(term=>contains(job,term));
    const additional=[...freq].sort((a,b)=>b[1]-a[1]).map(([term])=>term).filter(term=>!selected.some(p=>p.split(' ').includes(term))).slice(0,25-selected.length);
    const customTerms=String(custom).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const terms=[...new Set([...customTerms,...selected,...additional])].slice(0,40),present=terms.filter(t=>contains(resume,t)),missing=terms.filter(t=>!present.includes(t));
    return {terms,present,missing,score:terms.length?Math.round(present.length/terms.length*100):0};
  }
  const phrases={
    Engineering:['Built [system] using [technology] to support [user need].','Reduced [failure or delay] by [verified result] through [change].','Automated [workflow], saving [verified amount] per [period].','Partnered with [team] to ship [feature] for [audience].'],
    Design:['Designed [experience] around insights from [research method].','Improved [journey] through [design change], measured by [result].','Created [design system or prototype] used by [team or audience].','Tested [concept] with [participants] and applied [finding].'],
    Business:['Led [initiative] across [teams] to achieve [verified outcome].','Analyzed [data] to guide [decision or strategy].','Managed [scope or budget] while delivering [outcome].','Streamlined [process], improving [measured result].'],
    Student:['Completed [project] using [method], demonstrating [skill].','Collaborated with [group] to create [deliverable].','Researched [topic] and presented [finding] to [audience].','Organized [activity] for [participants], achieving [outcome].']
  };
  function achievement(action,what,how,outcome){const clean=s=>String(s||'').trim().replace(/[.]+$/,'');return [clean(action),clean(what),how?'using '+clean(how):'',outcome?'— '+clean(outcome):''].filter(Boolean).join(' ')+(what?'.':'');}
  function summary(data){const title=data.personal?.title||'Professional',skills=String(data.skills||'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean).slice(0,3);const exp=(data.experience||[]).find(e=>e.role&&e.company);return title+(skills.length?' with a focus on '+skills.join(', '):'')+'.'+(exp?' Experience as '+exp.role+' at '+exp.company+'.':'')+(data.projects?.[0]?.name?' Recent work includes '+data.projects[0].name+'.':'');}
  function letter(data){const l=data.coverLetter||{},job=data.targetJob||{},role=l.role||job.title||'the advertised position',company=l.company||job.company||'your organization';return `I am writing to apply for ${role} at ${company}.\n\n${data.summary||summary(data)}\n\n${data.experience?.[0]?.description?data.experience[0].description.split('\n').map(line=>line.replace(/^[-•*]\s*/, '')).slice(0,2).join(' '):'I would welcome the chance to discuss how my background relates to this opportunity.'}\n\nThank you for considering my application. I would appreciate the opportunity to discuss the role and learn more about your team.`;}
  function interviewQuestions(data){const skills=String(data.skills||'').split(',').map(s=>s.trim()).filter(Boolean);return ['Tell me about yourself and why this role interests you.','Describe a project you are proud of. What was your specific contribution?',`Walk me through a challenging decision involving ${skills[0]||'your primary skill'}.`,'Tell me about a disagreement with a teammate. How did you handle it?',`How would you approach your first month as ${data.targetJob?.title||data.personal?.title||'a new team member'}?`,'Describe a time an idea did not work. What did you change?','Which result best demonstrates the value of your work?','What questions would you ask this team before accepting an offer?'];}
  window.FolioCoach={analyze,match,achievement,summary,letter,phrases,interviewQuestions,words};
})();
