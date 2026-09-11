# Third-party notices

## coss ui

Source repository: https://github.com/cosscom/coss

StarBox 0.5.1 uses the coss UI copy/paste-and-own model. Only source/design patterns from the repository's `apps/ui/` scope identified by coss as MIT-licensed are adapted; no source is copied from the repository areas covered by its different default license.

Adapted registry components / upstream source references used for this migration include:

- `apps/ui/registry/default/ui/textarea.tsx` — upstream blob `36d8b62c879a44f0ae47c6d4dfba8b879593d013`
- `badge.tsx` — `c76bff6d4ff6e0b59d689fc2d9fc70142b346488`
- `alert.tsx` — `e5c4617972b810abd7c82f043400ff068d3eabb8`
- `card.tsx` — `e2e490993f62081a1de6d459f0e1d65b00e35ac0`
- `menu.tsx` — `804bd47677630e6e7aa17b06e1a0181e6641eae6`
- `tabs.tsx` — `e53f93c27c94db865c012849c7c954b5a5932ad1`
- `toast.tsx` — `30ed9bf95d52d4b4733ab78b6dca18bb8ae32897`
- `pagination.tsx` — `f3db53c4beca84d0a8b55fb5e7bf4227dd1b8434`
- `command.tsx` — `f68092efa242abcaa89c17edceaabccceec4d43b`
- `autocomplete.tsx` was consulted for the Command adaptation — `0f0c4f337055a22a6b1f5c0a7747d0ea9b983115`

Existing Button/Input/Field/Dialog/Select/Checkbox/Switch/Tooltip components were also migrated to the same COSS/Base UI architecture in this 0.5.x line.

StarBox modifications include API compatibility wrappers, RemixIcon integration, theme/density/accent preservation, simplified composition appropriate to existing StarBox product surfaces, and deterministic test-runtime shims.

## Base UI

Project: https://base-ui.com/  
Repository: https://github.com/mui/base-ui

StarBox depends on `@base-ui/react` 1.8.0 as the behavior primitive layer. Base UI is used by Button, Input, Field/Textarea, Dialog, Select, Checkbox, Switch, Menu, Tooltip, Toast, Tabs, Command/Autocomplete and polymorphic render helpers. Base UI is distributed under the MIT license.

## Remix Icon

Repository: https://github.com/Remix-Design/RemixIcon

Icons are consumed through `@remixicon/react` and remain subject to the Remix Icon license.

## GithubStarsManager

Repository: https://github.com/AmintaCCCP/GithubStarsManager

Used as a product/workflow reference. StarBox does not copy its application source; the Worker-native architecture and implementation are independent.
