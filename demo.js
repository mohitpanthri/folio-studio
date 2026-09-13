(() => {
  "use strict";
  const uid = () =>
    crypto.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const sample = {
    personal: {
      firstName: "Alex",
      lastName: "Morgan",
      title: "Senior Product Designer",
      email: "alex.morgan@email.com",
      phone: "+1 (415) 555-0128",
      location: "Brooklyn, New York",
      website: "alexmorgan.design",
      linkedin: "linkedin.com/in/alexmorgan",
      photo: "",
    },
    summary:
      "Thoughtful product designer turning complex problems into simple, human experiences. I bring 6+ years of curiosity, craft, and collaboration to products that make everyday life a little better.",
    experience: [
      {
        id: uid(),
        role: "Senior Product Designer",
        company: "Forma",
        location: "New York, NY",
        start: "2022-03",
        end: "Present",
        description:
          "- Lead end-to-end design for a collaboration platform used by 40,000+ teams.\n- Reimagined onboarding, increasing activation by 28% and making the first five minutes feel effortless.\n- Partner with engineering and research to bring a cohesive design system to life.",
      },
      {
        id: uid(),
        role: "Product Designer",
        company: "Monday Studio",
        location: "Brooklyn, NY",
        start: "2019-06",
        end: "2022-02",
        description:
          "- Designed digital experiences for early-stage companies, from first sketch to launch.\n- Led research and usability testing that shaped three successful product launches.\n- Built a shared component library, reducing design handoff time by 35%.",
      },
    ],
    education: [
      {
        id: uid(),
        degree: "BFA, Communication Design",
        school: "Parsons School of Design",
        start: "2015",
        end: "2019",
        description: "Graduated with honors",
      },
    ],
    skills:
      "Product strategy, Interaction design, User research, Design systems, Prototyping, Figma, Webflow, HTML & CSS",
    projects: [
      {
        id: uid(),
        name: "Room to Grow",
        link: "roomtogrow.design",
        description:
          "A self-initiated project helping urban communities find and share green spaces. Designed with accessibility at its heart.",
      },
    ],
    customSections: [],
  };

  window.FolioDemo = sample;
})();
