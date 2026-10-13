// Barcode scanning with Google's ready-made scanner (ML Kit via Google Play
// services) — no camera permission needed. In a browser, falls back to typing
// the code.
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

// Resolves to the scanned code, or null when cancelled.
export async function scanBarcode() {
  if (!Capacitor.isNativePlatform()) {
    const v = prompt('Vpiši črtno kodo (EAN):');
    return v && v.trim() ? v.trim() : null;
  }
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {});
    throw new Error('Skener se prvič nalaga (Google Play). Poskusi znova čez nekaj sekund.');
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE]
    });
    return barcodes && barcodes.length ? String(barcodes[0].rawValue || barcodes[0].displayValue).trim() : null;
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return null;
    throw e;
  }
}
