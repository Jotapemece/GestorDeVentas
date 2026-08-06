import { vi } from 'vitest';

const mockInvoke = vi.fn();
mockInvoke.mockResolvedValue(undefined);

window.__TAURI__ = {
  core: {
    invoke: mockInvoke,
  },
};

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 Test',
  configurable: true,
});

globalThis.qs = (sel) => document.querySelector(sel);
globalThis.qsa = (sel) => document.querySelectorAll(sel);
globalThis.showToast = vi.fn();
globalThis.showLoading = vi.fn();
globalThis.hideLoading = vi.fn();
globalThis.setUserConfig = vi.fn();
globalThis.escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

globalThis.tasaActual = 40;
globalThis.tasaInventario = 0;
globalThis.cartShowBs = false;
globalThis.currentUser = { rol: 'admin', username: 'admin' };
globalThis.ROL_ADMIN = 'admin';
