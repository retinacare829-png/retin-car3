-- Keep trigger helpers and privileged RPCs out of the anonymous Data API.
-- The application-facing RPCs retain their explicit authenticated grants.
revoke execute on function public.close_screening_workflow(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.register_retinal_image(
  uuid, uuid, uuid, public.retinal_image_laterality, text, text, text, bigint, text
) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
-- The Dashboard's automatic-RLS event trigger exists only on projects that
-- opt into that setting. Local databases must still apply this migration.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;
