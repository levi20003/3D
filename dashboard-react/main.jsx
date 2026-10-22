import React from "react";
import { createRoot } from "react-dom/client";
import LeventeDashboard from "./LeventeDashboard.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LeventeDashboard />
  </React.StrictMode>,
);
