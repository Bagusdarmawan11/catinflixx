"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";

export interface VideoCallPeer {
  userId: number;
  name: string;
  stream: MediaStream | null;
}

interface UseVideoCallOptions {
  socket: Socket | null;
  roomCode: string;
  userId: number;
  userName: string;
}

export function useVideoCall({
  socket,
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
  const peerStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Buat RTCPeerConnection baru untuk satu peer
  const createPeerConnection = useCallback(
    (targetSocketId: string, targetUserId: number, targetName: string) => {
      if (!socket) return null;

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Tambahkan local tracks ke peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Terima remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        peerStreamsRef.current.set(targetSocketId, remoteStream);
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

      // Kirim ICE candidates ke peer via Socket.IO
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("vc:ice-candidate", {
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
    [socket, roomCode]
  );

  function removePeer(socketId: string) {
    peerConnectionsRef.current.get(socketId)?.close();
    peerConnectionsRef.current.delete(socketId);
    peerStreamsRef.current.delete(socketId);
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }

  // Mulai video call
  const startCall = useCallback(async () => {
    if (!socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallActive(true);

      // Beritahu semua di room bahwa kita join video call
      socket.emit("vc:join", {
        roomCode,
        userId,
        userName,
      });
    } catch (err) {
      console.error("[VideoCall] Gagal akses kamera/mic:", err);
      alert("Tidak bisa mengakses kamera/mikrofon. Pastikan izin sudah diberikan.");
    }
  }, [socket, roomCode, userId, userName]);

  // Stop video call
  const stopCall = useCallback(() => {
    if (!socket) return;

    // Hentikan semua tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Tutup semua peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    peerStreamsRef.current.clear();
    setPeers(new Map());
    setCallActive(false);

    socket.emit("vc:leave", { roomCode, userId });
  }, [socket, roomCode, userId]);

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

  // Socket.IO signaling handlers
  useEffect(() => {
    if (!socket) return;

    // Ada user lain join vc → kita inisiasi offer ke mereka
    socket.on(
      "vc:user-joined",
      async (data: { socketId: string; userId: number; userName: string }) => {
        if (!localStreamRef.current) return;
        const pc = createPeerConnection(data.socketId, data.userId, data.userName);
        if (!pc) return;

        // Set peer di map dulu (tanpa stream, nanti diisi ontrack)
        setPeers((prev) => {
          const next = new Map(prev);
          if (!next.has(data.socketId)) {
            next.set(data.socketId, { userId: data.userId, name: data.userName, stream: null });
          }
          return next;
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("vc:offer", {
          roomCode,
          targetSocketId: data.socketId,
          offer,
        });
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
        const pc = createPeerConnection(data.fromSocketId, data.fromUserId, data.fromUserName);
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

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("vc:answer", {
          roomCode,
          targetSocketId: data.fromSocketId,
          answer,
        });
      }
    );

    // Terima answer
    socket.on(
      "vc:answer",
      async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
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
            console.error("[VideoCall] Error adding ICE candidate:", e);
          }
        }
      }
    );

    // User lain meninggalkan vc
    socket.on("vc:user-left", (data: { socketId: string }) => {
      removePeer(data.socketId);
    });

    return () => {
      socket.off("vc:user-joined");
      socket.off("vc:offer");
      socket.off("vc:answer");
      socket.off("vc:ice-candidate");
      socket.off("vc:user-left");
    };
  }, [socket, createPeerConnection, roomCode]);

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
