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

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  const getSocket = useCallback(() => socketRef.current, [socketRef]);

  const createPeerConnection = useCallback(
    (targetSocketId: string, targetUserId: number, targetName: string) => {
      const socket = getSocket();
      if (!socket) return null;

      if (peerConnectionsRef.current.has(targetSocketId)) {
        peerConnectionsRef.current.get(targetSocketId)?.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(targetSocketId, {
            userId: targetUserId,
            name: targetName,
            stream: remoteStream,
          });
          return next;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket()?.emit("vc:ice-candidate", {
            roomCode,
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          removePeer(targetSocketId);
        }
      };

      peerConnectionsRef.current.set(targetSocketId, pc);
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomCode, getSocket]
  );

  function removePeer(socketId: string) {
    peerConnectionsRef.current.get(socketId)?.close();
    peerConnectionsRef.current.delete(socketId);
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }

  const startCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      alert("Belum terhubung ke server. Coba beberapa detik lagi.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallActive(true);
      socket.emit("vc:join", { roomCode, userId, userName });
    } catch (err) {
      console.error("[VideoCall] Gagal akses kamera/mic:", err);
      alert("Tidak bisa mengakses kamera/mikrofon. Pastikan izin sudah diberikan.");
    }
  }, [getSocket, roomCode, userId, userName]);

  const stopCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers(new Map());
    setCallActive(false);
    getSocket()?.emit("vc:leave", { roomCode, userId });
  }, [getSocket, roomCode, userId]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn((prev) => !prev);
  }, []);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((prev) => !prev);
  }, []);

  // Daftarkan socket event listeners
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20;

    const registerHandlers = () => {
      const socket = getSocket();
      if (!socket) {
        if (attempts++ < maxAttempts) setTimeout(registerHandlers, 500);
        return;
      }

      socket.off("vc:user-joined");
      socket.off("vc:offer");
      socket.off("vc:answer");
      socket.off("vc:ice-candidate");
      socket.off("vc:user-left");
      socket.off("vc:participants-update");
      socket.off("force-mute"); // FIX: cleanup sebelumnya

      // Ada user lain join vc → kita kirim offer
      socket.on(
        "vc:user-joined",
        async (data: { socketId: string; userId: number; userName: string }) => {
          if (!localStreamRef.current) return;
          const pc = createPeerConnection(data.socketId, data.userId, data.userName);
          if (!pc) return;

          setPeers((prev) => {
            const next = new Map(prev);
            if (!next.has(data.socketId)) {
              next.set(data.socketId, {
                userId: data.userId,
                name: data.userName,
                stream: null,
              });
            }
            return next;
          });

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            getSocket()?.emit("vc:offer", {
              roomCode,
              targetSocketId: data.socketId,
              offer,
            });
          } catch (e) {
            console.error("[VC] Error creating offer:", e);
          }
        }
      );

      socket.on(
        "vc:offer",
        async (data: {
          fromSocketId: string;
          fromUserId: number;
          fromUserName: string;
          offer: RTCSessionDescriptionInit;
        }) => {
          if (!localStreamRef.current) return;
          const pc = createPeerConnection(
            data.fromSocketId,
            data.fromUserId,
            data.fromUserName
          );
          if (!pc) return;

          setPeers((prev) => {
            const next = new Map(prev);
            if (!next.has(data.fromSocketId)) {
              next.set(data.fromSocketId, {
                userId: data.fromUserId,
                name: data.fromUserName,
                stream: null,
              });
            }
            return next;
          });

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            getSocket()?.emit("vc:answer", {
              roomCode,
              targetSocketId: data.fromSocketId,
              answer,
            });
          } catch (e) {
            console.error("[VC] Error creating answer:", e);
          }
        }
      );

      socket.on(
        "vc:answer",
        async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
          const pc = peerConnectionsRef.current.get(data.fromSocketId);
          if (pc && pc.signalingState !== "stable") {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (e) {
              console.error("[VC] Error setting answer:", e);
            }
          }
        }
      );

      socket.on(
        "vc:ice-candidate",
        async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
          const pc = peerConnectionsRef.current.get(data.fromSocketId);
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error("[VC] Error adding ICE candidate:", e);
            }
          }
        }
      );

      socket.on("vc:user-left", (data: { socketId: string }) => {
        removePeer(data.socketId);
      });

      socket.on(
        "vc:participants-update",
        (data: { participants: VcParticipant[] }) => {
          setVcParticipants(data.participants);
        }
      );

      // FIX: Host mute mic user — matikan audio track lokal
      socket.on("force-mute", () => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
        setMicOn(false);
        console.log("[VC] Mic di-mute oleh host");
      });
    };

    registerHandlers();

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off("vc:user-joined");
        socket.off("vc:offer");
        socket.off("vc:answer");
        socket.off("vc:ice-candidate");
        socket.off("vc:user-left");
        socket.off("vc:participants-update");
        socket.off("force-mute");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, createPeerConnection]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  return {
    callActive,
    localStream,
    peers,
    camOn,
    micOn,
    vcParticipants,
    startCall,
    stopCall,
    toggleCam,
    toggleMic,
  };
}
