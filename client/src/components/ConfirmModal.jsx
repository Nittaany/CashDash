import { useEffect, useRef } from "react";

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (isOpen && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div 
        className="bg-slate-800 rounded-lg p-6 max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-white mb-2">
          {title}
        </h2>
        <p className="text-slate-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
