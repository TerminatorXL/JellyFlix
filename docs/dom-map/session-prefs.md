# Session, preferences & admin dashboard — login, user picker, select server, wizard, `#myPreferencesMenuPage`, `#dashboardPage` (Jellyfin 12.1)

Scope: `src/apps/legacy/controllers/session/**` (login, selectServer, addServer, resetPassword),
`src/apps/legacy/routes/session/forgotPassword`, `src/apps/wizard/**`, the user-preference pages
(`src/apps/legacy/routes/user/settings`, `src/apps/modern/routes/user/display`, the four legacy
`mypreferences*` controllers) and the admin dashboard shell (`src/apps/dashboard/**`).

All source paths below are relative to `_ref/jellyfin-web/` unless stated otherwise.

---

## Where it appears (routes, layouts, breakpoints)

### Routes

| hash route | page element | rendered by | app layout |
|---|---|---|---|
| `#/login` | `#loginPage` | `src/apps/legacy/controllers/session/login/index.{html,js}` via `LEGACY_PUBLIC_ROUTES` (`src/apps/legacy/routes/legacyRoutes/public.ts:18-24`) | modern **or** legacy `AppLayout` |
| `#/selectserver` | `#selectServerPage` | `session/selectServer/index.html` (`public.ts:11-17`) | modern/legacy |
| `#/addserver` | anonymous `.page.standalonePage` | `session/addServer/index.html` (`public.ts:4-10`) | modern/legacy |
| `#/forgotpassword` | `#forgotPasswordPage` (React) | `src/apps/legacy/routes/session/forgotPassword/index.tsx:86-135`, `ASYNC_PUBLIC_ROUTES` (`asyncRoutes/public.ts:4`) | modern/legacy |
| `#/forgotpasswordpin` | `.page.standalonePage.forgotPasswordPinPage` | `session/resetPassword/index.html` (`public.ts:25-31`) | modern/legacy |
| `#/wizard/start\|user\|settings\|library\|remoteaccess\|finish` | `#wizardStartPage`, `#wizardUserPage`, `#wizardSettingsPage`, `#wizardLibraryPage`, `#wizardFinishPage` | `src/apps/wizard/controllers/**`, routes `src/apps/wizard/routes/routes.tsx:10-59` | **`apps/legacy/AppLayout`** (`routes.tsx:4,66`) |
| `#/mypreferencesmenu` | `#myPreferencesMenuPage` (React) | `src/apps/legacy/routes/user/settings/index.tsx:53-384` — used by **both** apps (`apps/modern/routes/asyncRoutes/user.ts:16`) | modern/legacy |
| `#/mypreferencesdisplay` | `#displayPreferencesPage` | **modern:** MUI page `src/apps/modern/routes/user/display/index.tsx:47-90`; **legacy:** `apps/legacy/controllers/user/display/index.html` | modern/legacy |
| `#/mypreferenceshome` | `#homeScreenPreferencesPage` | legacy controller for both apps (`apps/modern/routes/legacyRoutes/user.ts:29-33`) | modern/legacy |
| `#/mypreferencesplayback` | `#languagePreferencesPage` | legacy controller (`legacyRoutes/user.ts:35-39`) | modern/legacy |
| `#/mypreferencessubtitles` | `#homeScreenPreferencesPage` (id is duplicated — see gotchas) | legacy controller (`legacyRoutes/user.ts:41-45`) | modern/legacy |
| `#/mypreferencescontrols` | `#controlsPreferencesPage` | legacy controller (`legacyRoutes/user.ts:23-27`) | modern/legacy |
| `#/userprofile`, `#/quickconnect` | `.userPreferencesPage` React pages | `apps/legacy/routes/user/userprofile.tsx:182`, `apps/legacy/routes/quickConnect/index.tsx:73` | modern/legacy |
| `#/dashboard/**`, `#/metadata`, `#/configurationpage` | `#dashboardPage` etc., all `.mainAnimatedPage.type-interior` | `src/apps/dashboard/routes/routes.tsx:18-55` | **`apps/dashboard/AppLayout`** (separate tree) |

Route trees are siblings under `RootAppLayout` (`src/RootAppRouter.tsx:22-35`): the modern **or** legacy app
(`layoutManager.modern ? MODERN_APP_ROUTES : LEGACY_APP_ROUTES`), then `DASHBOARD_APP_ROUTES`, then
`WIZARD_APP_ROUTES`. **The dashboard is not nested inside the modern/legacy layout** — this has a large
consequence for custom CSS (see gotchas).

### Layouts / breakpoints

* `<html>` gets `layout-desktop | layout-mobile | layout-tv` and `data-theme="dark"` (live-verified on all
  profiles below). Root font-size differs per layout — `styles/fonts.scss:6-11` `html{font-size:93%}` → **14.88px**
  (desktop), `:49-51` `.layout-mobile{font-size:90%}` → **14.4px**, `:43-47` `.layout-tv{font-size:125%}` → **20px**
  (all three measured live). Every `em` in legacy CSS scales with that; **`@media` `em` units stay at 16px**.
* Login page is the *same* markup in all layouts; only the surrounding shell differs:
  * **modern** (`layout-desktop`/`layout-mobile`): legacy `.skinHeader` block is `display:none`, a MUI
    `header.MuiAppBar-root` (48px, `colorTransparent`, `position:fixed`) sits above; `#loginPage` starts at `y=48`.
  * **legacy-desktop**: no MUI app bar; `.skinHeader.semiTransparent.noHeaderRight` (53px, `position:fixed`,
    `z-index:999`) overlays; `#loginPage` starts at `y=0`.
  * **tv**: no app bar at all, `#loginPage` is `{0,0 1920x1080}`, every button gains `.show-focus`.
* `form` and `.readOnlyContent` are capped at `max-width:54em` **only above `min-width:50em`**
  (`styles/site.scss:128-138`) → 804px at 1920 desktop, **unconstrained at 390px mobile** (measured: 364px wide).
* Dashboard drawer: permanent `MuiDrawer` of **240px** at MUI `md` (`>=900px`); below that a `SwipeableDrawer`
  (`src/components/ResponsiveDrawer.tsx:10,24-70`). `.dashboardDocument .mainAnimatedPage:not(.metadataEditorPage){left:240px}`
  above 900px (`src/apps/dashboard/AppOverrides.scss:11-16`) — live: `#dashboardPage` at `x=240`.

### Live verification actually performed

| profile | route | what was dumped |
|---|---|---|
| modern-desktop | `#/login` (`--nologin`) | full `body` tree + computed bg/padding/position |
| modern-mobile | `#/login` (`--nologin`) | `#loginPage` + padding/max-width/margin |
| legacy-desktop | `#/login` (`--nologin`) | `body` + position/z-index |
| tv | `#/login` (`--nologin`) | `#loginPage` + font-size/padding/transform |
| modern-desktop | `#/mypreferencesmenu` | `#reactRoot` tree |
| modern-desktop | `#/mypreferencesdisplay?userId=…` | `#displayPreferencesPage` tree |
| modern-desktop | `#/dashboard` | `#reactRoot` (app bar + MUI drawer + grid) |
| modern-desktop | `#/dashboard/users` | `.content-primary` (user card grid) |
| modern-desktop | `#/wizard/start` (`--nologin`) | confirmed **redirect to `#/login`** |
| modern-desktop | `html` | all `--jf-*` variables consumed here |

Screenshots read: `_shots/baseline/modern-desktop/{login,prefs,dashboard}.png`.

**Two things could not be reproduced live on this test server and are source-only below:**

1. **The visual user picker (`.visualLoginForm` / `#divUsers`) never renders here.** `GET /Users/Public` returns
   `[]` because all four users (`admin`, `Dzieci`, `Kasia`, `Patryk`) have `Policy.IsHidden = true`. With an empty
   list `index.js:291-298` calls `showManualForm(view,false,false)` instead of `showVisualForm()`. To exercise the
   Netflix profile picker, clear *"Hide this user from login screens"* for at least one user in
   `#/dashboard/users/<id>` first. The card markup below is taken verbatim from `loadUserList()` and its
   sub-structure is live-verified on `#/dashboard/users`, which builds the *same* card skeleton
   (`src/components/dashboard/users/UserCardBox.tsx:53-83`).
