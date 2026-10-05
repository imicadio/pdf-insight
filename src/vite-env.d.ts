/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the analysis API (Vercel), e.g. https://pdf-insight-api.vercel.app */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
