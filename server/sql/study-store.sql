begin;

create schema if not exists notedeck_private;
revoke all on schema notedeck_private from public;

create table if not exists notedeck_private.study_store (
  id smallint primary key check (id = 1),
  revision bigint not null default 0,
  state jsonb not null check (jsonb_typeof(state) = 'object')
);

revoke all on table notedeck_private.study_store from public;
alter table notedeck_private.study_store enable row level security;

commit;
