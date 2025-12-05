import Link from 'next/link'
import { forwardRef, type ComponentProps, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold',
  ghost: 'bg-slate-800 hover:bg-slate-700 text-slate-50',
  danger: 'bg-red-900/50 hover:bg-red-900/80 text-red-300',
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors cursor-pointer'

type ButtonBaseProps = {
  variant?: Variant
  active?: boolean
  fullWidth?: boolean
  children: ReactNode
}

type ButtonAsButton = ButtonBaseProps &
  Omit<ComponentProps<'button'>, keyof ButtonBaseProps> & {
    href?: never
  }

type ButtonAsLink = ButtonBaseProps &
  Omit<ComponentProps<typeof Link>, keyof ButtonBaseProps> & {
    href: string
  }

type ButtonProps = ButtonAsButton | ButtonAsLink

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const { variant = 'ghost', active, fullWidth, className = '', children, ...rest } = props

    const classes = [
      baseStyles,
      active ? 'bg-blue-600 text-white' : variantStyles[variant],
      fullWidth && 'w-full',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if ('href' in rest && rest.href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...(rest as Omit<ComponentProps<typeof Link>, 'className'>)}
        >
          {children}
        </Link>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...(rest as Omit<ComponentProps<'button'>, 'className'>)}
      >
        {children}
      </button>
    )
  }
)
