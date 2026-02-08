import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsScanning(true);
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setHasCamera(false);
        setError('Camera access denied. Enter barcode manually.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulated barcode detection (in real app, use a library like zxing-js or quagga)
  useEffect(() => {
    if (!isScanning || !videoRef.current) return;

    // For demo purposes, we'll just use manual input
    // In production, integrate a barcode scanning library

    return () => {};
  }, [isScanning]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="scanner-overlay flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Scanning frame */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="scanner-frame">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-2xl" />
              </div>
            </div>
            {/* Scanning line animation */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-0.5 bg-amber-500 animate-pulse" />
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
          Position the barcode within the frame or enter it manually
        </p>
      </div>
    </div>
  );
}