2. **The wizard** only renders on an unconfigured server; `ConnectionRequired level='wizard'`
   (`apps/wizard/routes/routes.tsx:63`) redirected `#/wizard/start` to `#loginPage` in the live dump.

---

## DOM skeleton (indented tree of the real markup, trimmed)

### `#/login` — modern-desktop, live (manual form state)

```
body.hideMainDrawer
  div#reactRoot
    div.backdropContainer                     {fixed, 100vw×100vh, z-index:-1}   ← splashscreen image lands here
    div.backgroundContainer                   {fixed, bg #101010}
    div                                       (display:none — whole legacy header block in modern)
      div.mainDrawer.transition.touch-menu-la
      div.skinHeader.…semiTransparent.noHeaderRight
      div.mainDrawerHandle
    div.MuiBox-root.css-sjv9i2                 ← modern AppLayout root (hashed!)
      header.MuiPaper-root.MuiAppBar-root.MuiAppBar-colorTransparent.MuiAppBar-positionFixed.mui-fixed  {0,0 1920×48}
        div.MuiToolbar-root.MuiToolbar-dense.padded-left.padded-right
          div.MuiStack-root > a[href="#/"] > span.MuiButton-startIcon > img      ← logo only (public path)
      div                                       {0,0 1920×48}  ← OffsetAppBar spacer
      main.MuiBox-root
        div.mainAnimatedPages.skinBody
          div#loginPage.page.standalonePage.backdropPage.mainAnimatedPage   {0,48 1920×1032; position:absolute;
                                                                             padding:66.96px 0 74.4px}
            div.padded-left.padded-right.padded-bottom-page.margin-auto-y   {padding:0 3.3% 74.4px}   ← vertical centerer
              form.manualLoginForm.margin-auto-x                            {558,115 804×360}
                div.padded-left.padded-right.flex.align-items-center.justify-content-center
                  h1.sectionTitle                     "Logowanie"
                div.inputContainer
                  label.inputLabel.inputLabel-float.inputLabelFocused   "Użytkownik"
                  input#txtManualName.emby-input[is=emby-input][type=text]    {bg rgba(255,255,255,.09)}
                div.inputContainer
                  label.inputLabel.inputLabelUnfocused.inputLabel-float  "Hasło"
                  input#txtManualPassword.emby-input[type=password]
                label.checkboxContainer.emby-checkbox-label
                  input.chkRememberLogin.emby-checkbox   {position:absolute, 1×1 — visually hidden}
                  span.checkboxLabel                     "Zapamiętaj hasło"
                  span.checkboxOutline                   {bg #00a4dc, position:absolute}
                    span.material-icons.checkboxIcon.checkboxIcon-checked.check
                    span.material-icons.checkboxIcon.checkboxIcon-unchecked
                button.raised.button-submit.block.emby-button[type=submit]   {bg #00a4dc}
                  span                                   "Zaloguj się"
                div[style="margin-top:.5em"]
                  button.raised.cancel.block.btnCancel.emby-button(.hide)
              div.visualLoginForm(.hide)[style="text-align:center"]          ← profile picker (hidden here)
                h1[style="margin-top:1em"]              "Logowanie"
                div#divUsers.itemsContainer.vertical-wrap.centered           {display:flex; flex-wrap:wrap; justify-content:center}
              div.readOnlyContent[style="margin:.5em auto 1em"]              {558,482 804×127}
                button.raised.cancel.block.btnManual.emby-button(.hide)
                button.raised.cancel.block.btnQuick.emby-button(.hide until QuickConnect enabled)
                button.raised.cancel.block.btnForgotPassword.emby-button
                button.raised.block.btnSelectServer.emby-button(.hide when !AppFeature.MultiServer)
                div.loginDisclaimerContainer            {display:flex; margin-top:2em}
                  div.loginDisclaimer                   {margin:0 auto}  ← markdown-rendered HTML from Branding
        div.skinBody                                                          ← React pages render here
    link[href="themes/dark/theme.css"]                ← ThemeCss, inside #reactRoot
  div.docspinner.mdl-spinner                          {fixed, z-index:9999999}
  div.appfooter                                       {fixed, z-index:1201}
  div.tmla-mask.hide                                  {fixed, z-index:1098}
```

Source: `src/apps/legacy/controllers/session/login/index.html:1-58`.

### `#divUsers` card (source `login/index.js:145-192`; sub-structure live-verified on `#/dashboard/users`)

```
button.card.squareCard.scalableCard.squareCard-scalable          (+ .show-focus .show-animation on TV)
  div.cardBox.cardBox-bottompadded                               {margin:.6em; margin-bottom:1.8em !important}
    div.cardScalable
      div.cardPadder.cardPadder-square                           {padding-bottom:100%; contain:strict; bg #202020}
      div.cardContent[data-haspw][data-username][data-userid]    {position:absolute; inset:0; border-radius:var(--jf-card-borderRadius)}
        div.cardImageContainer.coveredImage[style="background-image:url('…/Users/<id>/Images/Primary?…')"]
        — or, when the user has no avatar —
        div.cardImage.defaultCardBackground.defaultCardBackgroundN.flex.align-items-center.justify-content-center
          span.material-icons.cardImageIcon.person
    div.cardFooter.visualCardBox-cardFooter                      {padding:.3em .3em .5em}
      div.cardText.singleCardText.cardTextCentered               user name
```

Note the login page uses `cardBox cardBox-bottompadded` (**not** `visualCardBox`), so it gets **no card
background/shadow** — unlike the dashboard user cards, which use `.cardBox.visualCardBox` (bg `#202020`,
`box-shadow`). Click handling is delegated on `#divUsers` and reads `data-userid` / `data-haspw` /
`data-username` off `.cardContent` (`index.js:227-248`).

### `#/selectserver` (source `session/selectServer/index.html:1-17`)

```
div#selectServerPage.page.noSecondaryNavPage.standalonePage.pageContainer
  div.margin-auto-y.padded-bottom-page
    div.verticalSection.flex-shrink-zero.w-100.flex.flex-direction-column
      div.padded-left.padded-right.flex.align-items-center.justify-content-center
        h1.sectionTitle.sectionTitle-cards          "Wybierz serwer"
      div.padded-top.padded-bottom-focusscale.flex-grow.flex[data-horizontal=true][data-centerfocus=card]
        div.scrollSlider.focuscontainer-x.servers.flex-grow[is=emby-itemscontainer][style="display:block;text-align:center"]
          button.card.backdropCard.backdropCard-scalable …        ← per server; footer is .cardText.cardTextCentered
    div.padded-top.padded-left.padded-right.flex.flex-shrink-zero.justify-content-center.verticalSection.flex-wrap-wrap.margin-auto-x
      a.raised.cancel.btnAddServer.flex-shrink-zero[href="#/addserver"][style="margin:.25em"]
```

`updatePageStyle()` (`selectServer/index.js:79-88`) swaps `standalonePage` ⇄ `libraryPage noSecondaryNavPage`
depending on `?showuser=1` — i.e. **the page-top padding changes at runtime** (4.5em vs 7.5em).

### `#/addserver`, `#/forgotpassword`, `#/forgotpasswordpin`

```
div.page.standalonePage                                     (addServer — no id!)
  div.padded-left.padded-right.padded-bottom-page
    form.addServerForm[style="margin:0 auto"][novalidate]
      h1 ; div.inputContainer > input#txtServerHost.emby-input ; div.fieldDescription
      button.raised.button-submit.block ; button.raised.button-cancel.block.btnCancel

div#forgotPasswordPage.standalonePage.forgotPasswordPage.mainAnimatedPage       (React)
  div.padded-left.padded-right.padded-bottom-page
    form.forgotPasswordForm[style="text-align:center;margin:0 auto"]
      div[style="text-align:left"] > h1 ; .inputContainer > input#txtName ; .fieldDescription
        button#btnSubmit.raised.submit.block ; button#btnCancel.raised.cancel.block.btnCancel

div.page.standalonePage.forgotPasswordPinPage
  div.padded-left.padded-right.padded-bottom-page
    form.forgotPasswordPinForm > div > h2 ; .inputContainer > input#txtPin ; buttons
```

