"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("modal-scrim fixed inset-0 z-50 bg-black/60 backdrop-blur-md", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Conteúdo do diálogo. Radix cuida de foco (trap + restauração), ESC, scroll-lock,
 * `aria-modal` e inert do fundo. `showClose` adiciona o ✕ no canto.
 *
 * Responsivo: no mobile (<sm) vira um bottom-sheet full-width que sobe do rodapé
 * (com alça de arrasto visual); no desktop mantém o diálogo centrado. Os
 * `max-w-*` passados via className continuam valendo só no desktop.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showClose?: boolean; overlayClassName?: string }
>(({ className, children, showClose = true, overlayClassName, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "modal-pop fixed z-50 flex w-full flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-lg)] outline-none",
        // mobile: sheet ancorado no rodapé
        "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-2xl border-b-0",
        // desktop: diálogo centrado
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-b",
        className,
      )}
      {...props}
    >
      {/* Alça do sheet (só mobile) — affordance de "puxar" padrão de apps. */}
      <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" />
      {children}
      {showClose && (
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-4 top-3.5 grid h-9 w-9 place-items-center rounded-lg text-faint transition-colors hover:bg-surface2 hover:text-text focus-visible:ring-2 focus-visible:ring-[#e91e8c]/40"
        >
          ✕
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-text", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-xs text-faint", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogTitle, DialogDescription };
