# CVLT Web

[Website](https://cvlt.ch) of the **Club Volo Libero Ticino**

Built with [Next.js](https://nextjs.org/) and [Payload CMS](https://payloadcms.com/).

## Prerequisites

- Node.js 24 LTS
- npm

## Getting started

```bash
# 1. Copy the example env file and fill in your values
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app runs at `http://localhost:3000`.  
The Payload admin panel is at `http://localhost:3000/admin`.

## Environment variables

See [`.env.example`](.env.example) for all required variables.
The app validates env vars at startup and fails fast if any required value is missing or invalid.

For shop checkout on deployed environments:
- `SHOP_PAYLINK_URL` must be set to the live RaiseNow paylink (`https://pay.raisenow.io/...`).
- `SHOP_ORDER_TOKEN_SECRET` must be set (separate from `PAYLOAD_SECRET`).
- `NEXT_PUBLIC_SERVER_URL` must match the active domain (`https://dev.cvlt.ch` during development deployment, `https://cvlt.ch` at go-live).
- Do not keep `localhost` values on deployed instances.
- There are no runtime fallbacks for required env vars.

The SQLite database file and uploaded media are stored locally (ignored by git). Make sure to back them up separately.

## Build & deploy

```bash
npm run build
npm start
```

The project is deployed on [Infomaniak](https://www.infomaniak.com/) via Git. Push to the main branch and pull on the server.

## Contributing

This is a private project for CVLT. Contributions from club members are welcome.

1. Fork or branch from `main`
2. Make your changes and test locally (`npm run dev`)
3. Open a pull request with a short description of what you changed and why

Please keep commits focused and write clear commit messages. If you're unsure about something, open an issue first.

## License

[MIT](LICENSE) - Ruben Hutter
