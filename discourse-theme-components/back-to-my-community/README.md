# Tea Time Cari Back to My Community Button

This is a lightweight Discourse **theme component** that adds a logged-in-only navigation button near the top of topic pages and category pages.

Button text:

```text
← Back to My Community
```

## Behavior

- Logged-out visitors do not see the button.
- On `/t/...` topic pages and `/c/...` category pages, logged-in users see the button at the top of `#main-outlet`.
- If the current user has the `women-slu` group loaded in the Discourse current-user payload, the button links to `/c/user-photos/women-photos-slu/7`.
- If the current user has the `men-slu` group loaded in the Discourse current-user payload, the button links to `/c/user-photos/men-photos-slu/6`.
- If group detection is unavailable, the button falls back to `window.history.back()`.
- If a user is already on their assigned category page, the button uses `window.history.back()` instead of reloading the same category.

## Where to paste this in Discourse

Preferred install path:

1. In Discourse, go to **Admin → Customize → Themes → Components**.
2. Choose **Install → From your device** and upload this `discourse-theme-components/back-to-my-community` directory as a theme component, or create a new component manually.
3. Attach the component to the active Tea Time Cari theme.

Manual paste path:

1. Create a new theme component named **Tea Time Cari Back to My Community Button**.
2. Paste `common/head_tag.html` into **Common → Head**.
3. Paste `common/common.scss` into **Common → CSS/SCSS**.
4. Save, then add the component to the active theme.

## Testing steps

### Women test account

1. Sign in as a test account that belongs to `women-slu`.
2. Open a topic page, such as `/t/example-topic/...`.
3. Confirm the `← Back to My Community` button appears near the top of the page.
4. Click the button and confirm it opens `/c/user-photos/women-photos-slu/7`.
5. Open the Women’s Community category page directly.
6. Click the button and confirm the browser goes back to the previous page.

### Men test account

1. Sign in as a test account that belongs to `men-slu`.
2. Open a topic page, such as `/t/example-topic/...`.
3. Confirm the `← Back to My Community` button appears near the top of the page.
4. Click the button and confirm it opens `/c/user-photos/men-photos-slu/6`.
5. Open the Men’s Community category page directly.
6. Click the button and confirm the browser goes back to the previous page.

### Fallback and visibility checks

1. Sign in as a logged-in user whose groups are not present in the current-user payload.
2. Open a topic page or category page and click the button.
3. Confirm the browser runs the history-back behavior.
4. Sign out and open a public topic or category page.
5. Confirm the button is not visible.
