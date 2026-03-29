# ENTRYFRAG baseline snapshot

- Captured at: 2026-03-29T19:14:21.0465410+03:00
- Site: http://localhost:4782/
- Product anchor checked: #product-navi-2025-jersey
- Promo code checked: SIGNA
- Server boundary: existing order logger and /api/orders were used without backend code changes.
- Checkout note: Nova Poshta lookup was stubbed with deterministic city/branch data to keep the run repeatable.

## Preserved flows

- Browse catalog
- Open product
- Select size
- Add to cart
- Apply promo
- Submit checkout
- Open #product-... links

## Results

### desktop

- Viewport: 1440x1400
- Selected size: M
- Order number shown in checkout: EF-20260329-3054
- Submit result observed after clicking confirm: Checkout stayed open after submit and showed an error toast in the captured screenshot.
- Hash flow title: #product-navi-2025-jersey
- Catalog screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\01-catalog.png
- Product screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\02-product-size-selected.png
- Cart screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\03-cart-promo.png
- Checkout screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\04-checkout-open.png
- After-submit screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\05-after-submit.png
- Hash screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\desktop\02-product-size-selected.png

### mobile

- Viewport: 390x844
- Selected size: M
- Order number shown in checkout: EF-20260329-9059
- Submit result observed after clicking confirm: Checkout stayed open after submit and showed an error toast in the captured screenshot.
- Hash flow title: #product-navi-2025-jersey
- Catalog screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\01-catalog.png
- Product screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\02-product-size-selected.png
- Cart screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\03-cart-promo.png
- Checkout screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\04-checkout-open.png
- After-submit screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\05-after-submit.png
- Hash screenshot: A:\Entryfrag\artifacts\baseline\20260329-191349\mobile\02-product-size-selected.png

Artifacts were written under $relativeOutput.
