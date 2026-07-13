"use client"

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

import styles from "./landing.module.css"

export function LandingSpotlight({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }

    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const surface = surfaceRef.current
      if (!surface) return
      surface.style.setProperty("--landing-spotlight-x", `${pointerRef.current.x}px`)
      surface.style.setProperty("--landing-spotlight-y", `${pointerRef.current.y}px`)
    })
  }

  return (
    <div
      ref={surfaceRef}
      onPointerMove={handlePointerMove}
      className={cn(styles.spotlight, className)}
    >
      {children}
    </div>
  )
}