### Wizard (source only — `src/apps/wizard/controllers/*/index.html`)

```
div#wizardStartPage.page.standalonePage.wizardPage[data-backbutton=false]
  div.padded-left.padded-right.padded-top
    div.ui-corner-all.ui-shadow.wizardContent[style="position:relative"]
      form.wizardStartForm
        div > h1[style="float:left"] + a.raised.raised-alt[style="float:right;margin-top:20px"]
        p ; div.inputContainer > input#txtServerName ; div.selectContainer > select#selectLocalizationLanguage
        div.wizardNavigation[style="text-align:right"] > button.raised.button-submit > span + span.material-icons.arrow_forward
```

Same shell for `#wizardUserPage` (`.wizardUserForm`, `#txtUsername`, `#txtManualPassword`, `#txtPasswordConfirm`),
`#wizardSettingsPage`, `#wizardLibraryPage.mediaLibraryPage`, `#wizardFinishPage`. All are
`.page.standalonePage.wizardPage` → `padding-top:7em !important` (`styles/librarybrowser.scss:107-109`).

### `#/mypreferencesmenu` — live, modern-desktop

```
div.skinBody
  div#myPreferencesMenuPage.page.libraryPage.userPreferencesPage.noSecondaryNavPage.mainAnimatedPage
                                                     {0,48 1920×1032; position:absolute; padding:0 0 74.4px}
    div.padded-left.padded-right.padded-bottom-page.padded-top       {padding:14.88px 3.3% 74.4px}
      div.readOnlyContent[style="margin:0 auto"]                     {558,81 804×376}
        div.verticalSection.verticalSection-extrabottompadding
          h2.sectionTitle.headerUsername[style="padding-left:.25em"]     "admin"
          a.emby-button.lnkUserProfile.listItem-border[href="#/userprofile?userId=…"][style="display:block;margin:0;padding:0"]
            div.listItem                                             {padding:.25em .25em .25em .5em}
              span.material-icons.listItemIcon.listItemIcon-transparent.person
              div.listItemBody > div.listItemBodyText                "Profil"
          a.emby-button.lnkQuickConnectPreferences.listItem-border   (display:none in modern — see gotchas)
          a.emby-button.lnkDisplayPreferences.listItem-border        tv           → #/mypreferencesdisplay
          a.emby-button.lnkHomePreferences.listItem-border           home         → #/mypreferenceshome
          a.emby-button.lnkPlaybackPreferences.listItem-border       play_circle_filled
          a.emby-button.lnkSubtitlePreferences.listItem-border       closed_caption
          a.emby-button.downloadManager.listItem-border              (appHost gated)
          a.emby-button.clientSettings.listItem-border               (appHost gated)
          a.emby-button.lnkControlsPreferences.listItem-border       keyboard
        div.adminSection.verticalSection.verticalSection-extrabottompadding   (display:none in modern)
          h2.sectionTitle.headerUsername "Administracja" ; a[href="#/dashboard"] ; a[href="#/metadata"]
        div.userSection.verticalSection.verticalSection-extrabottompadding    (display:none in modern)
          h2 "Użytkownik" ; a.selectServer ; a.btnLogout ; a.exitApp
```

Source `src/apps/legacy/routes/user/settings/index.tsx:53-384`.

### `#/mypreferencesdisplay` (modern) — live

```
div#displayPreferencesPage.page.libraryPage.userPreferencesPage.noSecondaryNavPage
  div.settingsContainer.padded-left.padded-right.padded-bottom-page
    form[style="margin:auto"]                                        {558,48 804×2558}
      div.MuiStack-root.css-15ctjlp                                  (spacing={4})
        div.MuiStack-root.css-14jjdko                                ← one per section
          h2.MuiTypography-root.MuiTypography-h2                     "Lokalizacja" / "Wyświetlanie" / …
          div.MuiFormControl-root.MuiFormControl-fullWidth
            label.MuiInputLabel-root.MuiInputLabel-filled#display-settings-<name>-label
            div.MuiInputBase-root.MuiFilledInput-root.MuiSelect-root {bg rgba(255,255,255,.09)}
              div#mui-component-select-<name>.MuiSelect-select.MuiFilledInput-input[role=combobox]
              input.MuiSelect-nativeInput
              svg.MuiSelect-icon[data-testid=ArrowDropDownIcon]
            div#display-settings-<name>-description.MuiFormHelperText-root
          label.MuiFormControlLabel-root > span.MuiCheckbox-root.PrivateSwitchBase-root + span.MuiFormControlLabel-label
      button.MuiButton-root.MuiButton-containedPrimary.MuiButton-sizeLarge[type=submit]   "Zapisz"  {bg #00a4dc}
```

Stable hooks here: `#displayPreferencesPage`, `.settingsContainer`, `form`, and the **stable ids**
`#display-settings-<field>-label` / `#mui-component-select-<field>` / `#display-settings-<field>-description`.
Everything else is MUI + hashed emotion.

The other four preference pages are legacy and much thinner — `#homeScreenPreferencesPage >
div.homeScreenSettingsContainer` (home), `#homeScreenPreferencesPage > div.settingsContainer` (subtitles, **same id**),
`#languagePreferencesPage > div.settingsContainer` (playback), `#controlsPreferencesPage` with an inline
`form > .verticalSection.verticalSection-extrabottompadding > h2.sectionTitle + .checkboxContainer.checkboxContainer-withDescription`.

### `#/dashboard` — live, modern-desktop

```
div#reactRoot
  div.backdropContainer ; div.backgroundContainer ; div(display:none — legacy header) ; div.mainDrawerHandle
  div.MuiBox-root.css-o44is                                        ← dashboard AppLayout root
    header.MuiPaper-root.MuiAppBar-root.MuiAppBar-colorTransparent.MuiAppBar-positionFixed.mui-fixed
                                                                   {240,0 1680×48}  (width = 100% - 240px at md+)
      div.MuiToolbar-root.MuiToolbar-dense.dashboard-appBar         {padding:0 14.88px}
        button.MuiIconButton-root[aria-label="Wstecz"] > svg[data-testid=ArrowBackIcon]
        div.MuiBox-root.css-1riowxi                                 ← AppTabs slot
        div.MuiBox-root.css-2uchni > button[aria-label="Menu użytkownika"] > div.MuiAvatar-root.MuiAvatar-circular
    div                                                             {0,0 1920×48}  ← OffsetAppBar spacer
    div.MuiDrawer-root.MuiDrawer-anchorLeft.MuiDrawer-docked        {0,48 240×0}
      div.MuiPaper-root.MuiDrawer-paper.MuiDrawer-paperAnchorDockedLeft  {fixed, 240×1080, bg #202020, padding-bottom:62.5px}
        ul.MuiList-root > li.MuiListItem-root > a.MuiListItemButton-root[href="#/"]
            div.MuiListItemIcon-root > img.MuiBox-root
            div.MuiListItemText-root.MuiListItemText-multiline
              h6.MuiListItemText-primary   "JellyFlix Test"
              p.MuiListItemText-secondary  "12.1"
        ul.MuiList-root.MuiList-subheader                          ← one per section
          div#server-subheader.MuiListSubheader-root.MuiListSubheader-sticky  "Serwer"
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/dashboard"].Mui-selected
                                                                    {bg rgba(0,164,220,.2)}
            div.MuiListItemIcon-root > svg[data-testid=DashboardIcon]
            div.MuiListItemText-root > span.MuiListItemText-primary "Kokpit"
          … #devices-subheader, #livetv-subheader, #plugins-subheader, #advanced-subheader
    main.MuiBox-root
      div.mainAnimatedPages.skinBody
      div.skinBody                                                  {position:unset !important}
        div#dashboardPage.page.mainAnimatedPage.type-interior        {240,48 1680×1032; position:absolute; left:240px}
          div.content-primary.MuiBox-root                           {padding:0 14.88px 74.4px}
            div.MuiGrid-root.MuiGrid-container.MuiGrid-spacing-xs-3
              div.MuiGrid-item.MuiGrid-grid-xs-12.MuiGrid-grid-md-7…  > div.MuiStack-root   ← widgets column
              div.MuiGrid-item…md-5 > div.MuiBox-root                                       ← activity column
              div.MuiGrid-item…md-6.lg-12 > div.MuiStack-root                               ← paths column
```

