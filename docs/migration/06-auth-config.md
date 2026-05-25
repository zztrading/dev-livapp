# Fase 6 — Auth config

Configurações de auth que vivem no Supabase dashboard e **não** estão no git. Precisam ser dumpadas antes da migração e re-validadas após.

## O que dumpar (Supabase Dashboard → Authentication)

### Providers (Authentication → Providers)

- [ ] Email: enabled? confirm required?
- [ ] Google OAuth: enabled? client_id? (secret NÃO commitar)
- [ ] Outros providers usados?

### URL Configuration (Authentication → URL Configuration)

- [ ] Site URL (provavelmente `https://intel-ignite-pro.lovable.app`)
- [ ] Redirect URLs allow list (provavelmente inclui `localhost`, `*.lovable.app`, custom domains)

**Após migração**: trocar tudo pro domínio novo. Manter o `*.lovable.app` por 90 dias para evitar quebrar sessões antigas.

### Email Templates (Authentication → Email Templates)

Para cada um, copiar HTML completo para `docs/migration/email-templates/`:
- [ ] Confirm signup
- [ ] Invite user
- [ ] Magic link
- [ ] Change email address
- [ ] Reset password

### SMTP Settings (Authentication → SMTP Settings)

- [ ] SMTP enabled? Sender email? Provider (Resend/SendGrid/AWS SES)?
- [ ] Secrets do SMTP NÃO commitar — recadastrar no projeto novo se for cenário B.

### Auth Settings (Authentication → Settings)

- [ ] `password_hibp_enabled` (leaked password protection)
- [ ] `auto_confirm` (provavelmente `false`)
- [ ] `external_anonymous_users_enabled` (provavelmente `false`)
- [ ] `disable_signup` (provavelmente `false`)
- [ ] JWT expiry, refresh token rotation, etc.

## Como capturar via API (opcional)

```bash
# Requer service_role key, NÃO rodar em produção sem proteção
curl -s "https://pspvppymcdjbwsudxzdx.supabase.co/auth/v1/admin/settings" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq > docs/migration/auth-settings-dump.json
```

## Pós-migração (Cenário B — projeto novo)

1. Recriar Google OAuth credentials no Google Cloud Console com nova redirect URL (`https://NEW_REF.supabase.co/auth/v1/callback`).
2. Re-cadastrar client_id + secret no projeto Supabase novo.
3. Re-colar email templates.
4. Re-configurar SMTP.
5. Atualizar redirect URLs allow list com domínio novo.
6. Testar fluxo completo de signup + reset password + Google OAuth.

## Pós-migração (Cenário A — transferência)

Nada muda. Tudo continua funcionando.
