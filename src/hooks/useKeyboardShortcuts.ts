import { useEffect } from "react";
import { useEditorStore } from "../state/editorStore";

export function useKeyboardShortcuts(): void {
  const setTool = useEditorStore((state) => state.setTool);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setLayer = useEditorStore((state) => state.setLayer);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (key === "b") {
        setTool("brush");
      } else if (key === "e") {
        setTool("erase");
      } else if (key === "f") {
        setTool("fill");
      } else if (key === "l") {
        setTool("label");
      } else if (key === "g") {
        setTool("fog");
        setLayer("fog");
      } else if (key === "i" || key === "v") {
        setTool("select");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, setLayer, setTool, undo]);
}
