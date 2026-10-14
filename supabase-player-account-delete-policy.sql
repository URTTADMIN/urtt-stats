-- Restrict permanent deletion of player accounts to the URTT owner.
-- Existing foreign keys cascade guess-driver history and anonymize predictions/feedback.
grant delete on table public.player_accounts to authenticated;

drop policy if exists "Owner can delete player accounts" on public.player_accounts;
create policy "Owner can delete player accounts"
on public.player_accounts
for delete
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'kolti@urtt.fr');
