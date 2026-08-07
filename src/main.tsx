import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyBranding, brandings, readBrandKey } from "./config/branding";
import "./index.css";

// Färgerna sätts före första renderingen, annars blinkar standardtemat till
applyBranding(brandings[readBrandKey()]);

createRoot(document.getElementById("root")!).render(<App />);
