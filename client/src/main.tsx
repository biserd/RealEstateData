import { createRoot } from "react-dom/client";
import App from "./App";
import { installDataTransport } from "./lib/dataTransport";
import "./index.css";

installDataTransport();
createRoot(document.getElementById("root")!).render(<App />);
