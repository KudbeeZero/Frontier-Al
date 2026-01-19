import { Buffer } from "buffer";

declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: typeof globalThis;
  }
}

window.Buffer = Buffer;
window.global = globalThis;

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
