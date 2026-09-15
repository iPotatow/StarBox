# Third-party notices

## coss ui

Source repository: https://github.com/cosscom/coss

StarBox 0.5.1 uses the coss UI copy/paste-and-own model. Only source/design patterns from the repository's `apps/ui/` scope identified by coss as MIT-licensed are adapted; no source is copied from the repository areas covered by its different default license.

Adapted registry components / upstream source references used for this migration include:

- `apps/ui/registry/default/ui/textarea.tsx` — upstream blob `36d8b62c879a44f0ae47c6d4dfba8b879593d013`
- `avatar.tsx` — `1e9c551e0c609b845e0ee95095ff8453d8561621`
- `badge.tsx` — `c76bff6d4ff6e0b59d689fc2d9fc70142b346488`
- `alert.tsx` — `e5c4617972b810abd7c82f043400ff068d3eabb8`
- `card.tsx` — `e2e490993f62081a1de6d459f0e1d65b00e35ac0`
- `menu.tsx` — `804bd47677630e6e7aa17b06e1a0181e6641eae6`
- `select.tsx` — `d7782d0c0a431206ecc95f6d2921b74b3906ed0e`
- `sidebar.tsx` — `e6f284ee9b96ac10a907a71bc7658dcfc591ff02`
- `tabs.tsx` — `e53f93c27c94db865c012849c7c954b5a5932ad1`
- `toast.tsx` — `30ed9bf95d52d4b4733ab78b6dca18bb8ae32897`
- `pagination.tsx` — `f3db53c4beca84d0a8b55fb5e7bf4227dd1b8434`
- `progress.tsx` — `ea226ed46f07a959c6ac5812f4ce40e07e7373fd`

Existing Button/Input/Field/Dialog/Select/Checkbox/Switch/Tooltip components were also migrated to the same COSS/Base UI architecture in this 0.5.x line.

StarBox modifications include API compatibility wrappers, RemixIcon integration, theme/density/accent preservation, simplified composition appropriate to existing StarBox product surfaces, and deterministic test-runtime shims. The Sidebar adaptation intentionally uses the documented non-collapsible composition subset so the existing StarBox desktop sidebar and mobile bottom-tab visual contract remain unchanged.

## Animate UI

Source repository: https://github.com/imskyleen/animate-ui

StarBox adapts Animate UI's copy-and-own motion patterns for purposeful state feedback. The current integration is intentionally limited to AI analysis state transitions and animated batch progress; it does not replace the COSS visual system or add decorative page motion. The local `AnimatedProgress` implementation is adapted for StarBox's existing `@base-ui/react` primitives rather than introducing Animate UI's older Base UI package name. Animate UI is distributed under the MIT license.

## Motion

Repository: https://github.com/motiondivision/motion

StarBox depends on `motion` 12.23.24 for React state/layout animation primitives used by the Animate UI integration. Motion and Framer Motion are distributed under the MIT license.

## Base UI

Project: https://base-ui.com/  
Repository: https://github.com/mui/base-ui

StarBox depends on `@base-ui/react` 1.8.0 as the behavior primitive layer. Base UI is used by Button, Input, Field/Textarea, Dialog, Select, Checkbox, Switch, Menu, Tooltip, Toast, Tabs, Avatar and polymorphic render helpers. Base UI is distributed under the MIT license.

## Remix Icon

Repository: https://github.com/Remix-Design/RemixIcon

Icons are consumed through `@remixicon/react` and remain subject to the Remix Icon license.
