import { useEffect } from "react";

export function usePageVisibility(
  onHidden: () => void,
  onVisible?: () => void
) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onHidden();
      } else if (onVisible) {
        onVisible();
      }
    };

    const handleBeforeUnload = () => {
      onHidden();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [onHidden, onVisible]);
}
