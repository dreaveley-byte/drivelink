-- Google review automation: each organization can have its Google Business
-- review link looked up automatically (from its name/address via the Google
-- Places API) or set manually, plus a default for whether new jobs should
-- request a review. Each job can override that default individually.
alter table organizations add column if not exists google_place_id text;
alter table organizations add column if not exists google_review_link text;
alter table organizations add column if not exists send_google_review_default boolean not null default true;

alter table jobs add column if not exists send_google_review boolean not null default true;
