-- Adds CASL (Canada's Anti-Spam Legislation) express consent to send
-- promotional/marketing messages by email or text, as its own clearly
-- separate part of the media consent document - a genuine second consent
-- (a different purpose than the photo/video release), tracked as its own
-- checkbox and its own boolean, not folded silently into the existing
-- media_consent flag. CASL requires the purpose, the identity of who's
-- asking, and contact info to be stated, and requires an easy way to
-- withdraw consent at any time - all included below.
--
-- IMPORTANT: the mailing address and contact details below are
-- placeholders. CASL requires this notice to include Drivflo's real
-- mailing address and at least one of a phone number, email address, or
-- website - a placeholder here is not compliant. These need to be filled
-- in with the real details before this version is relied on.
update legal_documents set is_current = false where slug = 'media_consent_release' and is_current = true;

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'media_consent_release',
  2,
  'Media Consent & Photo/Video Release',
  'PART A — MEDIA CONSENT & PHOTO/VIDEO RELEASE

By checking the box for this part, I voluntarily grant Drivflo Inc. ("Drivflo"), its affiliates, and the selling dealership named on this delivery record permission to photograph and/or video record me and/or my vehicle during this delivery, and to use, reproduce, publish, and distribute those photographs and/or video recordings - including my likeness and image as they appear in them - in any format now known or later developed, for promotional, marketing, and advertising purposes. This includes, without limitation, use on the dealership''s and Drivflo''s websites, social media accounts (such as Facebook and Instagram), print advertising, and other marketing materials.

I understand and agree that this consent is entirely voluntary, I will not receive any payment or other compensation for this use, I may withdraw it at any time by providing written notice to Drivflo (withdrawal will not affect use that already occurred), and declining it will not affect my vehicle purchase or delivery.

PART B — CONSENT TO RECEIVE COMMERCIAL ELECTRONIC MESSAGES (CASL)

Drivflo Inc. is seeking your express consent, as required under Canada''s Anti-Spam Legislation (CASL), to send you commercial electronic messages - including emails and text messages - about promotions, special offers, new services, and other marketing communications from Drivflo and/or the selling dealership.

By checking the box for this part, I consent to receive these messages by email and/or text message.

I understand that I may withdraw this consent at any time, at no cost, using the unsubscribe link or instructions included in any message I receive, or by contacting Drivflo directly using the information below. Withdrawing this consent will not affect my vehicle purchase, delivery, or any other rights I have, and is separate from Part A above - withdrawing one does not withdraw the other.

Drivflo Inc.
[Drivflo mailing address — to be completed]
Email: [Drivflo contact email — to be completed]
Phone: [Drivflo contact phone — to be completed]

Parts A and B are each entirely optional and independent of one another, and neither is a condition of receiving your vehicle or completing this delivery.',
  'customer',
  true,
  current_date
)
on conflict do nothing;

alter table legal_acceptances add column if not exists casl_marketing_consent boolean;
