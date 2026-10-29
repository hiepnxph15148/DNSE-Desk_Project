"use client";

import { useState } from "react";

export function symbolLogoUrl(symbol: string) {
  return `https://cdn.simplize.vn/simplizevn/logo/${encodeURIComponent(symbol)}.jpeg`;
}

export function SymbolLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="logo-frame logo-fallback" aria-hidden="true">{symbol.slice(0, 1)}</span>;
  }

  return (
    <span className="logo-frame">
      <img
        className="logo"
        src={symbolLogoUrl(symbol)}
        alt=""
        onError={() => setFailed(true)}
      />
    </span>
  );
}
