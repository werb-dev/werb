/// <reference types="vite/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.beerjson" {
  const value: unknown;
  export default value;
}
