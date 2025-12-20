
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../Shared/Button';

declare const Html5QrcodeScanner: any;

interface QRScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onCancel }) => {
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = (decodedText: string) => {
      scanner.clear();
      onScan(decodedText);
    };

    const onScanFailure = (err: any) => {
      // Common scanning errors are ignored to avoid noise
    };

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((e: any) => console.error("Error clearing scanner", e));
      }
    };
  }, [onScan]);

  return (
    <div className="space-y-4">
      <p className="text-center text-slate-600">Scan the QR code shown by your teacher</p>
      <div id="qr-reader" className="overflow-hidden rounded-xl border-2 border-indigo-200"></div>
      {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
      <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
    </div>
  );
};
