# Production Scripts

Layout, validation, and export automation lives here.

Scripts are import-safe and only write outputs through their explicit CLI entry
points. `build_component_library.py` discovers repository resources and common
system font locations without relying on a developer-specific path.

`build_component_library.py` creates disposable transport/export packs. Its output is not a source of truth; tracked masters in `design-system/components/`, content in `design-system/tokens/`, and the current Business Bible govern production.
