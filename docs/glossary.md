# Glossary

| Term                | Repository meaning                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign            | Shop-owned promotional configuration with lifecycle, type, goal, placements, targeting, design, translations, and optional feature records. |
| Campaign type       | Renderer/data behavior identifier (`CampaignType`), not the merchant intent. Seven values are implemented.                                  |
| Goal                | Merchant intent (`CampaignGoal`), used for setup/copy/presets; several goals can map to the same type.                                      |
| Placement           | A `CampaignPlacement` surface and optional custom selector/style. A campaign can have several enabled placements.                           |
| Eligibility         | Result of publication, status, schedule, plan, placement, targeting, behavior, and contextual override gates.                               |
| Targeting rule      | Base include/exclude audience/page/product/context constraint stored in `CampaignTargeting`.                                                |
| Schedule            | Campaign-level start/end instants and timezone controlling server activity.                                                                 |
| Countdown mode      | Fixed, per-visitor evergreen, daily recurring, or weekly recurring timer calculation.                                                       |
| Expiration behavior | What eligibility/runtime does when a timer/campaign deadline passes: unpublish/hide/repeat/custom title/no-op.                              |
| Dismissal           | Buyer close behavior and session/permanent storage controlled by campaign design.                                                           |
| Layout              | A `CampaignDesign.layout` DOM/style arrangement; distinct from placement and template.                                                      |
| Setup preset        | Editor default mapping from a campaign type/choice to initial form values and placement.                                                    |
| Template            | Reusable full campaign configuration from the system or a shop; broader than a setup preset.                                                |
| Structure           | Sanitized merchant-editable HTML/AST with `data-cp-slot` dynamic hydration markers.                                                         |
| Published snapshot  | JSON copy of campaign configuration used by storefront until the next publish.                                                              |
| Storefront runtime  | Static theme JavaScript/CSS plus focused public endpoints; it cannot import server TypeScript.                                              |
| Admin preview       | React rendering of the edited configuration; must preserve semantic/visual parity but is not storefront execution.                          |
| Experiment          | Weighted, stable visitor assignment among variants with optional text/design/discount/placement overrides.                                  |
| Variant             | Control or override set within an experiment; a declared/applied winner is still subject to publication.                                    |
| Markets rule        | Context-specific enablement and allowed overrides selected by specificity after base serialization.                                         |
| Impression          | Privacy-gated analytics event for a rendered campaign, subject to deduplication.                                                            |
| Attribution         | Evidence connecting campaign touches to checkout/order conversion; not all analytics events imply attribution.                              |

## Maintenance

Source of truth: Prisma enums/models and linked domain docs. Update when project terminology or a confusing distinction changes.
