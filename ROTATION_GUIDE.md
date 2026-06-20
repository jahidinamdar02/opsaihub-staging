# API Key Rotation Guide — OpsAIHub

## URGENT: Keys exposed in git history

The `.env` file was committed in the initial commit (0b7ed96) and contains:
- ANTHROPIC_API_KEY
- EMAIL_PASS
- VAPID keys

**Current .env also has exposed:**
- OPENAI_API_KEY
- GEMINI_API_KEY
- JWT_SECRET (now rotated)

---

## Step 1: Rotate GitHub Token (CRITICAL)

Your git remote URL contains a leaked GitHub PAT:
```
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
```

1. Go to https://github.com/settings/tokens
2. Delete this token immediately
3. Generate a new token with `repo` scope
4. Update remote:
   ```bash
   git remote set-url origin https://<new_token>@github.com/jahidinamdar02/opsaihub-staging.git
   ```

---

## Step 2: Rotate API Keys

### Anthropic (sk-ant-api03-...)
1. Go to https://console.anthropic.com/settings/keys
2. Revoke the exposed key
3. Create new key
4. Update `ANTHROPIC_API_KEY` in `.env`

### OpenAI (sk-proj-...)
1. Go to https://platform.openai.com/api-keys
2. Delete the exposed key
3. Create new key
4. Update `OPENAI_API_KEY` in `.env`

### Google Gemini (AIzaSy...)
1. Go to https://console.cloud.google.com/apis/credentials
2. Delete the exposed API key
3. Create new key
4. Update `GEMINI_API_KEY` in `.env`

---

## Step 3: Rotate Email Password

1. Change password for jahidinamdar02@opsaihub.in
2. Update `EMAIL_PASS` in `.env`

---

## Step 4: JWT Secret (DONE)

New secret has been generated and applied:
```
e71925a1446f18c8bbe25d04ac995c0006447134c3f2026ee8be0d72cd937aa0
```

All existing tokens will be invalidated on next server restart.

---

## Step 5: Purge Git History (Optional but Recommended)

To remove `.env` from git history completely:
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from all commits
git filter-repo --path .env --invert-paths

# Force push (requires team coordination)
git push origin --force --all
```

**Warning**: This rewrites history. All clones will need to re-clone.

---

## Step 6: Rotate VAPID Keys (if needed)

VAPID keys are used for web push notifications. If compromised:
1. Generate new VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Update `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env`
3. All subscribed browsers will need to resubscribe

---

## Checklist

- [ ] Delete leaked GitHub token
- [ ] Rotate Anthropic API key
- [ ] Rotate OpenAI API key
- [ ] Rotate Gemini API key
- [ ] Change email password
- [ ] JWT secret rotated (done)
- [ ] Purge git history (optional)
- [ ] Rotate VAPID keys (if compromised)
