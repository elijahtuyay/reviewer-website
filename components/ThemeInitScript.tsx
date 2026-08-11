import Script from "next/script";

const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export default function ThemeInitScript() {
  return <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>;
}
