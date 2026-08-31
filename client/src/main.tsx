import { createRoot } from "react-dom/client";
import App from "./App";
import { installPublicDataFetchFallback } from "./lib/apiTransport";
import "./index.css";

installPublicDataFetchFallback();
createRoot(document.getElementById("root")!).render(<App />);
