"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
    }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const processedChildren = React.Children.toArray(children);
  const header = processedChildren.find(
    (child) => React.isValidElement(child) && (child as any).type?.displayName === "DialogHeader"
  );
  const footer = processedChildren.find(
    (child) => React.isValidElement(child) && (child as any).type?.displayName === "DialogFooter"
  );
  const body = processedChildren.find(
    (child) => React.isValidElement(child) && (child as any).type?.displayName === "DialogBody"
  );
  const otherChildren = processedChildren.filter(
    (child) =>
      !React.isValidElement(child) ||
      ((child as any).type?.displayName !== "DialogHeader" &&
        (child as any).type?.displayName !== "DialogFooter" &&
        (child as any).type?.displayName !== "DialogBody")
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
          "p-0 rounded-2xl",
          "max-h-[85vh] flex flex-col overflow-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(202, 138, 4, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(202, 138, 4, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
        {...props}
      >
        {header}
        {body ? body : (
          <div className="flex-1 overflow-y-auto min-h-0 p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(202,138,4,0.3) transparent' }}>
            {otherChildren}
          </div>
        )}
        {footer}
        <DialogPrimitive.Close 
          className={cn(
            "absolute left-4 top-4 z-10",
            "w-9 h-9 rounded-full",
            "flex items-center justify-center",
            "transition-all duration-300 ease-out",
            "hover:scale-110 active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "disabled:pointer-events-none"
          )}
          style={{
            background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
            border: '1px solid rgba(202, 138, 4, 0.3)',
            color: '#ca8a04',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
          data-testid="dialog-close-button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">إغلاق</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-2 p-6 pb-5 text-right",
      className
    )}
    style={{
      background: 'linear-gradient(90deg, rgba(202, 138, 4, 0.08) 0%, transparent 100%)',
      borderBottom: '1px solid rgba(202, 138, 4, 0.2)',
      ...style,
    }}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto p-6 min-h-0",
      "scrollbar-thin scrollbar-thumb-[hsl(43_74%_49%_/_0.3)] scrollbar-track-transparent",
      className
    )}
    style={{
      background: 'rgba(15, 23, 42, 0.5)',
      maxHeight: 'calc(90vh - 180px)',
    }}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-row-reverse gap-3 p-6 pt-5",
      className
    )}
    style={{
      background: 'linear-gradient(270deg, rgba(202, 138, 4, 0.05) 0%, transparent 100%)',
      borderTop: '1px solid rgba(202, 138, 4, 0.2)',
      ...style,
    }}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight tracking-tight",
      className
    )}
    style={{
      color: '#ca8a04',
      textShadow: '0 0 20px rgba(202, 138, 4, 0.3)',
    }}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm", className)}
    style={{ color: 'rgba(226, 232, 240, 0.7)' }}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
