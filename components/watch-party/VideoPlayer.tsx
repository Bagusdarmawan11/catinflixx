"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, Maximize, Minimize } from "lucide-react";
import type { VideoState } from "@/hooks/useWatchParty";

interface Props {
  videoUrl: string;
  videoTitle: string;
  videoState: VideoState;
  isHost: boolean;
  onControl: (isPlaying: boolean, currentTime: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  playerId?: string;
  fullscreenContainerRef?: React.RefObject<HTMLDivElement>;
}

const DEFAULT_PLAYER_ID = "catinflix-yt-player";

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
  } catch {}
  return null;
}

export default function VideoPlayer({
  videoUrl,
  videoTitle,
  videoState,
  isHost,
  onControl,
  onFullscreenChange,
  playerId = DEFAULT_PLAYER_ID,
  fullscreenContainerRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syncLockRef = useRef(false);

  const videoStateRef = useRef(videoState);
  useEffect(() => { videoStateRef.current = videoState; }, [videoState]);

  const videoId = extractYouTubeId(videoUrl);

  // ─── FULLSCREEN ───────────────────────────────────────────────────────────
  /*
   * FIX FULLSCREEN YOUTUBE:
   * Masalah sebelumnya: YouTube iframe tidak mengisi layar penuh karena
   * container-nya tidak di-stretch saat fullscreen.
   *
   * Sekarang:
   * 1. fullscreenContainerRef (outer div seluruh halaman) di-fullscreen,
   *    bukan hanya div video — agar FloatingVC ikut muncul.
   * 2. YouTube iframe diberi style width/height 100% via CSS + attribute.
   * 3. page.tsx memberi class "w-full h-full" ke area video saat isFullscreen=true,
   *    sehingga YouTube iframe benar-benar mengisi seluruh layar.
   * 4. playerVars.fs=1 diaktifkan agar tombol fullscreen native YouTube juga tersedia
   *    sebagai fallback.
   */
  const enterFullscreen = useCallback(async () => {
    const el = fullscreenContainerRef?.current ?? containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch {}
    // Kunci orientasi landscape di mobile
    setTimeout(async () => {
      try {
        const scr = window.screen as any;
        if (scr.orientation?.lock) await scr.orientation.lock("landscape");
      } catch {}
    }, 100);
  }, [fullscreenContainerRef]);

  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      }
    } catch {}
    try {
      const scr = window.screen as any;
      if (scr.orientation?.unlock) scr.orientation.unlock();
    } catch {}
  }, []);

  // Deteksi fullscreen keluar dari tombol ESC / swipe native browser
  useEffect(() => {
    const handleFSChange = () => {
      const doc = document as any;
      const nativeFS = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!nativeFS && isFullscreen) {
        setIsFullscreen(false);
        onFullscreenChange?.(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFSChange);
    document.addEventListener("webkitfullscreenchange", handleFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFSChange);
      document.removeEventListener("webkitfullscreenchange", handleFSChange);
    };
  }, [isFullscreen, onFullscreenChange]);

  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    onFullscreenChange?.(next);
    if (next) enterFullscreen();
    else exitFullscreen();
  }, [isFullscreen, onFullscreenChange, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    return () => { exitFullscreen(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── YOUTUBE IFRAME API ───────────────────────────────────────────────────
  useEffect(() => {
    if ((window as any).YT?.Player) { setApiReady(true); return; }
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        setApiReady(true);
      };
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  useEffect(() => {
    if (!apiReady || !videoId) return;
    setPlayerReady(false);
    playerReadyRef.current = false;

    const timer = setTimeout(() => {
      const el = document.getElementById(playerId);
      if (!el) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }

      playerRef.current = new (window as any).YT.Player(playerId, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          disablekb: isHost ? 0 : 1,
          // FIX: fs=1 agar tombol fullscreen native YouTube tersedia sebagai fallback
          fs: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            playerRef.current = e.target;
            try {
              const iframe = e.target.getIframe();
              if (iframe) {
                // FIX: Paksa iframe mengisi 100% width dan height container-nya
                iframe.style.cssText =
                  "width:100%!important;height:100%!important;display:block;position:absolute;top:0;left:0;border:none;";
                iframe.setAttribute("width", "100%");
                iframe.setAttribute("height", "100%");
              }
            } catch {}

            if (!isHost) {
              const state = videoStateRef.current;
              const serverTime = state.currentTime + (Date.now() - state.updatedAt) / 1000;
              try {
                e.target.seekTo(serverTime, true);
                if (state.isPlaying) e.target.playVideo();
                else e.target.pauseVideo();
              } catch {}
            }

            playerReadyRef.current = true;
            setPlayerReady(true);
          },
          onStateChange: (e: any) => {
            const YT = (window as any).YT?.PlayerState;
            if (!YT) return;
            if (isHost && !syncLockRef.current) {
              const { PLAYING, PAUSED, ENDED, UNSTARTED } = YT;
              const relevantStates = [PLAYING, PAUSED, ENDED, UNSTARTED];
              if (!relevantStates.includes(e.data)) return;
              const playing = e.data === PLAYING;
              const ct = playerRef.current?.getCurrentTime?.() ?? 0;
              onControl(playing, ct);
            }
          },
        },
      });
    }, 200);

    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId]);

  // Sync state dari socket (untuk guest)
  useEffect(() => {
    if (!playerRef.current || isHost || !playerReady) return;
    syncLockRef.current = true;
    const p = playerRef.current;
    const serverTime = videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
    const clientTime = p.getCurrentTime?.() ?? 0;
    if (Math.abs(serverTime - clientTime) > 3) p.seekTo?.(serverTime, true);
    if (videoState.isPlaying) p.playVideo?.();
    else p.pauseVideo?.();
    setTimeout(() => { syncLockRef.current = false; }, 500);
  }, [videoState, isHost, playerReady]);

  function toggleMute() {
    if (!playerRef.current) return;
    const isMuted = playerRef.current.isMuted?.();
    if (isMuted) playerRef.current.unMute?.();
    else playerRef.current.mute?.();
  }

  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4 text-gray-400">
        <p className="text-lg">URL video tidak valid</p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-purple-400 hover:underline text-sm"
        >
          <ExternalLink className="w-4 h-4" /> Buka di browser
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative bg-black h-full w-full">
      {/* FIX: Container iframe harus absolute inset-0 agar mengisi seluruh parent */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div
          id={playerId}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            position: "relative",
          }}
        />
      </div>

      {/* Loading overlay untuk guest sebelum player ready */}
      {!playerReady && !isHost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 pointer-events-none">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Menghubungkan video...</p>
          </div>
        </div>
      )}

      {/* Tombol fullscreen — masuk & keluar di pojok kanan bawah */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 transition-colors"
        title={isFullscreen ? "Keluar fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Info host-only hint (saat tidak fullscreen) */}
      {!isFullscreen && !isHost && (
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
          <span className="text-[10px] text-gray-500 bg-black/40 px-1.5 py-0.5 rounded">
            Hanya host yang bisa mengontrol video
          </span>
        </div>
      )}
    </div>
  );
}
