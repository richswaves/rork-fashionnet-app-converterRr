import LegalDoc from "@/components/LegalDoc";

const BODY = `Subscription Addendum
Current Status: thebrxnd is currently free to use. No paid subscriptions or in‑app purchases are available at this time. This page explains how subscriptions will work if introduced in the future; nothing here creates a present obligation to pay.

Future Subscription Overview: If we add subscriptions, pricing and features will be disclosed in‑app before purchase. You must explicitly confirm via the Apple App Store or Google Play. We will notify you of material changes.

Pricing and Trials: If offered in the future, exact price and any free trial length will be shown in‑app at purchase time.

Free Trial: If any free trial is offered in the future, details will be disclosed before purchase, including how to cancel before charges begin.

Auto‑Renewal: If enabled in the future, subscriptions would auto‑renew unless canceled at least 24 hours before renewal. You would manage or cancel via your Apple/Google subscription settings.

Cancellation: You could cancel any future subscription at any time through your store settings. Access would continue until the end of the paid period.

Refunds: Any future refunds would be handled by Apple/Google in line with their policies. We cannot issue refunds directly for store purchases.

Billing Platform: Any future billing would be through Apple/Google. We will not store your full payment details.

Support: Questions? tbrxnd@gmail.com.`;

export default function SubscriptionScreen() {
  return <LegalDoc title="Subscription Addendum" body={BODY} />;
}
