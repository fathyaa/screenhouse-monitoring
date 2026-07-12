import { API_URL } from "../config/api";
import { clearSession } from "./auth";

// Interceptor 401 global. Semua call site memakai `fetch(`${API_URL}/...`)`
// tanpa wrapper terpusat, jadi cara paling ringkas & menyeluruh adalah
// membungkus `window.fetch` sekali di entry point. Saat token kadaluarsa di
// tengah sesi, response 401 pertama langsung membersihkan sesi & memaksa login
// ulang — bukan menampilkan halaman dengan data kosong.

let redirecting = false;

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return "";
}

function isApiRequest(url) {
  return typeof url === "string" && url.startsWith(API_URL);
}

function handleUnauthorized() {
  // Cegah trigger ganda + loop saat sudah di halaman login.
  if (redirecting) return;
  if (window.location.pathname.startsWith("/login")) return;

  redirecting = true;
  clearSession();
  window.dispatchEvent(new Event("auth-changed"));
  // Full navigation supaya seluruh state React/socket ikut ter-reset bersih.
  window.location.replace("/login");
}

/** Pasang sekali sebelum render. Idempoten. */
export function installAuthInterceptor() {
  if (typeof window === "undefined" || window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);

    // Hanya tangani 401 dari API kita, dan hanya bila kita memang mengira
    // sedang login (ada token) — 401 salah-password di halaman login diurus
    // sendiri oleh LoginPage, jangan diintervensi di sini.
    if (
      response.status === 401 &&
      isApiRequest(requestUrl(input)) &&
      localStorage.getItem("token")
    ) {
      handleUnauthorized();
    }

    return response;
  };
}
