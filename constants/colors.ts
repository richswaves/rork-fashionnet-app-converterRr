const palette = {
  bg: "#000000",
  surface: "#0A0A0A",
  border: "#1A1A1A",
  text: "#FFFFFF",
  muted: "#808080",
  accent: "#FFFFFF",
};

export default {
  light: {
    text: palette.text,
    background: palette.bg,
    tint: palette.accent,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.accent,
    border: palette.border,
  },
  palette,
};
