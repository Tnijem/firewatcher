import { useEffect, useState } from "react";

const KEY = "firewatcher.consent.v1";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  if (!show) return null;

  const accept = () => {
    localStorage.setItem(KEY, "accepted");
    setShow(false);
  };

  return (
    <div className="consent">
      <span>
        This site shows ads via Google AdSense, which may set cookies.{" "}
        <a href="/privacy.html">Privacy</a>.
      </span>
      <button className="consent-btn" onClick={accept}>OK</button>
    </div>
  );
}
