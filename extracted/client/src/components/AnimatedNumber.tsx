import { CSSProperties, HTMLAttributes } from "react";
import { useCountUp } from "@/hooks/use-count-up";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  loading?: boolean;
  suffix?: string;
  style?: CSSProperties;
}

export function AnimatedNumber({ value, loading, suffix = "", className, style, ...rest }: Props) {
  const count = useCountUp(loading ? 0 : value, 900, !loading);
  if (loading) return <span className={className} style={style} {...rest}>...</span>;
  return <span className={className} style={style} {...rest}>{count}{suffix}</span>;
}
