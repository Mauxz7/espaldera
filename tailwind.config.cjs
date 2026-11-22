const c = (v) => `rgb(var(--c-${v}) / <alpha-value>)`;
module.exports = {
  content: ["./src/**/*.jsx", "./public/index.html"],
  theme: { extend: {
    colors: { bg: c("bg"), surface: c("surface"), surface2: c("surface-2"), fg: c("fg"), muted: c("muted"), faint: c("faint"), accent: c("accent"), accentInk: c("accent-ink"), cool: c("cool"), good: c("good"), warn: c("warn"), bad: c("bad"), sleep: c("sleep"), strain: c("strain"),
      // line es blanco translúcido: un borde sutil sobre el vidrio (line/80, line/60… siguen funcionando).
      line: "rgb(var(--c-line) / calc(<alpha-value> * 0.08))" },
    fontFamily: {
      sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter", "system-ui", "sans-serif"],
      display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "system-ui", "sans-serif"],
      mono: ["ui-rounded", "SF Pro Rounded", "-apple-system", "system-ui", "sans-serif"],
    },
  } },
};
