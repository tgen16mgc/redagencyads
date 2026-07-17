"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  ChevronUpIcon,
  EllipsisIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { actionDescription } from "@/components/dashboard/action-dock-description"
import { cn } from "@/lib/utils"

export type ActionDockStatus = "idle" | "ready" | "working" | "blocked"

export interface ActionDockAction {
  id: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  onSelect: () => void | Promise<void>
  disabled?: boolean
  disabledReason?: string
  loading?: boolean
  tooltip?: string
  badge?: string | number
  shortcut?: "mod+enter"
}

export interface StickyActionDockProps {
  contextLabel: string
  primaryAction: ActionDockAction
  secondaryActions?: ActionDockAction[]
  status?: ActionDockStatus
  statusLabel?: string
  statusBadge?: string | number
  position?: "fixed" | "sticky" | "inline"
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  actionsLabel?: string
  className?: string
  glowColors?: string[]
}

const STATUS_LABELS: Record<ActionDockStatus, string> = {
  idle: "Waiting",
  ready: "Ready",
  working: "Working",
  blocked: "Needs setup",
}

const STATUS_VARIANTS = {
  idle: "outline",
  ready: "success",
  working: "secondary",
  blocked: "destructive",
} as const

const POSITION_CLASSES = {
  fixed:
    "pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 px-3",
  sticky:
    "pointer-events-none sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 px-3",
  inline: "pointer-events-none px-3",
} as const

function ActionLabel({ action }: { action: ActionDockAction }) {
  return (
    <>
      <span className={cn("truncate", action.shortLabel && "hidden sm:inline")}>
        {action.label}
      </span>
      {action.shortLabel ? (
        <span className="truncate sm:hidden">{action.shortLabel}</span>
      ) : null}
    </>
  )
}

/**
 * A context-aware action surface for the current workspace step. The parent owns
 * lifecycle truth; this component turns that truth into an accessible dock.
 */
