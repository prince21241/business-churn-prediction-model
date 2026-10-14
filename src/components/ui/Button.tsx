import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

function buttonClass(variant: Variant = 'primary', size: Size = 'md'): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
    size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-10 px-4 text-sm',
    variant === 'primary' && 'bg-accent text-white hover:bg-accent-strong',
    variant === 'secondary' && 'border border-line bg-white text-ink hover:bg-[#f6f8fb]',
    variant === 'ghost' && 'bg-transparent text-ink hover:bg-[#eef2f6]',
    variant === 'danger' && 'bg-danger text-white hover:bg-[#7f0e2e]',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#e7edf4] disabled:text-ink-soft',
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cn(buttonClass(variant, size), className)}>
      {children}
    </Link>
  )
}
