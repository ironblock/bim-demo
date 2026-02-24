import { useLayoutEffect, useState, type RefObject } from "react";

export type FileDropState = {
  isDragging: boolean;
  files: FileList | null;
};

export function useFileDrop(
  extension: string,
  target: RefObject<HTMLElement | null>,
  onFilesDropped?: (files: FileList) => void,
): FileDropState {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  useLayoutEffect(() => {
    if (!target.current) return;

    console.info("Binding file drop listeners");

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
              if (!file.name.toLowerCase().endsWith(extension)) {
                console.error(`All files must be in ${extension} format`);
                return;
              }
            }

            console.info("Files dropped:", event.dataTransfer.files);
            onFilesDropped?.(event.dataTransfer.files);
            setFiles(event.dataTransfer.files);
          }
          return;
      }
    };

    target.current.addEventListener("dragover", handleDragEvent);
    target.current.addEventListener("dragleave", handleDragEvent);
    target.current.addEventListener("drop", handleDragEvent);

    return () => {
      if (!target.current) return;

      console.info("Unbinding file drop listeners");

      target.current.removeEventListener("dragover", handleDragEvent);
      target.current.removeEventListener("dragleave", handleDragEvent);
      target.current.removeEventListener("drop", handleDragEvent);
    };
  }, []);

  return { isDragging, files };
}
