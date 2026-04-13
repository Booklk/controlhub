import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

type ButtonProps = ComponentPropsWithoutRef<typeof Button>;

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingText, children, disabled, ...props }, ref) => {
    return (
      <Button ref={ref} disabled={disabled || loading} {...props}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
            {loadingText || children}
          </>
        ) : children}
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";
