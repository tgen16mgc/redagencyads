-- Clear the old current membership before selecting the new one.
create or replace function public.switch_workspace(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = current_user_id
      and status = 'active'
  ) then
    raise exception 'You do not have access to this workspace.' using errcode = '42501';
  end if;

  update public.workspace_members
  set is_current = false,
      updated_at = now()
  where user_id = current_user_id
    and is_current;

  update public.workspace_members
  set is_current = true,
      updated_at = now()
  where workspace_id = p_workspace_id
    and user_id = current_user_id;

  return p_workspace_id;
end;
$$;

revoke all on function public.switch_workspace(uuid) from public, anon;
grant execute on function public.switch_workspace(uuid) to authenticated;
