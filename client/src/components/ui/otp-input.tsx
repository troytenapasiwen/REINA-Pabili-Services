import { useState, useRef, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface OTPInputProps {
  length?: number;
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

export function OTPInput({ length = 6, onComplete, disabled = false }: OTPInputProps) {
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (otp.length === length && onComplete) {
      onComplete(otp);
    }
  }, [otp, length, onComplete]);

  return (
    <div className="flex justify-center w-full">
      <InputOTP
        maxLength={length}
        value={otp}
        onChange={setOtp}
        disabled={disabled}
        pattern="^[0-9]+$"
      >
        {Array.from({ length }).map((_, i) => (
          <InputOTPGroup key={i}>
            <InputOTPSlot index={i} />
          </InputOTPGroup>
        ))}
      </InputOTP>
    </div>
  );
}
