import { useEffect, useState, type RefObject } from "react";

export type IfcDropState = {
  isDragging: boolean;
  files: FileList | null;
};

export function useIfcDrop(
  canvas: RefObject<HTMLCanvasElement | null>,
): IfcDropState {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (!canvas.current) return;

    const handleDragEvent = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      switch (event.type) {
        case "dragenter":
          setIsDragging(true);
          return;

        case "dragleave":
          setIsDragging(false);
          return;

        case "drop":
          setIsDragging(false);
          if (event.dataTransfer?.files.length) {
            for (const file of event.dataTransfer.files) {
              if (!file.name.toLowerCase().endsWith(".ifc")) {
                console.error("All files must be in IFC format");
                return;
              }
            }

            console.info("Files dropped:", event.dataTransfer.files);
            setFiles(event.dataTransfer.files);
          }
          return;
      }
    };

    canvas.current.addEventListener("dragover", handleDragEvent);
    canvas.current.addEventListener("dragleave", handleDragEvent);
    canvas.current.addEventListener("drop", handleDragEvent);

    return () => {
      if (!canvas.current) return;

      canvas.current.removeEventListener("dragover", handleDragEvent);
      canvas.current.removeEventListener("dragleave", handleDragEvent);
      canvas.current.removeEventListener("drop", handleDragEvent);
    };
  }, [canvas]);

  return { isDragging, files };
}
