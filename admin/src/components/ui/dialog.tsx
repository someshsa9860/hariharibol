import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

type ContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Show as a full page instead of a small pop-up: it fills the screen, has a Back button, and the browser's Back
   * button closes it. For anything that is read or edited at length. Quick questions (confirm, pick a role) stay small.
   */
  page?: boolean;
};

// While a page is open it owns one history step, so the browser's Back closes it instead of leaving the section.
function PageHistory({ back }: { back: React.RefObject<HTMLButtonElement | null> }) {
  const pushed = useRef(false);
  useEffect(() => {
    window.history.pushState({ page: true }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      back.current?.click();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushed.current) window.history.back();
    };
  }, [back]);
  return null;
}

export const DialogContent = forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, ContentProps>(
  ({ className, children, page, ...props }, ref) => {
    const backRef = useRef<HTMLButtonElement>(null);
    if (page) {
      return (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            ref={ref}
            // Radix would otherwise treat a click outside the page as "close"; there is no outside here.
            onInteractOutside={(e) => e.preventDefault()}
            className={cn('fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6 focus-visible:outline-none', className?.replace(/max-w-\S+|max-h-\S+/g, ''))}
            {...props}
          >
            <PageHistory back={backRef} />
            <div className="mx-auto max-w-5xl">
              <DialogPrimitive.Close ref={backRef} className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none">
                <ArrowLeft className="h-4 w-4" /> Back
              </DialogPrimitive.Close>
              {children}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      );
    }
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-4 shadow-lg sm:p-6',
            'max-h-[90vh] overflow-y-auto',
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex flex-wrap justify-end gap-2', className)} {...props} />;
}
