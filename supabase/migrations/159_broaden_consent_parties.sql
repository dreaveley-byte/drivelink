-- Broadens who the media/photo release and CASL consent cover, per
-- request: not just Drivflo and the selling dealership, but Drivflo's
-- affiliated and third-party companies too (e.g. partners who might help
-- with marketing, printing, or distributing this material). Same
-- structure as version 2 (Part A media/photo, Part B CASL), just the
-- broadened wording throughout, plus the mailing address/contact
-- placeholders still need to be filled in - see the note on version 2.
update legal_documents set is_current = false where slug = 'media_consent_release' and is_current = true;

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'media_consent_release',
  3,
  'Media Consent & Photo/Video Release',
  'PART A — MEDIA CONSENT & PHOTO/VIDEO RELEASE

By checking the box for this part, I voluntarily grant Drivflo Inc. ("Drivflo"), its affiliated and third-party companies, and/or the selling dealership named on this delivery record permission to photograph and/or video record me and/or my vehicle during this delivery, and to use, reproduce, publish, and distribute those photographs and/or video recordings - including my likeness and image as they appear in them - in any format now known or later developed, for promotional, marketing, and advertising purposes. This includes, without limitation, use on the dealership''s and Drivflo''s websites, social media accounts (such as Facebook and Instagram), print advertising, and other marketing materials.

I understand and agree that this consent is entirely voluntary, I will not receive any payment or other compensation for this use, I may withdraw it at any time by providing written notice to Drivflo (withdrawal will not affect use that already occurred), and declining it will not affect my vehicle purchase or delivery.

PART B — CONSENT TO RECEIVE COMMERCIAL ELECTRONIC MESSAGES (CASL)

Drivflo Inc. is seeking your express consent, as required under Canada''s Anti-Spam Legislation (CASL), to send you commercial electronic messages - including emails and text messages - about promotions, special offers, new services, and other marketing communications from Drivflo, its affiliated and third-party companies, and/or the selling dealership.

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