Widget pattern (`src/apps/dashboard/components/widgets/Widget.tsx:14-35`): `Box > Button[variant=text] >
Typography[variant=h3]` + children. Cards: `src/apps/dashboard/components/BaseCard.tsx:42-117` →
`MuiCard-root > MuiCardActionArea-root > (MuiCardMedia-root | Box.defaultCardBackgroundN) + MuiCardContent-root`.

### `#/dashboard/users` — live (legacy card grid inside the MUI shell)

```
div.content-primary
  div.verticalSection
    div.sectionTitleContainer.flex.align-items-center               ← note the stray class "undefined" before it
      h2.sectionTitle                     "Użytkownicy"
      div > button#btnAddUser.fab.submit.sectionTitleButton.emby-button   {border-radius:50%, bg #424242}
  div.localUsers.itemsContainer.vertical-wrap
    div.card.squareCard.scalableCard.squareCard-scalable[data-userid][data-username]   (+ .grayscale when disabled)
      div.cardBox.visualCardBox                                     {bg #202020; border-radius:.2em; box-shadow}
        div.cardScalable.visualCardBox-cardScalable
          div.cardPadder.cardPadder-square
          a.emby-button.cardContent[href="#/dashboard/users/<id>/profile"]
            div.cardImage[style="background-image:url(...)"]  — or —
            div.cardImage.defaultCardBackground.defaultCardBackground1.flex.align-items-center.justify-content-center
              span.material-icons.cardImageIcon.person
        div.cardFooter.visualCardBox-cardFooter
          div[style="text-align:right;float:right;padding-top:5px"] > … > button.btnUserMenu.flex-shrink-zero.paper-icon-button-light
          div.cardText            > span   user name
          div.cardText.cardText-secondary > span   "Ostatnia aktywność …"
```

Source `src/apps/dashboard/routes/users/index.tsx:180` + `src/components/dashboard/users/UserCardBox.tsx:53-83`.
Most other dashboard list pages are `material-react-table` inside `TablePage`
(`src/apps/dashboard/components/table/TablePage.tsx:48-78`).

---

