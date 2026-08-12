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
  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- this lint rule predates the App Router; beforeInteractive in the root layout is the documented way to avoid a flash of the wrong theme before hydration
  return <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>;
}
