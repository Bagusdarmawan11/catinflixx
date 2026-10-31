/**
 * Watch Party Socket Handlers
 *
 * Semua logika socket Watch Party (join-room, video-control, chat,
 * kick, VC signaling, dll.) sudah dipindahkan langsung ke server/index.ts
 * agar lebih mudah dikelola dalam satu tempat.
 *
 * File ini sengaja dikosongkan untuk menghindari duplikasi handler
 * (io.on("connection") ganda yang menyebabkan event terpanggil dua kali).
 *
 * Jika ingin memecah handler ke file terpisah di masa depan,
 * gunakan pola:
 *
 *   // server/socket/watchPartyHandlers.ts
 *   export function registerWatchPartyHandlers(io: Server, socket: Socket, ...) {
 *     socket.on("join-room", (...) => { ... });
 *     socket.on("video-control", (...) => { ... });
 *     // dst.
 *   }
 *
 *   // server/index.ts
 *   io.on("connection", (socket) => {
 *     registerWatchPartyHandlers(io, socket, persistedRooms, runtimes);
 *   });
 */

export {};
