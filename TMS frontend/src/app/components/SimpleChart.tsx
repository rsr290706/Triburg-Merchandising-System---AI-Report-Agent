

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
import { memo, useMemo, useCallback } from "react";

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

export function SimpleChartComponent({ type, data, xField, yField }: SimpleChartProps) {
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
  

  const enableAnimation = data.length < 100;

  const truncateTick = useCallback((value: unknown) => {
    const text = String(value);

    return text.length > 10
        ? text.slice(0, 10) + "..."
        : text;
    }, []);

  
  
  const tooltipFormatter = useCallback(
    (value: unknown) => [
        Number(value).toLocaleString(),
        yField ?? "",
    ],
    [yField]
    );

  // Normalize data values to numbers for recharts
  const normalized = useMemo(() => {
    if (!yField) return [];

    return data.map((row) => ({
        ...row,
        [yField]: Number(row[yField]) || 0,
    }));
    }, [data, yField]);

  const pieCells = useMemo(
    () =>
        normalized.map((_, i) => (
        <Cell
            key={i}
            fill={COLORS[i % COLORS.length]}
        />
        )),
    [normalized]
    );

  const chartStyle = {
    width: "100%",
    height: "100%",
  };

  if (type === "bar") {
    return (
      <div style={chartStyle}>
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <BarChart data={normalized} margin={{ top: 6, right: 10, left: 4, bottom: 12 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={palette.border} vertical={false} />
            <XAxis
              dataKey={xField ?? undefined}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: palette.border }}
              angle={0}
              textAnchor="middle"
              interval={0}
              height={50}
            />
            <YAxis
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={truncateTick}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "#1A1A1A",
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
              formatter={(value: number, _name, props) => [
                Number(value).toLocaleString(),
                props.payload?.[xField ?? ""],
              ]}
            />
            <Bar
                  dataKey={yField}
                  isAnimationActive={enableAnimation}
                  fill={COLORS[0]}
                  activeBar={false}
                  radius={[6,6,0,0]}
                  maxBarSize={58}
                  barSize={56}
              />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <LineChart data={normalized} margin={{ top: 6, right: 10, left: 4, bottom: 12 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={palette.border} vertical={false} />
          <XAxis
            dataKey={xField ?? undefined}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
            angle={0}
            textAnchor="middle"
            interval={0}
            height={50}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={truncateTick}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#1A1A1A",
              border: `1px solid ${palette.border}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
            formatter={(value: number, _name, props) => [
              Number(value).toLocaleString(),
              props.payload?.[xField ?? ""],
            ]}
          />
          <Line
            type="monotone"
            dataKey={yField}
            stroke={COLORS[0]}
            activeDot={false}
            strokeWidth={2}
            dot={{ fill: COLORS[0], r: 3 }}
            isAnimationActive={enableAnimation}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <PieChart>
          <Pie
            data={normalized}
            dataKey={yField}
            nameKey={xField ?? undefined}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            paddingAngle={2}
            label={false}
            labelLine={false}
          >
            {pieCells}
          </Pie>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#1A1A1A",
              border: `1px solid ${palette.border}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
            formatter={(value: number, _name, props) => [
              Number(value).toLocaleString(),
              props.payload?.[xField ?? ""],
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: palette.textMuted, fontFamily: "JetBrains Mono, monospace" }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
          <XAxis
            dataKey={xField ?? undefined}
            tickFormatter={truncateTick}
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
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#1A1A1A",
              border: `1px solid ${palette.border}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
            formatter={(value: number, _name, props) => [
              Number(value).toLocaleString(),
              props.payload?.[xField ?? ""],
            ]}
          />
          <Scatter data={normalized} fill={COLORS[0]} isAnimationActive={enableAnimation} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

export const SimpleChart = memo(SimpleChartComponent);