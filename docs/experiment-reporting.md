# Experiment Reporting and Auto-Winner

Promo Pulse calculates experiment results from Stage 2 attribution tables:

- `AttributionTouch` powers impressions, clicks, add-to-cart, checkout-started, visitors, and rates.
- `AttributionConversion` powers orders, revenue, revenue per visitor, and conversion rate.

## Auto-winner rule

The first implementation intentionally uses a conservative deterministic rule instead of full statistical significance:

1. The experiment must have run for at least `autoWinnerMinRuntimeHours`.
2. At least two variants must each have at least `autoWinnerMinSampleSize` impressions.
3. The winning variant must have a positive primary metric value.
4. The simple confidence score is `min(0.99, 0.5 + relativeLift)`, where `relativeLift = (winner - runnerUp) / winner`.
5. The confidence score must be greater than or equal to `autoWinnerConfidenceThreshold`.

Auto-winner declaration only marks a winning variant. Promo Pulse does not copy winner overrides into the campaign base unless the merchant clicks **Apply winner**, or a future explicit automation path opts into applying winners.
