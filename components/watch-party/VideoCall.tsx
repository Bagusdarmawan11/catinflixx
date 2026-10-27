"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, PhoneCall,
  ArrowLeftRight, Minimize2, Maximize2, Users, ChevronDown, X,
} from "lucide-react";
import type { VideoCallPeer, VcParticipant } from "@/hooks/useVideoCall";

// ── Toast badge auto-hilang 3 detik ──────────────────────────────────────────
function HostActionToast({ message, icon }: { message: string; icon: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white">
      {icon}
      <span>{message}</span>
    </div>
  );
}

// ── Tile helpers (shared) ─────────────────────────────────────────────────────
function LocalTile({
  stream, name, camOn, micOn, fullWidth = false,
}: {
  stream: MediaStream | null;
  name: string;
  camOn: boolean;
  micOn: boolean;
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); }
  }, [stream]);
  return (
    <div
      className={`relative bg-gray-800 overflow-hidden border border-white/10 ${
        fullWidth ? "w-full aspect-video rounded-none" : "flex-shrink-0 w-28 sm:w-32 aspect-video rounded-lg"
      }`}
    >
      {stream
        ? <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
      }
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[calc(100%-8px)]">
        {name}
      </span>
      <div className="absolute top-1 right-1 flex gap-0.5">
        {!micOn && <MicOff className="w-3 h-3 text-orange-400 drop-shadow" />}
        {!camOn && <VideoOff className="w-3 h-3 text-yellow-400 drop-shadow" />}
      </div>
    </div>
  );
}

function PeerTile({
  stream, name, fullWidth = false,
}: {
  stream: MediaStream | null;
  name: string;
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); }
  }, [stream]);
  return (
    <div
      className={`relative bg-gray-800 overflow-hidden border border-white/10 ${
        fullWidth ? "w-full aspect-video rounded-none" : "flex-shrink-0 w-28 sm:w-32 aspect-video rounded-lg"
      }`}
    >
      {stream
        ? <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
      }
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[calc(100%-8px)]">
        {name}
      </span>
    </div>
  );
}

