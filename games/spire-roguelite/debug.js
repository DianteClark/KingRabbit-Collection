// Developer tools (the ?gallery sprite view, window.__spire / window.__battle test hooks)
// are only switched on in dev builds, or in a published build opened with ?debug.
export const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
