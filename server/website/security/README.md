# Website — security/

The website is a public marketing/app shell and normally needs **no secret
key files** (it talks to the backend over HTTP).

Place any website-only secrets here if needed later, e.g.:

- TLS certs (if terminating HTTPS at the container instead of Nginx)
- Third-party widget private keys

Everything in this folder is git-ignored. Set tight permissions:

```bash
chmod 700 /var/www/server/website/security
chmod 600 /var/www/server/website/security/*
```
