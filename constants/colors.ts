const palette = {
  bg: "#0B0B0F",
  surface: "#121218",
  border: "#23232B",
  text: "#E5E7EB",
  muted: "#9CA3AF",
  accent: "#E5E7EB",
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
