-- A real, standalone Media Consent & Photo/Video Release document, so the
-- media-consent checkbox has actual terms behind it that the customer can
-- read before agreeing - not just a bare checkbox with a one-line label.
-- Worth noting: this is a media/photo release (grant of rights to use
-- likeness/image for marketing), not a CASL document specifically - CASL
-- governs commercial electronic messages (email/text marketing consent),
-- which is a different thing. This document covers what was actually
-- asked for (permission to use photos/video, including on social media,
-- for advertising) with the standard terms a release like this needs:
-- voluntary, no compensation, revocable, and separate from the vehicle
-- acknowledgement itself.
insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'media_consent_release',
  1,
  'Media Consent & Photo/Video Release',
  'By signing below, I voluntarily grant Drivflo Inc. ("Drivflo"), its affiliates, and the selling dealership named on this delivery record permission to photograph and/or video record me and/or my vehicle during this delivery, and to use, reproduce, publish, and distribute those photographs and/or video recordings - including my likeness and image as they appear in them - in any format now known or later developed, for promotional, marketing, and advertising purposes. This includes, without limitation, use on the dealership''s and Drivflo''s websites, social media accounts (such as Facebook and Instagram), print advertising, and other marketing materials.

I understand and agree that:

This consent is entirely voluntary. Declining to sign this consent will not affect my vehicle purchase, delivery, or any rights I have under my purchase agreement.

I will not receive any payment, royalty, or other compensation for this use.

This consent has no expiry date but may be withdrawn by me at any time by providing written notice to Drivflo. Withdrawal will not affect any use of the photographs or video that occurred before the date Drivflo receives my notice.

I release Drivflo, its affiliates, and the selling dealership from any claims arising from the use of these photographs and/or video recordings in accordance with this consent, except for claims arising from unlawful use.

This consent is separate from, and does not affect, the Vehicle Delivery Acknowledgement, Release & Acceptance signed as part of this delivery. Declining this consent does not require re-signing that document.',
  'customer',
  true,
  current_date
)
on conflict do nothing;

-- Tracks which version of the media consent document was actually shown
-- and agreed to (or declined), the same way document_version already
-- tracks this for the main acknowledgement - so the receipt can always
-- reproduce the exact text the customer saw, even after this document is
-- later revised.
alter table legal_acceptances add column if not exists media_consent_document_version int;
