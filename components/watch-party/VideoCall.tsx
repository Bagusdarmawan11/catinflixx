"use client";

import { useEffect, useRef } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, PhoneCall } from "lucide-react";
import type { VideoCallPeer } from "@/hooks/useVideoCall";

// ── Komponen satu tile video ──────────────────────────────────────────────────
function VideoTile({
  stream,
  name,
  muted = false,
}: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800 rounded-lg overflow-hidden border border-white/10">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded truncate max-w-[90%]">
        {name}
      </span>
    </div>
  );
}

// ── Komponen utama VideoCall ──────────────────────────────────────────────────
interface VideoCallProps {
  callActive: boolean;
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  userName: string;
  onStart: () => void;
  onStop: () => void;
  onToggleCam: () => void;
  onToggleMic: () => void;
}

export default function VideoCall({
  callActive,
  localStream,
  peers,
  camOn,
  micOn,
  userName,
  onStart,
  onStop,
  onToggleCam,
  onToggleMic,
}: VideoCallProps) {
  const peerList = Array.from(peers.values());

  if (!callActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border-t border-white/10">
        <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-xs text-gray-400 flex-1">Video call tersedia</span>
        <button
          onClick={onStart}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Mulai
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 border-t border-white/10 px-3 py-2 space-y-2">
      {/* Baris tiles video */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Tile lokal (muted=true supaya tidak feedback) */}
        <VideoTile stream={localStream} name={`${userName} (Kamu)`} muted={true} />

        {/* Tiles remote peers */}
        {peerList.map((peer) => (
          <VideoTile
            key={peer.userId}
            stream={peer.stream}
            name={peer.name}
          />
        ))}

        {/* Placeholder kalau belum ada peer */}
        {peerList.length === 0 && (
          <div className="flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800/60 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
            <p className="text-[10px] text-gray-500 text-center px-1">
              Tunggu pasangan join…
            </p>
          </div>
        )}
      </div>

      {/* Kontrol */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleCam}
          className={`p-1.5 rounded-lg border transition-colors ${
            camOn
              ? "bg-gray-800 border-white/10 text-gray-300 hover:text-white"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
          title={camOn ? "Matikan kamera" : "Nyalakan kamera"}
        >
          {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded-lg border transition-colors ${
            micOn
              ? "bg-gray-800 border-white/10 text-gray-300 hover:text-white"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
          title={micOn ? "Matikan mic" : "Nyalakan mic"}
        >
          {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[10px] text-gray-500 flex-1">
          {peerList.length > 0
            ? `${peerList.length + 1} orang di call`
            : "Hanya kamu di call"}
        </span>

        <button
          onClick={onStop}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Keluar
        </button>
      </div>
    </div>
  );
}
