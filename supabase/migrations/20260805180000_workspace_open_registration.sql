create or replace function public.handle_workspace_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending_invite public.workspace_invites%rowtype;
  target_workspace_id uuid;
  target_role text := 'viewer';
  resolved_name text;
begin
  if new.email is null then
    return new;
  end if;

  select * into pending_invite
  from public.workspace_invites
  where email = lower(new.email)
    and accepted_at is null
  order by created_at
  limit 1;

  if pending_invite.id is not null then
    target_workspace_id := pending_invite.workspace_id;
    target_role := pending_invite.role;
  else
    select id into target_workspace_id
    from public.workspaces
    where slug = 'decision-workspace';
  end if;

  if target_workspace_id is null then
    return new;
  end if;

  resolved_name := coalesce(
    nullif(trim(pending_invite.full_name), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.workspace_members (workspace_id, user_id, email, full_name, role, status)
  values (target_workspace_id, new.id, lower(new.email), resolved_name, target_role, 'active')
  on conflict (workspace_id, user_id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now();

  if pending_invite.id is not null then
    update public.workspace_members
    set role = pending_invite.role,
        status = 'active',
        updated_at = now()
    where workspace_id = target_workspace_id
      and user_id = new.id;

    update public.workspace_invites
    set accepted_at = coalesce(accepted_at, now())
    where id = pending_invite.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_workspace_invite on auth.users;
create trigger on_auth_user_workspace_invite
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_workspace_auth_user();
