import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path, Circle, Rect } from "react-native-svg";

export type PieSlice = { label: string; value: number; color?: string };

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "L", cx, cy, "Z"].join(" ");
  return d;
}

const PALETTE = [
  "#8B5CF6",
  "#22D3EE",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#A78BFA",
  "#14B8A6",
  "#F472B6",
  "#FCD34D",
];

export default function PieChart({ data, size = 140, innerRadius = 0 }: { data: PieSlice[]; size?: number; innerRadius?: number; }) {
  const total = useMemo(() => data.reduce((acc, d) => acc + (d.value || 0), 0), [data]);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const slices = useMemo(() => {
    let angle = 0;
    return data.map((d, i) => {
      const pct = total === 0 ? 0 : d.value / total;
      const sweep = pct * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      const color = d.color ?? PALETTE[i % PALETTE.length];
      const path = describeArc(cx, cy, r, startAngle, endAngle);
      return { path, color, startAngle, endAngle, value: d.value, label: d.label };
    });
  }, [data, total, cx, cy, r]);

  if (total === 0) {
    return (
      <View style={styles.empty} testID="pie-empty">
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="pie-chart">
      <Svg width={size} height={size}>
        <G>
          {slices.map((s, idx) => (
            <Path key={`s-${idx}`} d={s.path} fill={s.color} />
          ))}
          {innerRadius > 0 ? (
            <Circle cx={cx} cy={cy} r={innerRadius} fill="#0B0B0F" />
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

export function PieLegend({ data, maxItems = 6 }: { data: PieSlice[]; maxItems?: number }) {
  const shown = useMemo(() => data.slice(0, maxItems), [data, maxItems]);
  return (
    <View style={styles.legend} testID="pie-legend">
      {shown.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: d.color ?? PALETTE[i % PALETTE.length] }]} />
          <Text style={styles.legendLabel} numberOfLines={1}>{d.label}</Text>
          <View style={styles.legendValueWrap}>
            <Text style={styles.legendValue}>{d.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#15151A", borderRadius: 12, borderWidth: 1, borderColor: "#2A2A33" },
  emptyText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" as const },
  legend: { marginTop: 10, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: "#E5E7EB", fontSize: 12, flex: 1 },
  legendValueWrap: { minWidth: 28, alignItems: "flex-end" },
  legendValue: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" as const },
});
