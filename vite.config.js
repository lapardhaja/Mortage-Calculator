import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site / custom path — must match the URL segment after your domain
// https://lapardhaja.com/Mortage-Calculator/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/Mortage-Calculator/" : "/",
}));
