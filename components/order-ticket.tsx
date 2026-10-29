"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatPrice, sideLabel } from "@/lib/format";
import type { LoanPackage, PowerView } from "@/lib/dnse/normalize";
import type { MarketType } from "@/lib/dnse/validate";

type Account = { id: string; name: string };

type Props = {
  symbol: string;
  lastPrice: number | null;
  pricePick?: { id: number; price: number } | null;
  accounts: Account[];
  accountNo: string;
  marketType: MarketType;
  tokenActive: boolean;
  onAccount: (accountNo: string) => void;
  onPlaced: () => void;
  onTokenChange: () => void;
};

const ORDER_TYPES = [
  { id: "LO", label: "LO" },
  { id: "MTL", label: "MTL" },
  { id: "ATO", label: "ATO" },
  { id: "ATC", label: "ATC" },
];

export function OrderTicket({
  symbol,
  lastPrice,
  pricePick,
  accounts,
  accountNo,
  marketType,
  tokenActive,
  onAccount,
  onPlaced,
  onTokenChange,
}: Props) {
  const [side, setSide] = useState<"NB" | "NS">("NB");
  const [orderType, setOrderType] = useState("LO");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [packages, setPackages] = useState<LoanPackage[]>([]);
  const [loanPackageId, setLoanPackageId] = useState("");
  const [power, setPower] = useState<PowerView>({ buyingPower: null, sellingPower: null });
  const [otpType, setOtpType] = useState<"email_otp" | "smart_otp">("smart_otp");
  const [passcode, setPasscode] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lastPrice != null) setPrice(String(lastPrice));
  }, [symbol, lastPrice]);

  useEffect(() => {
    if (pricePick) setPrice(String(pricePick.price));
  }, [pricePick]);

  useEffect(() => {
    if (!accountNo || !symbol) return;
    const handle = window.setTimeout(async () => {
      const params = new URLSearchParams({
        accountNo,
        symbol,
        marketType,
        price: price || "0",
      });
      if (loanPackageId) params.set("loanPackageId", loanPackageId);
      const response = await fetch(`/api/trading/context?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) {
        if (body.code !== "CONFIG") setNote(body.error ?? "Chưa lấy được sức mua.");
        return;
      }
      setPackages(body.loanPackages ?? []);
      setPower(body.power ?? { buyingPower: null, sellingPower: null });
      if (!loanPackageId && body.loanPackageId) setLoanPackageId(String(body.loanPackageId));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [accountNo, symbol, marketType, price, loanPackageId]);

  async function sendEmailOtp() {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/auth/email-otp", { method: "POST" });
      const body = await response.json();
      setNote(body.message ?? body.error ?? "Đã xử lý OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/auth/trading-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpType, passcode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "OTP không hợp lệ");
      setPasscode("");
      setNote(body.message);
      onTokenChange();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Không xác thực được OTP");
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    await fetch("/api/auth/trading-token", { method: "DELETE" });
    onTokenChange();
    setNote("Đã xóa trading token trên server.");
  }

  async function placeOrder() {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNo,
          symbol,
          side,
          orderType,
          price: orderType === "LO" ? Number(price || 0) : 0,
          quantity: Number(quantity),
          loanPackageId: Number(loanPackageId),
          marketType,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không gửi được lệnh");
      setConfirming(false);
      setNote(`Đã gửi lệnh ${sideLabel(side)} ${symbol}.`);
      onPlaced();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Không gửi được lệnh");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel ticket-rail">
      <div className="panel-head">
        <h2>{symbol}</h2>
        <span className={tokenActive ? "ok" : "tone-ref"}>{tokenActive ? "Đã xác thực" : "Chưa có token"}</span>
      </div>
      <div className="ticket">
        <label className="field">
          <span>Tiểu khoản</span>
          <select value={accountNo} onChange={(event) => onAccount(event.target.value)}>
            {accounts.length === 0 && <option value="">Chưa có tiểu khoản</option>}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.id} · {account.name}</option>
            ))}
          </select>
        </label>
        <div className="order-types" role="group" aria-label="Loại lệnh">
          {ORDER_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ghost"
              aria-pressed={orderType === item.id}
              onClick={() => setOrderType(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Giá</span>
          <input
            className="num"
            inputMode="decimal"
            value={orderType === "LO" ? price : ""}
            placeholder={orderType === "LO" ? "" : orderType}
            disabled={orderType !== "LO"}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Khối lượng</span>
          <input className="num" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <label className="field">
          <span>Gói vay</span>
          <select value={loanPackageId} onChange={(event) => setLoanPackageId(event.target.value)}>
            {packages.length === 0 && <option value="">Chưa có gói</option>}
            {packages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.initialRate != null ? ` · ${formatNumber(item.initialRate <= 1 ? item.initialRate * 100 : item.initialRate, 0)}%` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="power">
          <div><span>Sức mua</span><strong className="num">{formatNumber(power.buyingPower)}</strong></div>
          <div><span>Sức bán</span><strong className="num">{formatNumber(power.sellingPower)}</strong></div>
        </div>
        <div className="auth-box">
          <p>{tokenActive ? "Trading token đang lưu trong cookie httpOnly." : "Đặt lệnh thật cần OTP. Smart OTP lấy trên Entrade X, hoặc gửi OTP email."}</p>
          <select value={otpType} onChange={(event) => setOtpType(event.target.value as "email_otp" | "smart_otp")}>
            <option value="smart_otp">Smart OTP</option>
            <option value="email_otp">Email OTP</option>
          </select>
          {otpType === "email_otp" && (
            <button type="button" className="ghost" disabled={busy} onClick={sendEmailOtp}>Gửi OTP email</button>
          )}
          <input
            className="num"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Mã OTP"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
          <button type="button" className="ghost" disabled={busy || passcode.length < 4} onClick={verifyOtp}>Xác thực</button>
          {tokenActive && <button type="button" className="texty" onClick={clearToken}>Xóa token</button>}
        </div>
        {note && <p className="note">{note}</p>}
        <div className="ticket-actions">
          <button
            type="button"
            className="solid buy"
            disabled={!tokenActive || !accountNo || !loanPackageId}
            onClick={() => { setSide("NB"); setConfirming(true); }}
          >
            MUA
          </button>
          <button
            type="button"
            className="solid sell"
            disabled={!tokenActive || !accountNo || !loanPackageId}
            onClick={() => { setSide("NS"); setConfirming(true); }}
          >
            BÁN
          </button>
        </div>
      </div>
      {confirming && (
        <div className="modal-back" role="presentation" onClick={() => setConfirming(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="confirm-title">Xác nhận lệnh thật</h3>
            <p className="note">Lệnh này được gửi thẳng lên DNSE, không phải mô phỏng.</p>
            <dl>
              <dt>Mã</dt><dd className="num">{symbol}</dd>
              <dt>Chiều</dt><dd>{sideLabel(side)}</dd>
              <dt>Loại</dt><dd>{orderType}</dd>
              <dt>Giá</dt><dd className="num">{formatPrice(Number(price))}</dd>
              <dt>Khối lượng</dt><dd className="num">{formatNumber(Number(quantity))}</dd>
              <dt>Tiểu khoản</dt><dd className="num">{accountNo}</dd>
            </dl>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>Quay lại</button>
              <button type="button" className={`solid ${side === "NB" ? "buy" : "sell"}`} disabled={busy} onClick={placeOrder}>
                {busy ? "Đang gửi" : "Xác nhận gửi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
