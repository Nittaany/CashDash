import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// UPI VPA format: 2-256 alphanumeric/.-_ characters @ 2-64 alpha characters
const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * Validate UPI VPA format
 * @param {string} handle - Payment handle to validate
 * @returns {boolean} - Whether handle is a valid UPI VPA
 */
export function isValidUpiVpa(handle) {
  return typeof handle === "string" && UPI_VPA_REGEX.test(handle);
}

/**
 * Build a valid UPI payment URI using integer math only
 * @param {string} payeeHandle - UPI ID (e.g., "user@upi")
 * @param {string} payeeName - Name of the payee
 * @param {number} amountMinor - Amount in minor units (paisa)
 * @returns {string|null} - Properly encoded UPI URI or null if invalid
 */
export function buildUpiUri(payeeHandle, payeeName, amountMinor) {
  if (!isValidUpiVpa(payeeHandle)) return null;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return null;
  
  // Integer math only - no floating point
  const whole = Math.floor(amountMinor / 100);
  const frac = String(amountMinor % 100).padStart(2, "0");
  const amountStr = `${whole}.${frac}`;
  
  const params = new URLSearchParams();
  params.set("pa", payeeHandle);
  params.set("pn", payeeName);
  params.set("am", amountStr);
  params.set("cu", "INR"); // UPI only supports INR
  return `upi://pay?${params.toString()}`;
}

export function PaymentQRModal({ isOpen, onClose, payeeHandle, payeeName, amountMinor, currency }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // UPI only works for INR with valid VPA
  const isUpiSupported = currency === "INR" && isValidUpiVpa(payeeHandle);
  const upiUri = isUpiSupported ? buildUpiUri(payeeHandle, payeeName, amountMinor) : null;

  // Format amount for display using integer math
  const whole = Math.floor(amountMinor / 100);
  const frac = String(amountMinor % 100).padStart(2, "0");
  const displayAmount = `${whole}.${frac}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payeeHandle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = payeeHandle;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-qr-title"
    >
      <div 
        className="bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="payment-qr-title" className="text-lg font-semibold text-white mb-4 text-center">
          Pay {payeeName}
        </h2>
        
        <div className="flex flex-col items-center gap-4">
          {/* QR Code - only for INR with valid UPI VPA */}
          {isUpiSupported && upiUri && (
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG 
                value={upiUri} 
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          )}

          {/* Non-UPI notice */}
          {!isUpiSupported && (
            <div className="text-center p-4 bg-slate-700 rounded-lg">
              <p className="text-slate-300 text-sm">
                {currency !== "INR" 
                  ? `UPI QR is only available for INR payments. Please use the payment handle below for ${currency}.`
                  : "Invalid UPI ID format. Please copy the payment handle below."}
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {currency} {displayAmount}
            </div>
          </div>

          {/* Payment Handle */}
          <div className="w-full">
            <div className="text-sm text-slate-400 mb-1">Payment Handle</div>
            <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-3">
              <span className="text-white flex-1 truncate">{payeeHandle}</span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-slate-600 text-sm text-white rounded hover:bg-slate-500 transition"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Mobile: Open Payment App - only for valid UPI */}
          {isMobile && isUpiSupported && upiUri && (
            <a
              href={upiUri}
              className="w-full px-4 py-3 bg-emerald-600 text-white text-center rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              Open Payment App
            </a>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
