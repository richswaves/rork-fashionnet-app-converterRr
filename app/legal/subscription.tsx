import LegalDoc from "@/components/LegalDoc";

const BODY = `Subscription Addendum
This Subscription Addendum provides details on pricing, renewal, cancellation, and refunds for the thebrxnd app, in compliance with App Store (Apple) and Google Play requirements.

Subscription Pricing: thebrxnd offers a subscription at $9.99 per month (USD) with a 7-day free trial for new subscribers. The price shown includes applicable taxes. All billing is handled by the App Store or Google Play; we never see your credit card or payment info.

Free Trial: A 7-day free trial starts when you subscribe. You won’t be charged until the trial ends. To avoid being charged, cancel your subscription at least 24 hours before the trial expires[3]. If you do not cancel, your subscription will automatically begin and your payment method will be charged.

Auto-Renewal: Subscriptions automatically renew each month after the initial period[1][2]. You will be charged 24 hours before the start of each new month. To prevent renewal, cancel at least 24 hours before your next billing date[1]. We will notify you via your device’s App Store or Google Play when your subscription is about to renew, as required by law.

Cancellation: You can cancel your subscription at any time. To cancel, go to your Apple/Google account’s “Manage Subscriptions” page. (For Apple, open Settings → [your name] → Subscriptions. For Google, open Google Play Store → Menu → Subscriptions.) Follow the on-screen steps. Cancelling stops future payments but does not retroactively refund your last payment or prorate the current month[4]. Your subscription remains active until the end of the paid period. If you cancel during a free trial, you will not be charged, but you will also lose access to subscription content once the trial ends. We have no access to subscription settings; please use only the official app store interfaces.

Refunds: All subscription payments are final except as required by law. We do not offer refunds for unused subscription periods beyond the policies of Apple and Google[4]. If you believe you are entitled to a refund (for example, double-billing or unauthorized purchase), please contact Apple Support or Google Play Support directly. You can also use the “Report a Problem” feature in your App Store/Google account. We cannot issue refunds ourselves for in-app purchases. Any refunds granted will be processed by Apple/Google; we will comply by canceling the subscription upon refund request.

App Store and Google Play: This app and its subscription are distributed through the Apple App Store and/or Google Play. By purchasing through these platforms, you agree to their terms. You must use the tools provided by Apple or Google to manage or cancel subscriptions[9]. We recommend bookmarking or saving the link to the thebrxnd app.

For any billing issues, contact Apple or Google support first. For other help, email us at tbrxnd@gmail.com.`;

export default function SubscriptionScreen() {
  return <LegalDoc title="Subscription Addendum" body={BODY} />;
}
