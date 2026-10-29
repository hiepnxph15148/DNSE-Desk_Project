"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/dnse/normalize";

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function uniqueCandles(candles: Candle[]) {
  const byTime = new Map<number, Candle>();
  for (const candle of candles) byTime.set(candle.time, candle);
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

export function PriceChart({ candles, resolution }: { candles: Candle[]; resolution: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node || candles.length === 0) return;

    const up = cssColor("--up", "#22c55e");
    const down = cssColor("--down", "#f43f5e");
    const text = cssColor("--text-muted", "#6d7380");
    const grid = cssColor("--chart-grid", "rgba(255,255,255,0.06)");
    const background = cssColor("--surface", "#17181c");
    const rows = uniqueCandles(candles);

    const chart = createChart(node, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: background },
        textColor: text,
        fontFamily: "Roboto, sans-serif",
        fontSize: 13,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        borderColor: grid,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: grid,
        timeVisible: resolution !== "D",
        secondsVisible: false,
      },
      localization: {
        locale: "vi-VN",
        priceFormatter: (price: number) => new Intl.NumberFormat("vi-VN", {
          minimumFractionDigits: Math.abs(price) >= 1000 ? 0 : 2,
          maximumFractionDigits: Math.abs(price) >= 1000 ? 0 : 2,
        }).format(price),
      },
      crosshair: {
        vertLine: { color: "rgba(239,239,239,0.28)" },
        horzLine: { color: "rgba(239,239,239,0.28)" },
      },
    });

    const prices = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    prices.setData(rows.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    volume.setData(rows.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? `${up}99` : `${down}99`,
    })));
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles, resolution]);

  if (candles.length === 0) {
    return <div className="chart-empty">Chưa có nến cho khung thời gian này.</div>;
  }

  return <div className="tv-chart" ref={host} role="img" aria-label="Biểu đồ nến TradingView" />;
}
