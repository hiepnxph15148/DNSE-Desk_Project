"use client";

import { useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  colorSchemeDark,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { IndexStrip } from "@/components/index-strip";
import { OrderTicket } from "@/components/order-ticket";
import { PriceChart } from "@/components/price-chart";
import { SymbolLogo } from "@/components/symbol-logo";
import {
  canCancel,
  clockLabel,
  formatNumber,
  formatPct,
  formatPrice,
  formatQty,
  orderStatusLabel,
  priceTone,
  sideLabel,
} from "@/lib/format";
import type { ListedSymbol } from "@/lib/dnse/catalog";
import type { BoardRow, Candle, OrderRow, PositionRow } from "@/lib/dnse/normalize";
import type { PriceLevel } from "@/lib/dnse/stream-types";
import type { MarketType } from "@/lib/dnse/validate";
import { RESOLUTIONS, type Resolution } from "@/lib/symbols";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#17181c",
  foregroundColor: "#efefef",
  headerBackgroundColor: "#111114",
  headerTextColor: "#6d7380",
  borderColor: "rgba(255,255,255,0.08)",
  accentColor: "#ef4444",
  fontFamily: "Roboto, sans-serif",
  fontSize: 13,
  headerFontSize: 12,
  wrapperBorderRadius: 0,
  borderRadius: 0,
  spacing: 5,
});

type StreamState = "off" | "connecting" | "live" | "down";

export type TapePrint = {
  id: number;
  symbol: string;
  price: number | null;
  quantity: number | null;
  at: number;
};

type WatchRow = BoardRow & { label: string };

type Props = {
  rows: BoardRow[];
  catalog: ListedSymbol[];
  selected: string;
  quote: BoardRow | null;
  stream: StreamState;
  book: { bids: PriceLevel[]; asks: PriceLevel[] } | null;
  prints: TapePrint[];
  candles: Candle[];
  resolution: Resolution;
  marketType: MarketType;
  booting: boolean;
  orders: OrderRow[];
  positions: PositionRow[];
  availableCash: number | null;
  totalCash: number | null;
  accounts: { id: string; name: string }[];
  accountNo: string;
  tokenActive: boolean;
  now: Date | null;
  onResolution: (value: Resolution) => void;
  onMarketType: (value: MarketType) => void;
  onSelect: (symbol: string) => void;
  onCancel: (orderId: string) => void;
  onAccount: (accountNo: string) => void;
  onPlaced: () => void;
  onTokenChange: () => void;
};

const STREAM_LABEL: Record<StreamState, string> = {
  off: "Socket tắt",
  connecting: "Đang nối socket",
  live: "Socket sống",
  down: "Socket ngắt",
};

function toneColor(tone: ReturnType<typeof priceTone>) {
  if (tone === "up") return "var(--up)";
  if (tone === "down") return "var(--down)";
  if (tone === "ceiling") return "var(--ceiling)";
  if (tone === "floor") return "var(--floor)";
  if (tone === "ref") return "var(--ref)";
  return "var(--text)";
}

function SymbolCell(params: ICellRendererParams<WatchRow>) {
  const row = params.data;
  if (!row) return null;
  return (
    <span className="watch-symbol">
      <SymbolLogo symbol={row.symbol} />
      <span className="watch-meta">
        <strong>{row.symbol}</strong>
        <small>{row.exchange || "\u00a0"}</small>
      </span>
    </span>
  );
}

function CancelCell(params: ICellRendererParams<OrderRow>) {
  const order = params.data;
  if (!order || !canCancel(order.status)) return null;
  return (
    <button type="button" className="texty" onClick={() => params.context.onCancel(order.id)}>
      Hủy
    </button>
  );
}

