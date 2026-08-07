import React, { useRef, forwardRef, useImperativeHandle } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const RichEditor = forwardRef(({ value, onChange, placeholder }, ref) => {
  const internalRef = useRef(null);

  // Use internal ref to avoid findDOMNode issues
  React.useImperativeHandle(ref, () => ({
    getEditor: () => internalRef.current?.getEditor?.(),
  }));

  return (
    <>
      <style>{`
        .ql-editor img {
          max-width: 100%;
          height: auto;
          cursor: nwse-resize;
        }
        .ql-container {
          font-family: inherit;
          border: none !important;
        }
        .ql-editor {
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
          background: hsl(var(--card));
          color: hsl(var(--foreground));
        }
        .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .ql-toolbar.ql-snow {
          background: hsl(var(--muted));
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .ql-toolbar.ql-snow .ql-stroke {
          stroke: hsl(var(--foreground) / 0.6);
        }
        .ql-toolbar.ql-snow .ql-fill {
          fill: hsl(var(--foreground) / 0.6);
        }
        .ql-toolbar.ql-snow button:hover .ql-stroke,
        .ql-toolbar.ql-snow button.ql-active .ql-stroke {
          stroke: hsl(var(--primary));
        }
        .ql-toolbar.ql-snow button:hover .ql-fill,
        .ql-toolbar.ql-snow button.ql-active .ql-fill {
          fill: hsl(var(--primary));
        }
        .ql-snow.ql-toolbar button:hover,
        .ql-snow.ql-toolbar button.ql-active {
          color: hsl(var(--primary));
        }
        .ql-snow .ql-picker-label {
          color: hsl(var(--foreground) / 0.7);
        }
        .ql-snow .ql-picker-options {
          background: hsl(var(--card));
          border-color: hsl(var(--border));
        }
      `}</style>
      <ReactQuill
        ref={internalRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={{
          toolbar: [
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "image"],
            [{ size: ["small", false, "large", "huge"] }],
            ["clean"],
          ],
        }}
        style={{ border: "none" }}
      />
    </>
  );
});

RichEditor.displayName = "RichEditor";

export default RichEditor;