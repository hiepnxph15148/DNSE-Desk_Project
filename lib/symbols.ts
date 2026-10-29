export const POPULAR_SYMBOLS = [
  "FPT",
  "KOS",
  "PNJ",
  "VIX",
  "VIC",
  "MSR",
  "VSC",
  "TCB",
  "HPG",
  "SHB",
  "VHM",
];

export const DEFAULT_WATCHLIST = [
  "HPG",
  "VCB",
  "FPT",
  "MWG",
  "SSI",
  "VNM",
  "TCB",
  "ACB",
  "VIC",
  "MSN",
  "GAS",
  "CTG",
];

export const RESOLUTIONS = [
  { id: "1", label: "1 phút" },
  { id: "5", label: "5 phút" },
  { id: "15", label: "15 phút" },
  { id: "60", label: "1 giờ" },
  { id: "D", label: "Ngày" },
] as const;

export type Resolution = (typeof RESOLUTIONS)[number]["id"];

export function lookbackSeconds(resolution: string) {
  switch (resolution) {
    case "1":
      return 60 * 60 * 6;
    case "5":
      return 60 * 60 * 24 * 2;
    case "15":
      return 60 * 60 * 24 * 5;
    case "60":
      return 60 * 60 * 24 * 20;
    default:
      return 60 * 60 * 24 * 180;
  }
}
