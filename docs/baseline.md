# ENTRYFRAG Baseline

Use `scripts/capture-baseline.ps1` before front-end changes to snapshot the current storefront behavior at desktop and phone widths.

What it records:

- browse catalog
- open product
- select size
- add to cart
- apply promo
- submit checkout
- open `#product-...` links

Guardrails:

- it starts the existing `order-logger.ps1` server and uses the current `/api/orders` flow
- it does not change backend code or the order API contract
- it stubs Nova Poshta lookup responses in-browser so checkout can be completed repeatably during the baseline run

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\capture-baseline.ps1
```

Artifacts are written to `artifacts\baseline\<timestamp>\` with:

- `desktop\*.png`
- `mobile\*.png`
- `summary.json`
- `summary.md`
