-- KM.OS — Supabase schema
-- Plak dit in de SQL Editor van je project en druk op Run.

create table if not exists km_workspace (
  id          text primary key,
  os          jsonb,
  notion      jsonb,
  updated_at  timestamptz default now()
);

-- Alleen jij mag erbij. Row Level Security staat aan;
-- de policy hieronder geeft toegang aan ingelogde gebruikers.
alter table km_workspace enable row level security;

drop policy if exists "eigen rij" on km_workspace;
create policy "eigen rij" on km_workspace
  for all
  using (true)
  with check (true);

-- Let op: bovenstaande policy is open voor iedereen met de anon key.
-- Wil je het echt dichttimmeren, zet dan Supabase Auth aan en vervang
-- 'using (true)' door 'using (auth.uid() is not null)'.

create index if not exists km_workspace_updated on km_workspace (updated_at desc);
