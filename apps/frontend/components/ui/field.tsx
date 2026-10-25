import * as React from 'react';
import { cn } from '@/lib/utils';

const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: 'vertical' | 'horizontal' }>(
  ({ className, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-orientation={orientation}
      className={cn(
        'flex flex-col gap-1.5',
        orientation === 'horizontal' && 'flex-row items-center',
        className,
      )}
      {...props}
    />
  ),
);
Field.displayName = 'Field';

const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="group" className={cn('flex flex-col gap-4', className)} {...props} />
  ),
);
FieldGroup.displayName = 'FieldGroup';

const FieldLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    />
  ),
);
FieldLabel.displayName = 'FieldLabel';

const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  ),
);
FieldDescription.displayName = 'FieldDescription';

const FieldSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn('-mx-1 h-px bg-border', className)} {...props} />
  ),
);
FieldSeparator.displayName = 'FieldSeparator';

const FieldSet = React.forwardRef<HTMLFieldSetElement, React.FieldsetHTMLAttributes<HTMLFieldSetElement>>(
  ({ className, ...props }, ref) => (
    <fieldset ref={ref} className={cn('flex flex-col gap-4', className)} {...props} />
  ),
);
FieldSet.displayName = 'FieldSet';

const FieldLegend = React.forwardRef<HTMLLegendElement, React.HTMLAttributes<HTMLLegendElement>>(
  ({ className, ...props }, ref) => (
    <legend ref={ref} className={cn('text-sm font-medium', className)} {...props} />
  ),
);
FieldLegend.displayName = 'FieldLegend';

export { Field, FieldGroup, FieldLabel, FieldDescription, FieldSeparator, FieldSet, FieldLegend };
