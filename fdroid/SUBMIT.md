<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Submitting N62 to F-Droid and IzzyOnDroid (the owner's steps after the tag)

Application id `dev.n62.calc`; the recipe is `fdroid/dev.n62.calc.yml` (draft, never built: [README.md](README.md)); in fdroiddata it becomes `metadata/dev.n62.calc.yml`. Sources, read on 2026-11-09: fdroiddata at 2e8653f777 (a clone beside this repo): `.gitlab/merge_request_templates/App inclusion.md` (the full-hash line 44, Reproducible Builds line 40, CI runners line 50), `CONTRIBUTING.md` (RFP line 11, squash line 173) and `.gitlab-ci.yml` (the jobs below; `fdroid build` at line 342, image `buildserver-trixie` at line 349); IzzyOnDroid: https://izzyondroid.org/docs/general/AppInclusionPolicy/ (fetched the same day). Both requests wait for the tag `v0.1.0` and its GitHub release (`tools/check-version.sh v0.1.0` passes; the release holds `n62-0.1.0.apk`, signed with the owner's key).

## 1. The fdroiddata merge request (gitlab.com/fdroid/fdroiddata)
1. Fork fdroiddata (public); keep its `master` untouched; make a branch `n62-add` (not protected). One app per MR.
2. Copy `fdroid/dev.n62.calc.yml` to `metadata/dev.n62.calc.yml`. The template wants **the full commit hash** in `commit:`, not the tag: put `git rev-parse v0.1.0^{commit}` there. Add nothing else (descriptions, screenshots and the icon come from `fastlane/` in our repo).
3. If `fdroid` is installed (pip, a venv): `fdroid readmeta`, `fdroid rewritemeta dev.n62.calc`, `fdroid checkupdates dev.n62.calc`, `fdroid lint dev.n62.calc`. All four ran on the draft once (README, 2026-10-11); `lint` only complained that the category is unknown in a scratch repo. `fdroid build -v -l` needs the build-server VM, which does not exist here: the CI is the first build.
4. Title `New app: N62`, the "App inclusion" template filled in: summary, why N62 (units, uncertainty, honest precision), screenshots, the licence GPL-3.0-or-later. Optionally file an RFP issue first (gitlab.com/fdroid/rfp) and link it. The template's Reproducible Builds box: see the open decision below.
5. Wait for the pipeline; fix what its jobs report in the same branch (squash is on). F-Droid's runners are free; if GitLab asks for a phone number or card, give nothing and say so in the MR.

**What the CI will be the first to test** (jobs of `.gitlab-ci.yml`, image `registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie`):
- `checkupdates`: runs `fdroid checkupdates --auto` and fails on any `git diff`; the recipe must already read as checkupdates writes it (hash, `CurrentVersion`, `CurrentVersionCode`).
- `fdroid lint`, `fdroid rewritemeta`, schema validation: field order, the category "Science & Education", `AuthorName`, the links.
- **`fdroid build`**: the first real build of everything in the recipe. Open points: `apt-get install emscripten=3.1.69+dfsg-3` finds that version in trixie and `build-wasm.sh` accepts the compiler (A96); the `--fetch-only` downloads in `prebuild` and the offline-or-not state of `build` (the reference says nothing on network in either phase, A97); the source scanner over `app/node_modules/` (not known before); the engine and Find-index steps within the job's time; `refresh-factors.mjs` reporting no difference (A60); Gradle's offline resolution; the system-emscripten wasm matching the container's (never compared).

## 2. The IzzyOnDroid request (codeberg.org/IzzyOnDroid/repodata, one issue for one app)
Policy (izzyondroid.org/docs/general/AppInclusionPolicy/): free licence; source public; APK **attached to a tagged GitHub release** (met); signed by the developer's release key, not `debuggable`/`testOnly` (A70 checked the first, WebView debugging off); no proprietary components, no trackers (none); Fastlane metadata in the repo with short and full description, icon and screenshots (`fastlane/metadata/android/en-US/`, met).

Issue text (title `[AppRequest] N62`; fill the repo's template if it shows one):
```
App: N62, a graphing CAS calculator for engineers (units, uncertainty, honest precision)
Package: dev.n62.calc
Source: https://github.com/n62-dev/n62 (GPL-3.0-or-later)
Release: https://github.com/n62-dev/n62/releases/tag/v0.1.0 (n62-0.1.0.apk + .sha256, signed with the release key; certificate SHA-256 in android/release-cert.sha256)
Metadata: fastlane/metadata/android/en-US/ in the repo; privacy: PRIVACY.md (no analytics, no account, no ads, nothing sent)
Size: <ls -l of the APK> MB, one APK
I am the developer. The app is not in the repo yet. It is submitted to F-Droid in parallel (MR: <link>).
```
(The privacy line is PRIVACY.md's first paragraph.)

**Size:** the policy's limit is "usually up to 30 MB per app", also the limit for one `.apk`; the repo keeps up to 3 versions if they fit. The APK is 14.1 MB (the package's figure; the file is not in the repo: `ls -l dist/n62-0.1.0.apk` or the release page, and put the real number in the issue), so about half the limit and room to grow. The limit was not checked before 2026-11-09; this page is the check, and the policy says exceptions are the maintainer's call.

## Open decision: Reproducible Builds (the owner decides before filing)
**Recommendation: tick the box and ask for them.** The template (line 40) says F-Droid then publishes with *our* signature; without it F-Droid signs with its own key and "you can't enable it later", so its APK and the owner's GitHub/IzzyOnDroid APK would have different keys and could not update each other. Cost: the recipe needs `AllowedAPKSigningKeys:` (our certificate, `android/release-cert.sha256`), and bit-identity of the VM build with the owner's APK is unproven (the system-emscripten wasm was never compared with the container's); if the first build differs, the MR needs a rework, not the app. Would change if: the first CI build shows the wasm differs and the fix is long; then state the reasons in the MR (the template asks for them) and take F-Droid's key.

A pre-release on IzzyOnDroid (from memory only): v0.1.0 is a normal release (must-have 9), so it does not arise.
