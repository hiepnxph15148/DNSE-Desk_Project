"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderDesk, type TapePrint } from "@/components/order-desk";
import { Sparkline } from "@/components/sparkline";
import { SymbolLogo } from "@/components/symbol-logo";
import { UserMenu } from "@/components/user-menu";
import { useMarketStream } from "@/components/use-market-stream";
import {
  clockLabel,
  formatChange,
  formatPct,
  formatPrice,
  formatQty,
  priceTone,
} from "@/lib/format";
import type { BoardRow, Candle, OrderRow, PositionRow } from "@/lib/dnse/normalize";
import type { MarketEvent, PriceLevel } from "@/lib/dnse/stream-types";
import type { MarketType } from "@/lib/dnse/validate";
import { matchSymbols, type ListedSymbol } from "@/lib/dnse/catalog";
import { DEFAULT_WATCHLIST, POPULAR_SYMBOLS, type Resolution } from "@/lib/symbols";

const WATCH_KEY = "dnse-desk-watchlist";

const MARKETS = [
  { id: "ALL", label: "Tất cả" },
  { id: "HOSE", label: "HOSE" },
  { id: "HNX", label: "HNX" },
  { id: "UPCOM", label: "UPCOM" },
] as const;

type DeskStatus = {
  ok: boolean;
  error?: string;
  code?: string;
  tradingToken: boolean;
  hasKey: boolean;
  hasSecret: boolean;
  accountCount?: number;
};

type Portfolio = {
  accounts: { id: string; name: string }[];
  accountNo: string | null;
  balance: { availableCash: number | null; totalCash: number | null };
  orders: OrderRow[];
  positions: PositionRow[];
};