## Selector table

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `#loginPage` | login page root; also `.page.standalonePage.backdropPage.mainAnimatedPage` | all | **yes** — best anchor for the whole sign-in screen | `session/login/index.html:1`; `padding-top:4.5em !important` from `styles/librarybrowser.scss:103-105`; `padding-bottom:5em !important` from `styles/site.scss:119-125` |
| `#loginPage > div.padded-left.padded-right.padded-bottom-page.margin-auto-y` | the only wrapper that centers the form vertically (`margin:auto 0`) | all | yes, but it has no unique class — use the child combinator | `index.html:2`; `.margin-auto-y` = `styles/site.scss:181-184` |
| `.manualLoginForm` | username/password form | all | **yes** | `index.html:3`; `.hide` toggled by `index.js:128-129,218-219` |
| `.manualLoginForm > div:first-child > h1.sectionTitle` | "Please sign in" heading | all | yes | `index.html:4-6` |
| `#txtManualName`, `#txtManualPassword` | the two `input[is=emby-input]` | all | **yes** | `index.html:8,12`; base look `elements/emby-input/emby-input.scss:1-17` + `themes/_base/_theme.scss:394-401` |
| `.inputContainer` | wrapper, `margin-bottom:1.8em` | all | yes | `emby-input.scss:32-34` |
| `.inputLabel` / `.inputLabelFocused` / `.inputLabelUnfocused` / `.inputLabel-float` | floating label; classes toggled by JS | all | yes | `elements/emby-input/emby-input.js:47-48,62-71,95-100`; colors `_theme.scss:203-215`. `.inputLabel-float` has **no CSS** — free marker |
| `.chkRememberLogin` | "Remember me" checkbox (visually hidden, 1×1, absolute) | all | style the siblings, not this | `index.html:16` |
| `.checkboxContainer` / `.checkboxOutline` / `.checkboxLabel` / `.checkboxIcon-checked` | rendered checkbox | all | **yes** | live-verified; `.checkboxOutline` bg is `#00a4dc` |
| `.button-submit` (on `#loginPage`) | primary "Sign in" button | all | **yes** — Netflix red target | `index.html:20`; `.emby-button` base `elements/emby-button/emby-button.scss:1-32` |
| `.btnCancel` | cancel, shown only when the manual form was opened from a card | all | yes | `index.js:138-142` |
| `.visualLoginForm` | "Who's watching?" container (inline `text-align:center`) | all | **yes** | `index.html:31`; shown only when `/Users/Public` is non-empty (`index.js:291-294`) |
| `.visualLoginForm > h1` | heading above the picker (inline `margin-top:1em`) | all | yes | `index.html:32` |
| `#divUsers` | the profile grid: `.itemsContainer.vertical-wrap.centered` → `display:flex;flex-wrap:wrap;justify-content:center` | all | **yes — the single most useful selector for the picker** | `index.html:33`; `components/cardbuilder/card.scss:33-51` |
| `#divUsers .card.squareCard` | one profile tile; width is a % set by media query | all | **yes** — override `width` to change columns | `card.scss:519-521` + breakpoints `card.scss:539-663` (50% → 33.3% → 25% → 20% → 16.7% → 14.3% → 12.5% → 11.1% → 10%) |
| `#divUsers .cardBox.cardBox-bottompadded` | tile box, `margin:.6em` + `margin-bottom:1.8em !important` | all | yes — needs `!important` to change the bottom margin | `card.scss:88-102,120-127` |
| `#divUsers .cardPadder-square` | aspect-ratio spacer, `padding-bottom:100%`, `contain:strict`, bg `#202020` | all | **yes** — change `padding-bottom` to reshape the tile | `card.scss:67-72`, `_theme.scss:242-244` |
| `#divUsers .cardContent` | absolutely-positioned click target carrying `data-userid/-username/-haspw` | all | yes | `index.js:165`; `card.scss:197-…` |
| `#divUsers .cardImageContainer.coveredImage` | avatar (`background-image` set inline) | all | yes (not the image itself) | `index.js:175`; `card.scss:164-178,262-265` |
| `#divUsers .cardImage.defaultCardBackground.defaultCardBackgroundN` | fallback avatar tile, N = 1..5 hashed from the name | all | **yes** — 5 fixed colors per theme | `index.js:177`; `components/cardbuilder/utils/builder.ts:135-145`; colors `themes/dark/theme.scss:5-22` |
| `#divUsers .cardImageIcon.person` | fallback person glyph | all | yes | `index.js:178` |
| `#divUsers .cardFooter.visualCardBox-cardFooter` | name strip | all | yes | `index.js:184`; `card.scss:271-274` |
| `#divUsers .cardText.singleCardText.cardTextCentered` | the user name | all | **yes** | `index.js:185`; `card.scss:301-314,373-377` |
| `.btnManual`, `.btnQuick`, `.btnForgotPassword`, `.btnSelectServer` | the four secondary buttons in `.readOnlyContent` | all | **yes** | `index.html:37-51`; `.btnQuick` unhidden by `index.js:281-286`, `.btnSelectServer` hidden without MultiServer (`index.js:275-277`) |
| `#loginPage .readOnlyContent` | the button stack (inline `margin:.5em auto 1em`), `max-width:54em` ≥50em | all | yes | `index.html:36`; `styles/site.scss:128-132` |
| `.loginDisclaimerContainer` / `.loginDisclaimer` | Branding disclaimer, `innerHTML` = sanitized markdown | all | yes | `login.scss:1-26`; `index.js:302-319`; links get `.button-link[is=emby-linkbutton]` |
| `.backdropContainer` | fixed full-viewport layer holding the splashscreen; `z-index:-1`, `contain:layout style size` | all | **yes — this is where the Netflix hero image lives** | `components/backdrop/backdrop.scss:1-9`; created by `components/Backdrop.tsx:11` |
| `.backdropContainer > .backdropImage` | the actual image div (`background-image` set inline by JS) | all | style position/filter, not the URL | `backdrop.scss:11-21`; `backdrop.js:28-35` |
| `.backgroundContainer` | opaque page background (`#101010`), `position:fixed`, `contain:strict` | all | **yes** — must be made transparent/overlaid for a full-bleed hero | `styles/site.scss:73-80`; `_theme.scss:125-133` |
| `.backgroundContainer.withBackdrop` | class added while a backdrop is shown; sets `opacity:.86` | all | **yes** — the built-in scrim | `_theme.scss:135-137`; toggled `backdrop.js:115-121` |
| `body.hideMainDrawer` | body class on public pages | all | useful `:has()`-free anchor | live-verified on `#/login` |
| `.standalonePage` | login / selectserver / addserver / resetpassword / wizard | all | yes but see `!important` | `styles/librarybrowser.scss:103-105` — `padding-top:4.5em !important` |
| `#selectServerPage`, `.servers`, `.btnAddServer` | server picker | all | yes | `selectServer/index.html:1,8,12` |
| `.addServerForm`, `#txtServerHost` | add-server form | all | yes | `addServer/index.html:3,6` |
| `#forgotPasswordPage`, `.forgotPasswordForm`, `#txtName`, `#btnSubmit`, `#btnCancel` | forgot-password (React) | all | yes | `routes/session/forgotPassword/index.tsx:88,94,104,119,126` |
| `.forgotPasswordPinPage`, `.forgotPasswordPinForm`, `#txtPin` | PIN reset | all | yes | `resetPassword/index.html:1,3,8` |
| `.wizardPage`, `.wizardContent`, `.wizardNavigation`, `.wizardStartForm`, `.wizardUserForm` | setup wizard | all | yes — **must** override `.wizardContent` (see gotchas) | `styles/dashboard.scss:252-265`; `librarybrowser.scss:107-109` |
| `#myPreferencesMenuPage` | settings menu page | all | **yes** | `routes/user/settings/index.tsx:55` |
| `#myPreferencesMenuPage .readOnlyContent` | the centered column (inline `margin:0 auto`) | all | yes | `index.tsx:62-66` |
| `.verticalSection.verticalSection-extrabottompadding` | group inside the settings menu | all | yes | `index.tsx:67,258,309` |
| `.sectionTitle.headerUsername` | the user's name as the section heading (inline `padding-left:.25em`) | all | yes | `index.tsx:68-75` |
| `.listItem-border` | every settings row (border-bottom `.1em` `--jf-palette-divider`) | all | **yes** | `components/listview/listview.scss:62-68`; color `_theme.scss:364-366` |
| `.listItem` / `.listItemBody` / `.listItemBodyText` / `.listItemIcon.listItemIcon-transparent` | row internals; `.listItem` has `contain:layout style` and `overflow:hidden` | all | yes | `listview.scss:1-6,13-34,75-133` |
| `.lnkUserProfile`, `.lnkDisplayPreferences`, `.lnkHomePreferences`, `.lnkPlaybackPreferences`, `.lnkSubtitlePreferences`, `.lnkControlsPreferences`, `.lnkQuickConnectPreferences`, `.downloadManager`, `.clientSettings`, `.selectServer`, `.btnLogout`, `.exitApp` | per-row hooks | all | **yes** — per-row icons/colors | `index.tsx:79,99,119,138,157,176,196,217,238,322,342,362` |
| `.adminSection`, `.userSection` | the two lower groups — **`display:none !important` in the modern app** | legacy/TV only | no (modern) | `src/apps/modern/AppOverrides.scss:9-15` |
| `#displayPreferencesPage`, `.settingsContainer` | display prefs page + its padded wrapper | all | **yes** | modern `routes/user/display/index.tsx:49-53`; legacy `controllers/user/display/index.html:2` |
| `#display-settings-<field>-label`, `#mui-component-select-<field>`, `#display-settings-<field>-description` | stable ids inside the MUI display-prefs form | modern | **yes** — the only non-hashed hooks there | live-verified (`language`, `dateTimeLocale`, `layout`, `theme`, …) |
| `#homeScreenPreferencesPage`, `.homeScreenSettingsContainer` | home prefs (**id reused by the subtitles page**) | all | yes, but scope by route | `controllers/user/home/index.html:1-2`, `controllers/user/subtitles/index.html:1-2` |
| `#languagePreferencesPage`, `#controlsPreferencesPage` | playback / controls prefs | all | yes | `controllers/user/playback/index.html:1`, `controllers/user/controls/index.html:1` |
| `.userPreferencesPage` | shared class on **every** preference page (incl. `#/userprofile`, `#/quickconnect`) | all | **yes — one hook for all prefs pages** | 7 pages, `grep userPreferencesPage src/` |
| `body.dashboardDocument` | set while any dashboard route is mounted | all | **yes — the dashboard scope hook** | `src/apps/dashboard/AppLayout.tsx:42-48` |
| `#dashboardPage`, `.type-interior` | dashboard home / every dashboard page | all | yes | `routes/index.tsx:88`; `.type-interior` on all `apps/dashboard/routes/**` |
| `.content-primary` | the content column of every dashboard page (`padding:0 1em`) | all | **yes** | `apps/dashboard/components/table/TablePage.tsx:49`, `routes/*/index.tsx`; `styles/dashboard.scss:154-158` |
| `.dashboard-appBar` | the dashboard `MuiToolbar` (extra class on a hashed element) | all | **yes** | `apps/dashboard/AppLayout.tsx:81` |
| `.MuiDrawer-paper` (inside `body.dashboardDocument`) | the 240px admin drawer surface, bg `#202020` | ≥900px docked / below swipeable | yes — but it is a *MUI global* class, scope it with `.dashboardDocument` | `components/ResponsiveDrawer.tsx:26-42` |
| `.MuiListItemButton-root.Mui-selected` (drawer) | active nav row, bg `rgba(0,164,220,.2)` | all | yes, scope it | live-verified |
| `#server-subheader`, `#devices-subheader`, `#livetv-subheader`, `#plugins-subheader`, `#advanced-subheader` | drawer section headers | all | **yes** — stable ids | live-verified |
| `.localUsers.itemsContainer.vertical-wrap` + `.card.squareCard` | dashboard user grid | all | yes — **but do not let `#divUsers` rules leak here** | `routes/users/index.tsx:180` |
| `#btnAddUser.fab.sectionTitleButton` | "+" button on the users page | all | yes | live-verified |
| `.cardBox.visualCardBox` | dashboard user/device cards (bg `#202020`, shadow, radius) | all | yes | `_theme.scss:227-231`; `card.scss:276-279` |
| `.MuiTableContainer-root`, `.MuiTableCell-root`, `.MuiTableHead-root` (material-react-table) | dashboard tables | all | yes, scope with `.dashboardDocument` | `TablePage.tsx:19-32,75` |

---

## Existing styling that will fight a custom theme

**`!important` already in the stock CSS (you must match or beat it):**

* `.standalonePage { padding-top: 4.5em !important }` — `styles/librarybrowser.scss:103-105`.
  `.wizardPage { padding-top: 7em !important }` — `:107-109`. `.libraryPage { padding-top: 7em !important }` — `:91-93`
  (and `:111-113` `.libraryPage:not(.noSecondaryNavPage){padding-top:7.5em !important}`), then the modern app undoes it:
  `.libraryPage:not(.itemDetailPage){padding-top:0 !important}` — `src/apps/modern/AppOverrides.scss:18-24`.
