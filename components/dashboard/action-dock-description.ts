export interface ActionDescriptionInput {
  label: string
  disabledReason?: string
  tooltip?: string
  shortcut?: "mod+enter"
}

export function actionDescription(action: ActionDescriptionInput, isDisabled: boolean) {
  const description = (isDisabled ? action.disabledReason : undefined) ?? action.tooltip ?? action.label
  return action.shortcut === "mod+enter"
    ? `${description} (Command or Control + Enter)`
    : description
}
