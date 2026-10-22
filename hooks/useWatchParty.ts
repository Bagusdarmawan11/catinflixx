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
  const [currentVideo, setCurrentVideo] = useState({ url: videoUrl, title: videoTitle });

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;

    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", {
        roomCode,
        userId,
        name: userName,
        isHost,
        videoUrl,
        videoTitle,
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room-members", (memberList: RoomMember[]) => {
      setMembers(memberList);
    });

    socket.on("chat-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]); // keep last 100
    });

    socket.on("video-state-sync", (state: VideoState) => {
      setVideoState(state);
    });

    socket.on("room-info", (info: { videoUrl: string; videoTitle: string }) => {
      setCurrentVideo({ url: info.videoUrl, title: info.videoTitle });
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, userId, userName, isHost]);

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

  return {
    // Expose socket instance untuk dipakai useVideoCall
    socket: socketRef.current,
    socketRef,
    connected,
    members,
    messages,
    videoState,
    currentVideo,
    sendMessage,
    controlVideo,
    changeVideo,
  };
}