* `.content-primary, .padded-bottom-page, .page { padding-bottom: 5em !important }` (and a
  `calc(env(safe-area-inset-bottom) + 5em)` second declaration) — `styles/site.scss:119-125`. This is why
  `#loginPage` measures `padding-bottom:74.4px` and why a full-bleed login needs `padding-bottom:0 !important`.
* `.mainAnimatedPage { contain: style size !important }` — `styles/site.scss:88-90`. **Nothing inside a page can
  visually escape its box**; a full-viewport Netflix hero must be painted on `.backdropContainer` /
  `.backgroundContainer` (both outside the page), never on `#loginPage::before`.
* `.pageContainer { overflow-x: visible !important }` — `styles/site.scss:92-94` (applies to `#selectServerPage`).
* `.cardBox-bottompadded { margin-bottom: 1.8em !important }` (`1.2em` under 50em) — `card.scss:120-127`.
* `.cardContent { margin:0 !important; border:0 !important; padding:0 !important; outline:none !important }` — `card.scss:197-…`.
* `.cardBox { padding: 0 !important }` — `card.scss:89`.
* `.emby-input { margin-bottom: 0 !important; outline: none !important }` — `emby-input.scss:4,14`.
* `.emby-button { outline: none !important }` — `emby-button.scss:13`.
* `#myPreferencesMenuPage .lnkQuickConnectPreferences, .adminSection, .userSection { display:none !important }`
  — `src/apps/modern/AppOverrides.scss:9-15`. **You cannot un-hide these in the modern app without `!important`.**
* `.dashboardDocument .skinBody { position: unset !important }` — `src/apps/dashboard/AppOverrides.scss:18-20`;
  `.dashboardDocument .metadataEditorPage { padding-top: 0 !important }` — `:22-25`.
* `.dashboardDocument .dashboardEntryHeaderButton, .lnkManageServer { display:none !important }` and the whole
  legacy-drawer block `.dashboardDocument .mainDrawer { ... !important }` — `styles/dashboard.scss:58-61`,
  `librarybrowser.scss:333-362`.
* `.pageTabContent:not(.is-active) { display:none !important }` — `librarybrowser.scss:126-128`.
* `.card:focus { position:relative !important; z-index:10 !important }` — `card.scss:130-134`.

**Inline styles (beat only with `!important` or by restyling the parent):**

* `.visualLoginForm` → `style="text-align:center"` (`index.html:31`).
* `.visualLoginForm > h1` → `style="margin-top:1em"` (`index.html:32`).
* `#loginPage .readOnlyContent` → `style="margin:.5em auto 1em"` (`index.html:36`).
* `.manualLoginForm .btnCancel` wrapper `div` → `style="margin-top:.5em"` (`index.html:24`).
* `#divUsers .cardImageContainer` → `style="background-image:url('…')"` built in JS (`index.js:175`).
* `.servers` container → `style="display:block; text-align:center"` (`selectServer/index.html:8`);
  `.btnAddServer` → `style="margin:.25em"`.
* `.addServerForm`, `.forgotPasswordPinForm`, `.forgotPasswordForm` → `style="margin:0 auto"` (+ `text-align`).
* `#myPreferencesMenuPage .readOnlyContent` → `style={{margin:'0 auto'}}`; every `LinkButton` row →
  `style={{display:'block', margin:0, padding:0}}`; `h2.headerUsername` → `style={{paddingLeft:'0.25em'}}`
  (`routes/user/settings/index.tsx:63-65,70-72,80-84`).
* `#displayPreferencesPage form` → `style={{margin:'auto'}}` (`routes/user/display/index.tsx:56`).
* Dashboard `UserCardBox` menu wrapper → `style={{textAlign:'right', float:'right', paddingTop:'5px'}}`
  (`components/dashboard/users/UserCardBox.tsx:66`).
* `#wizardStartPage` h1/link → `style="float:left"` / `style="float:right;margin-top:20px"`;
  `.wizardContent` → `style="position:relative"`.
* MUI `sx` props compile to **hashed emotion classes**, which behave exactly like ordinary stylesheet rules of
  specificity (0,1,0) — they are *not* inline styles, but they load in `<head>`, so Custom CSS at equal
  specificity still wins (Custom CSS is the last `<style>` in `<body>`).

**Hashed emotion classes — never target these:** `css-sjv9i2`, `css-o44is`, `css-1u7mpsp`, `css-1tmqktv`,
`css-357a58`, `css-yknuxp`, `css-q9gyaw`, `css-14jjdko`, `css-17qa0m8`, `css-yqyrzd`, `css-13lpr8v`, `css-ybuz3k`,
`css-rtsren`, `css-iguwhy`, … They change on every jellyfin-web build. Use the semantic MUI classes
(`MuiAppBar-root`, `MuiDrawer-paper`, `MuiListItemButton-root`, `Mui-selected`, `MuiFilledInput-root`,
`MuiSelect-select`, `MuiButton-containedPrimary`, `MuiTypography-h2`, `MuiFormHelperText-root`,
`MuiListSubheader-root`) — these *are* stable — and always scope them (`.dashboardDocument …`,
`#displayPreferencesPage …`) so they do not bleed into dialogs and menus.

**Containment / transform / overflow ancestors that clip:**

| element | property | effect |
|---|---|---|
| `.mainAnimatedPage` (= `#loginPage`, `#myPreferencesMenuPage`, `#dashboardPage`) | `contain: style size !important` | children cannot influence page size; no escaping the page box |
| `.backdropContainer` | `contain: layout style size`, `position:fixed`, `z-index:-1` | isolated; `z-index:-1` means it sits **behind** `#reactRoot`'s painted background |
| `.backgroundContainer` | `contain: strict`, `position:fixed` | opaque `#101010` sheet over the backdrop unless made transparent |
| `.backdropImage` | `contain: layout style`, `position:absolute inset:0`, `background-size:cover` | |
| `.cardPadder-square` | `contain: strict` | fixed aspect box; its own children are not painted |
| `.card:not(.show-animation)` | `contain: layout style paint` | **a hover-scale/overlay on a login card cannot overflow the card** |
| `.cardScalable`, `.cardBox`, `.listItem`, `.listItemBody` | `contain: layout style` | |
| `.listItem` | `overflow: hidden` | no protruding decorations on settings rows |
| `.cardText` | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` | profile names truncate; set `white-space:normal` to wrap |
| `body` | `overflow-x: hidden` (`styles/site.scss:46-50`) | horizontal bleed is clipped at the body |
| `.dashboardDocument .skinBody` | `position:absolute; inset:0; pointer-events:none` (children `pointer-events:all`) | `librarybrowser.scss:303-321` |
| `.emby-button.show-focus:focus` | `transform: scale(1.2)` | on TV this creates a containing block and a paint order change; `.listItem-border.show-focus:focus{transform:scale(1) !important}` neutralises it for settings rows (`listview.scss:70-73`) |
| `.card.show-animation:focus > .cardBox` | `transform: scale(1.07)` | TV profile-card focus effect |

**JS-set sizes / values:**

* Root font-size is CSS-driven but layout-dependent (93% / 90% / 125%) and `<html>`'s class is set from
  `localStorage.layout` at boot — so `1em` is 14.88px, 14.4px or 20px. Size things in `em`/`rem` or accept three scales.
* `.backdropImage`'s `background-image` and `.cardImageContainer`'s `background-image` are written by JS.
* The splashscreen URL is `api.getUri(SPLASHSCREEN_URL, {t:Date.now()})` (`scripts/autoBackdrops.js:66-76`) and is
  only requested when Branding → *Enable splash screen* is on; otherwise `clearBackdrop()` and the login page keeps
  the flat `#101010` background (this is the state in `_shots/baseline/*/login.png`).
