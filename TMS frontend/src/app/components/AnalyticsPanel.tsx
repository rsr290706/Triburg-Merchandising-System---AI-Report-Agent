

import { useState, useMemo } from "react";
import { ChevronDown, BarChart2, TrendingUp, PieChart, Maximize2, X } from "lucide-react";
import { GraphicWalker } from "@kanaries/graphic-walker";
import { SimpleChart } from "./SimpleChart";
import {
  inferChartSuggestions,
  canVisualize,
  analyzeColumns,
  ChartType,
  ChartSuggestion,
} from "../utils/inferChart";

const palette = {
  bg: "#0A0A0A",
  bgSecondary: "#111111",
  card: "#1A1A1A",
  border: "#2A2A2A",
  text: "#FAFAFA",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  hover: "#222222",
};

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  bar: <BarChart2 size={13} />,
  line: <TrendingUp size={13} />,
  pie: <PieChart size={13} />,
  scatter: <BarChart2 size={13} />,
  kpi: <BarChart2 size={13} />,
};

interface SelectProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}

function Select({ value, options, onChange, placeholder }: SelectProps) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          background: palette.bgSecondary,
          border: `1px solid ${palette.border}`,
          borderRadius: 8,
          color: value ? palette.text : palette.textMuted,
          fontSize: 12,
          fontFamily: "JetBrains Mono, monospace",
          padding: "7px 32px 7px 12px",
          cursor: "pointer",
          outline: "none",
          minWidth: 130,
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o} style={{ background: palette.card }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: "absolute",
          right: 10,
          pointerEvents: "none",
          color: palette.textMuted,
        }}
      />
    </div>
  );
}

interface AnalyticsPanelProps {
  data: Record<string, unknown>[];
  formatColumnName: (column: string) => string;
}

export function AnalyticsPanel({
    data,
    formatColumnName,
    }: AnalyticsPanelProps) {
  const suggestions = useMemo(() => inferChartSuggestions(data), [data]);
  const columns = useMemo(() => analyzeColumns(data), [data]);
  const visualizable = useMemo(() => canVisualize(data), [data]);

  const allColumnNames = columns.map((c) => c.name);
  const numberColumns = columns.filter((c) => c.kind === "number").map((c) => c.name);
  const nonNumberColumns = columns.filter((c) => c.kind !== "number").map((c) => c.name);

  const defaultSuggestion: ChartSuggestion | null = suggestions[0] ?? null;

  const [chartType, setChartType] = useState<ChartType>(
    defaultSuggestion?.type ?? "bar"
  );
  const [xField, setXField] = useState<string>(
    defaultSuggestion?.xField ?? nonNumberColumns[0] ?? allColumnNames[0] ?? ""
  );
  const [yField, setYField] = useState<string>(
    defaultSuggestion?.yField ?? numberColumns[0] ?? ""
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const CHART_TYPES: { type: ChartType; label: string }[] = [
    { type: "bar", label: "Bar" },
    { type: "line", label: "Line" },
    { type: "pie", label: "Pie" },
    { type: "scatter", label: "Scatter" },
    { type: "kpi", label: "KPI" },
  ];

  if (!visualizable) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
          gap: 8,
        }}
      >
        <BarChart2 size={28} style={{ color: palette.textMuted, opacity: 0.5 }} />
        <p style={{ fontSize: 13, color: palette.textSecondary, margin: 0 }}>
          No visualization available.
        </p>
        <p style={{ fontSize: 12, color: palette.textMuted, margin: 0, maxWidth: 260 }}>
          Run a query containing numerical or categorical data to generate charts.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Controls row ── */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${palette.border}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        {/* Chart type */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 10.5, color: palette.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Chart Type
          </label>
          <Select
            value={chartType}
            options={CHART_TYPES.map((c) => c.label)}
            onChange={(v) => {
              const found = CHART_TYPES.find((c) => c.label === v);
              if (found) setChartType(found.type);
            }}
          />
        </div>

        {/* X Axis — hidden for KPI */}
        {chartType !== "kpi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10.5, color: palette.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              X Axis
            </label>
            <Select
              value={xField}
              options={allColumnNames}
              onChange={setXField}
              placeholder="Select column"
            />
          </div>
        )}

        {/* Y Axis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 10.5, color: palette.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Y Axis
          </label>
          <Select
            value={yField}
            options={numberColumns.length ? numberColumns : allColumnNames}
            onChange={setYField}
            placeholder="Select column"
          />
        </div>
      </div>

      {/* ── Chart area ── */}
      <div
          style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              padding: 16,
          }}
      >
        <div
            style={{
                flex: 1,
                minHeight: 0,
            }}
        >
            <SimpleChart
                type={chartType}
                data={data}
                xField={xField || null}
                yField={yField || null}
            />
        </div>
      </div>

      {/* ── Suggested charts row ── */}
      {suggestions.length > 1 && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 10.5, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>
            Suggested
          </span>
          {suggestions.map((s) => {
            const active = s.type === chartType && s.xField === xField && s.yField === yField;
            return (
              <button
                key={`${s.type}-${s.xField}-${s.yField}`}
                onClick={() => {
                  setChartType(s.type);
                  if (s.xField) setXField(s.xField);
                  if (s.yField) setYField(s.yField);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontFamily: "JetBrains Mono, monospace",
                  cursor: "pointer",
                  background: active ? palette.text : "transparent",
                  color: active ? palette.bg : palette.textSecondary,
                  border: `1px solid ${active ? palette.text : palette.border}`,
                  transition: "all 0.15s ease",
                }}
              >
                {CHART_ICONS[s.type]}
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Advanced Analytics footer button ── */}
      <div
        style={{
          borderTop: `1px solid ${palette.border}`,
          padding: "10px 16px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setShowAdvanced(true)}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${palette.border}`,
            color: palette.textSecondary,
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = palette.textMuted;
            e.currentTarget.style.color = palette.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = palette.border;
            e.currentTarget.style.color = palette.textSecondary;
          }}
        >
          <Maximize2 size={12} />
          Open Advanced Analytics
        </button>
      </div>

      {/* ── Advanced Analytics modal (full Graphic Walker) ── */}
      {showAdvanced && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: palette.card,
              borderBottom: `1px solid ${palette.border}`,
              flexShrink: 0,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: palette.text, fontFamily: "JetBrains Mono, monospace" }}>
                Advanced Analytics
              </p>
              <p style={{ margin: 0, fontSize: 11, color: palette.textMuted, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>
                Full Graphic Walker — drag and drop to build visualizations
              </p>
            </div>
            <button
              onClick={() => setShowAdvanced(false)}
              style={{
                background: "transparent",
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                color: palette.textMuted,
                cursor: "pointer",
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              <X size={13} />
              Close
            </button>
          </div>

          {/* Full Graphic Walker */}
          <div style={{ flex: 1, overflow: "hidden", background: palette.bg }}>
            <GraphicWalker
              dataSource={data as any[]}
              dark="dark"
            />
          </div>
        </div>
      )}
    </div>
  );
}