import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background-color,box-shadow] active:scale-[.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-110 shadow-sm',
        outline: 'border border-border bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        accentOutline: 'text-primary ring-1 ring-inset ring-primary hover:bg-primary-soft',
        destructive: 'text-bad ring-1 ring-inset ring-bad hover:bg-bad-soft',
      },
      size: {
        default: 'h-10 px-5 text-[15px]',
        sm: 'h-8 px-3.5 text-[13px]',
        xs: 'h-7 px-2.5 text-xs rounded-lg',
        block: 'h-9 w-full text-[13px] rounded-xl',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