* `page.classList.remove('backdropPage')` when user backdrops are disabled (`autoBackdrops.js:90`) — do not rely on
  `.backdropPage` being present on library pages; on `#/login` it is kept because the type is `splashscreen`.
* `libraryMenu.setTransparentMenu(true/false)` on login `viewshow`/`viewhide` toggles `.skinHeader.semiTransparent`
  (legacy/TV only) — `session/login/index.js:273,322`.
* `updatePageStyle()` rewrites `#selectServerPage`'s classes at runtime (`selectServer/index.js:79-88`).

**z-index stack (live-measured, legacy-desktop `#/login`):** `.backdropContainer` `-1` · page/content `auto` ·
`.mainDrawerHandle` `1` · `.tmla-mask` `1098` · `.mainDrawer` `1099` · `.appfooter` `1201` ·
`.docspinner` `9999999`. In the modern/dashboard shells the MUI app bar and drawer use MUI's own
`zIndex.appBar`/`drawer` (1100/1200) and carry `.mui-fixed`.

**The single biggest trap — Custom CSS is not loaded on dashboard routes.**
`<CustomCss />` is rendered only by `src/apps/legacy/AppLayout.tsx:5,15` and `src/apps/modern/AppLayout.tsx:8,79`.
`src/apps/dashboard/AppLayout.tsx` renders `<ThemeCss dashboard />` (line 115) and **no `<CustomCss />`**, and
`DASHBOARD_APP_ROUTES` is a *sibling* of the app routes under `RootAppLayout` (`src/RootAppRouter.tsx:22-35`), not a
child. Consequence: every rule you write for `#dashboardPage`, `.content-primary`, `.dashboard-appBar`,
`body.dashboardDocument`, `#/metadata` and plugin config pages is **dead** when the CSS is installed through
Dashboard → General → Custom CSS. The wizard, by contrast, *does* get it (it mounts `apps/legacy/AppLayout`,
`apps/wizard/routes/routes.tsx:4,66`), as do login, prefs and all library pages.
*Status: source-verified, not live-verified* — confirming it live requires writing `CustomCss` into the test
server's branding config, which would mutate shared state. Confirm before spending effort on dashboard styling.
Note also that the harness's `--inject` flag appends the `<style>` on **every** page including the dashboard, so
`tools/shoot.sh --inject` will make dashboard theming look like it works when it does not.

Secondary: `CustomCss.tsx:12` also honours the per-user **"Disable custom CSS"** display setting
(`apps/modern/features/preferences/components/DisplayPreferences.tsx:84-92`) and appends a second `<style>` with the
*user's own* custom CSS after the server one (`CustomCss.tsx:17-21`) — user CSS beats the theme at equal specificity.

---

## Theming hooks

**`--jf-*` custom properties consumed by this subsystem** (all read live off `html.layout-desktop[data-theme=dark]`):

| variable | live value | used here by |
|---|---|---|
| `--jf-palette-background-default` | `#101010` | `.backgroundContainer`, `html`, `.dialog` (`_theme.scss:125-133,139-141`); `.wizardStartForm`, `.ui-corner-all`, `.ui-shadow` (`_theme.scss:74-82`) |
| `--jf-palette-background-defaultImage` | `none` | same rules — **set this to a gradient/image and every standalone page, including login, gets it** (`_theme.scss:57-58`) |
| `--jf-palette-background-paper` | `#202020` | MUI menus/dialogs |
| `--jf-palette-primary-main` | `#00a4dc` | `.button-submit`, `.checkboxOutline`, `.paper-icon-button-light:hover`, MUI `containedPrimary` |
| `--jf-palette-primary-mainChannel` | `0 164 220` | used with `--jf-palette-action-selectedOpacity` in `rgba(… / …)` hover rules (`_theme.scss:143-155`) |
| `--jf-palette-secondary-main` | `#00a4dc` | `.inputLabelFocused`, `.paper-icon-button-light.show-focus:focus` (`_theme.scss:211-215,157-159`) |
| `--jf-palette-text-primary` | `#fff` | |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | `html`, `.skinHeader`, `.inputLabel`, `.raised` text, `.cardText-secondary` (`_theme.scss:69-72,203-209,167-170,254-259`) |
| `--jf-palette-divider` | `rgba(255,255,255,.12)` | **`.listItem-border`** (every settings row) and `.emby-collapsible-button` (`_theme.scss:364-366,84-86`) |
| `--jf-palette-action-hover` | `rgba(255,255,255,.08)` | `.listItem:hover` — live-verified on the hovered prefs row |
| `--jf-palette-action-focus` | — | `.listItem:focus` (`_theme.scss:368-370`) |
| `--jf-palette-action-selectedOpacity` | `0.2` | drawer `Mui-selected` tint |
| `--jf-palette-FilledInput-bg` | `rgba(255,255,255,.09)` | `.emby-input`, `.emby-textarea` **and** MUI `MuiFilledInput-root` — one variable restyles both the login inputs and the display-prefs selects (`_theme.scss:394-401`) |
| `--jf-palette-FilledInput-borderColor` | = bg | `.emby-input` border |
| `--jf-palette-Button-inheritContainedBg` | `#424242` | `.raised`, `.fab`, `a[data-role=button]` → the four secondary login buttons (`_theme.scss:165-176`) |
| `--jf-palette-Button-inheritContainedHoverBg` | `#616161` | their `:hover` |
| `--jf-palette-AppBar-defaultBg` | `#202020` | `.skinHeader-withBackground`, `.detailRibbon` (`_theme.scss:88-91`) |
| `--jf-palette-AppBar-transparentBg` | `rgba(0,0,0,.4)` | `.skinHeader.semiTransparent` — the transparent header over the login page (`_theme.scss:100-108`) |
| `--jf-palette-AppBar-gradient` | `none` | overlay gradient on header/ribbon |
| `--jf-card-borderRadius` | `0.2em` | `.cardContent`, `.cardImageContainer`, `.visualCardBox`, `.cardPadder` (`_theme.scss:227-239`) — **one variable rounds every profile tile** |
| `--jf-shape-borderRadius` | `4px` | MUI components |

Theme mechanics: `themes/index.ts:12-28` — `cssVarPrefix:'jf'`, `colorSchemeSelector:'[data-theme="%s"]'`,
`defaultColorScheme:'dark'`, `disableCssColorScheme:true`. So `:root[data-theme="dark"]`, `[data-theme="light"]` …
carry the values; `<html>` also loads `themes/<id>/theme.css` via `components/ThemeCss.tsx:26-31`, which is a
`<link>` **inside `#reactRoot`, in `<body>`** — it therefore comes *before* the Custom CSS `<style>` and loses ties.
Note `$surface-overlay` (used for `.visualCardBox`, `.paperList`, `.cardPadder`) is a **SCSS** variable compiled per
theme — it is *not* exposed as `--jf-*`, so `.cardBox:not(.visualCardBox) .cardPadder{background-color:#202020}` must
be overridden by rule, not by variable.

**Classes toggled by JS (usable as state selectors):**

| class | on | meaning | toggled at |
|---|---|---|---|
| `.hide` | `.manualLoginForm`, `.visualLoginForm`, `.btnManual`, `.btnCancel`, `.btnQuick`, `.btnSelectServer` | the mode switch of the login page | `login/index.js:128-142,218-220,276,284` |
| `.withBackdrop` | `.backgroundContainer` | a backdrop image is displayed → `opacity:.86` | `backdrop.js:115-121` |
| `.hide` on `.backdropContainer`, `.backgroundContainer-transparent`, `html.transparentDocument` | transparency levels used by the video player | `backdrop.js:298-313` |
| `.semiTransparent` | `.skinHeader` | login/`viewshow` sets a transparent header (legacy/TV) | `login/index.js:273` |
| `.show-focus`, `.show-animation` | `#divUsers .card`, `.emby-button` | TV layout only | `login/index.js:152-157`; `layoutManager.tv` |
| `.grayscale`, `.disabledUser` | dashboard user card / image | user disabled | `UserCardBox.tsx:25-44` |
| `body.dashboardDocument` | body | any dashboard route mounted | `apps/dashboard/AppLayout.tsx:42-48` |
| `body.hideMainDrawer` | body | drawer unavailable (public pages) | live-verified on `#/login` |
| `.Mui-selected` | drawer `MuiListItemButton-root` | current admin page | MUI |
| `.inputLabelFocused` / `.inputLabelUnfocused` / `.inputLabel-float` | login labels | focus + empty state | `emby-input.js:62-71,95-100` |

