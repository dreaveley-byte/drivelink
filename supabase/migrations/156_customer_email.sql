-- Optional - not collected by any form yet, but the media consent
-- document displays it "if we have it" per Dan's request, so the column
-- needs to exist for that to be possible once something does start
-- capturing it.
alter table jobs add column if not exists customer_email text;