// ── Floating VC (saat fullscreen) ─────────────────────────────────────────────
function FloatingVideoCall({
  localStream, peers, camOn, micOn, userName, isFullscreen,
  mutedByHost, camDisabledByHost,
  onToggleCam, onToggleMic, onStop,
}: {
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean; micOn: boolean;
  userName: string; isFullscreen: boolean;
  mutedByHost: boolean; camDisabledByHost: boolean;
  onToggleCam: () => void; onToggleMic: () => void; onStop: () => void;
}) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 16, y: 72 });
  const [minimized, setMinimized] = useState(false);
  const [mainIsPeer, setMainIsPeer] = useState(true);
  const SIZES = [
    { label: "S", w: 180, h: 101 },
    { label: "M", w: 240, h: 135 },
    { label: "L", w: 300, h: 169 },
  ];
  const [sizeIdx, setSizeIdx] = useState(1);
  const { w: panelW, h: mainH } = SIZES[sizeIdx];
  const peerList = Array.from(peers.values());
  const activePeer = peerList[0] ?? null;
  const mainStream = mainIsPeer ? activePeer?.stream ?? null : localStream;
  const pipStream = mainIsPeer ? localStream : activePeer?.stream ?? null;
  const mainName = mainIsPeer ? (activePeer?.name ?? "Menunggu...") : `${userName} (Kamu)`;
  const pipName = mainIsPeer ? `${userName} (Kamu)` : (activePeer?.name ?? "Menunggu...");

  useEffect(() => {
    if (mainVideoRef.current && mainStream) {
      mainVideoRef.current.srcObject = mainStream;
      mainVideoRef.current.play().catch(() => {});
    }
  }, [mainStream]);
  useEffect(() => {
    if (pipVideoRef.current && pipStream) {
      pipVideoRef.current.srcObject = pipStream;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [pipStream]);

  const dragRef = useRef<{ startX: number; startY: number; startPX: number; startPY: number } | null>(null);
  const onDragDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPX: pos.x, startPY: pos.y };
  }, [pos]);
  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - panelW, dragRef.current.startPX + e.clientX - dragRef.current.startX));
    const y = Math.max(0, Math.min(window.innerHeight - 80, dragRef.current.startPY + e.clientY - dragRef.current.startY));
    setPos({ x, y });
  }, [panelW]);
  const onDragUp = useCallback(() => { dragRef.current = null; }, []);
  const zIndex = isFullscreen ? 210 : 200;

  if (minimized) {
    return (
      <div
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex, touchAction: "none" }}
        className="bg-gray-900 border border-white/20 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-xl select-none cursor-pointer"
        onPointerDown={onDragDown} onPointerMove={onDragMove} onPointerUp={onDragUp}
        onClick={() => setMinimized(false)}
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span className="text-sm text-white font-medium">📹 VC</span>
        <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: panelW, zIndex,
        borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.9)",
        border: "1.5px solid rgba(255,255,255,0.12)", background: "#111827",
        userSelect: "none", touchAction: "none", overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900 cursor-grab active:cursor-grabbing"
        onPointerDown={onDragDown} onPointerMove={onDragMove} onPointerUp={onDragUp}
        style={{ touchAction: "none" }}
      >
        <span className="text-[11px] text-gray-400 select-none">
          📹 {peerList.length > 0 ? `${peerList.length + 1} orang` : "VC Aktif"}
        </span>
        <div className="flex items-center gap-0.5">
          {SIZES.map((s, i) => (
            <button key={s.label} onClick={(e) => { e.stopPropagation(); setSizeIdx(i); }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${sizeIdx === i ? "bg-purple-600 text-white" : "text-gray-500 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
          <button onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="ml-1 text-gray-400 hover:text-white p-1 rounded transition-colors" title="Sembunyikan">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div style={{ position: "relative", height: mainH, background: "#000" }}>
        {mainStream
          ? <video ref={mainVideoRef} autoPlay playsInline muted={!mainIsPeer}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gray-800">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{mainName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-gray-400 text-[11px]">{mainName}</span>
            </div>
        }
        <div className="absolute bottom-1 left-1 bg-black/50 rounded px-1.5 py-0.5">
          <span className="text-white text-[10px]">{mainName}</span>
        </div>
        {(localStream || activePeer) && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            width: Math.round(panelW * 0.3), height: Math.round(panelW * 0.3 * (9 / 16)),
            borderRadius: 6, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "#1f2937",
          }}>
            {pipStream
              ? <video ref={pipVideoRef} autoPlay playsInline muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <span className="text-white text-[10px] font-bold">{pipName.charAt(0).toUpperCase()}</span>
                </div>
            }
            <div className="absolute bottom-0.5 left-0.5 bg-black/50 rounded px-1">
              <span className="text-white text-[9px]">{pipName}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 py-1.5 px-2 bg-gray-900">
        <button onClick={() => setMainIsPeer((v) => !v)}
          className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-1.5" title="Tukar tampilan">
          <ArrowLeftRight className="w-3 h-3" />
        </button>
        <button onClick={onToggleCam}
          className={`rounded-full p-1.5 text-white ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600"}`}>
          {camOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
        </button>
        <button onClick={onToggleMic}
          className={`rounded-full p-1.5 text-white ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600"}`}>
          {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
        </button>
        <button onClick={onStop}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5" title="Akhiri VC">
          <PhoneOff className="w-3 h-3" />
        </button>
      </div>

      {mutedByHost && (
        <div className="px-2 pb-1.5">
          <HostActionToast message="Mic dimatikan host" icon={<MicOff className="w-3 h-3 text-orange-400" />} />
        </div>
      )}
      {camDisabledByHost && (
        <div className="px-2 pb-1.5">
          <HostActionToast message="Kamera dimatikan host" icon={<VideoOff className="w-3 h-3 text-yellow-400" />} />
        </div>
      )}
    </div>
  );
}

// ── Sidebar VC — Desktop Layout A (vertical tiles) + Mobile Layout D (drawer) ─
function SidebarVideoCall({
  localStream, peers, camOn, micOn, userName,
  mutedByHost, camDisabledByHost,
  vcParticipants,
  onStart, onStop, onToggleCam, onToggleMic,
}: {
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean; micOn: boolean;
  userName: string;
  mutedByHost: boolean; camDisabledByHost: boolean;
  vcParticipants: VcParticipant[];
  onStart: () => void; onStop: () => void;
  onToggleCam: () => void; onToggleMic: () => void;
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const peerEntries = Array.from(peers.entries());
  const totalInCall = peerEntries.length + 1; // includes self

  // ── Tidak aktif: tombol gabung ─────────────────────────────────────────────
  const joinButton = (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border-b border-white/10 shrink-0">
      <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-400">Video call tersedia</span>
        {vcParticipants.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3 text-green-400 shrink-0" />
            <span className="text-[10px] text-green-400 truncate">
              {vcParticipants.map((p) => p.userName).join(", ")} sedang di VC
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onStart}
        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        <Video className="w-3.5 h-3.5" />
        {vcParticipants.length > 0 ? "Gabung" : "Mulai"}
      </button>
    </div>
  );

  // ── Kontrol bar (shared desktop+mobile) ────────────────────────────────────
  const controls = (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 border-t border-white/10">
      <button
        onClick={onToggleCam}
        className={`p-1.5 rounded-lg border transition-colors ${
          camOn ? "bg-gray-800 border-white/10 text-gray-300" : "bg-red-600/30 border-red-500/40 text-red-400"
        }`}
        title={camOn ? "Matikan kamera" : "Nyalakan kamera"}
      >
        {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={onToggleMic}
        className={`p-1.5 rounded-lg border transition-colors ${
          micOn ? "bg-gray-800 border-white/10 text-gray-300" : "bg-red-600/30 border-red-500/40 text-red-400"
        }`}
        title={micOn ? "Matikan mic" : "Nyalakan mic"}
      >
        {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
      </button>
      <span className="text-[10px] text-gray-500 flex-1">
        {totalInCall > 1 ? `${totalInCall} orang` : "Hanya kamu"}
      </span>
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <PhoneOff className="w-3.5 h-3.5" />
        Keluar
      </button>
    </div>
  );

  // ── Toast badges ───────────────────────────────────────────────────────────
  const toasts = (
    <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
      {mutedByHost && (
        <HostActionToast message="Mic dimatikan host" icon={<MicOff className="w-3 h-3 text-orange-400" />} />
      )}
      {camDisabledByHost && (
        <HostActionToast message="Kamera dimatikan host" icon={<VideoOff className="w-3 h-3 text-yellow-400" />} />
      )}
    </div>
  );

  return (
    <>
      {/* ─── Desktop Layout A: vertikal tiles + scroll ─── */}
      <div className="hidden sm:flex flex-col shrink-0 border-b border-white/10">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border-b border-white/10">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[11px] text-gray-400">Video Call · {totalInCall} orang</span>
        </div>

        {/* Tiles: vertical, scrollable, max ~40vh */}
        <div className="overflow-y-auto" style={{ maxHeight: "42vh" }}>
          <LocalTile stream={localStream} name={`${userName} (Kamu)`} camOn={camOn} micOn={micOn} fullWidth />
          {peerEntries.map(([socketId, peer]) => (
            <PeerTile key={socketId} stream={peer.stream} name={peer.name} fullWidth />
          ))}
          {peerEntries.length === 0 && (
            <div className="w-full aspect-video bg-gray-800/60 flex items-center justify-center border-t border-white/5">
              <p className="text-[10px] text-gray-500 text-center px-2">
                Tunggu teman bergabung...
              </p>
            </div>
          )}
        </div>

        {/* Toast badges */}
        {(mutedByHost || camDisabledByHost) && toasts}

        {/* Controls */}
        {controls}
      </div>

      {/* ─── Mobile Layout D: toggle bar + bottom drawer ─── */}
      <div className="sm:hidden shrink-0">
        {/* Toggle bar — selalu terlihat */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-900/80 border-b border-white/10"
        >
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shrink-0" />
          <span className="text-xs text-gray-300 flex-1 text-left">
            📹 {totalInCall} orang di VC
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {/* Bottom drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50" style={{ touchAction: "none" }}>
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer */}
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-white/10 shadow-2xl">
              {/* Handle + header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-white">
                    Video Call · {totalInCall} orang
                  </span>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tiles: horizontal scroll di mobile */}
              <div className="flex gap-2 overflow-x-auto px-3 pb-2" style={{ scrollSnapType: "x mandatory" }}>
                <div className="flex-shrink-0 w-40 aspect-video rounded-xl overflow-hidden" style={{ scrollSnapAlign: "start" }}>
                  <LocalTile stream={localStream} name={`${userName} (Kamu)`} camOn={camOn} micOn={micOn} />
                </div>
                {peerEntries.map(([socketId, peer]) => (
                  <div key={socketId} className="flex-shrink-0 w-40 aspect-video rounded-xl overflow-hidden" style={{ scrollSnapAlign: "start" }}>
                    <PeerTile stream={peer.stream} name={peer.name} />
                  </div>
                ))}
                {peerEntries.length === 0 && (
                  <div className="flex-shrink-0 w-40 aspect-video bg-gray-800/60 rounded-xl border border-dashed border-white/20 flex items-center justify-center">
                    <p className="text-[10px] text-gray-500 text-center px-2">Tunggu teman...</p>
                  </div>
                )}
              </div>

              {/* Toast badges */}
              {(mutedByHost || camDisabledByHost) && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {mutedByHost && (
                    <HostActionToast message="Mic dimatikan host" icon={<MicOff className="w-3 h-3 text-orange-400" />} />
                  )}
                  {camDisabledByHost && (
                    <HostActionToast message="Kamera dimatikan host" icon={<VideoOff className="w-3 h-3 text-yellow-400" />} />
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="px-3 pb-4">
                {controls}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Interface ─────────────────────────────────────────────────────────────────
interface VideoCallProps {
  callActive: boolean;
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  mutedByHost: boolean;
  camDisabledByHost: boolean;
  userName: string;
  isFullscreen: boolean;
  mode?: "sidebar" | "floating";
  vcParticipants: VcParticipant[];
  onStart: () => void;
  onStop: () => void;
  onToggleCam: () => void;
  onToggleMic: () => void;
}

// ── Komponen utama ────────────────────────────────────────────────────────────
export default function VideoCall({
  callActive, localStream, peers, camOn, micOn,
  mutedByHost, camDisabledByHost,
  userName, isFullscreen,
  mode = "sidebar",
  vcParticipants,
  onStart, onStop, onToggleCam, onToggleMic,
}: VideoCallProps) {

  // ── Mode floating ──────────────────────────────────────────────────────────
  if (mode === "floating") {
    if (!isFullscreen) return null;
    if (callActive) {
      return (
        <FloatingVideoCall
          localStream={localStream} peers={peers} camOn={camOn} micOn={micOn}
          userName={userName} isFullscreen={isFullscreen}
          mutedByHost={mutedByHost} camDisabledByHost={camDisabledByHost}
          onToggleCam={onToggleCam} onToggleMic={onToggleMic} onStop={onStop}
        />
      );
    }
    return (
      <div style={{ position: "fixed", bottom: 56, right: 12, zIndex: 210 }}>
        <button
          onClick={onStart}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl transition-colors"
        >
          <Video className="w-4 h-4" />
          {vcParticipants.length > 0 ? `Gabung VC (${vcParticipants.length})` : "Mulai VC"}
        </button>
      </div>
    );
  }

  // ── Mode sidebar ───────────────────────────────────────────────────────────
  if (isFullscreen) return null;

  // Belum aktif: tampilkan join button
  if (!callActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border-b border-white/10 shrink-0">
        <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-400">Video call tersedia</span>
          {vcParticipants.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Users className="w-3 h-3 text-green-400 shrink-0" />
              <span className="text-[10px] text-green-400 truncate">
                {vcParticipants.map((p) => p.userName).join(", ")} sedang di VC
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onStart}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          {vcParticipants.length > 0 ? "Gabung" : "Mulai"}
        </button>
      </div>
    );
  }

  // Aktif: Layout A + D
  return (
    <SidebarVideoCall
      localStream={localStream}
      peers={peers}
      camOn={camOn}
      micOn={micOn}
      userName={userName}
      mutedByHost={mutedByHost}
      camDisabledByHost={camDisabledByHost}
      vcParticipants={vcParticipants}
      onStart={onStart}
      onStop={onStop}
      onToggleCam={onToggleCam}
      onToggleMic={onToggleMic}
    />
  );
}
