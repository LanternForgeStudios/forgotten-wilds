/** Content filter shared by every player-to-player text surface (today: sendDirectMessage.ts;
 *  the planned town world-chat will reuse this same function). Deliberately blunt/heuristic
 *  rather than a full NLP profanity/PII detector - the goal is to catch the common, casual cases
 *  (a pasted phone number, email, link, or slur) and push people toward "coordinate the deal
 *  through normal conversation," not to be unbeatable against a determined bad actor. */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// A run of digits shaped like a phone number, with or without common separators
// (555-123-4567 / 555.123.4567 / 5551234567 / +1 555 123 4567).
const PHONE_RE = /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|\+?\d[\s.-]?(?:\d[\s.-]?){9,14}/;
const URL_RE = /(https?:\/\/|www\.)\S+/i;
// A bare domain-looking token (e.g. "example.com") without a scheme/www prefix - catches
// link-sharing attempts that omit the protocol.
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|org|io|co|gg|me|tv|xyz|info|biz|dev|app)\b/i;
// A long contiguous run of base64-alphabet characters - not a real decode/validate check, just a
// "this looks like an encoded blob, not a sentence" heuristic.
const BASE64_RE = /\b[A-Za-z0-9+/]{40,}={0,2}\b/;

// Deliberately short and generic (word stems, not every variant/slur) - this is a first-pass
// filter, not the whole moderation story, and an exhaustive list would be more maintenance
// burden than value here. \b...\b keeps it from flagging unrelated words that merely contain a
// stem as a substring.
const PROFANITY_RE =
  /\b(fuck|shit|bitch|asshole|bastard|cunt|nigger|nigga|faggot|retard|whore|slut)\w*\b/i;

export interface MessageFilterResult {
  ok: boolean;
  reason?: string;
}

/** Returns the first violation found, or null if the message is clean. Checked in a fixed order
 *  so the rejection reason is deterministic (useful for tests and for the client to display
 *  something specific rather than a generic "message rejected"). */
export function findMessageViolation(text: string): string | null {
  if (EMAIL_RE.test(text)) return 'Messages cannot contain email addresses.';
  if (PHONE_RE.test(text)) return 'Messages cannot contain phone numbers.';
  if (URL_RE.test(text) || BARE_DOMAIN_RE.test(text)) return 'Messages cannot contain links.';
  if (BASE64_RE.test(text)) return 'Messages cannot contain encoded/pasted content.';
  if (PROFANITY_RE.test(text)) return 'Messages cannot contain offensive language.';
  return null;
}
