// src/utils/inferChart.ts

export type ChartType = "bar" | "line" | "pie" | "scatter" | "kpi";

export interface ColumnMeta {
  name: string;
  kind: "category" | "date" | "number";
}

export interface ChartSuggestion {
  type: ChartType;
  xField: string | null;
  yField: string | null;
  label: string;
}

function detectKind(values: unknown[]): ColumnMeta["kind"] {
  const sample = values.find((v) => v !== null && v !== undefined && v !== "");
  if (sample === undefined) return "category";

  // Date detection
  if (
    typeof sample === "string" &&
    /^\d{4}[-/]\d{2}[-/]\d{2}/.test(sample)
  )
    return "date";

  // Number detection
  if (!isNaN(Number(sample))) return "number";

  return "category";
}

export function analyzeColumns(
  data: Record<string, unknown>[]
): ColumnMeta[] {
  if (!data.length) return [];
  return Object.keys(data[0]).map((name) => ({
    name,
    kind: detectKind(data.map((r) => r[name])),
  }));
}

export function inferChartSuggestions(
  data: Record<string, unknown>[]
): ChartSuggestion[] {
  if (!data.length) return [];

  const cols = analyzeColumns(data);
  const categories = cols.filter((c) => c.kind === "category");
  const dates = cols.filter((c) => c.kind === "date");
  const numbers = cols.filter((c) => c.kind === "number");

  const suggestions: ChartSuggestion[] = [];

  // Date + Number → Line
  if (dates.length >= 1 && numbers.length >= 1) {
    suggestions.push({
      type: "line",
      xField: dates[0].name,
      yField: numbers[0].name,
      label: "Line",
    });
  }

  // Category + Number → Bar
  if (categories.length >= 1 && numbers.length >= 1) {
    suggestions.push({
      type: "bar",
      xField: categories[0].name,
      yField: numbers[0].name,
      label: "Bar",
    });
  }

  // Category + Number → Pie (only if few categories)
  const uniqueCategories =
    categories.length >= 1
      ? new Set(data.map((r) => r[categories[0].name])).size
      : 0;
  if (categories.length >= 1 && numbers.length >= 1 && uniqueCategories <= 10) {
    suggestions.push({
      type: "pie",
      xField: categories[0].name,
      yField: numbers[0].name,
      label: "Pie",
    });
  }

  // Two numbers → Scatter
  if (numbers.length >= 2) {
    suggestions.push({
      type: "scatter",
      xField: numbers[0].name,
      yField: numbers[1].name,
      label: "Scatter",
    });
  }

  // Single number only → KPI
  if (numbers.length === 1 && categories.length === 0 && dates.length === 0) {
    suggestions.push({
      type: "kpi",
      xField: null,
      yField: numbers[0].name,
      label: "KPI",
    });
  }

  // Fallback: at least show a bar if we have any number
  if (suggestions.length === 0 && numbers.length >= 1) {
    suggestions.push({
      type: "bar",
      xField: cols.find((c) => c.kind !== "number")?.name ?? null,
      yField: numbers[0].name,
      label: "Bar",
    });
  }

  return suggestions;
}

export function canVisualize(data: Record<string, unknown>[]): boolean {
  if (!data.length) return false;
  const cols = analyzeColumns(data);
  return cols.some((c) => c.kind === "number");
}