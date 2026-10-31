"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink, Maximize, Minimize, Lock, Loader2 } from "lucide-react";
import { detectVideoType, extractYouTubeId, type VideoType } from "@/lib/utils";
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

/** Toleransi selisih waktu (detik) sebelum paksa seek */
const SYNC_THRESHOLD = 2;

const DEFAULT_PLAYER_ID = "catinflix-yt-player";

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

  // YouTube
  const ytPlayerRef = useRef<any>(null);
  const [ytApiReady, setYtApiReady] = useState(false);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);

  // HLS / Direct
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stable refs untuk callbacks
  const isHostRef = useRef(isHost);
  const onControlRef = useRef(onControl);
  const videoStateRef = useRef(videoState);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { onControlRef.current = onControl; }, [onControl]);
  useEffect(() => { videoStateRef.current = videoState; }, [videoState]);

  const videoType: VideoType = detectVideoType(videoUrl);
  const youtubeId = videoType === "youtube" ? extractYouTubeId(videoUrl) : null;

  // ── FULLSCREEN ──────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    const el = fullscreenContainerRef?.current ?? containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch {}
    setTimeout(async () => {
      try {
        const scr = window.screen as any;
        if (scr.orientation?.lock) await scr.orientation.lock("landscape");
      } catch {}
    }, 100);
  }, [fullscreenContainerRef]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsFullscreen(fs);
      onFullscreenChange?.(fs);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [onFullscreenChange]);

  // ── YOUTUBE — Load API ───────────────────────────────────────────────────────
  useEffect(() => {
    if (videoType !== "youtube") return;
    if ((window as any).YT?.Player) { setYtApiReady(true); return; }

    const existing = document.getElementById("yt-api-script");
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "yt-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
      prev?.();
    };
    return () => {
      if ((window as any).onYouTubeIframeAPIReady === setYtApiReady) {
        delete (window as any).onYouTubeIframeAPIReady;
      }
    };
  }, [videoType]);

  // ── YOUTUBE — Init Player ────────────────────────────────────────────────────
  useEffect(() => {
    if (videoType !== "youtube" || !ytApiReady || !youtubeId) return;

    setYtPlayerReady(false);
    setLoading(true);

    // Bersihkan player lama
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }

    // Pastikan div container ada
    const divId = playerId;
    let div = document.getElementById(divId);
    if (!div) {
      div = document.createElement("div");
      div.id = divId;
      containerRef.current?.appendChild(div);
    } else {
      containerRef.current?.appendChild(div);
    }

    const player = new (window as any).YT.Player(divId, {
      videoId: youtubeId,
      width: "100%",
      height: "100%",
      playerVars: {
        controls: isHost ? 1 : 0,
        fs: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        enablejsapi: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          setYtPlayerReady(true);
          setLoading(false);
        },
        onStateChange: (e: any) => {
          if (!isHostRef.current) return;
          const YT = (window as any).YT;
          if (e.data === YT.PlayerState.PLAYING) {
            onControlRef.current(true, player.getCurrentTime());
          } else if (e.data === YT.PlayerState.PAUSED) {
            onControlRef.current(false, player.getCurrentTime());
          }
        },
        onError: () => setLoading(false),
      },
    });
    ytPlayerRef.current = player;

    return () => {
      try { player.destroy(); } catch {}
      ytPlayerRef.current = null;
      setYtPlayerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoType, ytApiReady, youtubeId, playerId]);

  // ── YOUTUBE — Sync videoState ────────────────────────────────────────────────
  useEffect(() => {
    if (videoType !== "youtube" || !ytPlayerReady || !ytPlayerRef.current) return;

    const player = ytPlayerRef.current;
    const { isPlaying, currentTime, updatedAt } = videoState;
    const YT = (window as any).YT;

    try {
      const elapsed = (Date.now() - updatedAt) / 1000;
      const targetTime = isPlaying ? currentTime + elapsed : currentTime;
      const curTime: number = player.getCurrentTime?.() ?? 0;

      if (Math.abs(curTime - targetTime) > SYNC_THRESHOLD) {
        player.seekTo?.(targetTime, true);
      }

      const state: number = player.getPlayerState?.() ?? -1;
      if (isPlaying && state !== YT?.PlayerState.PLAYING) {
        player.playVideo?.();
      } else if (!isPlaying && state === YT?.PlayerState.PLAYING) {
        player.pauseVideo?.();
      }
    } catch {}
  }, [videoState, ytPlayerReady, videoType]);

  // ── HLS / DIRECT — Setup player ─────────────────────────────────────────────
  useEffect(() => {
    if (videoType !== "hls" && videoType !== "direct") return;
    const video = videoRef.current;
    if (!video) return;

    setPlayerReady(false);
    setLoading(true);

    // Bersihkan HLS instance lama
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    async function setup() {
      if (videoType === "hls") {
        try {
          // Dynamic import — hls.js harus sudah diinstall (npm install hls.js)
          const HlsModule = await import("hls.js");
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
            hls.loadSource(videoUrl);
            hls.attachMedia(video!);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setPlayerReady(true);
              setLoading(false);
            });
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) setLoading(false);
            });
            hlsRef.current = hls;
          } else if (video!.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari native HLS
            video!.src = videoUrl;
            setPlayerReady(true);
            setLoading(false);
          } else {
            setLoading(false);
          }
        } catch {
          // hls.js belum terinstall — coba native
          video!.src = videoUrl;
          setPlayerReady(true);
          setLoading(false);
        }
      } else {
        // Direct video (mp4, webm, dll.)
        video!.src = videoUrl;
        setPlayerReady(true);
        setLoading(false);
      }
    }

    setup();

    return () => {
      try { hlsRef.current?.destroy(); } catch {}
      hlsRef.current = null;
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
      setPlayerReady(false);
    };
  }, [videoUrl, videoType]);

  // ── HLS / DIRECT — Sync videoState ──────────────────────────────────────────
  useEffect(() => {
    if (videoType === "youtube" || !playerReady) return;
    const video = videoRef.current;
    if (!video) return;

    const { isPlaying, currentTime, updatedAt } = videoState;
    const elapsed = (Date.now() - updatedAt) / 1000;
    const targetTime = isPlaying ? currentTime + elapsed : currentTime;

    if (Math.abs(video.currentTime - targetTime) > SYNC_THRESHOLD) {
      video.currentTime = targetTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [videoState, playerReady, videoType]);

  // ── HLS / DIRECT — Host event handlers ──────────────────────────────────────
  const handleVideoPlay = useCallback(() => {
    if (!isHostRef.current) return;
    onControlRef.current(true, videoRef.current?.currentTime ?? 0);
  }, []);

  const handleVideoPause = useCallback(() => {
    if (!isHostRef.current) return;
    onControlRef.current(false, videoRef.current?.currentTime ?? 0);
  }, []);

  const handleVideoSeeked = useCallback(() => {
    if (!isHostRef.current) return;
    const v = videoRef.current;
    onControlRef.current(!(v?.paused ?? true), v?.currentTime ?? 0);
  }, []);

  const handleVideoCanPlay = useCallback(() => {
    setLoading(false);
  }, []);

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
    >
      {/* ── YouTube Player ───────────────────────────────────────────────── */}
      {videoType === "youtube" && (
        <div id={playerId} className="w-full h-full" />
      )}

      {/* ── HLS / Direct Video ───────────────────────────────────────────── */}
      {(videoType === "hls" || videoType === "direct") && (
        <>
          <video
            ref={videoRef}
            className="w-full h-full"
            controls={isHost}
            playsInline
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onSeeked={handleVideoSeeked}
            onCanPlay={handleVideoCanPlay}
            controlsList="nodownload nofullscreen"
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Overlay untuk non-host: cegah interaksi */}
          {!isHost && (
            <div
              className="absolute inset-0 cursor-default select-none"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </>
      )}

      {/* ── URL tidak dikenali ────────────────────────────────────────────── */}
      {videoType === "unknown" && (
        <div className="flex flex-col items-center gap-3 text-gray-400 p-8 text-center">
          <ExternalLink className="w-10 h-10" />
          <p className="text-sm font-medium">Format URL tidak dikenali</p>
          <p className="text-xs text-gray-600">
            Dukung: YouTube, HLS (.m3u8), MP4/WebM
          </p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 underline text-xs mt-1"
          >
            Buka di tab baru
          </a>
        </div>
      )}

      {/* ── Loading spinner ───────────────────────────────────────────────── */}
      {loading && videoType !== "unknown" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          <p className="text-gray-400 text-sm truncate max-w-xs px-4">{videoTitle}</p>
        </div>
      )}

      {/* ── Non-host indicator ───────────────────────────────────────────── */}
      {!isHost && !loading && videoType !== "unknown" && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-lg px-2.5 py-1.5 pointer-events-none">
          <Lock className="w-3 h-3 text-gray-400" />
          <span className="text-gray-400 text-xs">Kontrol hanya untuk host</span>
        </div>
      )}

      {/* ── Fullscreen button ─────────────────────────────────────────────── */}
      <button
        onClick={isFullscreen ? exitFullscreen : enterFullscreen}
        className="absolute bottom-3 right-3 z-20 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
        title={isFullscreen ? "Keluar fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <Minimize className="w-4 h-4" />
        ) : (
          <Maximize className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