export function StickyActionDock({
  contextLabel,
  primaryAction,
  secondaryActions = [],
  status = "idle",
  statusLabel,
  statusBadge,
  position = "fixed",
  expanded: controlledExpanded,
  defaultExpanded = false,
  onExpandedChange,
  actionsLabel = "More actions",
  className,
  glowColors = [
    "var(--action-glow-primary)",
    "var(--action-glow-secondary)",
    "var(--action-glow-primary)",
  ],
}: StickyActionDockProps) {
  const actionsId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstSecondaryActionRef = useRef<HTMLButtonElement>(null)
  const dockSurfaceRef = useRef<HTMLDivElement>(null)
  const pointerFrameRef = useRef<number | null>(null)
  const pointerPositionRef = useRef({ x: 0, y: 0 })
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
  const isExpanded = controlledExpanded ?? uncontrolledExpanded
  const hasSecondaryActions = secondaryActions.length > 0
  const resolvedStatusLabel = statusLabel ?? STATUS_LABELS[status]
  const primaryIsWorking = status === "working" || Boolean(primaryAction.loading)
  const primaryIsDisabled =
    status === "blocked" || Boolean(primaryAction.disabled) || primaryIsWorking

  const setExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (controlledExpanded === undefined) {
        setUncontrolledExpanded(nextExpanded)
      }
      onExpandedChange?.(nextExpanded)
    },
    [controlledExpanded, onExpandedChange]
  )

  const runPrimaryAction = useCallback(() => {
    if (primaryIsDisabled) return
    void primaryAction.onSelect()
  }, [primaryAction, primaryIsDisabled])

  useEffect(() => {
    if (primaryAction.shortcut !== "mod+enter") return

    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      runPrimaryAction()
    }

    document.addEventListener("keydown", handleShortcut)
    return () => document.removeEventListener("keydown", handleShortcut)
  }, [primaryAction.shortcut, runPrimaryAction])

  useEffect(() => {
    return () => {
      if (pointerFrameRef.current !== null) {
        cancelAnimationFrame(pointerFrameRef.current)
      }
    }
  }, [])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return

    const bounds = event.currentTarget.getBoundingClientRect()
    pointerPositionRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }

    if (pointerFrameRef.current !== null) return
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = null
      const surface = dockSurfaceRef.current
      if (!surface) return
      surface.style.setProperty("--dock-x", `${pointerPositionRef.current.x}px`)
      surface.style.setProperty("--dock-y", `${pointerPositionRef.current.y}px`)
    })
  }

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const nextExpanded = !isExpanded
    setExpanded(nextExpanded)

    if (nextExpanded && event.detail === 0) {
      requestAnimationFrame(() => firstSecondaryActionRef.current?.focus())
    }
  }

  const handleDockKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !isExpanded) return
    event.preventDefault()
    setExpanded(false)
    toggleRef.current?.focus()
  }

  return (
    <TooltipProvider>
      <div
        data-slot="sticky-action-dock"
        data-status={status}
        className={cn(POSITION_CLASSES[position], className)}
      >
        <div
          role="group"
          aria-label={`${contextLabel}. ${resolvedStatusLabel}`}
          onKeyDown={handleDockKeyDown}
          className="pointer-events-auto mx-auto flex w-fit max-w-full flex-col items-end gap-2"
        >
          <span className="sr-only" aria-live="polite">
            {resolvedStatusLabel}
          </span>

          <div
            ref={dockSurfaceRef}
            onPointerMove={handlePointerMove}
            data-expanded={isExpanded ? "true" : "false"}
            className="action-dock-island max-w-full"
          >
            {hasSecondaryActions ? (
              <div className="action-dock-tray-shell" aria-hidden={!isExpanded}>
                <div
                  id={actionsId}
                  role="group"
                  aria-label={actionsLabel}
                  className="action-dock-tray flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-between gap-1.5"
                >
                  <div className="action-dock-tray-meta flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {actionsLabel}
                    </span>
                    {primaryAction.shortcut === "mod+enter" ? (
                      <kbd className="action-dock-shortcut hidden sm:inline-flex">Cmd/Ctrl + Enter</kbd>
                    ) : null}
                  </div>
                  {secondaryActions.map((action, index) => {
                    const Icon = action.icon
                    const actionIsDisabled = Boolean(action.disabled || action.loading)
                    const description = actionDescription(action, actionIsDisabled)

                    return (
                      <Tooltip key={action.id}>
                        <TooltipTrigger
                          render={
                            <Button
                              ref={index === 0 ? firstSecondaryActionRef : undefined}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={actionIsDisabled}
                              tabIndex={isExpanded ? undefined : -1}
                              aria-label={action.label}
                              title={description}
                              onClick={() => {
                                setExpanded(false)
                                void action.onSelect()
                              }}
                              className="action-dock-secondary-action"
                              style={{ "--action-index": index } as CSSProperties}
                            >
                              {action.loading ? (
                                <Spinner data-icon="inline-start" />
                              ) : (
                                <Icon data-icon="inline-start" />
                              )}
                              <span className="hidden truncate sm:inline">{action.label}</span>
                              {action.badge !== undefined ? (
                                <Badge variant="secondary">{action.badge}</Badge>
                              ) : null}
                            </Button>
                          }
                        />
                        <TooltipContent>{description}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="action-dock-surface flex max-w-full items-center gap-1">
              <div className="action-dock-context hidden min-w-0 items-center gap-2 pl-2 sm:flex">
                <span className="max-w-40 truncate text-sm font-medium text-foreground">
                  {contextLabel}
                </span>
                <Badge
                  variant={STATUS_VARIANTS[status]}
                  className="action-dock-status"
                >
                  <span className="action-dock-status-signal" aria-hidden="true" />
                  {resolvedStatusLabel}
                  {statusBadge !== undefined ? (
                    <span className="font-mono tabular-nums">{statusBadge}</span>
                  ) : null}
                </Badge>
              </div>

              <span className="action-dock-mobile-status inline-flex sm:hidden" aria-hidden="true">
                <span className="action-dock-status-signal" />
              </span>

              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

              {hasSecondaryActions ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        ref={toggleRef}
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-expanded={isExpanded}
                        aria-controls={actionsId}
                        aria-label={isExpanded ? `Hide ${actionsLabel}` : actionsLabel}
                        onClick={handleToggle}
                        className="action-dock-toggle"
                      >
                        <EllipsisIcon data-icon="inline-start" />
                        <span className="hidden sm:inline">{actionsLabel}</span>
                        <ChevronUpIcon
                          data-icon="inline-end"
                          className="action-dock-toggle-chevron"
                        />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {isExpanded ? `Hide ${actionsLabel}` : actionsLabel}
                  </TooltipContent>
                </Tooltip>
              ) : null}

              <div
                data-active={status === "ready" && !primaryIsDisabled ? "true" : "false"}
                className="action-dock-primary-frame min-w-0 shrink-0"
                style={{
                  "--dock-glow-primary": glowColors[0],
                  "--dock-glow-secondary": glowColors[1] ?? glowColors[0],
                  "--dock-glow-tertiary": glowColors[2] ?? glowColors[0],
                } as CSSProperties}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        disabled={primaryIsDisabled}
                        aria-keyshortcuts={
                          primaryAction.shortcut === "mod+enter"
                            ? "Meta+Enter Control+Enter"
                            : undefined
                        }
                        title={actionDescription(primaryAction, primaryIsDisabled)}
                        onClick={runPrimaryAction}
                        data-working={primaryIsWorking ? "true" : undefined}
                        className="action-dock-primary max-w-64 sm:max-w-none"
                      >
                        {primaryIsWorking ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <span className="action-dock-primary-glyph">
                            <primaryAction.icon data-icon="inline-start" />
                          </span>
                        )}
                        <ActionLabel action={primaryAction} />
                        {primaryAction.badge !== undefined ? (
                          <Badge variant="secondary">{primaryAction.badge}</Badge>
                        ) : null}
                      </Button>
                    }
                  />
                  <TooltipContent>{actionDescription(primaryAction, primaryIsDisabled)}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
