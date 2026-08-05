import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyBranding } from "./config/branding";
import "./index.css";

applyBranding();

createRoot(document.getElementById("root")!).render(<App />);
