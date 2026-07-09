import { describe, expect, it } from 'vitest';
import {
  checkAndRecordMessage,
  FLOOD_MESSAGE_LIMIT,
  FLOOD_WINDOW_MS,
  MIN_MESSAGE_INTERVAL_MS,
  TEMP_MUTE_MS,
} from './chatModerationEngine';
import type { WorldChatModerationDoc } from '../shared-types';

const FRESH: WorldChatModerationDoc = { lastMessageAt: 0, recentMessageTimestamps: [], mutedUntil: 0 };

describe('checkAndRecordMessage', () => {
  it('allows a first message and records lastMessageAt/recentMessageTimestamps', () => {
    const result = checkAndRecordMessage(FRESH, 100_000);
    expect(result.allowed).toBe(true);
    expect(result.moderation).toEqual({ lastMessageAt: 100_000, recentMessageTimestamps: [100_000], mutedUntil: 0 });
  });

  it('rejects a message sent before MIN_MESSAGE_INTERVAL_MS has passed', () => {
    const moderation: WorldChatModerationDoc = { lastMessageAt: 100_000, recentMessageTimestamps: [100_000], mutedUntil: 0 };
    const result = checkAndRecordMessage(moderation, 100_000 + MIN_MESSAGE_INTERVAL_MS - 1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/too quickly/i);
    // Rejected for the cooldown reason - moderation state is returned unchanged, not mutated.
    expect(result.moderation).toEqual(moderation);
  });

  it('allows a message sent exactly at/after MIN_MESSAGE_INTERVAL_MS', () => {
    const moderation: WorldChatModerationDoc = { lastMessageAt: 100_000, recentMessageTimestamps: [100_000], mutedUntil: 0 };
    const result = checkAndRecordMessage(moderation, 100_000 + MIN_MESSAGE_INTERVAL_MS);
    expect(result.allowed).toBe(true);
  });

  it('prunes timestamps older than FLOOD_WINDOW_MS before counting', () => {
    const now = 1_000_000;
    const stale = Array.from({ length: FLOOD_MESSAGE_LIMIT }, (_, i) => now - FLOOD_WINDOW_MS - 1 - i);
    const moderation: WorldChatModerationDoc = {
      lastMessageAt: now - MIN_MESSAGE_INTERVAL_MS - 1,
      recentMessageTimestamps: stale,
      mutedUntil: 0,
    };
    const result = checkAndRecordMessage(moderation, now);
    expect(result.allowed).toBe(true);
    // Only this message survives pruning - every stale one aged out.
    expect(result.moderation.recentMessageTimestamps).toEqual([now]);
  });

  it('applies a temp mute once more than FLOOD_MESSAGE_LIMIT messages land inside the window', () => {
    const now = 1_000_000;
    // FLOOD_MESSAGE_LIMIT prior messages, all still within the window, spaced past the per-message
    // cooldown so only the flood check (not the cooldown check) is what trips.
    const recentMessageTimestamps = Array.from(
      { length: FLOOD_MESSAGE_LIMIT },
      (_, i) => now - MIN_MESSAGE_INTERVAL_MS * (FLOOD_MESSAGE_LIMIT - i),
    );
    const moderation: WorldChatModerationDoc = {
      lastMessageAt: recentMessageTimestamps[recentMessageTimestamps.length - 1],
      recentMessageTimestamps,
      mutedUntil: 0,
    };
    const result = checkAndRecordMessage(moderation, now);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/muted/i);
    expect(result.moderation.mutedUntil).toBe(now + TEMP_MUTE_MS);
  });

  it('rejects outright while mutedUntil is still in the future, without re-checking cooldown/flood', () => {
    const now = 500_000;
    const moderation: WorldChatModerationDoc = {
      lastMessageAt: 0,
      recentMessageTimestamps: [],
      mutedUntil: now + 60_000,
    };
    const result = checkAndRecordMessage(moderation, now);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/muted/i);
    expect(result.moderation).toEqual(moderation);
  });

  it('allows a message again once mutedUntil has passed', () => {
    const now = 500_000;
    const moderation: WorldChatModerationDoc = {
      lastMessageAt: 0,
      recentMessageTimestamps: [],
      mutedUntil: now - 1,
    };
    const result = checkAndRecordMessage(moderation, now);
    expect(result.allowed).toBe(true);
    expect(result.moderation.mutedUntil).toBe(0);
  });
});
