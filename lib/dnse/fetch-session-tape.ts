import { dnseRequest } from "@/lib/dnse/client";
import { readSessionTape, readTradePage } from "@/lib/dnse/read-trades";
import { mergeTapeCaches, TAPE_CACHE_MAX, type TapePrint } from "@/lib/dnse/tape";

const PAGE_LIMIT = 200;
const MAX_PAGES = 5;

/** Doc: `from`/`to` là unix giây, bắt buộc, khoảng không quá 1 ngày. */
function historyWindow() {
  const to = Math.floor(Date.now() / 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
  const start = Math.floor(Date.parse(`${date}T00:00:00+07:00`) / 1000);
  const from = Number.isFinite(start) ? Math.max(start, to - 86_400) : to - 86_400;
  return { from, to };
}

/** GET /price/:symbol/trades — Lịch sử khớp lệnh. */
async function fetchHistoryTrades(symbol: string) {
  const { from, to } = historyWindow();
  const collected: unknown[] = [];
  let token: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      boardId: "G1",
      from: String(from),
      to: String(to),
      limit: String(PAGE_LIMIT),
    });
    if (token) params.set("nextPageToken", token);

    const body = await dnseRequest(`/price/${symbol}/trades?${params.toString()}`);
    const { rows, nextPageToken } = readTradePage(body);
    collected.push(...rows);
    if (!nextPageToken || rows.length === 0) break;
    token = nextPageToken;
  }

  return collected;
}

/** Khớp lệnh từng lệnh lấy từ lịch sử trades, rồi ghép thêm khớp gần nhất. */
export async function fetchSessionTape(symbol: string): Promise<TapePrint[]> {
  const history = await fetchHistoryTrades(symbol);
  let prints = readSessionTape(symbol, { trades: history });

  try {
    const latest = await dnseRequest(`/price/${symbol}/trades/latest?boardId=G1`);
    prints = mergeTapeCaches(prints, readSessionTape(symbol, latest, prints.length + 1), TAPE_CACHE_MAX);
  } catch {
    /* Lịch sử đã đủ nếu latest lỗi */
  }

  return prints.sort((a, b) => b.at - a.at).slice(0, TAPE_CACHE_MAX);
}
