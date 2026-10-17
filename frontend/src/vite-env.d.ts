/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Express REST API, e.g. http://localhost:4000 */
  readonly VITE_API_URL?: string
  /** Socket.io server URL, e.g. http://localhost:4000 */
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
