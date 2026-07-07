/** True when a DOM event target is a form field currently accepting text input - shared by the
 *  keyboard-hotkey guard below and the browser-lockdown event interception (browserLockdown.ts),
 *  since both need the same "don't interfere with normal typing" exemption. */
export function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/** True when the keydown's target is a form field currently accepting text input - global game
 *  keybinds (movement, dash, quest log/inventory/journal toggles) must not fire while the user is
 *  typing into an overlay's input, since letters like w/a/s/d/i/j/l double as both game hotkeys
 *  and ordinary text. */
export function isTypingTarget(e: KeyboardEvent): boolean {
  return isFormFieldTarget(e.target);
}