export function OrderDesk(props: Props) {
  const [filter, setFilter] = useState("");
  const [ledger, setLedger] = useState<"orders" | "positions">("orders");
  const [pricePick, setPricePick] = useState<{ id: number; price: number } | null>(null);
  const [watchOpen, setWatchOpen] = useState(true);
  const [sideOpen, setSideOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const [blotterHeight, setBlotterHeight] = useState(188);
  const deskRef = useRef<HTMLDivElement>(null);
  const listed = props.rows.find((row) => row.symbol === props.selected) ?? props.rows[0];
  const active = props.quote && props.quote.symbol === props.selected ? props.quote : listed;
  const reference = active?.reference ?? null;
  const ceiling = active?.ceiling ?? null;
  const floor = active?.floor ?? null;

  const watchRows = useMemo<WatchRow[]>(() => props.rows.map((row) => {
    const listed = props.catalog.find((item) => item.symbol === row.symbol);
    return {
      ...row,
      exchange: listed?.exchange || row.exchange,
      name: listed?.name && listed.name !== row.symbol ? listed.name : row.name,
      label: listed?.name && listed.name !== row.symbol ? listed.name : row.name,
    };
  }), [props.catalog, props.rows]);

  const watchColumns = useMemo<ColDef<WatchRow>[]>(() => [
    {
      field: "symbol",
      headerName: "Mã",
      flex: 1.5,
      minWidth: 112,
      cellRenderer: SymbolCell,
      sortable: true,
      resizable: false,
    },
    {
      field: "price",
      headerName: "Giá",
      flex: 0.8,
      minWidth: 68,
      resizable: false,
      type: "rightAligned",
      valueFormatter: (params) => formatPrice(params.value),
      cellStyle: (params) => ({ color: toneColor(priceTone(params.data?.price, params.data?.reference, params.data?.ceiling, params.data?.floor)) }),
    },
    {
      field: "changePercent",
      headerName: "%",
      flex: 0.7,
      minWidth: 64,
      resizable: false,
      type: "rightAligned",
      valueFormatter: (params) => formatPct(params.value),
      cellStyle: (params) => ({ color: toneColor(priceTone(params.data?.price, params.data?.reference, params.data?.ceiling, params.data?.floor)) }),
    },
    {
      field: "volume",
      headerName: "Tổng KL",
      flex: 0.9,
      minWidth: 76,
      resizable: false,
      type: "rightAligned",
      valueFormatter: (params) => formatQty(params.value),
    },
  ], []);

  const orderColumns = useMemo<ColDef<OrderRow>[]>(() => [
    { field: "symbol", headerName: "Mã", minWidth: 80 },
    {
      field: "side",
      headerName: "Lệnh",
      minWidth: 70,
      valueFormatter: (params) => sideLabel(params.value),
      cellStyle: (params) => ({ color: params.value === "NB" ? "var(--up)" : "var(--down)" }),
    },
    { field: "orderType", headerName: "Loại", minWidth: 70 },
    { field: "quantity", headerName: "KL", minWidth: 80, type: "rightAligned", valueFormatter: (params) => formatQty(params.value) },
    { field: "price", headerName: "Giá", minWidth: 80, type: "rightAligned", valueFormatter: (params) => formatPrice(params.value) },
    { field: "filled", headerName: "Khớp", minWidth: 80, type: "rightAligned", valueFormatter: (params) => formatQty(params.value) },
    { field: "status", headerName: "Trạng thái", minWidth: 120, flex: 1, valueFormatter: (params) => orderStatusLabel(params.value) },
    { colId: "cancel", headerName: "", width: 72, sortable: false, cellRenderer: CancelCell },
  ], []);

  const positionColumns = useMemo<ColDef<PositionRow>[]>(() => [
    { field: "symbol", headerName: "Mã", minWidth: 90, flex: 1 },
    { field: "quantity", headerName: "KL", minWidth: 90, type: "rightAligned", valueFormatter: (params) => formatQty(params.value) },
    { field: "averagePrice", headerName: "Giá vốn", minWidth: 100, type: "rightAligned", valueFormatter: (params) => formatPrice(params.value) },
    { field: "marketPrice", headerName: "Giá TT", minWidth: 100, type: "rightAligned", valueFormatter: (params) => formatPrice(params.value) },
  ], []);

  const depth = Math.max(props.book?.bids.length ?? 0, props.book?.asks.length ?? 0, 0);
  const depthRows = Array.from({ length: Math.min(depth, 8) }, (_, index) => ({
    bid: props.book?.bids[index],
    ask: props.book?.asks[index],
  }));
  const prints = props.prints.filter((item) => item.symbol === props.selected).slice(0, 24);

  function pickPrice(price: number | null) {
    if (price == null || !active) return;
    setPricePick({ id: Date.now(), price });
    props.onSelect(active.symbol);
  }

  function startBlotterDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startH = blotterHeight;
    const move = (ev: PointerEvent) => {
      const desk = deskRef.current;
      const max = desk ? Math.max(180, desk.clientHeight - 260) : 520;
      const next = startH - (ev.clientY - startY);
      setBlotterHeight(Math.min(max, Math.max(128, next)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className={`order-desk${watchOpen ? "" : " is-watch-closed"}${sideOpen ? "" : " is-side-closed"}${railOpen ? "" : " is-rail-closed"}`}
      ref={deskRef}
      style={{ ["--blotter" as string]: `${blotterHeight}px` }}
    >
      <IndexStrip now={props.now} />
      <aside className={`order-watch panel${watchOpen ? "" : " is-collapsed"}`}>
        {watchOpen ? (
          <button type="button" className="pane-toggle pane-hide" aria-label="Ẩn bảng theo dõi" onClick={() => setWatchOpen(false)}>
            <span aria-hidden="true">‹</span>
            <span className="pane-tip" role="tooltip">Ẩn bảng theo dõi</span>
          </button>
        ) : (
          <button type="button" className="pane-toggle pane-reveal" aria-label="Mở bảng theo dõi" onClick={() => setWatchOpen(true)}>
            <span aria-hidden="true">›</span>
            <span className="pane-tip" role="tooltip">Mở bảng theo dõi</span>
          </button>
        )}
        {watchOpen && <>
        <div className="order-watch-head">
          <strong>Theo dõi</strong>
          <span className={props.stream === "live" ? "ok" : "tone-ref"}>{STREAM_LABEL[props.stream]}</span>
        </div>
        <input
          aria-label="Lọc mã trong bảng"
          placeholder="Lọc mã"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="grid-host">
          <AgGridReact<WatchRow>
            theme={gridTheme}
            rowData={watchRows}
            columnDefs={watchColumns}
            quickFilterText={filter}
            getRowId={(params) => params.data.symbol}
            rowClassRules={{ "is-on": (params) => params.data?.symbol === props.selected }}
            onRowClicked={(event) => {
              if (event.data) props.onSelect(event.data.symbol);
            }}
            headerHeight={28}
            rowHeight={40}
            suppressCellFocus
            suppressHorizontalScroll
            suppressMovableColumns
            animateRows={false}
          />
        </div>
        </>}
      </aside>

      <section className="order-chart panel">
        <div className="order-chart-bar">
          <div>
            <strong>{active?.symbol ?? "—"}</strong>
            <span>{active && active.name !== active.symbol ? active.name : "Biểu đồ"}</span>
          </div>
          <div className="resolutions" role="group" aria-label="Khung thời gian">
            {RESOLUTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ghost"
                aria-pressed={props.resolution === item.id}
                onClick={() => props.onResolution(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <PriceChart candles={props.candles} resolution={props.resolution} symbol={active?.symbol ?? props.selected} />
      </section>

      <aside className={`order-side${sideOpen ? "" : " is-collapsed panel"}`}>
        {sideOpen ? (
          <button type="button" className="pane-toggle pane-hide" aria-label="Ẩn bước giá" onClick={() => setSideOpen(false)}>
            <span aria-hidden="true">›</span>
            <span className="pane-tip" role="tooltip">Ẩn bước giá</span>
          </button>
        ) : (
          <button type="button" className="pane-toggle pane-reveal" aria-label="Mở bước giá" onClick={() => setSideOpen(true)}>
            <span aria-hidden="true">‹</span>
            <span className="pane-tip" role="tooltip">Mở bước giá</span>
          </button>
        )}
        {sideOpen && <>
        <section className="order-depth panel">
        <div className="panel-head">
          <h2>Bước giá</h2>
          <span className="num">{active ? formatPrice(active.price) : ""}</span>
        </div>
        <div className="depth-head num">
          <span>KL mua</span>
          <span>Giá mua</span>
          <span>Giá bán</span>
          <span>KL bán</span>
        </div>
        <div className="depth-list">
          {depthRows.map((level, index) => {
            const bidTone = priceTone(level.bid?.price, reference, ceiling, floor);
            const askTone = priceTone(level.ask?.price, reference, ceiling, floor);
            return (
              <div className="depth-row num" key={index}>
                <span>{formatQty(level.bid?.quantity)}</span>
                <button type="button" className={`tone-${bidTone}`} onClick={() => pickPrice(level.bid?.price ?? null)}>
                  {formatPrice(level.bid?.price)}
                </button>
                <button type="button" className={`tone-${askTone}`} onClick={() => pickPrice(level.ask?.price ?? null)}>
                  {formatPrice(level.ask?.price)}
                </button>
                <span>{formatQty(level.ask?.quantity)}</span>
              </div>
            );
          })}
        </div>
          {depth === 0 && <p className="empty">{props.stream === "live" ? "Chưa có lệnh chờ." : "Đang chờ bước giá."}</p>}
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
            {prints.length === 0 && <p className="empty">Chưa có khớp lệnh mới.</p>}
            {prints.map((item) => {
              const tone = priceTone(item.price, reference, ceiling, floor);
              const delta = item.price != null && reference != null ? item.price - reference : null;
              return (
                <div className="tape-row num" key={item.id}>
                  <span>{clockLabel(new Date(item.at))}</span>
                  <button type="button" className={`tone-${tone}`} onClick={() => pickPrice(item.price)}>{formatPrice(item.price)}</button>
                  <span className={`tone-${tone}`}>{formatNumber(delta, Math.abs(delta ?? 0) >= 1000 ? 0 : 2)}</span>
                  <span>{formatQty(item.quantity)}</span>
                </div>
              );
            })}
          </div>
        </section>
        </>}
      </aside>

      <aside className={`order-rail${railOpen ? "" : " is-collapsed panel"}`}>
        {railOpen ? (
          <button type="button" className="pane-toggle pane-hide" aria-label="Ẩn đặt lệnh" onClick={() => setRailOpen(false)}>
            <span aria-hidden="true">›</span>
            <span className="pane-tip" role="tooltip">Ẩn đặt lệnh</span>
          </button>
        ) : (
          <button type="button" className="pane-toggle pane-reveal" aria-label="Mở đặt lệnh" onClick={() => setRailOpen(true)}>
            <span aria-hidden="true">‹</span>
            <span className="pane-tip" role="tooltip">Mở đặt lệnh</span>
          </button>
        )}
        {railOpen && <>
        <label className="account-line panel">
          <span>Thị trường</span>
          <select value={props.marketType} onChange={(event) => props.onMarketType(event.target.value as MarketType)}>
            <option value="STOCK">Cơ sở</option>
            <option value="DERIVATIVE">Phái sinh</option>
          </select>
        </label>
        <OrderTicket
          symbol={props.selected}
          lastPrice={active?.price ?? null}
          pricePick={pricePick}
          accounts={props.accounts}
          accountNo={props.accountNo}
          marketType={props.marketType}
          tokenActive={props.tokenActive}
          onAccount={props.onAccount}
          onPlaced={props.onPlaced}
          onTokenChange={props.onTokenChange}
        />
        </>}
      </aside>

      <section className="order-blotter panel">
        <button
          type="button"
          className="blotter-resize"
          aria-label="Kéo để đổi chiều cao sổ lệnh"
          onPointerDown={startBlotterDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") setBlotterHeight((height) => Math.min(520, height + 24));
            if (event.key === "ArrowDown") setBlotterHeight((height) => Math.max(128, height - 24));
          }}
        />
        <div className="panel-head">
          <div className="ledger-tabs" role="group" aria-label="Sổ lệnh">
            <button type="button" aria-pressed={ledger === "orders"} onClick={() => setLedger("orders")}>Sổ lệnh</button>
            <button type="button" aria-pressed={ledger === "positions"} onClick={() => setLedger("positions")}>Vị thế</button>
          </div>
          <span className="num">
            {props.availableCash != null ? `Tiền ${formatNumber(props.availableCash)}` : ""}
            {props.totalCash != null ? ` · Tổng ${formatNumber(props.totalCash)}` : ""}
          </span>
        </div>
        <div className="grid-host blotter-grid">
          {ledger === "orders" ? (
            <AgGridReact<OrderRow>
              theme={gridTheme}
              rowData={props.orders}
              columnDefs={orderColumns}
              getRowId={(params) => params.data.id}
              context={{ onCancel: props.onCancel }}
              headerHeight={32}
              rowHeight={34}
              suppressCellFocus
              overlayNoRowsTemplate={props.booting ? "Đang đọc sổ lệnh" : "Chưa có lệnh trong ngày"}
            />
          ) : (
            <AgGridReact<PositionRow>
              theme={gridTheme}
              rowData={props.positions}
              columnDefs={positionColumns}
              getRowId={(params) => `${params.data.id}-${params.data.symbol}`}
              onRowClicked={(event) => {
                if (event.data?.symbol) props.onSelect(event.data.symbol);
              }}
              headerHeight={32}
              rowHeight={34}
              suppressCellFocus
              overlayNoRowsTemplate={props.booting ? "Đang đọc vị thế" : "Chưa có vị thế"}
            />
          )}
        </div>
      </section>
    </div>
  );
}
