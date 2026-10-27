"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: number;
  userId: number;
  name: string;
  message: string;
  isSystem: boolean;
  timestamp: string;
}

export interface RoomMember {
  userId: number;
  name: string;
  isHost: boolean;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
}

interface UseWatchPartyOptions {
  roomCode: string;
  userId: number;
  userName: string;
  isHost: boolean;
  videoUrl: string;
  videoTitle: string;
}

export function useWatchParty({
  roomCode,
  userId,
  userName,
  isHost,
  videoUrl,
  videoTitle,
}: UseWatchPartyOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    updatedAt: Date.now(),
  });
  const [currentVideo, setCurrentVideo] = useState({
    url: videoUrl,
    title: videoTitle,
  });
  const [wasKicked, setWasKicked] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;

    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      query: { userId: String(userId) },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);

      const joinKey = `cf-joined-${roomCode}-${userId}`;
      const alreadyJoined = sessionStorage.getItem(joinKey);
      const isReconnect = !!alreadyJoined;
      sessionStorage.setItem(joinKey, Date.now().toString());

      socket.emit("join-room", {
        roomCode,
        userId,
        name: userName,
        isHost,
        videoUrl,
        videoTitle,
        isReconnect,
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room-members", (memberList: RoomMember[]) => {
      setMembers(memberList);
    });

    socket.on("chat-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    });

    socket.on("video-state-sync", (state: VideoState) => {
      setVideoState(state);
    });

    socket.on(
      "room-info",
      (info: { videoUrl: string; videoTitle: string }) => {
        setCurrentVideo({ url: info.videoUrl, title: info.videoTitle });
      }
    );

    socket.on("kicked", () => {
      setWasKicked(true);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, userId]);

  const sendMessage = useCallback(
    (message: string) => {
      socketRef.current?.emit("send-message", {
        roomCode,
        userId,
        name: userName,
        message,
      });
    },
    [roomCode, userId, userName]
  );

  const controlVideo = useCallback(
    (isPlaying: boolean, currentTime: number) => {
      if (!isHost) return;
      socketRef.current?.emit("video-control", {
        roomCode,
        isPlaying,
        currentTime,
      });
    },
    [roomCode, isHost]
  );

  const changeVideo = useCallback(
    (newUrl: string, newTitle: string) => {
      if (!isHost) return;
      socketRef.current?.emit("change-video", {
        roomCode,
        videoUrl: newUrl,
        videoTitle: newTitle,
      });
    },
    [roomCode, isHost]
  );

  const kickUser = useCallback(
    (targetUserId: number) => {
      if (!isHost) return;
      socketRef.current?.emit("kick-user", { roomCode, targetUserId });
    },
    [roomCode, isHost]
  );

  const muteUser = useCallback(
    (targetUserId: number) => {
      if (!isHost) return;
      socketRef.current?.emit("mute-user", { roomCode, targetUserId });
    },
    [roomCode, isHost]
  );

  // FIX14: Host matikan kamera user (user harus nyalakan sendiri)
  const disableCamUser = useCallback(
    (targetUserId: number) => {
      if (!isHost) return;
      socketRef.current?.emit("disable-cam-user", { roomCode, targetUserId });
    },
    [roomCode, isHost]
  );

  return {
    socketRef,
    connected,
    members,
    messages,
    videoState,
    currentVideo,
    wasKicked,
    sendMessage,
    controlVideo,
    changeVideo,
    kickUser,
    muteUser,
    disableCamUser,
  };
}
