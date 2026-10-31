// ─── Class name merger ────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Duration / date helpers ──────────────────────────────────────────────────

/** Convert menit ke format "1j 30m" atau "90m" */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

/** Format ISO date ke "12 Januari 2024" */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Format "2024-01-12" ke "2024" */
export function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return dateStr.slice(0, 4);
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Potong string dan tambahkan ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen).trimEnd() + "…" : str;
}

/** Capitalize huruf pertama */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── URL / video helpers ──────────────────────────────────────────────────────

export type VideoType = "youtube" | "hls" | "direct" | "unknown";

/** Deteksi tipe URL video */
export function detectVideoType(url: string): VideoType {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (path.endsWith(".m3u8") || url.toLowerCase().includes(".m3u8")) return "hls";
    if ([".mp4", ".webm", ".ogg", ".mkv", ".avi"].some((ext) => path.endsWith(ext)))
      return "direct";
  } catch {}
  return "unknown";
}

/** Validasi apakah URL video yang diterima untuk Watch Party */
export function isValidVideoUrl(url: string): boolean {
  if (!url.trim()) return false;
  const type = detectVideoType(url);
  return type !== "unknown";
}

/** Extract YouTube video ID dari berbagai format URL */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("?")[0];
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
  } catch {}
  return null;
}

// ─── Number helpers ───────────────────────────────────────────────────────────

/** Format angka ke "1.234" */
export function formatNumber(n: number): string {
  return n.toLocaleString("id-ID");
}

/** Clamp nilai dalam range [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── Object helpers ───────────────────────────────────────────────────────────

/** Sleep untuk async/await */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Debounce function */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
