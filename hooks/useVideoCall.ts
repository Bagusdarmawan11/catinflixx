"use client";

import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import type { Socket } from "socket.io-client";

export interface VideoCallPeer {
  userId: number;
  name: string;
  stream: MediaStream | null;
}

export interface VcParticipant {
  socketId: string;
  userId: number;
  userName: string;
}

interface UseVideoCallOptions {
  socketRef: MutableRefObject<Socket | null>;
  roomCode: string;
  userId: number;
  userName: string;
}

function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl.split(",").map((s) => s.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return { iceServers, iceCandidatePoolSize: 4 };
}

const DISCONNECT_GRACE_MS = 10000;
const MAX_REJOIN_ATTEMPTS = 5;

export function useVideoCall({
  socketRef,
  roomCode,
  userId,
  userName,
}: UseVideoCallOptions) {
  const [callActive, setCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, VideoCallPeer>>(new Map());
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [vcParticipants, setVcParticipants] = useState<VcParticipant[]>([]);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const callActiveRef = useRef(false);
  const rejoinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejoinAttemptsRef = useRef(0);

  const idRef = useRef({ roomCode, userId, userName });
  idRef.current = { roomCode, userId, userName };

  const clearDisconnectTimer = useCallback((socketId: string) => {
    const t = disconnectTimersRef.current.get(socketId);
    if (t) { clearTimeout(t); disconnectTimersRef.current.delete(socketId); }
  }, []);

  const removePeer = useCallback(
    (socketId: string) => {
      clearDisconnectTimer(socketId);
      pendingCandidatesRef.current.delete(socketId);
      const pc = pcsRef.current.get(socketId);
      if (pc) {
        pc.onconnectionstatechange = null;
        pc.ontrack = null;
        pc.onicecandidate = null;
        try { pc.close(); } catch {}
        pcsRef.current.delete(socketId);
      }
      setPeers((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    },
    [clearDisconnectTimer]
  );

  const removeAllPeers = useCallback(() => {
    Array.from(pcsRef.current.keys()).forEach((id) => removePeer(id));
    pendingCandidatesRef.current.clear();
  }, [removePeer]);

  const scheduleRejoin = useCallback(() => {
    if (rejoinTimerRef.current) return;
    if (rejoinAttemptsRef.current >= MAX_REJOIN_ATTEMPTS) return;
    rejoinTimerRef.current = setTimeout(() => {
      rejoinTimerRef.current = null;
      const socket = socketRef.current;
      if (!callActiveRef.current || !localStreamRef.current || !socket?.connected) return;
      rejoinAttemptsRef.current += 1;
      removeAllPeers();
      const { roomCode: rc, userId: uid, userName: un } = idRef.current;
      socket.emit("vc:leave", { roomCode: rc, userId: uid });
      socket.emit("vc:join", { roomCode: rc, userId: uid, userName: un });
    }, 1000 + Math.random() * 1000);
  }, [socketRef, removeAllPeers]);

  const handlePeerFailure = useCallback(
    (socketId: string) => {
      removePeer(socketId);
      const myId = socketRef.current?.id ?? "";
      if (callActiveRef.current && myId > socketId) scheduleRejoin();
    },
    [removePeer, scheduleRejoin, socketRef]
  );

  const createPeerConnection = useCallback(
    (targetSocketId: string, targetUserId: number, targetName: string) => {
      const socket = socketRef.current;
      if (!socket) return null;
      if (pcsRef.current.has(targetSocketId)) removePeer(targetSocketId);
      const pc = new RTCPeerConnection(buildRtcConfig());
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(targetSocketId, { userId: targetUserId, name: targetName, stream: remoteStream });
          return next;
        });
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("vc:ice-candidate", {
            roomCode: idRef.current.roomCode,
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pcsRef.current.get(targetSocketId) !== pc) return;
        const state = pc.connectionState;
        if (state === "connected") {
          clearDisconnectTimer(targetSocketId);
          rejoinAttemptsRef.current = 0;
        } else if (state === "disconnected") {
          clearDisconnectTimer(targetSocketId);
          disconnectTimersRef.current.set(
            targetSocketId,
            setTimeout(() => {
              disconnectTimersRef.current.delete(targetSocketId);
              if (pcsRef.current.get(targetSocketId) === pc && pc.connectionState !== "connected") {
                handlePeerFailure(targetSocketId);
              }
            }, DISCONNECT_GRACE_MS)
          );
        } else if (state === "failed") {
          clearDisconnectTimer(targetSocketId);
          handlePeerFailure(targetSocketId);
        }
      };
      pcsRef.current.set(targetSocketId, pc);
      return pc;
    },
    [socketRef, removePeer, clearDisconnectTimer, handlePeerFailure]
  );

  const flushCandidates = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(socketId);
    pendingCandidatesRef.current.delete(socketId);
    if (!queue) return;
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch (e) {
        console.warn("[VC] gagal add queued candidate:", e);
      }
    }
  }, []);

  const startCall = useCallback(async () => {
    if (callActiveRef.current) return;
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      alert("Belum terhubung ke server. Coba beberapa detik lagi.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setCamOn(true);
    } catch (err) {
      console.warn("[VC] Kamera gagal, coba audio saja:", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setCamOn(false);
      } catch (err2) {
        console.error("[VideoCall] Gagal akses kamera/mic:", err2);
        alert("Tidak bisa mengakses kamera/mikrofon. Pastikan izin sudah diberikan.");
        return;
      }
    }
    localStreamRef.current = stream;
    callActiveRef.current = true;
    rejoinAttemptsRef.current = 0;
    setMicOn(true);
    setLocalStream(stream);
    setCallActive(true);
    socket.emit("vc:join", {
      roomCode: idRef.current.roomCode,
      userId: idRef.current.userId,
      userName: idRef.current.userName,
    });
  }, [socketRef]);

  const stopCall = useCallback(() => {
    callActiveRef.current = false;
    if (rejoinTimerRef.current) { clearTimeout(rejoinTimerRef.current); rejoinTimerRef.current = null; }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    removeAllPeers();
    setCallActive(false);
    socketRef.current?.emit("vc:leave", {
      roomCode: idRef.current.roomCode,
      userId: idRef.current.userId,
    });
  }, [socketRef, removeAllPeers]);

  const toggleCam = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    setCamOn((prev) => !prev);
  }, []);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    setMicOn((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let reJoinTimer: ReturnType<typeof setTimeout> | null = null;
    let attached: Socket | null = null;

    const onUserJoined = async (data: { socketId: string; userId: number; userName: string }) => {
      if (!localStreamRef.current || data.socketId === attached?.id) return;
      const pc = createPeerConnection(data.socketId, data.userId, data.userName);
      if (!pc) return;
      setPeers((prev) => {
        if (prev.has(data.socketId)) return prev;
        const next = new Map(prev);
        next.set(data.socketId, { userId: data.userId, name: data.userName, stream: null });
        return next;
      });
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        attached?.emit("vc:offer", {
          roomCode: idRef.current.roomCode,
          targetSocketId: data.socketId,
          offer: pc.localDescription ?? offer,
        });
      } catch (e) { console.error("[VC] Error creating offer:", e); }
    };

    const onOffer = async (data: {
      fromSocketId: string; fromUserId: number; fromUserName: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!localStreamRef.current) return;
      const fromId = data.fromSocketId;
      let pc = pcsRef.current.get(fromId) ?? null;
      if (pc && pc.signalingState !== "stable") {
        const polite = (attached?.id ?? "") < fromId;
        if (!polite) return;
        try { await pc.setLocalDescription({ type: "rollback" }); } catch {}
      }
      if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
        pc = createPeerConnection(fromId, data.fromUserId, data.fromUserName);
      }
      if (!pc) return;
      setPeers((prev) => {
        if (prev.has(fromId)) return prev;
        const next = new Map(prev);
        next.set(fromId, { userId: data.fromUserId, name: data.fromUserName, stream: null });
        return next;
      });
      try {
        await pc.setRemoteDescription(data.offer);
        await flushCandidates(fromId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        attached?.emit("vc:answer", {
          roomCode: idRef.current.roomCode,
          targetSocketId: fromId,
          answer: pc.localDescription ?? answer,
        });
      } catch (e) { console.error("[VC] Error creating answer:", e); }
    };

    const onAnswer = async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = pcsRef.current.get(data.fromSocketId);
      if (!pc || pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(data.answer);
        await flushCandidates(data.fromSocketId, pc);
      } catch (e) { console.error("[VC] Error setting answer:", e); }
    };

    const onIceCandidate = async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcsRef.current.get(data.fromSocketId);
      if (!pc || !pc.remoteDescription) {
        const q = pendingCandidatesRef.current.get(data.fromSocketId) ?? [];
        q.push(data.candidate);
        pendingCandidatesRef.current.set(data.fromSocketId, q);
        return;
      }
      try { await pc.addIceCandidate(data.candidate); } catch (e) {
        console.warn("[VC] Error adding ICE candidate:", e);
      }
    };

    const onUserLeft = (data: { socketId: string }) => removePeer(data.socketId);

    const onParticipantsUpdate = (data: { participants: VcParticipant[] }) => {
      setVcParticipants(data.participants);
    };

    // Host mute mic user
    const onForceMute = () => {
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      setMicOn(false);
    };

    // FIX14: Host matikan kamera user (user harus nyalakan sendiri)
    const onForceDisableCam = () => {
      localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = false; });
      setCamOn(false);
    };

    const onSocketConnect = () => {
      if (!callActiveRef.current || !localStreamRef.current) return;
      removeAllPeers();
      if (reJoinTimer) clearTimeout(reJoinTimer);
      reJoinTimer = setTimeout(() => {
        if (!callActiveRef.current || !attached?.connected) return;
        attached.emit("vc:join", {
          roomCode: idRef.current.roomCode,
          userId: idRef.current.userId,
          userName: idRef.current.userName,
        });
      }, 800);
    };

    const attach = () => {
      if (cancelled) return;
      const socket = socketRef.current;
      if (!socket) { pollTimer = setTimeout(attach, 400); return; }
      attached = socket;
      socket.on("vc:user-joined", onUserJoined);
      socket.on("vc:offer", onOffer);
      socket.on("vc:answer", onAnswer);
      socket.on("vc:ice-candidate", onIceCandidate);
      socket.on("vc:user-left", onUserLeft);
      socket.on("vc:participants-update", onParticipantsUpdate);
      socket.on("force-mute", onForceMute);
      socket.on("force-disable-cam", onForceDisableCam); // FIX14
      socket.on("connect", onSocketConnect);
    };
    attach();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (reJoinTimer) clearTimeout(reJoinTimer);
      if (attached) {
        attached.off("vc:user-joined", onUserJoined);
        attached.off("vc:offer", onOffer);
        attached.off("vc:answer", onAnswer);
        attached.off("vc:ice-candidate", onIceCandidate);
        attached.off("vc:user-left", onUserLeft);
        attached.off("vc:participants-update", onParticipantsUpdate);
        attached.off("force-mute", onForceMute);
        attached.off("force-disable-cam", onForceDisableCam); // FIX14
        attached.off("connect", onSocketConnect);
      }
    };
  }, [userId, roomCode, socketRef, createPeerConnection, flushCandidates, removePeer, removeAllPeers]);

  useEffect(() => {
    return () => {
      callActiveRef.current = false;
      if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
      disconnectTimersRef.current.forEach((t) => clearTimeout(t));
      disconnectTimersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcsRef.current.forEach((pc) => {
        pc.onconnectionstatechange = null;
        try { pc.close(); } catch {}
      });
      pcsRef.current.clear();
    };
  }, []);

  return {
    callActive, localStream, peers, camOn, micOn, vcParticipants,
    startCall, stopCall, toggleCam, toggleMic,
  };
}
