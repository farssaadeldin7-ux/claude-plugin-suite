# Getting this onto GitHub

> Historical setup notes, kept for reference. The repository already exists at
> `farssaadeldin7-ux/claude-plugin-suite` and is public; nothing here needs doing
> again.

The repository is already initialised with a commit on `main`. Two steps.

## 1. Create the empty repo

Go to https://github.com/new and create a repository named `claude-plugin-suite` under
`farssaadeldin7-ux`. Do **not** add a
README, .gitignore or licence — the repo already has them, and adding them creates a
conflict on the first push.

## 2. Push

From inside the unzipped folder:

```bash
git remote add origin git@github.com:farssaadeldin7-ux/claude-plugin-suite.git
git push -u origin main
```

Or over HTTPS if you have not set up SSH keys:

```bash
git remote add origin https://github.com/farssaadeldin7-ux/claude-plugin-suite.git
git push -u origin main
```

If you have the GitHub CLI, both steps collapse into one:

```bash
gh repo create farssaadeldin7-ux/claude-plugin-suite --public --source=. --push
```

## Then

```
/plugin marketplace add farssaadeldin7-ux/claude-plugin-suite
/plugin install ghost-post-preview@plugin-suite
```

The marketplace is public, so anyone can add it and install the open tools; the licensed
tools still need a plan. Publishing the source grants no rights to it — see `LICENSE`.

## Before you push, if you want to change the author

The commit is authored as `Fars Saadeldin <farssaadeldin7@gmail.com>`. To change it:

```bash
git commit --amend --author="Your Name <you@example.com>" --no-edit
```
