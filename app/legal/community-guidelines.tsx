import LegalDoc from "@/components/LegalDoc";

const BODY = `Community Guidelines
We want thebrxnd to be a creative, positive space for fashion and culture. Please follow these guidelines to keep the community safe and respectful:

Important Pricing Notice: thebrxnd is currently free to use. We may introduce paid features or subscriptions in the future. If that happens, we will provide clear in‑app disclosure and you will not be charged unless you choose to opt in.

• Be Respectful: Treat others kindly. Bullying, harassment, or personal attacks are not allowed.
• No Hate Speech: Do not post content that attacks or discriminates against others based on race, ethnicity, religion, gender, sexual orientation, disability, or any protected status. Hate symbols, slurs, and extremist content are banned.
• No Graphic or Adult Content: Do not share excessive violence, gore, or sexual content. If you post fashion content that is edgy, make sure it’s still appropriate for a broad audience. Content intended for adults (nudity, explicit scenes) is not allowed.
• No Illegal or Dangerous Content: Do not promote illegal activities (drug use, theft, etc.) or instructions for wrongdoing. Criminal behavior or self-harm encouragement is strictly prohibited.
• No Spam or Scams: Do not spam, flood chat, or promote your products/services without permission. Links to malicious sites, phishing attempts, or fraudulent schemes are forbidden.
• Protect Privacy: Do not post others’ personal information (like addresses, private photos, contact info) without permission. Respect everyone’s privacy.
• Original Content: Share only content you have the rights to. Do not post copyrighted images, music, or videos that you don’t own (see our DMCA Policy for details).
• Stay on Topic: Keep discussions relevant to fashion, creativity, and culture. Irrelevant or repetitive content can be removed to keep the app enjoyable for everyone.

Consequences for violating these rules include content removal, warnings, temporary suspension, or permanent ban, depending on severity. We enforce these guidelines fairly and consistently.

If you see something that breaks these rules, report it through the app’s flag/report feature or contact tbrxnd@gmail.com.`;

export default function CommunityGuidelinesScreen() {
  return <LegalDoc title="Community Guidelines" body={BODY} />;
}
