import LegalDoc from "@/components/LegalDoc";

const BODY = `Content Licensing Agreement
All content you create or post on thebrxnd (photos, designs, text, etc.) is owned by you. By submitting content to thebrxnd service, you grant thebrxnd LLC a worldwide, royalty-free, perpetual, non-exclusive license to use, reproduce, modify, and display your content in connection with the operation of the app. This means we can show your posts, share them in our app, and use them for marketing (like featured posts), but you still own the copyright.

This license is only so long as your content is published in the app. If you delete the content or your account is closed, the license ends (except to the extent we already used the content). We will not sell your content to third parties.

You represent and warrant that you have all rights to the content you post. Do not post content that infringes others’ rights. If someone claims your content violates their rights, we may remove it.`;

export default function ContentLicensingScreen() {
  return <LegalDoc title="Content Licensing" body={BODY} />;
}
