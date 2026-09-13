import React from "react";
import ReactDOM from "react-dom/client";
import ArcaLauncher from "./ArcaLauncher";
import SigoAuthGate from "./SigoAuthGate";
import SigoRoot from "./SigoRoot";
import "./index.css";
import "./barcode-scanner.css";
import "./premium-mobile.css";
import "./native-app.css";
import "./don-benchmark.css";
import "./arca-facturacion.css";
import "./reports-catalog.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SigoAuthGate>
      <>
        <SigoRoot />
        <ArcaLauncher />
      </>
    </SigoAuthGate>
  </React.StrictMode>
);
