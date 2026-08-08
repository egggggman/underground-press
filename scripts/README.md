# Production Scripts

Layout, validation, and export automation lives here.

Scripts are import-safe and only write outputs through their explicit CLI entry
points. `build_component_library.py` discovers repository resources and common
system font locations without relying on a developer-specific path.
