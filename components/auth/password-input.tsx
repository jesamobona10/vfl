"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type PasswordInputProps = React.ComponentProps<typeof Input>;

export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-8 -translate-y-1/2 text-muted hover:text-text"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
