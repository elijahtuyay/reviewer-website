/**
 * Sets the `dark` class on <html> before the page paints.
 *
 * This used to be `<Script strategy="beforeInteractive">`, which reads like the
 * right tool and is not. next/script serializes an inline script into the Next
 * client runtime's own queue (`self.__next_s.push([...])`) rather than emitting
 * a real <script> tag, so it does not run until that runtime has booted — which
 * means after ~400 KB of framework chunks have downloaded and executed. The
 * stylesheet's light `:root` palette has painted long before that, so every
 * dark-mode user got a white flash on every full page load. Measured in the
 * prerendered HTML: </head> ended at byte 2432 and the theme code did not appear
 * until byte 2866, inside the body, as queued data.
 *
 * The docs are not wrong, they are just narrower than they look: `beforeInteractive`
 * promises the script will not BLOCK hydration, never that it runs before first
 * paint.
 *
 * A plain inline <script> is emitted as a real tag and executed synchronously
 * while the browser parses it. Rendered as the first thing in <body>, that is
 * after the <head> stylesheet (which blocks rendering anyway) and before any
 * content exists to paint, so the class is always in place first.
 *
 * <html> carries suppressHydrationWarning because this deliberately mutates it
 * before React hydrates.
 */
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
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />;
}
