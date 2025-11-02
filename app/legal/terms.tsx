import LegalDoc from "@/components/LegalDoc";

const BODY = `Terms of Service
Welcome to thebrxnd (operated by thebrxnd LLC, 204 Lincoln St, New Britain, CT). These Terms of Service govern your use of our mobile app. By using the app, you agree to these rules. If you do not agree, do not use thebrxnd.

Important Pricing Notice: thebrxnd is currently free to use. We may introduce paid features or subscriptions in the future. If we do, we will update these Terms, provide clear in‑app disclosure before any charges, and you will not be billed unless you explicitly opt in through the App Store or Google Play. Some core features may remain free while others could require payment.

Eligibility: You must be at least 16 years old and legally allowed to use the app in your region. By registering, you confirm that you meet this requirement. Accounts for those under 16 are not permitted. If you are 13–15 in a jurisdiction where the age of consent is 16, you may use the app only with parental consent. thebrxnd is intended for personal, non-commercial use.

Account and Subscription: There is no paid subscription at this time. If we later add a subscription, pricing, trial details, renewal terms, cancellation, and refund information will be shown in‑app before purchase and managed through your Apple/Google account. You will always have the opportunity to review and confirm before any charge.

Content and Usage License: You retain ownership of the content you create or post on thebrxnd (your photos, messages, designs, etc.). By posting content, you grant thebrxnd LLC a worldwide, royalty-free, non-exclusive license to use, display, and distribute your content within the app and on our platform. This license allows us to operate and promote the service. It ends when you delete the content or your account. You agree that your content complies with our policies (see Community Guidelines) and does not violate anyone’s rights.

User Conduct: Use thebrxnd respectfully. You agree not to post or share content that is illegal, hateful, harassing, abusive, defamatory, threatening, pornographic, or that promotes violence or discrimination. Do not spam, scam, or advertise others’ services. Do not impersonate others or post personal data about someone without consent. Harassment, hate speech, and cyberbullying are strictly prohibited. We encourage creativity and friendly interaction; please follow our Community Guidelines for more detail.

Moderation: We reserve the right to monitor, remove, or disable any content that violates these Terms or our Community Guidelines. Violations may result in warnings, content removal, or account suspension/termination. If your content is removed or account suspended, we will notify you. You may appeal any moderation decision (such as a takedown or suspension) by emailing tbrxnd@gmail.com within 14 days of the action. Include your name, username, and details of the issue. We will review and respond to appeals promptly.

Termination: We may suspend or terminate your access if you breach these Terms, applicable law, or behave in a harmful way. If we terminate your account, your content will be removed and you will lose access to the app.

Disclaimer: Thebrxnd is provided “as is” for social networking and creative expression. We make no guarantees about the app’s availability or that content is accurate or reliable. We are not liable for any errors, interruptions, or your use of user-generated content. Use the app at your own risk. To the extent allowed by law, our liability is limited to amounts you have paid to us, if any, and we disclaim all other damages.

Updates: We may update these Terms from time to time. We will notify you of major changes (for example, by email or an in-app notice). Continued use of thebrxnd after changes means you accept the new Terms.

If you have questions about these Terms, contact us at tbrxnd@gmail.com.`;

export default function TermsScreen() {
  return <LegalDoc title="Terms of Service" body={BODY} />;
}
