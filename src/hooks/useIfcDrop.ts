import { useEffect, useState, type RefObject } from "react";

export function useIfcDrop(
  canvas: RefObject<HTMLCanvasElement | null>,
  loadModel: (source: File) => Promise<void>,
): boolean {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer?.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".ifc")) {
        console.error("Please drop an IFC file (.ifc extension)");
        return;
      }

      try {
        await loadModel(file);
      } catch (error) {
        console.error("Failed to load dropped IFC file:", error);
      }
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [canvas, loadModel]);

  return isDragging;
}
