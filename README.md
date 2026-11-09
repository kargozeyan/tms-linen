# TMS Linen

## Requirements

- Node.js 26
- Docker, for MySQL and the integration tests

## Setup

```bash
cp .env.example .env
npm install
npm --prefix server install
npm --prefix ui install
docker compose up -d
npm --prefix server run seed
```

`npm run seed` recreates all tables and loads the JSON files, so it also resets any data you've added.

## Running

Start the API on `PORT` (default 3000):

```bash
npm --prefix server start
```

Start the UI in another terminal, then open http://localhost:5173:

```bash
npm --prefix ui run dev
```

To send every event in `data/events.json` to the running API, in file order:

```bash
npm --prefix server run send-events
```

## Tests

```bash
npm --prefix server test
```

- `npm --prefix server run test:unit` runs the unit tests, which need no database.
- `npm --prefix server run test:integration` runs the integration tests.
