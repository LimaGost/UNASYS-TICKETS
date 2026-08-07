import React from "react";
import { AlertTriangle, X } from "lucide-react";

export default function WarnToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border border-amber-400 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 max-w-[90vw]"
    >
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <p className="text-[12px] font-medium text-amber-800 dark:text-amber-200">{message}</p>
      <button
        onClick={onClose}
        aria-label="Fechar aviso"
        className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 cursor-pointer flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}