import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Build a valid UPI payment URI
 * @param {string} payeeHandle - UPI ID (e.g., "user@upi")
 * @param {string} payeeName - Name of the payee
 * @param {number} amountMajor - Amount in major units (e.g., rupees, not paisa)
 * @param {string} currency - Currency code (NPR, INR, USD)
 * @returns {string} - Properly encoded UPI URI
 */
export function buildUpiUri(payeeHandle, payeeName, amountMajor, currency) {
  const params = new URLSearchParams();
  params.set("pa", payeeHandle);
  params.set("pn", payeeName);
  params.set("am", amountMajor.toFixed(2));
  params.set("cu", currency);
  return `upi://pay?${params.toString()}`;
}

export function PaymentQRModal({ isOpen, onClose, payeeHandle, payeeName, amountMinor, currency }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const amountMajor = amountMinor / 100;
  const upiUri = buildUpiUri(payeeHandle, payeeName, amountMajor, currency);

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
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG 
              value={upiUri} 
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Amount */}
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {currency} {amountMajor.toLocaleString(currency === "USD" ? "en-US" : "en-IN", { minimumFractionDigits: 2 })}
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

          {/* Mobile: Open Payment App */}
          {isMobile && (
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
