import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const SCANNER_REGION_ID = 'barcode-scanner-region';

// Product barcode formats we expect on shelf items, plus QR as a convenience.
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Guards against the decode callback firing onScan more than once for the
  // same physical scan (html5-qrcode keeps emitting while the code is in frame).
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let scanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        scanner = new Html5Qrcode(SCANNER_REGION_ID, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777,
          disableFlip: false,
        };

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!mounted || hasScannedRef.current) return;
            hasScannedRef.current = true;
            // Stop the camera before handing the result back so the stream is
            // torn down even if the parent keeps us mounted briefly.
            stopScanner().finally(() => onScan(decodedText.trim()));
          },
          () => {
            // Per-frame decode miss — expected constantly, ignore.
          }
        );

        if (mounted) {
          setError(null);
        }
      } catch (err: any) {
        console.error('Barcode scanner init failed:', err);
        if (mounted) {
          setHasCamera(false);
          setError(
            err?.name === 'NotAllowedError'
              ? 'Camera access denied. Enter barcode manually.'
              : 'Could not start camera. Enter barcode manually.'
          );
        }
      }
    };

    // Defer until the scanner region is mounted in the DOM.
    const timer = setTimeout(initScanner, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stops the active scan and releases the camera's MediaStream tracks.
  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Already stopped / tearing down — nothing to release.
    } finally {
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
    stopScanner().finally(onClose);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        {hasCamera ? (
          <>
            {/* html5-qrcode injects its <video> into this region */}
            <div id={SCANNER_REGION_ID} className="w-full h-full" />
            {/* Framing guide for the cashier (purely visual) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-40">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-2xl" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <CameraIcon className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-slate-400 text-center mb-2">{error}</p>
          </div>
        )}
      </div>

      {/* Manual Entry */}
      <div className="p-4 bg-slate-900">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            placeholder="Enter barcode manually"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
        <p className="text-xs text-slate-500 text-center mt-3">
          Point the camera at a barcode or enter it manually
        </p>
      </div>
    </div>
  );
}
