# Email Countdown Timers

Email timers generate a public PNG image that changes as the related campaign
approaches its real `endsAt` value. Email clients do not run storefront
JavaScript, so the timer is delivered as an image URL that can be pasted into
Klaviyo, Omnisend, Mailchimp, or any editor that supports HTML image tags.

## Admin Flow

1. Open a campaign with a real end date.
2. In the campaign editor, use the **Email Timer** section.
3. Pick image width, height, and expired behavior.
4. Click **Create email timer**.
5. Copy either the public image URL or the generated snippet.

The generated URL has this shape:

```text
https://your-app-domain.com/api/email-timer/<publicToken>.png
```

Generic snippet:

```html
<img src="https://your-app-domain.com/api/email-timer/<publicToken>.png" alt="Offer countdown timer" width="600" style="display:block;border:0;max-width:100%;height:auto;" />
```

## Rendering

- The image is a PNG response rendered server-side.
- No JavaScript is required in the email.
- The timer uses the campaign end date, not a fake per-open countdown.
- The first implementation uses a compact bitmap renderer with campaign
  background, text, and accent colors.
- Response headers use `no-store` and `no-cache` because the image is time
  sensitive.

## Expired Behavior

Supported options:

- `SHOW_EXPIRED`: render an expired image.
- `SHOW_ZERO`: render `00:00:00`.
- `HIDE`: return a transparent 1x1 PNG.

Email clients cannot reliably remove an already inserted image block after the
timer expires. `HIDE` avoids showing a countdown, but some clients may still
reserve space or cache a previous image.

## Security

- `publicToken` is generated from high-entropy random bytes and is not derived
  from shop, campaign, or visitor IDs.
- The image endpoint only exposes the timer image.
- No shop secrets, visitor IDs, sessions, or customer PII are included in the
  URL or response.

## Limitations

- Email clients and ESP proxy layers may cache images despite no-cache headers.
- The timer is based on the server clock and campaign end date.
- A campaign without `endsAt` cannot create an email timer.
- The first version renders static PNG frames per request, not animated GIFs.
