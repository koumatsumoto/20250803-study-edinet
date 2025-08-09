---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit and push it
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## 作業内容

ここまでの作業内容と変更差分を確認して、 git commit する。
commit message を作成したらユーザに確認を求める。
承認されたら commit, push する。

### Commit 方法

Conventional Commits の仕様に基づいて git commit する。

- 英語で記述する
- 一行目に `<type>: <description>` の形式で概要を書く
- 三行目に具体的な作業内容を書く

例:

```
feat: implement user authentication API

- Add JWT token generation and validation
- Create user login and registration endpoints
```
