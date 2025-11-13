import LegalDoc from "@/components/LegalDoc";

const BODY = `Moderation & Appeals Policy
Content Moderation: thebrxnd moderates user content to keep the community safe. Our moderators (human and automated tools) review content and enforce rules. Content that violates the Community Guidelines (see above) may be deleted or hidden. This includes hate speech, harassment, explicit material, spam, illegal content, and other prohibited content[6][7]. If content is removed, we will notify you (in-app or by email). We may also suspend or ban accounts of repeat or severe offenders.

Suspension and Takedowns: Depending on the violation, we may take action such as:
- Warning: Minor or first-time infractions may get a warning.
- Content Removal: We may delete or hide specific posts or comments.
- Temporary Suspension: Repeated or serious violations can lead to a temporary suspension of your account.
- Account Ban: Continued severe violations (especially hate or illegal content) may result in permanent ban.

We reserve discretion: even one serious violation (e.g. explicit or illegal content) can lead to immediate suspension.

Appeals: If your content is removed or your account is suspended, you may appeal our decision. Send an email to tbrxnd@gmail.com within 14 days of the action, with:
1. Your name and username.
2. Description of the moderation action (e.g. “My post about X was removed on [date]”).
3. Why you believe the action was in error.
4. Any additional context.

Our team will review your appeal in a fair manner. We will respond by email as soon as possible (usually within a few days). If we agree with your appeal, we will restore the content or account. If not, the decision stands. This 14-day window is final: appeals made after 14 days may not be considered.

No Third-Party Guarantees: Please note that appeals concern actions taken by thebrxnd moderators. If your content was removed due to a third-party (e.g. App Store violation or DMCA), you must follow that process (see our [DMCA Policy]).

We aim for transparency and consistency. Thank you for helping us keep the community respectful.`;

export default function ModerationAppealsScreen() {
  return <LegalDoc title="Moderation & Appeals Policy" body={BODY} />;
}
