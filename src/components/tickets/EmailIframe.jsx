import React, { useRef, useEffect, useState } from "react";

export default function EmailIframe({ html }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(200);

  const fullHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0 !important; padding: 12px !important;
      background: #ffffff !important; color: #111111 !important;
      font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;
      word-break: break-word;
    }
    img { max-width: 100% !important; height: auto !important; display: block; }
    a { color: #6d28d9; }
    * { box-sizing: border-box; max-width: 100%; }
    [style*="color: white"], [style*="color:#fff"], [style*="color: #fff"],
    [style*="color:white"], [style*="color: transparent"], [style*="color:transparent"] {
      color: #111111 !important;
    }
  </style>
</head><body>${html || "<p style='color:#999'>Sem conteúdo</p>"}</body></html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(fullHtml); doc.close();
    const resize = () => {
      try {
        const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 200;
        setHeight(Math.min(Math.max(h + 20, 80), 1000));
      } catch {}
    };
    iframe.onload = () => setTimeout(resize, 150);
    setTimeout(resize, 300);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", height, border: "none", borderRadius: "6px", background: "#ffffff", display: "block" }}
      sandbox="allow-same-origin"
      title="email-body"
    />
  );
}