**Useful structural anchors (no new classes needed):**

* `#loginPage:has(.visualLoginForm:not(.hide))` → "Who's watching?" mode; `#loginPage:has(.manualLoginForm:not(.hide))`
  → sign-in mode. Lets you use two completely different layouts from one stylesheet.
* `#divUsers:not(:empty)` → picker actually populated.
* `#loginPage .readOnlyContent > button:not(.hide)` → only the visible secondary buttons (for `:first-of-type`
  styling that survives QuickConnect/MultiServer being off).
* `body.dashboardDocument .MuiDrawer-paper` → admin drawer without touching library drawers.
* `.userPreferencesPage` → all seven preference pages at once; combine with `#myPreferencesMenuPage` for the menu.
* `html.layout-tv #loginPage`, `html.layout-mobile #loginPage` → per-layout login variants.
* `#divUsers .cardContent[data-haspw="false"]` → passwordless profiles (Netflix "kids" style badge).
* `#myPreferencesMenuPage .listItem-border:not(.lnkUserProfile)` etc. for per-row icon colours.

---

## Netflix-relevance notes

| Netflix UI element | Jellyfin 12.1 element(s) | how far pure CSS gets |
|---|---|---|
| **Sign-in screen** (dark hero photo, black 50% scrim, centered 450×600 card) | `.backdropContainer` (photo) + `.backgroundContainer` (scrim) + `#loginPage .padded-left.margin-auto-y > form.manualLoginForm` (card) | **Fully doable.** Put the hero on `.backdropContainer::after` or on `--jf-palette-background-defaultImage`, make `.backgroundContainer` a `linear-gradient(rgba(0,0,0,.6),…)`, then give `.manualLoginForm` `background:rgba(0,0,0,.75); border-radius:4px; padding:60px 68px 40px; max-width:450px` and kill `#loginPage`'s `padding-bottom:5em !important`. Note `form{max-width:54em}` only applies ≥50em, so on mobile you must set the width yourself. |
| Netflix top-left logo on the sign-in page | modern: `header .MuiStack-root > a[href="#/"] > img`; legacy/TV: `.skinHeader .pageTitle.pageTitleWithLogo.pageTitleWithDefaultLogo` (a `background-image`, `_theme.scss:110-123`) | Swappable via `background-image` / `content:url()`. The modern one is an `<img>` with a server-provided `src` — you can only hide it and draw your own with `::after` on the `<a>`. |
| **"Who's watching?" profile picker** | `.visualLoginForm` + `#divUsers` + `.card.squareCard` tiles | **Doable, with one catch:** the picker only appears when at least one user is *not* hidden from login screens. Netflix's centered `flex` row is already there (`.vertical-wrap.centered`). Override `.squareCard{width:…}` (or `#divUsers{gap:…}` + fixed tile width) to get 4–5 large tiles, square them with `.cardPadder-square{padding-bottom:100%}`, round with `--jf-card-borderRadius`, and restyle `.cardText.cardTextCentered` as the grey name label. |
| Profile-tile hover (white border + name turning white) | `#divUsers .card:hover .cardContent` / `.cardText` | Doable — but `.card:not(.show-animation){contain:layout style paint}` means a **glow/scale cannot overflow the tile**. Use an inset `box-shadow` or `outline` instead of an outer glow, or set `contain:none` on the card (safe, it is only a perf hint). |
| "Manage Profiles" button under the picker | `.btnManual` / `.btnForgotPassword` / `.btnSelectServer` in `.readOnlyContent` | Doable — restyle to Netflix's transparent bordered button (`background:transparent; border:1px solid #808080; color:#808080; letter-spacing:2px; text-transform:uppercase`). |
| Netflix red primary CTA | `.button-submit` on login, `.MuiButton-containedPrimary` on prefs/dashboard, `.fab.submit` on the users page | Set `--jf-palette-primary-main` (+ `--jf-palette-primary-mainChannel`) once and all three follow. |
| Netflix input (dark grey fill, floating label, 4px radius) | `.emby-input` + `.inputLabel*` on login; `.MuiFilledInput-root` on display prefs | `--jf-palette-FilledInput-bg` covers both fills. The login label is a real floating label only in the sense that JS toggles classes — **there is no CSS-only "label rides up on focus" animation to reuse**; you must animate `.inputLabel` yourself, and `.inputLabel-float` (which JS adds when the field is empty) is the only state hook. |
| Netflix "Remember me" checkbox | `.chkRememberLogin` + `.checkboxOutline` + `.checkboxIcon-checked` | Doable; the real input is 1×1 absolute, so style `.checkboxOutline` as the box. |
| Netflix account/settings list (thin rows, hairline dividers) | `#myPreferencesMenuPage .listItem-border` + `.listItem` + `.listItemBodyText` | Doable — `--jf-palette-divider` is the hairline, `--jf-palette-action-hover` the row hover. |
| Netflix account page section headings | `.sectionTitle.headerUsername`, `h2.MuiTypography-h2` on display prefs | Doable. |
| Netflix-style member/admin console | `#dashboardPage`, `.content-primary`, `.dashboard-appBar`, `.MuiDrawer-paper`, `material-react-table` | Technically all styleable **but see the gotcha: Branding Custom CSS is not injected on dashboard routes.** If that holds, a Netflix-skinned dashboard is impossible through the supported install path and would need a plugin or a patched `index.html`. |
| Netflix splash / loading spinner | `.docspinner.mdl-spinner` (`z-index:9999999`), `.splashLogo` (`styles/site.scss:17-35`) | Colour/size only; the four `mdl-spinner__layer-N` divs are fixed markup. |

**Impossible (or not worth faking) in pure CSS here:**

* Showing the profile picker when every user is hidden from the login screen, or adding an "Add profile" tile —
  `#divUsers`'s children come from `/Users/Public` via `innerHTML` (`login/index.js:191`). CSS cannot add a card
  that can be clicked into a working action.
* Netflix's per-profile avatar artwork: the fallback is `.defaultCardBackground1..5` picked by a hash of the name
  (`utils/builder.ts:135-145`); you can recolour those 5 classes but you cannot map a *specific* user to a *specific*
  avatar without `[data-username="…"]` selectors hand-written per user (which does work:
  `#divUsers .cardContent[data-username="Kasia"] .cardImage{background-image:url(…)}`).
* Reordering the login page so the picker sits above the heading, or moving `.loginDisclaimer` out of
  `.readOnlyContent` — possible with `order:` only within the same flex container; `#loginPage`'s wrapper is a
  block, so you must first make `.padded-left…margin-auto-y` a flex column (safe, it only holds the three blocks).
* A hero image that bleeds past the page: `.mainAnimatedPage{contain:style size !important}` — paint it on the two
  fixed containers instead.
* Netflix's video-preview background on the sign-in screen: the splashscreen slot only accepts a still image
  (`SPLASHSCREEN_URL`, `autoBackdrops.js:66-76`); a `<video>` cannot be added by CSS.
* Restyling the modern app bar's logo `<img>` source, the MUI `Avatar` fallback `PersonIcon`, or the drawer icons
  (all inline `<svg data-testid="…">`) beyond `fill`/`color` and `display:none` + `::after` replacements.
* Un-hiding `.adminSection` / `.userSection` on `#myPreferencesMenuPage` in the modern app needs
  `display:block !important` to beat `AppOverrides.scss:9-15` — doable, but those links are duplicated in the
  avatar menu, so Netflix-style "Account / Sign out" is better built there.
