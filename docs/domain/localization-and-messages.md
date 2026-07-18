# Localization and campaign messages

## Message model

`CampaignTranslation` stores locale-specific headline, subheadline, CTA text, expired text, and delivery text for a campaign. `app/utils/campaign-localization.ts` defines supported locale defaults, goal/type copy, normalization, and fallback behavior. The default locale and enabled locales are shop settings; Markets rules and experiment variants may override serialized text for a request.

Dynamic messages use typed variables resolved by `app/utils/message-variables.ts` and type-specific view models. Free-shipping progress, delivery dates, low-stock quantity, discount/offer state, and post-purchase claims must use real runtime data. When data is missing, use the established safe fallback or hide the claim.

## Resolution order

The base serializer selects request locale translation with normalized/base-locale fallback and then the shop/default campaign copy. Experiment text overrides may replace serialized fields for the assigned variant. A matching Markets rule can then replace permitted text fields. Admin preview context must use the same semantic order even when its implementation is separate.

## Invariants

- Locale identifiers are normalized consistently; regional locale may fall back to its base language.
- At least one nonblank headline is required for activation.
- Storefront strings are text unless explicitly sanitized structural HTML; never concatenate unsanitized translation into HTML.
- `expiredText` is presented only for the appropriate timer behavior.
- Checkout/post-purchase copy cannot claim an applied/used discount unless Shopify context confirms the matching code.
- Translation generation must pass claim and structure guardrails and remain merchant-reviewable.

## Entry points and tests

- Contracts/defaults: `app/types/localization.ts`, `app/utils/campaign-localization.ts`, `app/utils/custom-messages.ts`.
- Save parsing: `app/services/campaign-translations-form.server.ts`.
- View models: `app/services/campaign-message-view-model.ts`, type-specific utilities/services.
- UI: `app/components/CampaignTranslationsEditor.tsx`, custom message editor.
- Tests: localization/custom-message/message-variable tests, AI translation tests, `translations-targeting.spec.ts`, payload/preview parity tests.

## Related documentation

[Campaigns](campaigns.md), [design and structure](design-and-structure.md), existing [localization guide](../localization.md).

## Maintenance

Source of truth: localization utility/types, translation form service, and serializers. Update for supported locale, message field, variable, fallback, or override-order changes.
