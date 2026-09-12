import { useEffect, useMemo, useRef, useState } from "react";
import {
  buscarProductoPorCodigo,
  isLikelyScannerSubmit,
  normalizeBarcode,
  type BarcodeAction,
  type BarcodeProduct,
} from "./barcode";

type Props = {
  empresaId: string;
  action: BarcodeAction;
  onActionChange?: (action: BarcodeAction) => void;
  onProduct: (product: BarcodeProduct, action: BarcodeAction) => void;
};

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type ScanSource = "manual" | "wedge" | "camera";

const ACTIONS: Array<{ value: BarcodeAction; label: string }> = [
  { value: "vender", label: "Vender producto" },
  { value: "ingresar", label: "Ingresar mercadería" },
  { value: "consultar", label: "Consultar precio / stock" },
  { value: "editar", label: "Buscar / editar producto" },
];

const SCANNER_GAP_MS = 90;
const CAMERA_DUPLICATE_GUARD_MS = 1200;

export default function BarcodeScanner({
  empresaId,
  action,
  onActionChange,
  onProduct,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const inFlightRef = useRef(false);
  const wedgeBufferRef = useRef("");
  const wedgeLastKeyAtRef = useRef(0);
  const lastCameraResolvedRef = useRef<{ code: string; at: number } | null>(null);
  const empresaActivaRef = useRef(empresaId);
  const requestRef = useRef(0);

  const detectorCtor = useMemo(() => {
    const w = window as typeof window & { BarcodeDetector?: BarcodeDetectorCtor };
    return w.BarcodeDetector;
  }, []);

  function focusScanner() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function resolveCode(raw: string, source: ScanSource = "manual") {
    const normalized = normalizeBarcode(raw);
    if (!normalized || inFlightRef.current) return;
    const empresaOperacion = empresaId;
    if (!empresaOperacion) {
      setError("Seleccioná una empresa antes de escanear.");
      focusScanner();
      return;
    }

    if (source === "camera") {
      const now = Date.now();
      const previous = lastCameraResolvedRef.current;
      if (previous && previous.code === normalized && now - previous.at < CAMERA_DUPLICATE_GUARD_MS) return;
      lastCameraResolvedRef.current = { code: normalized, at: now };
    }

    const requestId = ++requestRef.current;
    inFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const matches = await buscarProductoPorCodigo(empresaOperacion, normalized);
      if (empresaActivaRef.current !== empresaOperacion || requestRef.current !== requestId) return;
      if (matches.length === 0) {
        setError(`No se encontró un producto con el código ${normalized}.`);
        return;
      }
      if (matches.length > 1) {
        setError("El código está duplicado dentro de esta empresa. Revisá el maestro de productos.");
        return;
      }
      setCode("");
      onProduct(matches[0], action);
      if ("vibrate" in navigator) navigator.vibrate?.(40);
    } catch (e) {
      console.error(e);
      if (empresaActivaRef.current === empresaOperacion && requestRef.current === requestId) {
        setError("No se pudo consultar el código. Verificá conexión, permisos y empresa activa.");
      }
    } finally {
      if (empresaActivaRef.current === empresaOperacion && requestRef.current === requestId) {
        inFlightRef.current = false;
        setBusy(false);
        if (source !== "camera") focusScanner();
      }
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lastCameraResolvedRef.current = null;
    setCameraOpen(false);
    focusScanner();
  }

  async function openCamera() {
    setError("");
    if (!detectorCtor) {
      setError("Este navegador no ofrece escaneo nativo por cámara. Podés usar pistola o ingresar el código manualmente.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara no está disponible en este dispositivo o contexto.");
      return;
    }

    const empresaOperacion = empresaId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (empresaActivaRef.current !== empresaOperacion) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      lastCameraResolvedRef.current = null;
      setCameraOpen(true);
    } catch (e) {
      console.error(e);
      if (empresaActivaRef.current === empresaOperacion) setError("No se pudo abrir la cámara. Revisá el permiso del navegador.");
    }
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current || !detectorCtor) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    let detector: BarcodeDetectorLike;
    try {
      // No forzamos una lista de formatos: algunos navegadores lanzan NotSupportedError
      // si se incluye siquiera un formato que su implementación no reconoce.
      detector = new detectorCtor();
    } catch (e) {
      console.error("BarcodeDetector no pudo inicializarse", e);
      setError("El lector de cámara de este navegador no pudo inicializarse. Usá pistola o ingreso manual.");
      stopCamera();
      return;
    }
    scanningRef.current = true;

    let timer: number | undefined;
    const scan = async () => {
      if (!scanningRef.current) return;
      try {
        if (!inFlightRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const results = await detector.detect(video);
          const found = results.map((r) => normalizeBarcode(r.rawValue || "")).find(Boolean);
          if (found) await resolveCode(found, "camera");
        }
      } catch (e) {
        console.debug("BarcodeDetector scan skipped", e);
      }
      timer = window.setTimeout(scan, 220);
    };

    void video.play().then(scan).catch((e) => {
      console.error(e);
      setError("No se pudo iniciar la vista de cámara.");
      stopCamera();
    });

    return () => {
      scanningRef.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [cameraOpen, detectorCtor]);

  useEffect(() => {
    empresaActivaRef.current = empresaId;
    requestRef.current += 1;
    inFlightRef.current = false;
    wedgeBufferRef.current = "";
    wedgeLastKeyAtRef.current = 0;
    lastCameraResolvedRef.current = null;
    setCode("");
    setError("");
    setBusy(false);
    if (cameraOpen || streamRef.current) stopCamera();
    else focusScanner();
    // El cambio de tenant invalida lecturas y cámara del tenant anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    focusScanner();
  }, [action]);

  useEffect(() => {
    function handleKeyboardWedge(event: KeyboardEvent) {
      if (cameraOpen || event.ctrlKey || event.metaKey || event.altKey) return;

      const active = document.activeElement as HTMLElement | null;
      const isScannerInput = active === inputRef.current;
      const isEditable = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.tagName === "SELECT" || active?.isContentEditable;
      if (isEditable && !isScannerInput) return;
      if (isScannerInput) return;

      const now = Date.now();
      if (now - wedgeLastKeyAtRef.current > SCANNER_GAP_MS) wedgeBufferRef.current = "";
      wedgeLastKeyAtRef.current = now;

      if (isLikelyScannerSubmit(event.key)) {
        const buffered = normalizeBarcode(wedgeBufferRef.current);
        wedgeBufferRef.current = "";
        if (buffered.length >= 4) {
          event.preventDefault();
          void resolveCode(buffered, "wedge");
        }
        return;
      }

      if (event.key.length === 1) wedgeBufferRef.current += event.key;
    }

    window.addEventListener("keydown", handleKeyboardWedge);
    return () => window.removeEventListener("keydown", handleKeyboardWedge);
  }, [cameraOpen, empresaId, action]);

  useEffect(() => () => stopCamera(), []);

  return (
    <section aria-label="Escáner de código de barras" style={{ display: "grid", gap: 12 }}>
      {onActionChange && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Acción del código escaneado">
          {ACTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onActionChange(item.value)}
              aria-pressed={action === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="off"
          spellCheck={false}
          autoComplete="off"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (isLikelyScannerSubmit(e.key)) {
              e.preventDefault();
              void resolveCode(code, "manual");
            }
          }}
          placeholder="Código de barras o interno"
          aria-label="Código de barras o código interno"
        />
        <button type="button" disabled={busy || !code.trim()} onClick={() => void resolveCode(code, "manual")}>
          {busy ? "Buscando…" : "Buscar"}
        </button>
        <button type="button" disabled={busy || cameraOpen} onClick={() => void openCamera()}>
          📷 Escanear con cámara
        </button>
      </div>

      <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
        Pistola USB/Bluetooth: cada lectura suma una unidad, incluso si escaneás el mismo producto varias veces. También acepta código interno alfanumérico.
      </p>

      {cameraOpen && (
        <div style={{ display: "grid", gap: 8 }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 480, borderRadius: 12 }} />
          <p style={{ margin: 0, fontSize: 13, opacity: 0.72 }}>Cámara continua: apuntá al siguiente producto sin cerrar el lector.</p>
          <button type="button" onClick={stopCamera}>Cerrar cámara</button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
