import { Link } from "react-router-dom";

import LegalPage from "../components/LegalPage";
import SupportEmailLink from "../components/SupportEmailLink";

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion Instructions"
      description="How to submit a deletion request and what you can remove through SugboGo today."
    >
      <section>
        <h2>Current account controls</h2>
        <p>
          Eligible users can deactivate an account in the mobile app under
          Account Settings. Deactivation requires an active, verified account
          and your current SugboGo password. It disables sign-in, ends
          existing sessions, and leaves your account records and contributions
          in place. Permanent account erasure is currently unavailable.
        </p>
        <p>
          While signed in, you can remove some items individually, such as a
          custom profile photo or a review you submitted.
        </p>
      </section>

      <section>
        <h2>Submit a deletion request</h2>
        <p>
          Email <SupportEmailLink /> to request deletion of your SugboGo
          account, specific personal information, or data SugboGo received
          through Facebook Login.
        </p>
        <ol>
          <li>
            Include the email address associated with your SugboGo account and
            whether you signed in with email, Google, or Facebook.
          </li>
          <li>
            Specify whether you want your entire SugboGo account deleted or
            only particular information removed. For a partial request,
            identify the items you want removed. For Facebook Login data,
            identify Facebook as the linked sign-in provider.
          </li>
          <li>
            Keep passwords, sign-in codes, and provider tokens out of your
            message.
          </li>
        </ol>
      </section>

      <section>
        <h2>Verification and fulfillment</h2>
        <p>
          Before acting on a request, the SugboGo team needs to verify your
          authority to make the request, identify the records it covers, and
          determine what can be removed. The team still needs to approve and
          test the procedure for carrying out deletion and explaining what
          was removed or retained and why.
        </p>
      </section>

      <section>
        <h2>Information a request can cover</h2>
        <p>
          A request can cover account and profile details, Google or Facebook
          account links, reviews and photos, vouches, saves and Pocket
          collections, activity records, and merchant submissions tied to the
          account. Requests to SugboGo concern copies held by SugboGo or its
          service providers. Manage your Google or Facebook account directly
          with that provider.
        </p>
      </section>

      <section>
        <h2>Retention and technical limits</h2>
        <p>
          Merchant applications and related records can depend on an account
          record. Handling an erasure request requires reviewing those
          relationships and identifying copies in media storage and activity
          stores. Retention rules for linked records, service providers, and
          backups are pending confirmation.
        </p>
        <p>
          See the <Link to="/privacy-policy">Privacy Policy</Link> for more about
          the information SugboGo handles.
        </p>
      </section>
    </LegalPage>
  );
}
