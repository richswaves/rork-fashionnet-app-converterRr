import LegalDoc from "@/components/LegalDoc";

const BODY = `Data Processing Agreement (DPA)
This DPA explains how thebrxnd LLC (“we”) and our third-party vendors handle your data in compliance with data protection laws (such as GDPR, CCPA, etc.). Thebrxnd LLC (204 Lincoln St, New Britain, CT) is the data controller: we determine what personal data is collected and how it is used. Our service providers, such as Supabase (database hosting) and RevenueCat (subscription management), are data processors: they process personal data only on our behalf.

Under data protection law, the controller “determines the purposes for which and the means by which personal data is processed,” while a processor “processes personal data only on behalf of the controller”[12][13]. For example, RevenueCat’s agreement explicitly states that “Customer is the data controller and RevenueCat is its data processor”[14].

Supabase: We use Supabase to store user data (accounts, posts, messages). Supabase stores data on secure servers (primarily in the U.S.)[8]. They implement security measures and comply with relevant privacy laws. We have a contract (Data Processing Agreement) with Supabase ensuring they only process data as we instruct and keep it confidential. When required, we will enter into a separate agreement or DPA with Supabase.

RevenueCat: We use RevenueCat to handle subscription receipts and billing metadata. RevenueCat processes users’ purchase information (like transaction IDs) but not sensitive payment details. They also follow strict security and privacy standards. As noted, RevenueCat’s terms identify us as the controller and them as the processor[14]. We require RevenueCat to store and process any personal data (e.g. email address, subscription status) only for delivering their services and to protect it from unauthorized use.

Other Processors: We may use other third-party services (e.g. email providers) to send you communications or push notifications. Each processor is bound by contract to use your data only for providing that service to us, and to maintain security. If we add major new processors, we will update this DPA.

Data Transfers: We may transfer data internationally (e.g. if a processor’s servers are abroad), but only to countries with adequate protections or using standard contractual clauses, as required by law. For instance, Supabase’s policy notes data may be stored in the U.S. or other countries where they operate[8].

Security: We and our processors use encryption and other safeguards to protect data. In case of a breach, we will notify you as required by law.

Sub-Processors: If any processor subcontracts work (e.g. if Supabase hires another cloud service), they are obligated to the same privacy standards. For example, RevenueCat’s DPA requires them to ensure any sub-processor is similarly bound[14].

Your Rights: You have rights over your data. You can request access, correction, or deletion (see Privacy Policy). We will comply with legal obligations. If you are in the EU or UK, you can also request data portability or object to certain processing. Processors will assist us in fulfilling your requests, as allowed by law.

By using thebrxnd, you agree to this DPA along with our Privacy Policy. If you have questions about data processing, contact us at tbrxnd@gmail.com.`;

export default function DPAScreen() {
  return <LegalDoc title="Data Processing Agreement" body={BODY} />;
}
