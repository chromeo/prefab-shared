import { defineConfig } from "vitest/config";

// The UI components are JSX using React's automatic runtime.
export default defineConfig({ esbuild: { jsx: "automatic" } });
