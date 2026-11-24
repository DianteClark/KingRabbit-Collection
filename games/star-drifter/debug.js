// Developer hooks (window.__sd for the browser checks, the ?gallery sprite sheet view) are only
// switched on in dev builds, or in a published build opened with ?debug.
export const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
