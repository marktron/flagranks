"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoteErrorToastProps {
  message: string;
  failedCount: number;
  onRetry: () => void;
  onDismiss: () => void;
}

export function VoteErrorToast({
  message,
  failedCount,
  onRetry,
  onDismiss,
}: VoteErrorToastProps) {
  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80
                 bg-red-50 border-2 border-red-200 rounded-lg p-4 shadow-lg z-50
                 animate-slide-up"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-red-800 text-sm">
            {failedCount} vote{failedCount !== 1 ? "s" : ""} failed to sync
          </p>
          <p className="text-red-600 text-xs mt-1 truncate">{message}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
