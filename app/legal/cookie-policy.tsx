import LegalDoc from "@/components/LegalDoc";

const BODY = `Cookie / Tracking Policy

thebrxnd is a mobile app and does not use web browser cookies. We do not currently use advertising or analytics tracking that identifies you. Here is how we handle tracking:

• No Tracking Cookies: We do not place cookies on your device or browser. The mobile app uses local storage for essential functions only.
• Essential Analytics: We may use basic analytics (for example, crash reporting or usage statistics) to improve the app. These analytics are anonymous and not linked to you personally. Currently, we do not use any third-party analytics or advertising networks.
• Future Tracking: We may introduce analytics or metrics to better understand app usage and improve features. If that happens, we will update this policy and give you an option to opt in or out where possible.
• Opt-Out: If tracking is implemented in the future, we will provide settings or instructions to disable it. We will never sell or share your data with advertisers.
• Device IDs: The app may use a non-personal unique device ID (automatically generated) to remember your preferences and help prevent fraud or abuse. This is not linked to your identity and is only used internally.
• Third-Party SDKs: If we integrate any third-party services (e.g. for push notifications or social login), those SDKs may collect data according to their own policies. We will disclose their names and data uses here when applicable.

For questions about our tracking practices, contact tbrxnd@gmail.com.`;

export default function CookiePolicyScreen() {
  return <LegalDoc title="Cookie / Tracking Policy" body={BODY} />;
}
