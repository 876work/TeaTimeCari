# Tea Time Cari Discourse Theme

This directory contains the Tea Time Cari Discourse theme styling that can be imported into Discourse.

## Light, dark, and auto color modes

Discourse core includes the light/dark/auto mode selector. Do **not** install the legacy Dark/Light Mode Toggle theme component for this theme.

To show the built-in selector, enable Discourse's `interface_color_selector` site setting (Admin > Settings, search for `interface color selector`). The core selector supports:

- **Light**: uses the site's configured light color palette.
- **Dark**: uses the site's configured dark color palette.
- **Auto**: follows the visitor's operating-system/browser color-scheme preference.

Make sure the site has both a light palette and a dark palette configured for the active theme. This theme's CSS intentionally uses Discourse color variables (for example `--primary`, `--secondary`, `--tertiary`, `--header_background`, and `--header_primary`) instead of hard-coded light-only colors so palette changes apply automatically.


References: Discourse Meta documents that the legacy Dark/Light Mode Toggle component was merged into Discourse core and that `interface_color_selector` can display the selector in the sidebar footer or header: https://meta.discourse.org/t/dark-light-mode-toggle-now-available-in-core/350991
