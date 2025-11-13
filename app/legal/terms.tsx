import LegalDoc from "@/components/LegalDoc";

const BODY = `Terms of Service
Welcome to thebrxnd (operated by thebrxnd LLC, 204 Lincoln St, New Britain, CT). These Terms of Service govern your use of our mobile app. By using the app, you agree to these rules. If you do not agree, do not use thebrxnd.

Eligibility: You must be at least 16 years old and legally allowed to use the app in your region. By registering, you confirm that you meet this requirement. Accounts for those under 16 are not permitted. If you are 13–15 in a jurisdiction where the age of consent is 16, you may use the app only with parental consent. thebrxnd is intended for personal, non-commercial use.

Account and Subscription: Some features require a paid subscription. You authorize us to charge a monthly fee of $9.99 (USD) for the subscription. A free 7-day trial is offered for new users. After the trial, the subscription automatically renews each month until you cancel[1][2]. To avoid charges after the free trial, cancel at least 24 hours before the trial ends[3]. You can cancel anytime through your device’s App Store/Google Play subscription settings[1][2]. (Directions: open your device’s Settings → your Apple/Google account → Subscriptions.) We do not collect or store your payment information; payments are processed by Apple or Google on our behalf. Subscription fees are non-refundable except as required by law[4]. No discretionary refunds will be given beyond the refund policies of the App Store or Google Play.

Content and Usage License: You retain ownership of the content you create or post on thebrxnd (your photos, messages, designs, etc.). By posting content, you grant thebrxnd LLC a worldwide, royalty-free, non-exclusive license to use, display, and distribute your content within the app and on our platform[5]. This license allows us to operate and promote the service. It ends when you delete the content or your account. You agree that your content complies with our policies (see Community Guidelines below) and does not violate anyone’s rights.

User Conduct: Use thebrxnd respectfully. You agree not to post or share content that is illegal, hateful, harassing, abusive, defamatory, threatening, pornographic, or that promotes violence or discrimination. Do not spam, scam, or advertise others’ services. Do not impersonate others or post personal data about someone without consent. Harassment, hate speech, and cyberbullying are strictly prohibited[6][7]. We encourage creativity and friendly interaction; please follow our [Community Guidelines] for more detail.

Moderation: We reserve the right to monitor, remove, or disable any content that violates these Terms or our Community Guidelines. Violations may result in warnings, content removal, or account suspension/termination. If your content is removed or account suspended, we will notify you. You may appeal any moderation decision (such as a takedown or suspension) by emailing tbrxnd@gmail.com within 14 days of the action. Include your name, username, and details of the issue. We will review and respond to appeals promptly. (See our Moderation & Appeals Policy for details.)

Termination: We may suspend or terminate your access if you breach these Terms, applicable law, or behave in a harmful way. If we terminate your account, your content will be removed and you will lose access to the app. Subscriptions will be canceled in accordance with store policies, but fees already paid are non-refundable (except as required by law)[4]. If you believe your account was terminated unfairly, use the appeal process above.

Disclaimer: Thebrxnd is provided “as is” for social networking and creative expression. We make no guarantees about the app’s availability or that content is accurate or reliable. We are not liable for any errors, interruptions, or your use of user-generated content. Use the app at your own risk. (You are responsible for backing up any content you want to keep.) To the extent allowed by law, our liability is limited to the cost of your subscription, and we disclaim all other damages.

Updates: We may update these Terms from time to time. We will notify you of major changes (for example, by email or an in-app notice). Continued use of thebrxnd after changes means you accept the new Terms.

If you have questions about these Terms, contact us at tbrxnd@gmail.com.`;

export default function TermsScreen() {
  return <LegalDoc title="Terms of Service" body={BODY} />;
}
