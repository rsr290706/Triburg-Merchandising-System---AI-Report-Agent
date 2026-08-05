// src/components/SimpleChart.tsx

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartType } from "../utils/inferChart";

const COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ec4899",
  "#14b8a6", "#8b5cf6", "#f87171", "#38bdf8",
];

const palette = {
  bg: "#0A0A0A",
  border: "#2A2A2A",
  text: "#FAFAFA",
  textMuted: "#71717A",
  textSecondary: "#A1A1AA",
};

interface SimpleChartProps {
  type: ChartType;
  data: Record<string, unknown>[];
  xField: string | null;
  yField: string | null;
}

const tickStyle = {
  fill: palette.textMuted,
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};

const tooltipStyle = {
  backgroundColor: "#1A1A1A",
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  color: palette.text,
  fontSize: 12,
  fontFamily: "JetBrains Mono, monospace",
};

export function SimpleChart({ type, data, xField, yField }: SimpleChartProps) {
  if (!yField) return null;

  // KPI card
  if (type === "kpi") {
    const val = data[0]?.[yField];
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 8,
        }}
      >
        <p style={{ fontSize: 11, color: palette.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {yField}
        </p>
        <p
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: palette.text,
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1,
          }}
        >
          {typeof val === "number" ? val.toLocaleString() : String(val ?? "—")}
        </p>
      </div>
    );
  }

  // Normalize data values to numbers for recharts
  const normalized = data.map((row) => ({
    ...row,
    [yField]: Number(row[yField]) || 0,
  }));

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={normalized} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
          <XAxis
            dataKey={xField ?? undefined}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                ? `${(v / 1_000).toFixed(1)}K`
                : String(v)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey={yField} fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalized} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
          <XAxis
            dataKey={xField ?? undefined}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                ? `${(v / 1_000).toFixed(1)}K`
                : String(v)
            }
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey={yField}
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={{ fill: COLORS[0], r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={normalized}
            dataKey={yField}
            nameKey={xField ?? undefined}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            paddingAngle={2}
            label={({ name, percent }: { name: string; percent: number }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {normalized.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: palette.textMuted, fontFamily: "JetBrains Mono, monospace" }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
          <XAxis
            dataKey={xField ?? undefined}
            type="number"
            name={xField ?? ""}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
          />
          <YAxis
            dataKey={yField}
            type="number"
            name={yField}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={normalized} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return null;
}