import LegalDoc from "@/components/LegalDoc";

const BODY = `Cookie / Tracking Policy

thebrxnd is a mobile app and does not use web browser cookies. We do not currently use advertising or analytics tracking that identifies you. Here is how we handle tracking:

• No Tracking Cookies: We do not place cookies on your device or browser. The mobile app uses local storage for essential functions only.
• Essential Analytics: We may use basic analytics (for example, crash reporting or usage statistics) to improve the app. These analytics are anonymous and not linked to you personally. Currently, we do not use any third-party analytics or advertising networks.
• Future Tracking: We may introduce analytics or metrics (for example, Google Analytics or another tool) to better understand app usage and improve features. If that happens, we will update this policy and give you an option to opt in or out where possible.
• Opt-Out: If tracking is implemented in the future, we will provide settings or instructions to disable it. We will never sell or share your data with advertisers.
• Device IDs: The app may use a non-personal unique device ID (automatically generated) to remember your preferences and help prevent fraud or abuse. This is not linked to your identity and is only used internally.
• Third-Party SDKs: If we integrate any third-party services (e.g. for push notifications or social login), those SDKs may collect data according to their own policies. We will disclose their names and data uses here when applicable.

For now, your privacy is protected: thebrxnd does not track your activity outside the app. We recommend you keep the app updated; any future analytics tools will be described in this policy.

If you have questions about our tracking practices, contact [SUPPORT_EMAIL].
________________________________________
[1] [3] [5] Legal - Apple Media Services - Apple
https://www.apple.com/legal/internet-services/itunes/
[2] [4] [9] Pandora - Subscription Terms
https://www.pandora.com/legal/subscription
[6] [7] [10] 6 essential community guidelines for moderating content in-app | Sendbird
https://sendbird.com/blog/6-essential-community-guidelines-for-content-moderation
[8] Privacy Policy | Supabase
https://supabase.com/privacy
[11] Example DMCA Policy Text
https://www.thelonesgroup.com/customer/vault.asp?op=item&vid=3558
[12] [13] What is a data controller or a data processor? - European Commission
https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/obligations/controllerprocessor/what-data-controller-or-data-processor_en
[14] Data Processing Addendum (DPA) – RevenueCat
https://www.revenuecat.com/dpa/`;

export default function CookiePolicyScreen() {
  return <LegalDoc title="Cookie / Tracking Policy" body={BODY} />;
}
