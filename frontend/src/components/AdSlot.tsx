import { useEffect } from "react";

const PUB = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;
const SLOT = import.meta.env.VITE_ADSENSE_AD_SLOT as string | undefined;
const ADSENSE_SCRIPT_ID = "adsbygoogle-script";

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

function ensureAdsenseScript() {
  if (!PUB) return;
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;
  const s = document.createElement("script");
  s.id = ADSENSE_SCRIPT_ID;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(PUB)}`;
  document.head.appendChild(s);
}

/**
 * Renders a Google AdSense ad unit. If VITE_ADSENSE_PUBLISHER_ID and
 * VITE_ADSENSE_AD_SLOT aren't set at build time, this renders nothing —
 * useful before AdSense approval comes through.
 */
export default function AdSlot({ format = "auto" }: { format?: string }) {
  useEffect(() => {
    if (!PUB || !SLOT) return;
    ensureAdsenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js sometimes fails on first push; AdSense self-recovers.
    }
  }, []);

  if (!PUB || !SLOT) return null;

  return (
    <div className="ad-slot">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={PUB}
        data-ad-slot={SLOT}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
