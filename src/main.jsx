import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./mortgage-calculator.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
