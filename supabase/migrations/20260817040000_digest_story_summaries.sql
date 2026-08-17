-- Keep the published summary alongside each covered story, so we can audit
-- what actually went out and future editors can see how a story was told.

alter table public.digest_stories
  add column if not exists summary text;
