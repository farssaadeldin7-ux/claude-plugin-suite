# Getting this onto GitHub

The repository is already initialised with a commit on `main`. Two steps.

## 1. Create the empty repo

Go to https://github.com/new and create a repository named `claude-plugin-suite` under
`farssaadeldin7-ux`. Set it to **Private** (the licence is proprietary). Do **not** add a
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
gh repo create farssaadeldin7-ux/claude-plugin-suite --private --source=. --push
```

## Then

```
/plugin marketplace add farssaadeldin7-ux/claude-plugin-suite
/plugin install ghost-post-preview@plugin-suite
```

A private marketplace works for you and anyone you add as a collaborator. Make it public
when you want others to install it — check `LICENSE` says what you want it to say first.

## Before you push, if you want to change the author

The commit is authored as `Fars Saadeldin <farssaadeldin7@gmail.com>`. To change it:

```bash
git commit --amend --author="Your Name <you@example.com>" --no-edit
```
