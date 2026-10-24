import type { Config } from "tailwindcss";

// Only these three lazy routes use prose classes. Keep their typography rules
// out of the render-blocking global stylesheet shipped to every visitor.
export default {
  darkMode: ["class"],
  content: [{ raw: "prose prose-neutral prose-sm dark:prose-invert", extension: "html" }],
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
