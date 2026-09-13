(() => {
  const key = "folio-theme-v2";
  const system = matchMedia("(prefers-color-scheme: dark)");
  const button = document.getElementById("theme-toggle");
  function apply(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    button.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode",
    );
    button.title = button.getAttribute("aria-label");
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#171b18"
      : "#fafaf7";
  }
  button.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(theme);
    try {
      localStorage.setItem(key, theme);
    } catch {}
  });
  system.addEventListener("change", () => {
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    apply(system.matches ? "dark" : "light");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key)
      apply(event.newValue || (system.matches ? "dark" : "light"));
  });
  apply(document.documentElement.dataset.theme);
})();
