import { Link } from "react-router-dom";

import LegalPage from "../components/LegalPage";
import SupportEmailLink from "../components/SupportEmailLink";

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="Conditions for using SugboGo, a Philippine capstone project for discovering local businesses and planning visits."
    >
      <section>
        <h2>Using SugboGo</h2>
        <p>
          Explorers can browse listings, use maps and directions, save
          businesses, and share reviews and specialty vouches. Approved
          merchants can manage their own business listings and use merchant
          tools. Access to some features depends on your account role, account
          status, or merchant application approval.
        </p>
      </section>

      <section>
        <h2>Eligibility and account responsibilities</h2>
        <p>
          Provide accurate account information and keep your sign-in
          credentials private. Use your own account and follow applicable
          law when using the service. Any project-specific age or guardian
          consent requirements are pending confirmation.
        </p>
      </section>

      <section>
        <h2>Acceptable use and contributions</h2>
        <p>
          Share honest reviews and vouches based on your own experience.
          Upload photos and other material only if you have permission to
          share them. Respect other people’s privacy and avoid sharing
          private or sensitive information in public contributions.
        </p>
        <p>
          Do not impersonate others, post harassment or spam, manipulate
          reviews or vouches, or attempt to bypass access controls.
        </p>
      </section>

      <section>
        <h2>Merchant submissions</h2>
        <p>
          Submit a listing only for a business you are authorized to
          represent. Provide accurate business details, locations, hours,
          photos, and supporting documents where requested. Merchant
          applications and certain listing updates go through review. Use
          the available merchant tools to keep your listing current.
        </p>
      </section>

      <section>
        <h2>Moderation and account restrictions</h2>
        <p>
          SugboGo uses automated checks and administrative review to help
          moderate content. Reviews may be held for review, rejected, or
          removed. Users can report reviews and merchants can dispute
          reviews through available app features. Administrative controls
          can suspend or reactivate an account.
        </p>
      </section>

      <section>
        <h2>Accuracy, availability, and third-party services</h2>
        <p>
          Treat business listings, hours, map locations, and directions as
          planning information. Details can change, and listings or features
          may be unavailable. Confirm important details with the business
          before travelling and follow local signs and conditions.
        </p>
        <p>
          Third-party sign-in and mapping features depend on the providers
          that operate them. See the <Link to="/privacy-policy">Privacy Policy</Link> for
          how SugboGo uses these services.
        </p>
      </section>

      <section>
        <h2>Ending use of SugboGo</h2>
        <p>
          You can stop using SugboGo and sign out at any time. Eligible
          account holders can also deactivate their account through Account
          Settings. Deactivation ends account access and leaves associated
          records in place. See the <Link to="/data-deletion">Data Deletion Instructions</Link> for
          how to request removal of account information.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Email <SupportEmailLink /> for account support or questions about
          these terms. The effective date of these terms is pending approval.
        </p>
      </section>
    </LegalPage>
  );
}
