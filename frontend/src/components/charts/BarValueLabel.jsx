import { LabelList } from "recharts";

/** Label angka di atas batang vertikal — terlihat di layar & saat screenshot/PDF. */
export function VerticalCountLabels({ dataKey, suffix = "" }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="top"
      formatter={(value) => {
        if (value == null || value === 0) return "";
        return suffix ? `${value}${suffix}` : String(value);
      }}
      style={{ fontSize: 10, fill: "#374151", fontWeight: 600 }}
    />
  );
}

/** Label angka di kanan batang horizontal. */
export function HorizontalCountLabels({ dataKey }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="right"
      formatter={(value) => (value != null && value !== 0 ? String(value) : "")}
      style={{ fontSize: 10, fill: "#374151", fontWeight: 600 }}
    />
  );
}

/** Label teks bebas di kanan batang horizontal (mis. "12 · skor 98"). */
export function HorizontalTextLabels({ dataKey }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="right"
      formatter={(value) => (value ? String(value) : "")}
      style={{ fontSize: 10, fill: "#374151", fontWeight: 600 }}
    />
  );
}

/** Label angka di tengah segmen stacked bar (teks putih). */
export function StackedSegmentLabels({ dataKey }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="center"
      formatter={(value) => (value != null && value > 0 ? String(value) : "")}
      style={{ fontSize: 9, fill: "#ffffff", fontWeight: 700 }}
    />
  );
}

/** Label angka di titik line chart. */
export function LinePointLabels({ dataKey }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="top"
      offset={8}
      formatter={(value) => (value != null && value > 0 ? String(value) : "")}
      style={{ fontSize: 10, fill: "#374151", fontWeight: 600 }}
    />
  );
}
