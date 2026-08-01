alter table public.workspace_members
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.workspaces
  add column if not exists settings jsonb not null default '{}'::jsonb;

drop policy if exists "members can update their profile" on public.workspace_members;
create policy "members can update their profile"
on public.workspace_members for update to authenticated
using (user_id = (select auth.uid()) and status = 'active')
with check (user_id = (select auth.uid()) and status = 'active');

drop policy if exists "admins can update workspace settings" on public.workspaces;
create policy "admins can update workspace settings"
on public.workspaces for update to authenticated
using (private.is_workspace_admin(id))
with check (private.is_workspace_admin(id));

grant update (full_name, preferences) on public.workspace_members to authenticated;
grant update (name, settings) on public.workspaces to authenticated;
