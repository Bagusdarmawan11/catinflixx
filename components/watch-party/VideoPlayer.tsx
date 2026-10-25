"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  ExternalLink,
  Maximize,
  Minimize,
} from "lucide-react";
import type { VideoState } from "@/hooks/useWatchParty";

interface Props {
  videoUrl: string;
  videoTitle: string;
  videoState: VideoState;
  isHost: boolean;
  onControl: (isPlaying: boolean, currentTime: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  // ID unik untuk player agar tidak konflik jika ada >1 instance
  playerId?: string;
}

// Default player ID — boleh di-override lewat prop
const DEFAULT_PLAYER_ID = "catinflix-yt-player";

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com"))
      return parsed.searchParams.get("v");
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false); // FIX: gate progress bar updates
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syncLockRef = useRef(false);

  // Simpan videoState terbaru di ref supaya onReady bisa akses tanpa stale closure
  const videoStateRef = useRef(videoState);
  useEffect(() => {
    videoStateRef.current = videoState;
  }, [videoState]);

  const videoId = extractYouTubeId(videoUrl);

  // ─── FULLSCREEN HELPERS ───────────────────────────────────────────────────

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    // FIX: gunakan native requestFullscreen + orientation lock
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } catch {}
    // Lock landscape setelah native fullscreen aktif (delay kecil)
    setTimeout(async () => {
      try {
        const scr = window.screen as any;
        if (scr.orientation?.lock) await scr.orientation.lock("landscape");
      } catch {}
    }, 100);
  }, []);

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

  // FIX: Sync state ke native fullscreen change (misal user tekan Esc)
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

  // Cleanup orientation saat unmount
  useEffect(() => {
    return () => {
      exitFullscreen();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── YOUTUBE IFRAME API ───────────────────────────────────────────────────

  // Load YouTube IFrame API sekali
  useEffect(() => {
    if ((window as any).YT?.Player) {
      setApiReady(true);
      return;
    }
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

  // Init / reinit player saat apiReady atau videoId berubah
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
          fs: 0, // kita handle fullscreen sendiri
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            // FIX: simpan e.target (player siap pakai)
            playerRef.current = e.target;

            // Force iframe fill container agar tidak hitam di mobile
            try {
              const iframe = e.target.getIframe();
              if (iframe) {
                iframe.style.cssText =
                  "width:100%!important;height:100%!important;display:block;position:absolute;top:0;left:0;";
              }
            } catch {}

            // Update durasi
            const dur = e.target.getDuration?.() || 0;
            if (dur > 0) setDuration(dur);

            // Apply videoState untuk guest saat player pertama ready
            if (!isHost) {
              const state = videoStateRef.current;
              const serverTime =
                state.currentTime + (Date.now() - state.updatedAt) / 1000;
              try {
                e.target.seekTo(serverTime, true);
                if (state.isPlaying) e.target.playVideo();
                else e.target.pauseVideo();
              } catch {}
            }

            playerReadyRef.current = true;
            setPlayerReady(true);

            // Retry getDuration setelah 2s jika masih 0 (streaming/lazy load)
            setTimeout(() => {
              try {
                const d = playerRef.current?.getDuration?.();
                if (d && d > 0) setDuration(d);
              } catch {}
            }, 2000);
          },
          onStateChange: (e: any) => {
            const YT = (window as any).YT?.PlayerState;
            if (!YT) return;
            if (e.data === YT.PLAYING) {
              setIsPlaying(true);
              // FIX: update currentTime saat mulai play
              try {
                const ct = playerRef.current?.getCurrentTime?.();
                if (typeof ct === "number") setCurrentTime(ct);
                const dur = playerRef.current?.getDuration?.();
                if (typeof dur === "number" && dur > 0) setDuration(dur);
              } catch {}
            }
            if (e.data === YT.PAUSED || e.data === YT.ENDED)
              setIsPlaying(false);
            if (isHost && !syncLockRef.current) {
              const playing = e.data === YT.PLAYING;
              const ct = playerRef.current?.getCurrentTime?.() ?? 0;
              onControl(playing, ct);
            }
          },
        },
      });
    }, 200);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId]);

  // Sync state dari socket (untuk guest)
  useEffect(() => {
    if (!playerRef.current || isHost || !playerReady) return;
    syncLockRef.current = true;
    const p = playerRef.current;
    const serverTime =
      videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
    const clientTime = p.getCurrentTime?.() ?? 0;
    if (Math.abs(serverTime - clientTime) > 3) p.seekTo?.(serverTime, true);
    if (videoState.isPlaying) p.playVideo?.();
    else p.pauseVideo?.();
    setTimeout(() => { syncLockRef.current = false; }, 500);
  }, [videoState, isHost, playerReady]);

  // FIX: Progress bar — update tiap 500ms, gate dengan playerReadyRef
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerReadyRef.current || !playerRef.current) return;
      try {
        const ct = playerRef.current.getCurrentTime?.();
        const dur = playerRef.current.getDuration?.();
        if (typeof ct === "number") setCurrentTime(ct);
        if (typeof dur === "number" && dur > 0) setDuration(dur);
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ─── CONTROLS ────────────────────────────────────────────────────────────

  function togglePlay() {
    if (!isHost || !playerRef.current) return;
    const YT = (window as any).YT?.PlayerState;
    const p = playerRef.current;
    const playing = p.getPlayerState?.() === YT?.PLAYING;
    if (playing) {
      p.pauseVideo?.();
      onControl(false, p.getCurrentTime?.() ?? 0);
    } else {
      p.playVideo?.();
      onControl(true, p.getCurrentTime?.() ?? 0);
    }
  }

  function toggleMute() {
    if (!playerRef.current) return;
    if (muted) playerRef.current.unMute?.();
    else playerRef.current.mute?.();
    setMuted(!muted);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isHost || !playerRef.current) return;
    const t = Number(e.target.value);
    playerRef.current.seekTo?.(t, true);
    onControl(isPlaying, t);
  }

  function restart() {
    if (!isHost || !playerRef.current) return;
    playerRef.current.seekTo?.(0, true);
    onControl(false, 0);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
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
    <div
      ref={containerRef}
      className="flex flex-col bg-black h-full w-full"
    >
      {/* YouTube Player Area */}
      <div className="relative flex-1 bg-black min-h-0 overflow-hidden">
        {/* FIX: player div pakai absolute fill agar iframe dapat height yang benar di mobile */}
        <div
          style={{ position: "absolute", inset: 0, overflow: "hidden" }}
        >
          <div
            id={playerId}
            style={{ width: "100%", height: "100%", display: "block", position: "relative" }}
          />
        </div>

        {/* Overlay "Menghubungkan video..." — hanya untuk guest sebelum player ready */}
        {!playerReady && !isHost && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 pointer-events-none">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-400">Menghubungkan video...</p>
            </div>
          </div>
        )}

        {/* Tombol fullscreen — kanan bawah */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 transition-colors"
          title={isFullscreen ? "Keluar fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>

        {/* Tombol exit fullscreen — kiri atas (saat fullscreen) */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 left-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 transition-colors"
          >
            <Minimize className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Custom Controls */}
      <div className="bg-gray-950 border-t border-white/10 px-3 sm:px-4 py-2 sm:py-3 space-y-1.5 shrink-0">
        <p className="text-xs sm:text-sm font-medium text-white truncate">
          {videoTitle}
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-gray-400 w-9 shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            disabled={!isHost}
            className="flex-1 h-1 accent-purple-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          />
          <span className="text-xs text-gray-400 w-9 shrink-0 text-right">
            {formatTime(duration)}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isHost && (
            <>
              <button
                onClick={restart}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-1.5 sm:p-2 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </>
          )}
          <button
            onClick={toggleMute}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          {!isHost && (
            <span className="text-[10px] sm:text-xs text-gray-500 italic">
              Hanya host yang bisa mengontrol video
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
