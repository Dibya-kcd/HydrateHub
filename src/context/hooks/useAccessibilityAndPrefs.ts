import React, { useEffect, useRef, useState } from "react";
import { FONT_SCALES, PALETTES } from "../../constants/initialData";
import type { FontSize, PaletteTokens, StickyTotalPosition } from "../../types";

export interface UseAccessibilityAndPrefsParams {
  initialFontSize: FontSize;
  initialHighContrast: boolean;
  initialLowVisionMode?: boolean;
  initialLowVisionStickyPosition?: StickyTotalPosition;
}

export interface UseAccessibilityAndPrefsResult {
  fontSize: FontSize;
  setFontSize: React.Dispatch<React.SetStateAction<FontSize>>;
  highContrast: boolean;
  setHighContrast: React.Dispatch<React.SetStateAction<boolean>>;
  lowVisionMode: boolean;
  setLowVisionMode: (valueOrUpdater: boolean | ((prev: boolean) => boolean)) => void;
  toggleLowVisionMode: () => void;
  lowVisionStickyPosition: StickyTotalPosition;
  setLowVisionStickyPosition: React.Dispatch<React.SetStateAction<StickyTotalPosition>>;
  scale: number;
  palette: PaletteTokens;
  fz: (px: number, extra?: React.CSSProperties) => React.CSSProperties;
}

export function useAccessibilityAndPrefs({
  initialFontSize,
  initialHighContrast,
  initialLowVisionMode,
  initialLowVisionStickyPosition,
}: UseAccessibilityAndPrefsParams): UseAccessibilityAndPrefsResult {
  const [fontSize, setFontSize] = useState<FontSize>(initialFontSize);
  const [highContrast, setHighContrast] = useState<boolean>(initialHighContrast);
  const [lowVisionMode, setLowVisionModeState] = useState<boolean>(
    Boolean(initialLowVisionMode),
  );
  const [lowVisionStickyPosition, setLowVisionStickyPosition] =
    useState<StickyTotalPosition>(initialLowVisionStickyPosition || "bottom");

  // Remembers what the user had BEFORE Easy View was switched on, so switching
  // back to Normal restores their own font size / contrast instead of leaving
  // the app stuck in the high-contrast look.
  const preLowVisionRef = useRef<{ fontSize: FontSize; highContrast: boolean } | null>(
    (() => {
      try {
        const raw = localStorage.getItem("mrwater_pre_low_vision");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })(),
  );

  const setLowVisionMode = (
    valueOrUpdater: boolean | ((prev: boolean) => boolean),
  ) => {
    const nextVal =
      typeof valueOrUpdater === "function"
        ? valueOrUpdater(lowVisionMode)
        : valueOrUpdater;
    if (nextVal === lowVisionMode) return;

    if (nextVal) {
      preLowVisionRef.current = { fontSize, highContrast };
      try {
        localStorage.setItem(
          "mrwater_pre_low_vision",
          JSON.stringify(preLowVisionRef.current),
        );
      } catch {
        /* ignore */
      }
      setHighContrast(true);
      if (fontSize === "standard") setFontSize("large");
    } else {
      const prev = preLowVisionRef.current;
      setHighContrast(prev ? prev.highContrast : false);
      if (prev) setFontSize(prev.fontSize);
      preLowVisionRef.current = null;
      try {
        localStorage.removeItem("mrwater_pre_low_vision");
      } catch {
        /* ignore */
      }
    }
    setLowVisionModeState(nextVal);
  };

  const toggleLowVisionMode = () => {
    setLowVisionMode((prev) => !prev);
  };

  const scale = FONT_SCALES[fontSize];
  const palette = PALETTES[highContrast ? "highContrast" : "standard"];

  const fz = (
    px: number,
    extra?: React.CSSProperties,
  ): React.CSSProperties => ({
    fontSize: `${Math.round(px * scale)}px`,
    ...extra,
  });

  // Save ONLY lightweight display preferences, NEVER business database records
  useEffect(() => {
    try {
      localStorage.setItem(
        "mrwater_ui_prefs",
        JSON.stringify({
          prefsVersion: 2,
          fontSize,
          highContrast,
          lowVisionMode,
          lowVisionStickyPosition,
        }),
      );
    } catch {
      // ignore
    }
  }, [fontSize, highContrast, lowVisionMode, lowVisionStickyPosition]);

  // Push the font-size scale onto the document root as a CSS variable.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-scale",
      String(scale),
    );
  }, [scale]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      highContrast ? "high-contrast" : "standard",
    );
  }, [highContrast]);

  return {
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    lowVisionMode,
    setLowVisionMode,
    toggleLowVisionMode,
    lowVisionStickyPosition,
    setLowVisionStickyPosition,
    scale,
    palette,
    fz,
  };
}
