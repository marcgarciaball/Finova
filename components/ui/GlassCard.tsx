import * as React from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'glass p-6 text-ink',
        hoverable &&
          'motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5',
        className
      )}
      {...props}
    />
  )
)
GlassCard.displayName = 'GlassCard'

export {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
export { GlassCard }
