import { describe, expect, it } from 'vitest';
import { findMessageViolation } from './messageFilter';

describe('findMessageViolation', () => {
  it('allows ordinary conversation', () => {
    expect(findMessageViolation('Hey, want to team up for the Coalbound Warden fight later?')).toBeNull();
  });

  it('flags email addresses', () => {
    expect(findMessageViolation('reach me at player1@example.com')).toMatch(/email/i);
  });

  it('flags phone numbers in common formats', () => {
    expect(findMessageViolation('call me 555-123-4567')).toMatch(/phone/i);
    expect(findMessageViolation('text 5551234567 later')).toMatch(/phone/i);
    expect(findMessageViolation('+1 555 123 4567 works too')).toMatch(/phone/i);
  });

  it('flags links with and without a scheme', () => {
    expect(findMessageViolation('check https://example.com/thing')).toMatch(/link/i);
    expect(findMessageViolation('go to www.example.com')).toMatch(/link/i);
    expect(findMessageViolation('visit example.com sometime')).toMatch(/link/i);
  });

  it('flags long base64-looking blobs', () => {
    const blob = Buffer.from('this is a secret payload that is long enough to matter').toString('base64');
    expect(findMessageViolation(`here: ${blob}`)).toMatch(/encoded/i);
  });

  it('does not flag ordinary short alphanumeric tokens as base64', () => {
    expect(findMessageViolation('my character name is IronbladeXYZ123')).toBeNull();
  });

  it('flags profanity as a standalone word', () => {
    expect(findMessageViolation('this fight was shit')).toMatch(/offensive/i);
  });

  it('does not flag a compound word the profane stem is only part of (the "Scunthorpe problem")', () => {
    // Same \b-boundary behavior as the town-name test below, just illustrating the flip side: a
    // real compound curse word ("bullshit") isn't standalone, so word-boundary matching misses
    // it too - a deliberate, accepted tradeoff (see the file's own header comment) rather than
    // trying to solve the unsolvable substring-vs-compound-word problem with a regex.
    expect(findMessageViolation('this fight was such bullshit')).toBeNull();
  });

  it('does not flag a word that merely contains a profane substring', () => {
    // "class" contains no filtered stem, but this guards the \b-boundary behavior generally -
    // pick a word containing a stem as a substring without being the word itself.
    expect(findMessageViolation('scunthorpe is a real place name')).toBeNull();
  });

  it('checks email before phone so a message with both gets a deterministic reason', () => {
    expect(findMessageViolation('email me at a@b.com or call 555-123-4567')).toMatch(/email/i);
  });
});
