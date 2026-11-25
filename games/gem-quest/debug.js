// Test hooks (window.__gq) only in dev builds, or in a published build opened with ?debug.
export const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
