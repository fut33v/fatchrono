const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

function resolveUrls(url: string) {
  const parsed = new URL(url);
  const api = parsed.toString().replace(/\/$/, "");
  const socketProtocol = parsed.protocol === "https:" ? "wss:" : parsed.protocol;
  const socket = `${socketProtocol}//${parsed.host}`;
  return { api, socket };
}

let apiBaseUrl = DEFAULT_API_BASE_URL;
let socketUrl = "http://localhost:3001";

if (rawBaseUrl) {
  try {
    const { api, socket } = resolveUrls(rawBaseUrl);
    apiBaseUrl = api;
    socketUrl = socket;
  } catch {
    const { api, socket } = resolveUrls(DEFAULT_API_BASE_URL);
    apiBaseUrl = api;
    socketUrl = socket;
  }
} else if (typeof window !== "undefined") {
  const origin = window.location.origin;
  const { api, socket } = resolveUrls(`${origin}/api`);
  apiBaseUrl = api;
  socketUrl = socket;
} else {
  const { api, socket } = resolveUrls(DEFAULT_API_BASE_URL);
  apiBaseUrl = api;
  socketUrl = socket;
}

export const API_BASE_URL = apiBaseUrl;
export const SOCKET_URL = socketUrl;
