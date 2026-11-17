try {
  document.documentElement.classList.toggle("dark", localStorage.getItem("notedeck-theme") !== "light");
} catch {
  // Keep the default theme when browser storage is unavailable.
}
