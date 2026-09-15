-- Expands Part B from email/text only to phone, mail, email, and text.
-- Worth noting for accuracy: CASL itself only governs ELECTRONIC messages
-- (email, text/SMS) - phone calls are governed separately by the National
-- Do Not Call List rules, and unsolicited mail isn't covered by
-- anti-spam legislation at all. Covering all four channels in one
-- consent is common and reasonable, but the heading/intro still frames
-- this primarily as the CASL notice since that's the piece with specific
-- legal requirements (purpose, sender ID, contact info, withdrawal) -
-- the phone/mail permission is added as a plain, complementary consent
-- alongside it, not portrayed as itself required by CASL.
update legal_documents set is_current = false where slug = 'media_consent_release' and is_current = true;

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'media_consent_release',
  4,
  'Media Consent & Photo/Video Release',
  'PART A — MEDIA CONSENT & PHOTO/VIDEO RELEASE

By checking the box for this part, I voluntarily grant Drivflo Inc. ("Drivflo"), its affiliated and third-party companies, and/or the selling dealership named on this delivery record permission to photograph and/or video record me and/or my vehicle during this delivery, and to use, reproduce, publish, and distribute those photographs and/or video recordings - including my likeness and image as they appear in them - in any format now known or later developed, for promotional, marketing, and advertising purposes. This includes, without limitation, use on the dealership''s and Drivflo''s websites, social media accounts (such as Facebook and Instagram), print advertising, and other marketing materials.

I understand and agree that this consent is entirely voluntary, I will not receive any payment or other compensation for this use, I may withdraw it at any time by providing written notice to Drivflo (withdrawal will not affect use that already occurred), and declining it will not affect my vehicle purchase or delivery.

PART B — CONSENT TO RECEIVE PROMOTIONAL COMMUNICATIONS (INCLUDING CASL FOR ELECTRONIC MESSAGES)

Drivflo Inc. is seeking your consent to send you promotional communications - including by phone, mail, email, and/or text message - about promotions, special offers, new services, and other marketing communications from Drivflo, its affiliated and third-party companies, and/or the selling dealership. For electronic messages (email and text), this consent is express consent as required under Canada''s Anti-Spam Legislation (CASL).

By checking the box for this part, I consent to receive these messages by phone, mail, email, and/or text message.

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
