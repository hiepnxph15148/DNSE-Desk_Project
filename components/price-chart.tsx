"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart, KLineData, Period } from "klinecharts";
import type { Candle } from "@/lib/dnse/normalize";

const TOOLS = [
  { id: "segment", label: "Đoạn" },
  { id: "horizontalStraightLine", label: "Ngang" },
  { id: "rayLine", label: "Tia" },
  { id: "fibonacciLine", label: "Fib" },
] as const;

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function uniqueCandles(candles: Candle[]) {
  const byTime = new Map<number, Candle>();
  for (const candle of candles) byTime.set(candle.time, candle);
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

function toKlines(candles: Candle[]): KLineData[] {
  return uniqueCandles(candles).map((candle) => ({
    timestamp: candle.time > 10_000_000_000 ? candle.time : candle.time * 1000,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

function periodOf(resolution: string): Period {
  if (resolution === "1") return { type: "minute", span: 1 };
  if (resolution === "5") return { type: "minute", span: 5 };
  if (resolution === "15") return { type: "minute", span: 15 };
  if (resolution === "60") return { type: "hour", span: 1 };
  return { type: "day", span: 1 };
}

function loadChart(chart: Chart, candles: Candle[], resolution: string, symbol: string) {
  if (candles.length === 0) return;
  const priced = candles.some((candle) => Math.abs(candle.close) < 1000);
  chart.setSymbol({ ticker: symbol || "DNSE", pricePrecision: priced ? 2 : 0, volumePrecision: 0 });
  chart.setPeriod(periodOf(resolution));
  chart.resetData();
}

export function PriceChart({ candles, resolution, symbol }: { candles: Candle[]; resolution: string; symbol: string }) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const dataRef = useRef(candles);
  const resolutionRef = useRef(resolution);
  const [tool, setTool] = useState<string | null>(null);
  const symbolRef = useRef(symbol);
  dataRef.current = candles;
  resolutionRef.current = resolution;
  symbolRef.current = symbol;

  const hasCandles = candles.length > 0;

  useEffect(() => {
    const node = host.current;
    if (!hasCandles || !node) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void import("klinecharts").then(({ init, dispose }) => {
      if (cancelled || !host.current) return;
      const up = cssColor("--up", "#22c55e");
      const down = cssColor("--down", "#f43f5e");
      const ref = cssColor("--ref", "#f5c451");
      const text = cssColor("--text-muted", "#6d7380");
      const grid = cssColor("--chart-grid", "rgba(255,255,255,0.06)");
      const chart = init(host.current, {
        timezone: "Asia/Ho_Chi_Minh",
        styles: {
          grid: {
            horizontal: { color: grid },
            vertical: { color: grid },
          },
          candle: {
            bar: {
              upColor: up,
              downColor: down,
              noChangeColor: ref,
              upBorderColor: up,
              downBorderColor: down,
              noChangeBorderColor: ref,
              upWickColor: up,
              downWickColor: down,
              noChangeWickColor: ref,
            },
            priceMark: {
              last: { upColor: up, downColor: down, noChangeColor: ref },
            },
          },
          indicator: {
            ohlc: { upColor: up, downColor: down, noChangeColor: ref },
          },
          xAxis: { axisLine: { color: grid }, tickText: { color: text } },
          yAxis: { axisLine: { color: grid }, tickText: { color: text } },
          separator: { color: grid },
          crosshair: {
            horizontal: { line: { color: "rgba(239,239,239,0.28)" } },
            vertical: { line: { color: "rgba(239,239,239,0.28)" } },
          },
        },
      });
      if (!chart || cancelled) {
        if (chart) dispose(chart);
        return;
      }
      chartRef.current = chart;
      chart.createIndicator({ name: "MA", calcParams: [5, 10, 20], paneId: "candle_pane" }, true);
      chart.createIndicator("VOL");
      chart.setDataLoader({
        getBars: ({ callback }) => {
          callback(toKlines(dataRef.current), false);
        },
      });
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(host.current);
      chart.resize();
      loadChart(chart, dataRef.current, resolutionRef.current, symbolRef.current);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      const chart = chartRef.current;
      chartRef.current = null;
      if (chart) void import("klinecharts").then(({ dispose }) => dispose(chart));
    };
  }, [hasCandles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    loadChart(chart, candles, resolution, symbol);
  }, [candles, resolution, symbol]);

  function draw(name: string) {
    const chart = chartRef.current;
    if (!chart) return;
    setTool(name);
    chart.createOverlay(name);
  }

  return (
    <div className="kline-wrap">
      {candles.length === 0 ? (
        <div className="chart-empty">Chưa có nến cho khung thời gian này.</div>
      ) : (
        <>
          <div className="kline-tools" role="group" aria-label="Công cụ vẽ">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ghost"
                aria-pressed={tool === item.id}
                onClick={() => draw(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="texty"
              onClick={() => {
                chartRef.current?.removeOverlay();
                setTool(null);
              }}
            >
              Xóa nét
            </button>
          </div>
          <div className="tv-chart" ref={host} role="img" aria-label="Biểu đồ nến KLineChart" />
        </>
      )}
    </div>
  );
}
