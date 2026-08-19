# Barnaloppan CLI

Public Bun CLI for Barnaloppan booth inventory. The site has no public
API; this uses its ordinary login form and the authenticated browser flow.
Only the session cookie is stored, at
`~/.config/barnaloppan/session.json` with mode `0600`.

```bash
barnaloppan auth login --from-1password
barnaloppan list --json
barnaloppan add clothes.csv        # dry run
barnaloppan add clothes.csv --yes  # uploads photos and creates listings
barnaloppan delete 12345678        # dry run
barnaloppan delete 12345678 --yes  # permanently removes it
```

`auth login --from-1password` reads a local 1Password item just-in-time and
never stores the password. The default item is `Barnaloppan`; override it with
`BARNALOPPAN_1PASSWORD_ITEM` and optionally
`BARNALOPPAN_1PASSWORD_VAULT`. The CLI normally discovers the active booth;
pass `--booking-id` only if discovery fails.

CSV format (the optional `photo` is a local JPEG/PNG path):

```csv
name,price,active,photo
Blue fleece,1200,true,/path/to/blue-fleece.jpg
Rain trousers,900,true,/path/to/rain-trousers.png
```

Names are limited to 24 characters because the site enforces that limit.
When `photo` is present, `add --yes` uploads it first and then includes the
returned image path in the product-save call. Dry runs validate the file and
show the full proposed batch without uploading or creating anything.

`delete` is permanent and accepts only explicit product IDs. It always starts
as a dry run; use `--yes` only after checking the target IDs with `list`.
