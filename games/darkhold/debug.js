// Test hooks (window.__dark) are only switched on in dev builds, or in a published build opened
// with ?debug in the address.
export const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
