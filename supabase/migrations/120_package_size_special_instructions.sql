-- Parts delivery/pickup jobs previously only captured a "pick up / drop off"
-- direction on the package, which is redundant with the job type itself
-- (Parts Delivery vs. Parts Pickup already says that). Replace it with a
-- part-size field so drivers know what vehicle they need to bring, and add
-- a general special-instructions free-text field.
alter table jobs add column if not exists package_size text;
alter table jobs add column if not exists special_instructions text;
