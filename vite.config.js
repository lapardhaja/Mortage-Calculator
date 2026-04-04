import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Actions sets GITHUB_REPOSITORY=owner/repo — Pages is always /repo/ for project sites */
function pagesBase() {
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (repo) return `/${repo}/`;
  return "/Mortage-Calculator/";
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? pagesBase() : "/",
}));
