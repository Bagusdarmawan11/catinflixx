"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, Volume2, VolumeX, ExternalLink } from "lucide-react";
import type { VideoState } from "@/hooks/useWatchParty";

interface Props {
  videoUrl: string;
  videoTitle: string;
  videoState: VideoState;
  isHost: boolean;
  onControl: (isPlaying: boolean, currentTime: number) => void;
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {}
  return null;
}

export default function VideoPlayer({ videoUrl, videoTitle, videoState, isHost, onControl }: Props) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const syncLockRef = useRef(false);

  const videoId = extractYouTubeId(videoUrl);

  // Load YouTube IFrame API
  useEffect(() => {
    if ((window as any).YT?.Player) {
      setApiReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  // Init / re-init player
  useEffect(() => {
    if (!apiReady || !videoId || !playerDivRef.current) return;
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new (window as any).YT.Player(playerDivRef.current, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,         // selalu tampilkan native controls agar mobile bisa fullscreen
        modestbranding: 1,
        rel: 0,
        disablekb: isHost ? 0 : 1,
        fs: 1,               // aktifkan fullscreen button
        playsinline: 0,      // di iOS, biarkan buka fullscreen native
      },
      events: {
        onReady: (e: any) => {
          setDuration(e.target.getDuration());
        },
        onStateChange: (e: any) => {
          const YT = (window as any).YT.PlayerState;
          if (e.data === YT.PLAYING) setIsPlaying(true);
          if (e.data === YT.PAUSED || e.data === YT.ENDED) setIsPlaying(false);

          // Host broadcasts state changes
          if (isHost && !syncLockRef.current) {
            const playing = e.data === YT.PLAYING;
            const ct = playerRef.current?.getCurrentTime() ?? 0;
            onControl(playing, ct);
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId]);

  // Sync dari socket (non-host)
  useEffect(() => {
    if (!playerRef.current || isHost) return;
    syncLockRef.current = true;

    const p = playerRef.current;
    const serverTime = videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
    const clientTime = p.getCurrentTime?.() ?? 0;

    if (Math.abs(serverTime - clientTime) > 3) {
      p.seekTo?.(serverTime, true);
    }

    if (videoState.isPlaying) {
      p.playVideo?.();
    } else {
      p.pauseVideo?.();
    }

    setTimeout(() => { syncLockRef.current = false; }, 500);
  }, [videoState, isHost]);

  // Progress tracker
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration() || 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function togglePlay() {
    if (!isHost || !playerRef.current) return;
    const p = playerRef.current;
    const playing = p.getPlayerState() === (window as any).YT?.PlayerState?.PLAYING;
    if (playing) {
      p.pauseVideo();
      onControl(false, p.getCurrentTime());
    } else {
      p.playVideo();
      onControl(true, p.getCurrentTime());
    }
  }

  function toggleMute() {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }
    setMuted(!muted);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isHost || !playerRef.current) return;
    const t = Number(e.target.value);
    playerRef.current.seekTo(t, true);
    onControl(isPlaying, t);
  }

  function restart() {
    if (!isHost || !playerRef.current) return;
    playerRef.current.seekTo(0, true);
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
    <div className="flex flex-col h-full bg-black">
      {/* Video iframe — full height, tanpa overlay yang menghalangi */}
      <div className="relative flex-1 bg-black min-h-0">
        <div className="w-full h-full">
          {/* YT API mengganti div ini dengan iframe */}
          <div ref={playerDivRef} className="w-full h-full" />
        </div>
        {/* 
          TIDAK ada overlay div untuk guest agar:
          1. Tombol fullscreen YouTube bisa diklik di mobile
          2. Guest tetap bisa mute/unmute via native controls
          Kontrol play/pause guest diblok via disablekb + controls terbatas di playerVars
        */}
      </div>

      {/* Custom Controls (tambahan di bawah player) */}
      <div className="bg-gray-950 border-t border-white/10 px-3 sm:px-4 py-2 sm:py-3 space-y-1.5 shrink-0">
        <p className="text-xs sm:text-sm font-medium text-white truncate">{videoTitle}</p>

        {/* Progress bar — hanya host yang bisa seek */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-gray-400 w-9 shrink-0">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            disabled={!isHost}
            className="flex-1 h-1 accent-purple-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          />
          <span className="text-xs text-gray-400 w-9 shrink-0 text-right">{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isHost && (
            <>
              <button
                onClick={restart}
                className="text-gray-400 hover:text-white transition-colors"
                title="Mulai ulang"
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
          <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
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
            title="Buka di YouTube"
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
