import LegalDoc from "@/components/LegalDoc";

const BODY = `Privacy Policy
This Privacy Policy explains how thebrxnd LLC (“we”, “us”) collects and uses your personal data when you use the thebrxnd mobile app (the “Service”). We are committed to protecting your privacy.

Important Pricing Notice: thebrxnd is currently free to use. We may introduce paid features or subscriptions in the future. If we do, we will update this Privacy Policy to explain any new data sharing with payment providers and will present clear in‑app disclosures before any purchase.

Information We Collect: We collect information you provide and information automatically collected by the app. This may include:
• Registration & Profile Data: When you sign up, we collect your email address and password. You may also provide a username, profile photo, and other profile details (e.g., bio, location).
• User Content: Any photos, messages, designs, posts, or other content you create or upload in the app.
• Communications: If you contact us or reply to our emails, we store your messages and responses.
• Usage Data: We collect data about how you use the app (features you use, time stamps, crashes, etc.) to help improve our service.
• Device Data: We may collect technical data such as device type, OS version, app version, and IP address for analytics and security.
• Payment & Subscription: There are no paid subscriptions at this time. If we introduce payments in the future, purchases will be processed by Apple/Google (or a compliant provider). We will not store your full payment details. We may receive limited purchase metadata (e.g., subscription status or transaction ID) from Apple/Google or, if used in the future, RevenueCat.
• Third-Party Data: If you use social login (e.g. Apple Sign-In), we may receive your name and email (only if you consent). We do not store data from social networks beyond what you choose to share.

Cookies & Tracking: Thebrxnd is a mobile app and does not use browser cookies. We do not use tracking pixels or advertising networks. We may use analytics tools (currently none, but see our Cookie Policy) to understand crashes or usage. Any future analytics services will be added to our Cookie/Tracking Policy.

How We Use Data: We use your information to:
• Provide and operate the Service (e.g., creating your account, delivering content and messages).
• Manage your account and subscription.
• Communicate with you (updates, support, service announcements).
• Improve and personalize the app (features, recommendations).
• Detect and prevent fraud or abuse, and enforce our Terms and Community Guidelines.
• Comply with legal obligations (e.g., respond to court orders, protect rights).
We will never sell your personal information to third parties.

Data Storage and Third-Party Services: Your data is stored in Supabase, our cloud database service. Supabase stores data on secure servers in the U.S. (and potentially other countries where Supabase operates). We use industry-standard security measures to protect your data. We do not currently use any payment/subscription processor because the app is free. If we later add subscriptions, we may use Apple/Google billing and optionally a subscription manager such as RevenueCat to process receipts on our behalf. Any such provider would act as our data processor under strict security terms. We will not share personal data with any other third parties without your consent, except for legal requests.

Data Retention: We keep your personal data and account information for as long as your account exists or as needed to provide the Service. If you close your account or request deletion, we will remove your data from active use. We will retain backups or residual copies for a limited period if required by law, but otherwise data is deleted after you request it. In all cases, we retain personal data only as long as necessary.

Your Rights: You can access and update your profile information in the app. You can also request that we delete your account and personal data by contacting us at tbrxnd@gmail.com. Upon verification, we will delete your data. If you live in California or other jurisdictions with special privacy laws, you may have additional rights; please contact tbrxnd@gmail.com for assistance.

Children: thebrxnd is not intended for children under 16. We do not knowingly collect data from children under 16. If we learn of a child’s data, we will delete it.

Security: We take reasonable steps to secure your data (encryption, secure servers, etc.), but no system is 100% secure. In the unlikely event of a breach, we will notify affected users as required by law.

Updates: We may update this Privacy Policy. The “Last Updated” date at the top reflects when we made changes. We will notify you of significant changes by email or in-app message. Continued use means you accept the new policy.

If you have privacy questions, contact us at tbrxnd@gmail.com.`;

export default function PrivacyScreen() {
  return <LegalDoc title="Privacy Policy" body={BODY} />;
}