function blankRow(symbol: string): BoardRow {
  return {
    symbol,
    name: symbol,
    exchange: "",
    price: null,
    reference: null,
    ceiling: null,
    floor: null,
    high: null,
    low: null,
    volume: null,
    change: null,
    changePercent: null,
    time: null,
  };
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export function Terminal() {
  const [symbols, setSymbols] = useState(DEFAULT_WATCHLIST);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(DEFAULT_WATCHLIST[0]);
  const [resolution, setResolution] = useState<Resolution>("D");
  const [marketType, setMarketType] = useState<MarketType>("STOCK");
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [quote, setQuote] = useState<BoardRow | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<ListedSymbol[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [preview, setPreview] = useState<BoardRow[]>([]);
  const suggestRef = useRef<HTMLFormElement>(null);
  const previewAsked = useRef(new Set<string>());
  const [market, setMarket] = useState<(typeof MARKETS)[number]["id"]>("ALL");
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [now, setNow] = useState<Date | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<"board" | "order">("board");
  const [book, setBook] = useState<{ symbol: string; bids: PriceLevel[]; asks: PriceLevel[] } | null>(null);
  const [tape, setTape] = useState<TapePrint[]>([]);
  const tapeSeq = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem(WATCH_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string") && parsed.length > 0) {
          const next = parsed.map((item) => item.toUpperCase()).slice(0, 20);
          setSymbols(next);
          setSelected(next[0]);
        }
      } catch {
        localStorage.removeItem(WATCH_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(WATCH_KEY, JSON.stringify(symbols));
  }, [ready, symbols]);

  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    setCatalogState("loading");
    fetch("/api/market/symbols")
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancel) return;
        if (!ok) {
          setCatalogState("error");
          return;
        }
        setCatalog(body.symbols ?? []);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!cancel) setCatalogState("error");
      });
    return () => {
      cancel = true;
    };
  }, [ready]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/status");
    const body = await readJson(response) as DeskStatus;
    setStatus(body);
    return body;
  }, []);

  const loadBoard = useCallback(async () => {
    const response = await fetch(`/api/market/board?symbols=${symbols.join(",")}`);
    const body = await readJson(response);
    if (!response.ok) {
      if (body.code !== "CONFIG") setError(body.error ?? "Không tải được bảng giá.");
      return;
    }
    setRows(body.rows ?? []);
    setError("");
  }, [symbols]);

  const candleKey = useRef("");

  const loadSymbol = useCallback(async () => {
    const key = `${selected}:${resolution}`;
    if (candleKey.current !== key) {
      candleKey.current = key;
      setCandles([]);
    }
    const response = await fetch(`/api/market/symbol?symbol=${selected}&resolution=${resolution}`);
    const body = await readJson(response);
    if (!response.ok) {
      if (response.status === 429) {
        setError("DNSE đang giới hạn số lần gọi. Biểu đồ sẽ hiện lại sau một lát.");
        return;
      }
      if (body.code !== "CONFIG") setError(body.error ?? "Không tải được mã.");
      setQuote(null);
      setCandles([]);
      return;
    }
    const nextCandles = body.candles ?? [];
    setQuote(body.quote ?? null);
    if (nextCandles.length > 0) {
      setCandles(nextCandles);
      setError("");
    }
  }, [resolution, selected]);

  const loadSparks = useCallback(async () => {
    const response = await fetch(`/api/market/sparks?symbols=${symbols.join(",")}`);
    const body = await readJson(response);
    if (response.ok) setSparks(body.sparks ?? {});
  }, [symbols]);

  const loadPortfolio = useCallback(async () => {
    const params = new URLSearchParams({ marketType });
    if (accountNo) params.set("accountNo", accountNo);
    const response = await fetch(`/api/portfolio?${params.toString()}`);
    const body = await readJson(response);
    if (!response.ok) {
      if (body.code !== "CONFIG") setError(body.error ?? "Không tải được tài khoản.");
      return;
    }
    setPortfolio(body);
    if (!accountNo && body.accountNo) setAccountNo(body.accountNo);
  }, [accountNo, marketType]);

  const refresh = useCallback(async () => {
    const current = await loadStatus();
    if (!current.ok) {
      setBooting(false);
      return;
    }
    await Promise.all([loadBoard(), loadPortfolio()]);
    setBooting(false);
  }, [loadBoard, loadPortfolio, loadStatus]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      void loadSparks();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [ready, loadSparks]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      void refresh();
      void loadSymbol();
    }, 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    const candles = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSymbol();
    }, 45_000);
    return () => {
      window.clearTimeout(handle);
      window.clearInterval(id);
      window.clearInterval(candles);
    };
  }, [ready, refresh, loadSymbol]);

  const stream = useMarketStream(symbols, ready && Boolean(status?.ok), (event: MarketEvent) => {
    if (event.kind === "book") {
      setBook({ symbol: event.symbol, bids: event.bids, asks: event.asks });
      return;
    }
    if (event.kind === "trade" && event.price != null) {
      const id = tapeSeq.current + 1;
      tapeSeq.current = id;
      const print = { id, symbol: event.symbol, price: event.price, quantity: event.quantity, at: Date.now() };
      setTape((current) => [print, ...current].slice(0, 80));
    }
    if (event.kind !== "trade" && event.kind !== "secdef") return;
    const merge = (row: BoardRow): BoardRow => {
      if (row.symbol !== event.symbol) return row;
      if (event.kind === "secdef") {
        const reference = event.reference ?? row.reference;
        const change = row.price != null && reference != null ? row.price - reference : row.change;
        const changePercent = change != null && reference ? (change / reference) * 100 : row.changePercent;
        return { ...row, reference, ceiling: event.ceiling ?? row.ceiling, floor: event.floor ?? row.floor, change, changePercent };
      }
      const price = event.price ?? row.price;
      const change = price != null && row.reference != null ? price - row.reference : row.change;
      const changePercent = change != null && row.reference ? (change / row.reference) * 100 : row.changePercent;
      return {
        ...row,
        price,
        volume: event.volume ?? row.volume,
        high: event.high ?? row.high,
        low: event.low ?? row.low,
        change,
        changePercent,
      };
    };
    setRows((current) => current.map(merge));
    setQuote((current) => (current && current.symbol === event.symbol ? merge(current) : current));
  });

  const board = useMemo(
    () => symbols.map((symbol) => rows.find((row) => row.symbol === symbol) ?? blankRow(symbol)),
    [rows, symbols],
  );
  const visible = useMemo(
    () => board.filter((row) => market === "ALL" || row.exchange === market),
    [board, market],
  );
  const advances = visible.filter((row) => (row.change ?? 0) > 0).length;
  const declines = visible.filter((row) => (row.change ?? 0) < 0).length;
  const unchanged = visible.filter((row) => row.price != null && (row.change ?? 0) === 0).length;
  const ceilings = visible.filter((row) => priceTone(row.price, row.reference, row.ceiling, row.floor) === "ceiling").length;
  const floors = visible.filter((row) => priceTone(row.price, row.reference, row.ceiling, row.floor) === "floor").length;
  const suggestions = useMemo(() => matchSymbols(catalog, query), [catalog, query]);
  const quoteFor = useCallback((symbol: string) => {
    return preview.find((row) => row.symbol === symbol)
      ?? rows.find((row) => row.symbol === symbol)
      ?? blankRow(symbol);
  }, [preview, rows]);
  const popular = useMemo(() => POPULAR_SYMBOLS.map((symbol) => {
    const listed = catalog.find((item) => item.symbol === symbol);
    const known = quoteFor(symbol);
    return {
      symbol,
      name: listed?.name && listed.name !== symbol ? listed.name : known.name,
      exchange: listed?.exchange || known.exchange,
    };
  }), [catalog, quoteFor]);
  const picks = useMemo(() => (query.trim() ? suggestions : popular), [popular, query, suggestions]);

  useEffect(() => {
    if (!suggestOpen) return;
    const wanted = query.trim() ? suggestions.map((item) => item.symbol) : [...POPULAR_SYMBOLS];
    const missing = wanted.filter((symbol) => !previewAsked.current.has(symbol));
    if (missing.length === 0) return;
    for (const symbol of missing) previewAsked.current.add(symbol);
    let cancel = false;
    fetch(`/api/market/board?symbols=${missing.join(",")}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancel || !ok) return;
        setPreview((current) => {
          const map = new Map(current.map((row) => [row.symbol, row]));
          for (const row of (body.rows ?? []) as BoardRow[]) map.set(row.symbol, row);
          return [...map.values()];
        });
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [query, suggestOpen, suggestions]);

  useEffect(() => {
    if (!suggestOpen) return;
    function onPointer(event: PointerEvent) {
      if (!suggestRef.current?.contains(event.target as Node)) setSuggestOpen(false);
    }
    const id = window.setTimeout(() => document.addEventListener("pointerdown", onPointer), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [suggestOpen]);

  function selectSymbol(symbol: string) {
    setSelected(symbol);
    const row = board.find((item) => item.symbol === symbol);
    if (row) setQuote(row);
  }

  function addListed(symbol: string) {
    setSymbols((current) => (
      current.includes(symbol) ? current : [symbol, ...current].slice(0, 20)
    ));
    setSelected(symbol);
    const row = quoteFor(symbol);
    if (row.price != null) {
      setQuote(row);
      setRows((current) => current.some((item) => item.symbol === symbol) ? current : [...current, row]);
    }
    setQuery("");
    setSuggestIndex(0);
    setSuggestOpen(true);
  }

  function addSymbol(event: FormEvent) {
    event.preventDefault();
    const picked = picks[suggestIndex];
    if (picked) addListed(picked.symbol);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestOpen(true);
      setSuggestIndex((index) => Math.min(index + 1, Math.max(picks.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Escape") {
      setSuggestOpen(false);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!accountNo) return;
    const params = new URLSearchParams({ accountNo, orderId, marketType });
    const response = await fetch(`/api/orders?${params.toString()}`, { method: "DELETE" });
    const body = await readJson(response);
    if (!response.ok) {
      setError(body.error ?? "Không hủy được lệnh.");
      return;
    }
    await loadPortfolio();
  }

  return (
    <main className={screen === "order" ? "desk desk-order" : "desk"}>
      <header className="topbar">
        <div className="brand">
          <div className="mark" aria-hidden="true">Đ</div>
          <h1>DNSE</h1>
        </div>
        <nav className="screen-tabs" aria-label="Màn hình">
          <button type="button" aria-pressed={screen === "board"} onClick={() => setScreen("board")}>Bảng giá</button>
          <button type="button" aria-pressed={screen === "order"} onClick={() => setScreen("order")}>Đặt lệnh</button>
        </nav>
        <div className="topbar-actions">
          <UserMenu />
          <time className="clock num">{now ? clockLabel(now) : "—"}</time>
        </div>
      </header>

      {status && !status.ok && (
        <div className="banner" role="status">
          {status.error ?? "Chưa kết nối được DNSE."}
        </div>
      )}
      {error && <div className="banner" role="alert">{error}</div>}

      {screen === "board" && (
      <>
      <div className="board-bar">
        <div className="filters">
          <form className="suggest" ref={suggestRef} onSubmit={addSymbol}>
            <input
              aria-label="Tìm mã để thêm vào bảng giá"
              aria-autocomplete="list"
              aria-controls="symbol-suggestions"
              aria-expanded={suggestOpen}
              placeholder="Tìm mã"
              value={query}
              onFocus={() => setSuggestOpen(true)}
              onPointerDown={() => setSuggestOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSuggestIndex(0);
                setSuggestOpen(true);
              }}
              onKeyDown={onSearchKey}
            />
            {suggestOpen && (
              <div className="suggest-panel" id="symbol-suggestions" onMouseDown={(event) => event.preventDefault()}>
                <ul className="suggest-list" role="listbox">
                  {query.trim() && catalogState === "loading" && picks.length === 0 && <li className="empty">Đang tải danh mục mã…</li>}
                  {query.trim() && catalogState === "error" && picks.length === 0 && <li className="empty">Chưa tải được danh mục mã.</li>}
                  {query.trim() && catalogState === "ready" && picks.length === 0 && <li className="empty">Không có mã khớp.</li>}
                  {picks.map((item, index) => {
                    const row = quoteFor(item.symbol);
                    const tone = priceTone(row.price, row.reference, row.ceiling, row.floor);
                    const name = item.name && item.name !== item.symbol ? item.name : row.name;
                    const exchange = item.exchange || row.exchange;
                    return (
                      <li key={item.symbol}>
                        <button
                          type="button"
                          className="suggest-row"
                          role="option"
                          aria-selected={index === suggestIndex}
                          onMouseEnter={() => setSuggestIndex(index)}
                          onClick={() => addListed(item.symbol)}
                        >
                          <SymbolLogo symbol={item.symbol} />
                          <span className="suggest-id">
                            <span className="suggest-symbol">
                              <strong>{item.symbol}</strong>
                              {row.changePercent != null && <em className={`tone-pill tone-${tone}`}>{formatPct(row.changePercent)}</em>}
                            </span>
                            <small>{exchange ? `${exchange} · ` : ""}{name !== item.symbol ? name : "Đang tải"}</small>
                          </span>
                          <span className="suggest-px">
                            <b className={`num tone-${tone}`}>{formatPrice(row.price)}</b>
                            {row.change != null && (
                              <small className={`tone-${tone}`}>{formatChange(row.change)} ({formatPct(row.changePercent)})</small>
                            )}
                            <small>KL {formatQty(row.volume)}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </form>
          <div className="chips" role="group" aria-label="Sàn">
            {MARKETS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={market === item.id}
                onClick={() => setMarket(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="breadth" aria-label="Thống kê biến động">
          <span>Tăng <b className="num tone-up">{advances}</b></span>
          <span>Giảm <b className="num tone-down">{declines}</b></span>
          <span>Trần <b className="num tone-ceiling">{ceilings}</b></span>
          <span>Sàn <b className="num tone-floor">{floors}</b></span>
          <span>Tham chiếu <b className="num tone-ref">{unchanged}</b></span>
        </div>
      </div>

      <section className="quote-grid" aria-label="Bảng giá">
        {visible.length === 0 && <p className="empty">Không có mã trên sàn này.</p>}
        {visible.map((row) => {
          const rowTone = priceTone(row.price, row.reference, row.ceiling, row.floor);
          const name = row.name !== row.symbol ? row.name : booting ? "Đang tải" : "Chưa có giá";
          return (
            <article className={row.symbol === selected ? "quote-card is-on" : "quote-card"} key={row.symbol}>
              <div className="quote-card-top">
                <div className="quote-id">
                  <SymbolLogo symbol={row.symbol} />
                  <button type="button" className="quote-open" aria-pressed={row.symbol === selected} onClick={() => selectSymbol(row.symbol)}>
                    <strong>{row.symbol}</strong>
                    <small>{name}</small>
                  </button>
                </div>
                <Sparkline values={sparks[row.symbol] ?? []} />
              </div>
              <button type="button" className="quote-rest" onClick={() => selectSymbol(row.symbol)}>
                <span className={`quote-card-price num tone-${rowTone}`}>{formatPrice(row.price)}</span>
                <span className={`quote-meta num tone-${rowTone}`}>
                  <b>{formatChange(row.change)} ({formatPct(row.changePercent)})</b>
                  <span>KL {formatQty(row.volume)}</span>
                </span>
              </button>
            </article>
          );
        })}
      </section>
      </>
      )}

      {screen === "order" && (
        <OrderDesk
          now={now}
          rows={board}
          catalog={catalog}
          selected={selected}
          quote={quote}
          stream={stream}
          book={book?.symbol === selected ? { bids: book.bids, asks: book.asks } : null}
          prints={tape}
          candles={candles}
          resolution={resolution}
          marketType={marketType}
          booting={booting}
          orders={portfolio?.orders ?? []}
          positions={portfolio?.positions ?? []}
          availableCash={portfolio?.balance.availableCash ?? null}
          totalCash={portfolio?.balance.totalCash ?? null}
          accounts={portfolio?.accounts ?? []}
          accountNo={accountNo}
          tokenActive={Boolean(status?.tradingToken)}
          onResolution={setResolution}
          onMarketType={setMarketType}
          onSelect={selectSymbol}
          onCancel={(orderId) => { void cancelOrder(orderId); }}
          onAccount={setAccountNo}
          onPlaced={() => { void loadPortfolio(); }}
          onTokenChange={() => { void loadStatus(); }}
        />
      )}
    </main>
  );
}
