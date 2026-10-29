"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber, formatPct, priceTone } from "@/lib/format";
import type { IndexQuote, IndexSpark } from "@/lib/dnse/indices";

function formatIndex(value: number | null) {
  if (value == null) return "—";
  return formatNumber(value, 2);
}

function formatIndexChange(value: number | null) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 2)}`;
}

function formatShareVolume(value: number | null) {
  if (value == null) return "—";
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2)} tỷ CP`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 0)} tr CP`;
  return `${formatNumber(value, 0)} CP`;
}

export function marketSessionLabel(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const clock = hour * 60 + minute;
  if (weekday === "Sat" || weekday === "Sun") return "Đóng cửa";
  if (clock >= 9 * 60 && clock < 11 * 60 + 30) return "Liên tục";
  if (clock >= 11 * 60 + 30 && clock < 13 * 60) return "Nghỉ trưa";
  if (clock >= 13 * 60 && clock < 14 * 60 + 30) return "Liên tục";
  if (clock >= 14 * 60 + 30 && clock < 14 * 60 + 45) return "ATC";
  return "Đóng cửa";
}

const SESSION_OPEN = 9 * 60;
const SESSION_CLOSE = 15 * 60;

function IndexChart({ points, reference, tone }: { points: IndexSpark[]; reference: number | null; tone: string }) {
  if (points.length < 2) return <p className="index-spark-empty">Chưa có chart trong phiên</p>;
  const prices = points.map((point) => point.close);
  if (reference != null) prices.push(reference);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const xOf = (time: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(time * 1000));
    const clock = Number(parts.find((part) => part.type === "hour")?.value ?? "0") * 60
      + Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return ((clock - SESSION_OPEN) / (SESSION_CLOSE - SESSION_OPEN)) * 100;
  };
  const yOf = (price: number) => 4 + ((max - price) / span) * 40;
  const pathOf = (group: IndexSpark[]) => group.map((point) => `${xOf(point.time)},${yOf(point.close)}`).join(" ");
  const morning = points.filter((point) => xOf(point.time) <= ((11 * 60 + 30 - SESSION_OPEN) / (SESSION_CLOSE - SESSION_OPEN)) * 100);
  const afternoon = points.filter((point) => xOf(point.time) >= ((13 * 60 - SESSION_OPEN) / (SESSION_CLOSE - SESSION_OPEN)) * 100);
  const marks = [10, 11, 13, 15];

  return (
    <div className={`index-spark tone-${tone}`}>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
        {reference != null ? <line className="index-spark-ref" x1="0" x2="100" y1={yOf(reference)} y2={yOf(reference)} /> : null}
        {points.map((point) => {
          const barHeight = (point.volume / maxVolume) * 14;
          return (
            <rect
              key={point.time}
              className="index-spark-volume"
              x={xOf(point.time)}
              y={48 - barHeight}
              width="0.7"
              height={barHeight}
            />
          );
        })}
        {morning.length > 1 ? <polyline className="index-spark-line" points={pathOf(morning)} /> : null}
        {afternoon.length > 1 ? <polyline className="index-spark-line" points={pathOf(afternoon)} /> : null}
      </svg>
      <div className="index-spark-axis">
        {marks.map((hour) => (
          <span key={hour} style={{ left: `${((hour * 60 - SESSION_OPEN) / (SESSION_CLOSE - SESSION_OPEN)) * 100}%` }}>{hour}h</span>
        ))}
      </div>
    </div>
  );
}

export function IndexStrip({ now }: { now: Date | null }) {
  const [rows, setRows] = useState<IndexQuote[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [edges, setEdges] = useState({ left: false, right: false });
  const scroller = useRef<HTMLDivElement>(null);
  const session = marketSessionLabel(now ?? new Date());

  useEffect(() => {
    let stopped = false;
    async function load() {
      const response = await fetch("/api/market/indices");
      const body = await response.json().catch(() => ({}));
      if (!stopped && Array.isArray(body.rows)) setRows(body.rows);
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    function sync() {
      const current = scroller.current;
      if (!current) return;
      setEdges({
        left: current.scrollLeft > 4,
        right: current.scrollLeft + current.clientWidth < current.scrollWidth - 4,
      });
    }
    sync();
    node.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [rows, expanded]);

  function scrollCards(direction: -1 | 1) {
    const node = scroller.current;
    const card = node?.querySelector(".index-card");
    if (!node || !card) return;
    const gap = 8;
    node.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  return (
    <div className={`index-strip-wrap${expanded ? " is-expanded" : ""}`}>
      <button
        className="index-scroll index-scroll-prev"
        type="button"
        aria-label="Chỉ số phía trước"
        disabled={!edges.left}
        onClick={() => scrollCards(-1)}
      >
        ‹
      </button>
      <section className="index-strip" aria-label="Chỉ số thị trường" ref={scroller}>
        {rows.map((row) => {
          const reference = row.price != null && row.change != null ? row.price - row.change : null;
          const tone = priceTone(row.price, reference, null, null);
          return (
            <article className="index-card" key={row.symbol}>
              <div className="index-card-name">
                <strong>{row.symbol}</strong>
                <span>{session}</span>
              </div>
              <p className={`num tone-${tone}`}>
                <b>{formatIndex(row.price)}</b>
                <span>{formatIndexChange(row.change)} ({formatPct(row.changePercent)})</span>
              </p>
              <small className="num">{formatShareVolume(row.volume)}</small>
              {expanded ? <IndexChart points={row.spark ?? []} reference={reference} tone={tone} /> : null}
            </article>
          );
        })}
      </section>
      <button
        className="index-scroll index-scroll-next"
        type="button"
        aria-label="Chỉ số phía sau"
        disabled={!edges.right}
        onClick={() => scrollCards(1)}
      >
        ›
      </button>
      <button
        className="index-expand"
        type="button"
        aria-pressed={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "⌃" : "⌄"}
        <span className="pane-tip">{expanded ? "Thu gọn chart chỉ số" : "Mở rộng xem chart"}</span>
      </button>
    </div>
  );
}
