"use client";

import { memo } from "react";
import { deskClockLabel, formatNumber, formatPrice, formatQty, priceTone } from "@/lib/format";
import { marketLinkStatusLabel, type MarketLinkState } from "@/lib/market-link";
import type { PriceLevel } from "@/lib/dnse/stream-types";
import type { TapePrint } from "@/lib/dnse/tape";

type BookView = { bids: PriceLevel[]; asks: PriceLevel[] } | null;

type Props = {
  stream: MarketLinkState;
  selected: string;
  lastPrice: number | null;
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
  book: BookView;
  prints: TapePrint[];
  onPickPrice: (price: number | null) => void;
};

function tapeClock(at: number) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "—";
  return `${deskClockLabel(date)}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function OrderMarketSideInner(props: Props) {
  const depth = Math.max(props.book?.bids.length ?? 0, props.book?.asks.length ?? 0, 0);
  const depthRows = Array.from({ length: Math.min(depth, 8) }, (_, index) => ({
    bid: props.book?.bids[index],
    ask: props.book?.asks[index],
    key: `${props.book?.bids[index]?.price ?? `b${index}`}-${props.book?.asks[index]?.price ?? `a${index}`}`,
  }));

  return (
    <>
      <section className="order-depth panel">
        <div className="panel-head">
          <h2>Bước giá</h2>
          <span className="num">{formatPrice(props.lastPrice)}</span>
        </div>
        <div className="depth-head num">
          <span>KL mua</span>
          <span>Giá mua</span>
          <span>Giá bán</span>
          <span>KL bán</span>
        </div>
        <div className="depth-list">
          {depthRows.map((level) => {
            const bidTone = priceTone(level.bid?.price, props.reference, props.ceiling, props.floor);
            const askTone = priceTone(level.ask?.price, props.reference, props.ceiling, props.floor);
            return (
              <div className="depth-row num" key={level.key}>
                <span>{formatQty(level.bid?.quantity)}</span>
                <button type="button" className={`tone-${bidTone}`} onClick={() => props.onPickPrice(level.bid?.price ?? null)}>
                  {formatPrice(level.bid?.price)}
                </button>
                <button type="button" className={`tone-${askTone}`} onClick={() => props.onPickPrice(level.ask?.price ?? null)}>
                  {formatPrice(level.ask?.price)}
                </button>
                <span>{formatQty(level.ask?.quantity)}</span>
              </div>
            );
          })}
        </div>
        {depth === 0 && (
          <p className="empty">
            {props.stream === "live" ? "Chưa có lệnh chờ." : `Đang chờ bước giá · ${marketLinkStatusLabel(props.stream)}`}
          </p>
        )}
      </section>
      <section className="order-tape panel">
        <div className="panel-head">
          <h2>Khớp lệnh</h2>
        </div>
        <div className="tape-head num">
          <span>Giờ</span>
          <span>Giá</span>
          <span>+/−</span>
          <span>KL</span>
        </div>
        <div className="tape-list">
          {props.prints.length === 0 && <p className="empty">Chưa có khớp lệnh mới.</p>}
          {props.prints.map((item) => {
            const tone = priceTone(item.price, props.reference, props.ceiling, props.floor);
            const delta = item.price != null && props.reference != null ? item.price - props.reference : null;
            return (
              <div className="tape-row num" key={item.id}>
                <span>{tapeClock(item.at)}</span>
                <button type="button" className={`tone-${tone}`} onClick={() => props.onPickPrice(item.price)}>
                  {formatPrice(item.price)}
                </button>
                <span className={`tone-${tone}`}>{formatNumber(delta, Math.abs(delta ?? 0) >= 1000 ? 0 : 2)}</span>
                <span>{formatQty(item.quantity)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function sameSide(prev: Props, next: Props) {
  if (prev.selected !== next.selected) return false;
  if (prev.stream !== next.stream) return false;
  if (prev.lastPrice !== next.lastPrice) return false;
  if (prev.reference !== next.reference) return false;
  if (prev.ceiling !== next.ceiling) return false;
  if (prev.floor !== next.floor) return false;
  if (prev.onPickPrice !== next.onPickPrice) return false;
  if (prev.prints.length !== next.prints.length) return false;
  if (prev.prints.length > 0 && prev.prints[0]?.id !== next.prints[0]?.id) return false;
  const prevBook = prev.book;
  const nextBook = next.book;
  if (!prevBook && !nextBook) return true;
  if (!prevBook || !nextBook) return false;
  if (prevBook.bids.length !== nextBook.bids.length || prevBook.asks.length !== nextBook.asks.length) return false;
  for (let i = 0; i < prevBook.bids.length; i += 1) {
    const a = prevBook.bids[i];
    const b = nextBook.bids[i];
    if (a.price !== b.price || a.quantity !== b.quantity) return false;
  }
  for (let i = 0; i < prevBook.asks.length; i += 1) {
    const a = prevBook.asks[i];
    const b = nextBook.asks[i];
    if (a.price !== b.price || a.quantity !== b.quantity) return false;
  }
  return true;
}

export const OrderMarketSide = memo(OrderMarketSideInner, sameSide);
