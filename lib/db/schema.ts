import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  uniqueIndex,
  index,
  pgEnum,
  char,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const mediaTypeEnum = pgEnum("media_type", ["movie", "tv"]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const watchlist = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    posterPath: varchar("poster_path", { length: 500 }),
    voteAverage: real("vote_average").notNull().default(0),
    releaseDate: varchar("release_date", { length: 20 }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Satu user tidak bisa menambahkan film yang sama dua kali
    uniqueIndex("watchlist_user_tmdb_idx").on(
      table.userId,
      table.tmdbId,
      table.mediaType
    ),
    index("watchlist_user_id_idx").on(table.userId),
  ]
);

// ─── Watch Rooms ─────────────────────────────────────────────────────────────

export const watchRooms = pgTable(
  "watch_rooms",
  {
    id: serial("id").primaryKey(),
    // Kode undangan yang unik dan sulit ditebak
    inviteCode: char("invite_code", { length: 8 }).notNull(),
    hostId: integer("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    posterPath: varchar("poster_path", { length: 500 }),
    // State pemutaran — disimpan untuk sinkronisasi reconnect
    currentTime: real("current_time").notNull().default(0),
    isPlaying: boolean("is_playing").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("watch_rooms_invite_code_idx").on(table.inviteCode),
    index("watch_rooms_host_id_idx").on(table.hostId),
    index("watch_rooms_expires_at_idx").on(table.expiresAt),
  ]
);

// ─── Room Members ─────────────────────────────────────────────────────────────

export const roomMembers = pgTable(
  "room_members",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => watchRooms.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("room_members_room_user_idx").on(table.roomId, table.userId),
    index("room_members_room_id_idx").on(table.roomId),
    index("room_members_user_id_idx").on(table.userId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  watchlist: many(watchlist),
  hostedRooms: many(watchRooms),
  roomMemberships: many(roomMembers),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
}));

export const watchRoomsRelations = relations(watchRooms, ({ one, many }) => ({
  host: one(users, {
    fields: [watchRooms.hostId],
    references: [users.id],
  }),
  members: many(roomMembers),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(watchRooms, {
    fields: [roomMembers.roomId],
    references: [watchRooms.id],
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),
}));

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type NewWatchlistItem = typeof watchlist.$inferInsert;
export type WatchRoom = typeof watchRooms.$inferSelect;
export type NewWatchRoom = typeof watchRooms.$inferInsert;
export type RoomMember = typeof roomMembers.$inferSelect;
export type NewRoomMember = typeof roomMembers.$inferInsert;
