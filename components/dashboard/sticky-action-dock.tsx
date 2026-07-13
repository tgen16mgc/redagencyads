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

import BorderGlow from "@/components/BorderGlow"
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
    "pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 px-3",
  sticky:
    "pointer-events-none sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 px-3",
  inline: "pointer-events-none px-3",
} as const

function actionDescription(action: ActionDockAction) {
  const description = action.disabledReason ?? action.tooltip ?? action.label
  return action.shortcut === "mod+enter"
    ? `${description} (Command or Control + Enter)`
    : description
}

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
  position = "fixed",
  expanded: controlledExpanded,
  defaultExpanded = false,
  onExpandedChange,
  actionsLabel = "More actions",
  className,
  glowColors = [
    "var(--action-glow-primary)",
    "var(--action-glow-secondary)",
    "var(--action-glow-success)",
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
  const primaryIsWorking = status === "working" || primaryAction.loading
  const primaryIsDisabled =
    status === "blocked" || primaryAction.disabled || primaryIsWorking

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

          {hasSecondaryActions && isExpanded ? (
            <div
              id={actionsId}
              role="group"
              aria-label={actionsLabel}
              className="action-dock-tray flex max-w-[calc(100vw-1.5rem)] flex-wrap justify-end gap-1.5"
            >
              {secondaryActions.map((action, index) => {
                const Icon = action.icon

                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger
                      render={
                        <Button
                          ref={index === 0 ? firstSecondaryActionRef : undefined}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={action.disabled || action.loading}
                          aria-label={action.label}
                          title={action.disabledReason}
                          onClick={() => void action.onSelect()}
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
                    <TooltipContent>{actionDescription(action)}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ) : null}

          <div
            ref={dockSurfaceRef}
            onPointerMove={handlePointerMove}
            className="action-dock-surface flex max-w-full items-center gap-1"
          >
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

            <BorderGlow
              active={status === "ready" && !primaryIsDisabled}
              interactive={!primaryIsDisabled}
              showShadow={false}
              borderRadius={999}
              borderWidth={2}
              coneSpread={18}
              glowRadius={18}
              glowIntensity={1.15}
              colors={glowColors}
              backgroundColor="transparent"
              className="action-dock-primary-frame min-w-0 shrink-0"
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
                      title={primaryAction.disabledReason}
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
                <TooltipContent>{actionDescription(primaryAction)}</TooltipContent>
              </Tooltip>
            </BorderGlow>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
