const palette = {
  bg: "#FFFFFF",
  bgSecondary: "#FAFAFA",
  surface: "#FFFFFF",
  border: "#EFEFEF",
  borderLight: "#F5F5F5",
  text: "#000000",
  textSecondary: "#737373",
  textTertiary: "#A3A3A3",
  accent: "#000000",
  accentSoft: "#0095F6",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
};

export default {
  light: {
    text: palette.text,
    background: palette.bg,
    tint: palette.accent,
    tabIconDefault: palette.textTertiary,
    tabIconSelected: palette.accent,
    border: palette.border,
  },
  palette,
};
