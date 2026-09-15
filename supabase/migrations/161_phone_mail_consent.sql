-- Splits phone calls and mail out of Part B into their own Part C.
-- CASL only governs electronic messages (email, text) - phone calls fall
-- under the separate National Do Not Call List rules (which already
-- allow calling a customer for a window after a purchase under the
-- "existing business relationship" exemption, without needing this
-- consent at all), and mail isn't covered by anti-spam legislation.
-- Keeping Part B strictly to what CASL actually requires, and Part C as
-- its own clearly separate, non-CASL consent, is more accurate than
-- bundling all four channels under one CASL-framed checkbox - and gives
-- a customer who's fine with email/text but not phone calls (or vice
-- versa) the ability to say so.
update legal_documents set is_current = false where slug = 'media_consent_release' and is_current = true;

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'media_consent_release',
  5,
  'Media Consent & Photo/Video Release',
  'PART A — MEDIA CONSENT & PHOTO/VIDEO RELEASE

By checking the box for this part, I voluntarily grant Drivflo Inc. ("Drivflo"), its affiliated and third-party companies, and/or the selling dealership named on this delivery record permission to photograph and/or video record me and/or my vehicle during this delivery, and to use, reproduce, publish, and distribute those photographs and/or video recordings - including my likeness and image as they appear in them - in any format now known or later developed, for promotional, marketing, and advertising purposes. This includes, without limitation, use on the dealership''s and Drivflo''s websites, social media accounts (such as Facebook and Instagram), print advertising, and other marketing materials.

I understand and agree that this consent is entirely voluntary, I will not receive any payment or other compensation for this use, I may withdraw it at any time by providing written notice to Drivflo (withdrawal will not affect use that already occurred), and declining it will not affect my vehicle purchase or delivery.

PART B — CONSENT TO RECEIVE ELECTRONIC MESSAGES (CASL)

Drivflo Inc. is seeking your express consent, as required under Canada''s Anti-Spam Legislation (CASL), to send you commercial electronic messages - including emails and text messages - about promotions, special offers, new services, and other marketing communications from Drivflo, its affiliated and third-party companies, and/or the selling dealership.

By checking the box for this part, I consent to receive these messages by email and/or text message.

I understand that I may withdraw this consent at any time, at no cost, using the unsubscribe link or instructions included in any message I receive, or by contacting Drivflo directly using the information below. Withdrawing this consent will not affect my vehicle purchase, delivery, or any other rights I have, and is separate from Parts A and C - withdrawing one does not withdraw the others.

PART C — CONSENT TO PHONE CALLS AND MAIL

By checking the box for this part, I consent to receive promotional phone calls and mail from Drivflo, its affiliated and third-party companies, and/or the selling dealership, about promotions, special offers, new services, and other marketing communications.

I understand that I may withdraw this consent at any time by contacting Drivflo directly using the information below, and that this is separate from Parts A and B - withdrawing one does not withdraw the others.

Drivflo Inc.
[Drivflo mailing address — to be completed]
Email: [Drivflo contact email — to be completed]
Phone: [Drivflo contact phone — to be completed]

Parts A, B, and C are each entirely optional and independent of one another, and none of them is a condition of receiving your vehicle or completing this delivery.',
  'customer',
  true,
  current_date
)
on conflict do nothing;

alter table legal_acceptances add column if not exists phone_mail_marketing_consent boolean;
