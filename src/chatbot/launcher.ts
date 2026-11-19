import { createContext } from "react";

export const AssistantLauncherContext = createContext<{
  isOpen: boolean;
  showHint: boolean;
  openFrom: (button: HTMLButtonElement) => void;
} | null>(null);
