import React from "react";
import ReactDOM from "react-dom/client";
import SigoAuthGate from "./SigoAuthGate";
import SigoRoot from "./SigoRoot";
import "./index.css";
import "./barcode-scanner.css";
import "./premium-mobile.css";
import "./native-app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SigoAuthGate>
      <SigoRoot />
    </SigoAuthGate>
  </React.StrictMode>
);
