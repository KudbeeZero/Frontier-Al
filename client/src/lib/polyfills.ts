import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  if (!window.Buffer) window.Buffer = Buffer;
  if (!window.global) window.global = globalThis;
}

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

if (typeof (globalThis as any).process === "undefined") {
  (globalThis as any).process = { env: {}, version: "", browser: true };
}
