"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const SETTINGS_KEY = "flagranks_settings";

interface Settings {
  showNamesWhileVoting: boolean;
}

interface SettingsContextValue {
  settings: Settings;
  isLoaded: boolean;
  toggleShowNames: () => void;
}

const defaultSettings: Settings = {
  showNamesWhileVoting: false,
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  isLoaded: false,
  toggleShowNames: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore errors
    }
    setIsLoaded(true);
  }, []);

  const toggleShowNames = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, showNamesWhileVoting: !prev.showNamesWhileVoting };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore errors
      }
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoaded, toggleShowNames }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
