import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

/**
 * Synchronizes Transit Network workspace fullscreen state with the browser's
 * Fullscreen API, including exits initiated by Escape or browser controls.
 */
export default function useTransitWorkspaceFullscreen(workspaceRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSupported = Boolean(document.documentElement.requestFullscreen);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [workspaceRef]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) {
        await document.exitFullscreen();
        return;
      }

      await workspaceRef.current?.requestFullscreen();
    } catch {
      toast.error("The Transit Network fullscreen mode could not be changed.");
    }
  }, [workspaceRef]);

  return {
    isFullscreen,
    isSupported,
    toggleFullscreen,
  };
}
