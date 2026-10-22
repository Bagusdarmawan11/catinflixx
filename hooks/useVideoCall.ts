"use client";

import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import type { Socket } from "socket.io-client";

export interface VideoCallPeer {
  userId: number;
  name: string;
  stream: MediaStream | null;
}

interface UseVideoCallOptions {
  // Terima socketRef (MutableRefObject) bukan socket value,
  // supaya selalu dapat instance terbaru tanpa re-render issue
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

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // Helper: dapatkan socket yang selalu fresh
  const getSocket = useCallback(() => socketRef.current, [socketRef]);

  const createPeerConnection = useCallback(
    (targetSocketId: string, targetUserId: number, targetName: string) => {
      const socket = getSocket();
      if (!socket) return null;

      // Tutup connection lama kalau ada
      if (peerConnectionsRef.current.has(targetSocketId)) {
        peerConnectionsRef.current.get(targetSocketId)?.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Tambahkan local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Terima remote stream
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

      // Kirim ICE candidates
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

  // Mulai video call
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

  // Stop video call
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

  // Toggle kamera
  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn((prev) => !prev);
  }, []);

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((prev) => !prev);
  }, []);

  // Daftarkan socket event listeners
  useEffect(() => {
    // Polling sampai socket tersedia (max 10 detik)
    let attempts = 0;
    const maxAttempts = 20;

    const registerHandlers = () => {
      const socket = getSocket();
      if (!socket) {
        if (attempts++ < maxAttempts) {
          setTimeout(registerHandlers, 500);
        }
        return;
      }

      // Bersihkan listener lama
      socket.off("vc:user-joined");
      socket.off("vc:offer");
      socket.off("vc:answer");
      socket.off("vc:ice-candidate");
      socket.off("vc:user-left");

      // Ada user lain join vc → kita kirim offer ke mereka
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

      // Terima offer → buat answer
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

      // Terima answer
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

      // Terima ICE candidate
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

      // User lain keluar dari vc
      socket.on("vc:user-left", (data: { socketId: string }) => {
        removePeer(data.socketId);
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
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, createPeerConnection]);

  // Cleanup saat unmount
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
    startCall,
    stopCall,
    toggleCam,
    toggleMic,
  };
}
