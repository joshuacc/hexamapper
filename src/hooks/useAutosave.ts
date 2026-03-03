import { useEffect } from "react";
import { useEditorStore } from "../state/editorStore";

const AUTOSAVE_KEY = "hexamapper.autosave.v1";

function debounce<T extends (...args: never[]) => void>(callback: T, waitMs: number): T {
  let timeoutId: number | null = null;

  return ((...args: never[]) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => callback(...args), waitMs);
  }) as T;
}

export function useAutosave(): void {
  const project = useEditorStore((state) => state.project);

  useEffect(() => {
    const save = debounce(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
    }, 350);

    save();
  }, [project]);
}

export function readAutosave(): unknown | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
