revoke all on public.workspaces from authenticated;
revoke all on public.workspace_invites from authenticated;
revoke all on public.workspace_access_requests from authenticated;
revoke all on public.workspace_login_events from authenticated;

grant select on public.workspace_members to authenticated;
grant insert on public.workspace_login_events to authenticated;
grant usage, select on sequence public.workspace_login_events_id_seq to authenticated;
