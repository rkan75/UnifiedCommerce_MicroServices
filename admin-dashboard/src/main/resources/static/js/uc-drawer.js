/**
 * Shared right-drawer utilities for the admin dashboard (vanilla JS).
 * One Escape listener at a time; bind when opening a modal drawer, unbind when closing.
 */
(function(global) {
  var escListener = null;
  var escCapture = false;

  global.ucDrawer = {
    bindEscape: function(handler, useCapture) {
      global.ucDrawer.unbindEscape();
      if (typeof handler !== 'function') return;
      escCapture = !!useCapture;
      escListener = handler;
      document.addEventListener('keydown', escListener, escCapture);
    },
    unbindEscape: function() {
      if (escListener) {
        document.removeEventListener('keydown', escListener, escCapture);
        escListener = null;
        escCapture = false;
      }
    }
  };

  /** Reusable 20×20 “open in drawer / external” icon (settings metadata + JSON triggers). */
  global.ucSettingsUi = {
    externalLinkIcon20:
      '<svg class="settings-meta-external-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M15 3h6v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="m10 14 11-11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
  };
})(typeof window !== 'undefined' ? window : this);
