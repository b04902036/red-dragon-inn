# Card selection and previews

Click or tap any eligible card body to select it for discard or a mandatory card choice; click again to deselect. Selected cards show a checkmark and border in addition to a small lift. Space and Enter both toggle selection while the card body has keyboard focus. Busy/ineligible cards and maximum selection limits block toggling. Play, Respond, gambling and Details controls are separate from the checkbox body and stop click propagation. No button is nested inside another button.

Desktop hover and keyboard focus automatically show localized card details in a nonblocking panel above the hand. The preview never moves focus or opens a modal. Move between cards to update it; leave the card or move focus outside to clear it after a 100ms grace period. Moving into or focusing the scrollable preview pins it for reading long rules until closed. Escape dismisses it. Touch/small screens expose a separate Details control that pins the same preview until closed, without changing selection. Reduced-motion users receive the checkmark, border and accessible state without the lift.

Mandatory card choices use the same card surface when projected own-hand metadata exists. Unknown options retain the original accessible list; no definition or card data is invented. Choice identity resets selection for a genuinely new server prompt, while locale changes preserve selected physical IDs.

## Visual verification

Start `npm run dev:fixture` and join with a second browser. Start a match, click two card titles/bodies, deselect one and submit discard. Hover two cards in sequence and confirm names/rules update without clicking or opening a dialog. Tab to a card, press Space/Enter and Escape. Click Play/Respond and check that selection is unchanged. At a 390px viewport, use Details and select a card separately. Choose 繁體中文 to inspect localized text, and enable reduced motion to confirm selection remains obvious. The browser regression produces `.tools/step16-desktop.png` and `.tools/step16-mobile.png`.
