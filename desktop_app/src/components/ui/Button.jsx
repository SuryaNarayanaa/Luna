import React from "react"
import { cn } from "../../utils"

const buttonVariants = {
  default: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white text-zinc-900 hover:bg-gray-100 h-10 px-4 py-2",
  destructive: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2",
  outline: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-zinc-300 bg-white hover:bg-zinc-50 hover:text-zinc-900 h-10 px-4 py-2",
  secondary: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 h-10 px-4 py-2",
  ghost: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-zinc-100 hover:text-zinc-900 h-10 px-4 py-2",
  link: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-blue-600 underline-offset-4 hover:underline h-10 px-4 py-2"
}

const buttonSizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
}

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const baseClasses = buttonVariants[variant] || buttonVariants.default;
  const sizeClasses = buttonSizes[size] || buttonSizes.default;
  
  return (
    <button
      className={cn(baseClasses, className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
