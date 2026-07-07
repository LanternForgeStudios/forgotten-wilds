import { isFormFieldTarget } from './keyboard';

/** Blocks the browser's default right-click menu, text selection, and copy/cut/paste while
 *  playing, since none of those are useful during exploration/combat and can make touch/mouse
 *  interactions feel accidental (a long-press selecting text instead of moving the player, etc).
 *  Form fields are fully exempt from all five - not just paste - so the Title screen's email/
 *  password inputs and Character Creation's name input keep working exactly as any other web page:
 *  right-click, select-all, and paste (including from a password manager) all still work there. */
export function installBrowserLockdown(): void {
  const blockUnlessFormField = (e: Event) => {
    if (isFormFieldTarget(e.target)) return;
    e.preventDefault();
  };
  document.addEventListener('contextmenu', blockUnlessFormField, true);
  document.addEventListener('selectstart', blockUnlessFormField, true);
  document.addEventListener('copy', blockUnlessFormField, true);
  document.addEventListener('cut', blockUnlessFormField, true);
  document.addEventListener('paste', blockUnlessFormField, true);
}
