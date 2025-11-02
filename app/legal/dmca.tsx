import LegalDoc from "@/components/LegalDoc";

const BODY = `DMCA Takedown Policy

Important Pricing Notice: thebrxnd is currently free to use. We may introduce paid features or subscriptions in the future. If that happens, we will provide clear in‑app disclosure and you will not be charged unless you choose to opt in.

Thebrxnd LLC respects copyright and intellectual property rights. If you believe that content on thebrxnd infringes your copyright, please submit a Copyright Infringement Notice in writing to our Designated Copyright Agent.

How to Submit a Notice: Send an email with all of the following information (as required by U.S. law, 17 U.S.C. §512):
- A physical or electronic signature of the copyright owner or authorized agent.
- Identification of the copyrighted work you claim has been infringed (e.g. title, description).
- Identification of the material you claim is infringing (with exact location in the app, e.g. link or screenshots).
- Your name, address, phone number, and email address.
- A statement that you have a good-faith belief that the use is not authorized by you or the law.
- A statement, under penalty of perjury, that the information you provided is accurate and you are the copyright owner or agent.

Please send your notice to our DMCA Agent at:

Designated Copyright Agent
 thebrxnd LLC
 204 Lincoln St, New Britain, CT, USA
 Email: richreporter70@gmail.com

What Happens Next: Upon receipt of a proper notice, thebrxnd will act expeditiously. We may remove or disable access to the allegedly infringing material. We will also notify the user who posted the content about the removal and provide your contact information to them so they can respond. Repeat copyright infringers will have their accounts terminated.

Counter-Notification: If you believe your content was removed in error, you may file a DMCA counter-notice. Email richreporter70@gmail.com with:
- A statement under penalty of perjury that you have a good-faith belief the material was removed by mistake.
- Your contact info and identification of the removed material.
- Consent to jurisdiction of your local court.
- Your signature (electronic or physical).

We will forward your counter-notice to the original claimant. Unless they notify us that they’ve filed a court action, we will restore your material in 10–14 business days.

No Guarantee: We do not investigate ownership claims. If you file a false notice or counter-notice, you may be liable for damages. Our only obligation is to follow the DMCA procedure promptly.`;

export default function DMCAScreen() {
  return <LegalDoc title="DMCA Takedown Policy" body={BODY} />;
}
