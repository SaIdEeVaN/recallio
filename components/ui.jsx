"use client";
import { useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";
export const modes = ["Summary", "Flashcards", "Quiz", "Tutor"];
export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modalBody">
        <div className="row between">
          <h2>{title}</h2>
          <button className="square" aria-label="Close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Citations({ refs = [], cite }) {
  return (
    <span className="cites">
      {refs.map((id) => (
        <button
          key={id}
          onClick={() => cite(id)}
          title={"Open source section " + id}
        >
          <FileText size={12} />
          {id}
        </button>
      ))}
    </span>
  );
}
export function DateText({ value }) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "—";
}
