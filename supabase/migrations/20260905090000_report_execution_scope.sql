alter table public.workspace_report_snapshots
  add column if not exists execution_scope jsonb,
  add column if not exists scope_key text;

alter table public.workspace_report_snapshots
  drop constraint if exists workspace_report_snapshots_scope_key_format;

alter table public.workspace_report_snapshots
  add constraint workspace_report_snapshots_scope_key_format
  check (scope_key is null or scope_key ~ '^[a-f0-9]{64}$');

alter table public.workspace_report_snapshots
  drop constraint if exists workspace_report_snapshots_user_id_account_id_date_since_da_key;

alter table public.workspace_report_snapshots
  drop constraint if exists workspace_report_snapshots_workspace_user_account_period_key;

alter table public.workspace_report_snapshots
  drop constraint if exists workspace_report_snapshots_workspace_user_scope_key;

alter table public.workspace_report_snapshots
  add constraint workspace_report_snapshots_workspace_user_scope_key
  unique (workspace_id, user_id, scope_key);
