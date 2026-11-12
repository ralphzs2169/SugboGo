import { Link } from "react-router-dom";

import LegalPage from "../components/LegalPage";
import SupportEmailLink from "../components/SupportEmailLink";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How SugboGo handles personal information when you discover local businesses, use maps, contribute reviews, or manage a business listing."
    >
      <section>
        <h2>Account and sign-in information</h2>
        <p>
          When you register with email, SugboGo uses your name and email address
          to create and verify your account. Passwords are stored as hashes.
          Your account also holds its role and verification status and may
          include a profile picture, other profile details, and selected interests.
        </p>
        <p>
          When you sign in with Google or Facebook, SugboGo verifies your
          sign-in with that provider. SugboGo receives your provider account
          ID, email address, and any available name and profile picture URL.
          Google sign-in requires a verified email address. Facebook sign-in
          requires an email address from Facebook. SugboGo uses this information
          to create or link your account and records the provider link and its
          sign-in time.
        </p>
        <p>
          Sign-in records can include the time, method, outcome, IP address, and
          general app, browser, or operating system type. These records support
          account security and the login history feature.
        </p>
      </section>

      <section>
        <h2>Location and app activity</h2>
        <p>
          The mobile app asks for location permission while in use. With
          permission, it can use your coordinates to find nearby businesses,
          show your position on a map, or plan a route. Some requests send
          coordinates to SugboGo or to Google mapping services. You can manage
          location permission in your device settings.
        </p>
        <p>
          SugboGo uses selected interests and interactions such as saves and
          vouches to help recommend businesses. It can record account-linked
          activity such as business impressions, listing views, saves, and
          requests for directions to measure how discovery features are used.
          An app installation identifier helps check some contributions for
          possible misuse.
        </p>
      </section>

      <section>
        <h2>Reviews, photos, and other contributions</h2>
        <p>
          SugboGo stores reviews and their photos, specialty vouches, saved
          businesses and Pocket collections, and related activity. Other
          users can see published reviews and associated author details.
          The app uses submitted content and reports to display contributions,
          review potential misuse, and generate review insights.
        </p>
      </section>

      <section>
        <h2>Merchant applications and listings</h2>
        <p>
          A merchant application can include the applicant’s account,
          business identity and contact details, location, hours, photos,
          and supporting documents. SugboGo uses these materials to review
          applications and manage listings and listing updates. Approved
          business information can appear in the app. Access to application
          verification documents is restricted.
        </p>
      </section>

      <section>
        <h2>Services that help provide SugboGo</h2>
        <ul>
          <li>
            Google and Facebook verify sign-ins. Google Maps services handle
            maps, place searches, address lookups, and directions.
          </li>
          <li>
            Cloudinary stores uploaded media and merchant documents. Resend
            sends account emails such as verification and password recovery.
          </li>
          <li>
            When configured, OpenAI can receive review text or photos for
            moderation. Google Gemini can receive review text or related
            context for review analysis, summaries, and merchant insights.
          </li>
          <li>
            If Merchant Plus checkout is enabled, PayMongo hosts checkout.
            SugboGo sends purchase and transaction reference details to
            PayMongo.
          </li>
          <li>
            Railway hosts the backend and Cloudflare Pages hosts the web app.
            SugboGo uses PostgreSQL for account and app records and can store
            discovery activity in MongoDB.
          </li>
        </ul>
      </section>

      <section>
        <h2>Storage, retention, and security</h2>
        <p>
          SugboGo uses password hashing, signed session tokens, and access
          checks for account and administrative features. The mobile app also
          stores sign-in information and some offline business and journey data
          on your device.
        </p>
        <p>
          SugboGo’s backend is configured to prune sign-in history older
          than 90 days. Production operation of that cleanup and retention
          practices for other records, provider copies, and backups are
          pending confirmation.
        </p>
      </section>

      <section>
        <h2>Your choices and privacy inquiries</h2>
        <p>
          You can review or change some profile details in the app and manage
          your interests, saved businesses, and contributions. The Philippine
          National Privacy Commission explains rights that may apply, including
          access, correction, objection, and erasure or blocking.
          See the <a href="https://privacy.gov.ph/data-subject-rights/">National Privacy Commission’s guide to data subject rights</a>.
        </p>
        <p>
          Email <SupportEmailLink /> for privacy inquiries, account support, or
          requests about your personal information. SugboGo receives your email
          address and the information you include in your message. See the{" "}
          <Link to="/data-deletion">Data Deletion Instructions</Link> for what to
          include in a deletion request.
        </p>
      </section>

      <section>
        <h2>Policy updates</h2>
        <p>
          The effective date and how SugboGo will communicate policy changes
          are pending project approval.
        </p>
      </section>
    </LegalPage>
  );
}
