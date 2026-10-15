import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const formScripts = ["/nav.js", "/registration.js", "/donation.js", "/company-donation.js", "/gallery.js"];

function App() {
  const [markup, setMarkup] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/legacy-home.html")
      .then((response) => response.text())
      .then((html) => {
        const document = new DOMParser().parseFromString(html, "text/html");
        document.querySelectorAll("script").forEach((script) => script.remove());
        setMarkup(document.body.innerHTML);
      })
      .catch(() => setError("Halaman belum dapat dimuat."));
  }, []);
  useEffect(() => {
    if (!markup) return;
    const scripts = formScripts.map((src) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      document.body.appendChild(script);
      return script;
    });
    return () => scripts.forEach((script) => script.remove());
  }, [markup]);
  if (error) return <p>{error}</p>;
  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}

createRoot(document.getElementById("root")).render(<App />);
