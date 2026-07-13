"use client"

import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import styles from "./landing.module.css"

export function LandingActionLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: ReactNode
}) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const handlePointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "touch") return

    const bounds = event.currentTarget.getBoundingClientRect()
    pointerRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }

    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const link = linkRef.current
      if (!link) return
      link.style.setProperty("--landing-cta-x", `${pointerRef.current.x}px`)
      link.style.setProperty("--landing-cta-y", `${pointerRef.current.y}px`)
    })
  }

  return (
    <Link
      ref={linkRef}
      href={href}
      className={className}
      onPointerMove={handlePointerMove}
    >
      <span>{children}</span>
      <span className={styles.ctaIcon} aria-hidden="true">
        <ArrowRightIcon />
      </span>
    </Link>
  )
}
