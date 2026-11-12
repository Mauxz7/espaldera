const c = (v) => `rgb(var(--c-${v}) / <alpha-value>)`;
module.exports = {
  content: ["./src/**/*.jsx", "./public/index.html"],
  theme: { extend: {
    colors: { bg: c("bg"), surface: c("surface"), surface2: c("surface-2"), line: c("line"), fg: c("fg"), muted: c("muted"), accent: c("accent"), accentInk: c("accent-ink"), cool: c("cool"), good: c("good"), warn: c("warn") },
    fontFamily: { display: ["Barlow Condensed", "Arial Narrow", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
  } },
};
