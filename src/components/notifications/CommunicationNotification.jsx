import React, { useEffect, useState } from "react";
import { Mail, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function CommunicationNotification({ 
  type = "message", // "message" | "email" | "delivery_update"
  title,
  message,
  icon,
  autoClose = 4000 
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => setIsVisible(false), autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose]);

  if (!isVisible) return null;

  const icons = {
    message: <MessageCircle className="w-5 h-5 text-green-400" />,
    email: <Mail className="w-5 h-5 text-blue-400" />,
    delivery_update: <CheckCircle2 className="w-5 h-5 text-purple-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
  };

  return (
    <div className="fixed bottom-20 right-6 z-40 animate-slide-in">
      <div className="bg-[#161830] border border-[rgba(139,92,246,0.2)] rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {icon || icons[type]}
          </div>
          
          <div className="flex-1">
            {title && (
              <h4 className="font-semibold text-sm text-white mb-1">
                {title}
              </h4>
            )}
            {message && (
              <p className="text-xs text-gray-300 leading-relaxed">
                {message}
              </p>
            )}
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast helper para comunicações
export const showCommunicationToast = (type, title, message) => {
  const icons = {
    message: "💬",
    email: "📧",
    delivery_update: "✓✓",
    error: "⚠️",
  };

  toast[type === "error" ? "error" : "success"](
    `${icons[type]} ${title}`,
    { description: message }
  );
};