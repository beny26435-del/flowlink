import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  help?: string;
};

export function Input({ label, help, id, ...props }: InputProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

export function Textarea({ label, help, id, ...props }: TextareaProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} {...props} />
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}
