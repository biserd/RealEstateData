import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { installPublicDataFetchFallback } from "./lib/apiTransport";
import "./index.css";

installPublicDataFetchFallback();
const root = document.getElementById("root")!;
if (root.hasAttribute("data-ssr-home")) {
  // Resolve the two streamed Suspense boundaries before auth can update them.
  // The HTML remains visible while these modules download on a cold visit.
  Promise.all([import("./pages/Landing"), import("./components/ui/toaster")])
    .then(() => hydrateRoot(root, <App />))
    .catch(() => createRoot(root).render(<App />));
} else {
  createRoot(root).render(<App />);
}
