import { Link } from "react-router";

type NotFoundPageProps = {
  variant?: "campaign" | "generic";
};

export function NotFoundPage({ variant = "generic" }: NotFoundPageProps) {
  const isCampaign = variant === "campaign";

  return (
    <s-page
      inlineSize="large"
      heading={isCampaign ? "Campaign not found." : "Page not found."}
    >
      <section
        className="counterpulse-not-found"
        aria-labelledby="not-found-title"
      >
        <div className="counterpulse-not-found__content">
          <div className="counterpulse-not-found__eyebrow">
            {isCampaign ? "Missing campaign" : "404"}
          </div>
          <h1 id="not-found-title">
            {isCampaign ? "Campaign not found." : "This page is not available."}
          </h1>
          <p>
            {isCampaign
              ? "The campaign may have been deleted, belongs to another shop, or the link may be outdated."
              : "The URL does not match a Promo Pulse page. You can return to the app and continue from a known place."}
          </p>
          <div className="counterpulse-not-found__actions">
            <Link className="counterpulse-button" to="/app">
              Back to dashboard
            </Link>
            <Link className="counterpulse-button-secondary" to="/app/campaigns">
              View campaigns
            </Link>
          </div>
        </div>
        <div className="counterpulse-not-found__visual" aria-hidden="true">
          <div className="counterpulse-not-found__screen">
            <span />
            <span />
            <span />
            <strong>{isCampaign ? "CAMPAIGN" : "404"}</strong>
            <small>
              {isCampaign ? "No matching record" : "Route unavailable"}
            </small>
          </div>
          <div className="counterpulse-not-found__pulse" />
        </div>
      </section>
    </s-page>
  );
}
