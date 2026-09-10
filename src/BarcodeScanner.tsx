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

const ACTIONS: Array<{ value: BarcodeAction; label: string }> = [
  { value: "vender", label: "Vender producto" },
  { value: "ingresar", label: "Ingresar mercadería" },
  { value: "consultar", label: "Consultar precio / stock" },
  { value: "editar", label: "Buscar / editar producto" },
];

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const detectorCtor = useMemo(() => {
    const w = window as typeof window & { BarcodeDetector?: BarcodeDetectorCtor };
    return w.BarcodeDetector;
  }, []);

  async function resolveCode(raw: string) {
    const normalized = normalizeBarcode(raw);
    if (!normalized || busy) return;
    if (!empresaId) {
      setError("Seleccioná una empresa antes de escanear.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const matches = await buscarProductoPorCodigo(empresaId, normalized);
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
    } catch (e) {
      console.error(e);
      setError("No se pudo consultar el código. Verificá conexión, permisos y empresa activa.");
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (e) {
      console.error(e);
      setError("No se pudo abrir la cámara. Revisá el permiso del navegador.");
    }
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current || !detectorCtor) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const detector = new detectorCtor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
    });
    scanningRef.current = true;

    let timer: number | undefined;
    const scan = async () => {
      if (!scanningRef.current) return;
      try {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const results = await detector.detect(video);
          const found = results.map((r) => normalizeBarcode(r.rawValue || "")).find(Boolean);
          if (found) {
            stopCamera();
            await resolveCode(found);
            return;
          }
        }
      } catch (e) {
        console.debug("BarcodeDetector scan skipped", e);
      }
      timer = window.setTimeout(scan, 250);
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

  useEffect(() => () => stopCamera(), []);

  return (
    <section aria-label="Escáner de código de barras" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ACTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onActionChange?.(item.value)}
            aria-pressed={action === item.value}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (isLikelyScannerSubmit(e.key)) {
              e.preventDefault();
              void resolveCode(code);
            }
          }}
          placeholder="Escaneá o ingresá el código"
          aria-label="Código de barras o código interno"
        />
        <button type="button" disabled={busy || !code.trim()} onClick={() => void resolveCode(code)}>
          {busy ? "Buscando…" : "Buscar"}
        </button>
        <button type="button" disabled={busy || cameraOpen} onClick={() => void openCamera()}>
          Escanear con cámara
        </button>
      </div>

      {cameraOpen && (
        <div style={{ display: "grid", gap: 8 }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 480, borderRadius: 12 }} />
          <button type="button" onClick={stopCamera}>Cerrar cámara</button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
