export const SUPPORTED_LOCALES = ["en", "it"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_STORAGE_KEY = "app_locale";
export const LOCALE_COOKIE_KEY = "APP_LOCALE";

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const base = lower.split("-")[0];
  if (base === "en" || base === "it") return base;
  return null;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (!part) continue;
    const [k, ...rest] = part.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function getPersistedLocale(): SupportedLocale | null {
  const cookieLocale = normalizeLocale(readCookie(LOCALE_COOKIE_KEY));
  if (cookieLocale) return cookieLocale;

  if (typeof window === "undefined") return null;
  try {
    const stored = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // ignore
  }
  return null;
}

export function persistLocale(locale: SupportedLocale) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }
  writeCookie(LOCALE_COOKIE_KEY, locale);
}

export function detectLocale(): SupportedLocale {
  const persisted = getPersistedLocale();
  if (persisted) return persisted;

  if (typeof navigator !== "undefined") {
    const detected = normalizeLocale(navigator.language);
    if (detected) return detected;
  }
  return DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): { locale: SupportedLocale | null; restPath: string } {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  const locale = normalizeLocale(first);
  if (!locale) return { locale: null, restPath: pathname.startsWith("/") ? pathname : `/${pathname}` };
  const rest = "/" + parts.slice(1).join("/");
  return { locale, restPath: rest === "/" ? "/" : rest };
}

export function withLocalePrefix(locale: SupportedLocale, to: string): string {
  if (!to) return `/${locale}`;
  if (to.startsWith("http://") || to.startsWith("https://") || to.startsWith("//")) return to;
  if (!to.startsWith("/")) return `/${locale}/${to}`;
  const { locale: existing } = stripLocalePrefix(to);
  if (existing) return to;
  if (to === "/") return `/${locale}`;
  return `/${locale}${to}`;
}

