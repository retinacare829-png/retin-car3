/**
 * Adapted from Rare UI's folder visual: https://www.rareui.com/components/foldercomponent
 * Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution.
 * See ../../docs/RARE_UI_LICENSE.txt. Dependency-free CSS adaptation for file uploads.
 */
import { useId, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import "./AnimatedFolder.css";

export interface AnimatedFolderProps {
  /** Both picker and drop send files here; the caller owns validation and persistence. */
  onFiles: (files: File[]) => void;
  /** Accessible name of the native file input; keep existing upload labels here. */
  inputLabel: string;
  label?: string;
  buttonLabel?: string;
  description?: ReactNode;
  /** IDs of caller-owned hints/errors, applied to both input and button. */
  describedBy?: string;
  invalid?: boolean;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedFolder({
  onFiles, inputLabel, label = "Arrastrá aquí tu imagen", buttonLabel = "Elegir imagen",
  description, describedBy, invalid = false, accept = "image/jpeg,image/png,image/webp",
  multiple = false, disabled = false, busy = false, selected = false, size = "md",
  compact = false, className = "", style,
}: AnimatedFolderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragging, setDragging] = useState(false);
  const unavailable = disabled || busy;
  const descriptionIds = [description ? descriptionId : null, describedBy].filter(Boolean).join(" ") || undefined;

  function receiveFiles(files: FileList | File[]) {
    if (unavailable || !files.length) return;
    // Do not filter by accept: invalid files must reach the caller's validation feedback.
    const selection = Array.from(files);
    onFiles(multiple ? selection : selection.slice(0, 1));
  }

  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = unavailable ? "none" : "copy";
    setDragging(!unavailable);
  }

  return <div
    className={`animated-folder${compact ? " animated-folder--compact" : ""} ${className}`.trim()}
    style={style}
    data-size={size}
    data-state={unavailable ? "disabled" : dragging ? "dragging" : selected ? "selected" : "idle"}
    aria-busy={busy}
    onDragEnter={dragOver}
    onDragOver={dragOver}
    onDragLeave={(event) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    }}
    onDrop={(event) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      setDragging(false);
      receiveFiles(event.dataTransfer.files);
    }}
  >
    <div className="animated-folder__art" aria-hidden="true">
      <div className="animated-folder__back" />
      <div className="animated-folder__card animated-folder__card--left"><i /><i /><i /></div>
      <div className="animated-folder__card animated-folder__card--right"><i /><i /><i /></div>
      <div className="animated-folder__card animated-folder__card--center"><i /><i /><i /></div>
      <div className="animated-folder__flap">
        <svg viewBox="0 0 160 112" focusable="false"><path d="M12 2h49c5 0 7 1 10 5l12 13h65a10 10 0 0 1 10 10v70a10 10 0 0 1-10 10H12a10 10 0 0 1-10-10V12A10 10 0 0 1 12 2Z" /></svg>
        <svg className="animated-folder__upload" viewBox="0 0 24 24" fill="none" focusable="false"><path d="M12 16V5m-4 4 4-4 4 4M5 15v4h14v-4" /></svg>
      </div>
    </div>
    <div className="animated-folder__copy">
      <strong>{label}</strong>
      {description ? <small id={descriptionId}>{description}</small> : null}
    </div>
    <input ref={inputRef} type="file" hidden tabIndex={-1} accept={accept} multiple={multiple}
      aria-label={inputLabel} aria-describedby={descriptionIds} aria-invalid={invalid} disabled={unavailable}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        receiveFiles(files);
      }} />
    <button className="animated-folder__button" type="button" disabled={unavailable}
      aria-describedby={descriptionIds} aria-invalid={invalid}
      onClick={() => inputRef.current?.click()}>
      {buttonLabel}
    </button>
  </div>;
}
