import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils";

const Select = ({ value, onValueChange, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative" {...props}>
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{value || "Select..."}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1 w-full z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md">
          {React.Children.map(children, child => 
            React.cloneElement(child, { 
              onValueChange: (newValue) => {
                onValueChange(newValue)
                setIsOpen(false)
              }
            })
          )}
        </div>
      )}
    </div>
  )
}

const SelectItem = ({ value, children, onValueChange }) => (
  <div
    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-zinc-100 focus:bg-zinc-100"
    onClick={() => onValueChange(value)}
  >
    {children}
  </div>
)

const SelectTrigger = ({ children, ...props }) => children
const SelectContent = ({ children, ...props }) => children
const SelectValue = ({ children, ...props }) => children

export { Select, SelectItem, SelectTrigger, SelectContent, SelectValue }
