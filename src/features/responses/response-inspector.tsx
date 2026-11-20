/**
 * Compatibility entry point. The shared response drawer lives in `response-drawer.tsx`:
 * `ResponseDrawer` (controlled drawer), `ResponseButton` (text button that opens it) and
 * `ResponseInspector` (the content without drawer chrome). Existing imports keep working.
 */
export { ResponseButton, ResponseDrawer, ResponseInspector, type ResponseDrawerProps } from "./response-drawer";
