/// <reference types="vite/client" />

// Build-time stamps injected from vite.config.ts. Surface in the
// Settings footer so a bug report can quote an exact commit.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.beerjson" {
  const value: unknown;
  export default value;
}
