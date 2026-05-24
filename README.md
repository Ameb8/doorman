# doorman

Doorman is a virtual doorman which notifies you of events happening in real time.

Doorman uses AI to provide updates of who is at your door and what is happening outside your home.

## Setup

The Ring notification listener lives in `ring-ai`. The currently useful command is
`npm run listen-smoke`, which logs Ring motion and notification events to the terminal.
The default `npm start` command only starts the unfinished application skeleton.

### 1. Install dependencies

From the repository root:

```sh
cd ring-ai
npm install
```

### 2. Create your local environment file

Copy the example file and edit it with your own values:

```sh
cp .env.example .env
```

For the Ring listener, the important values are:

```sh
RING_EMAIL=your-ring-account-email@example.com
RING_PASSWORD=your-ring-password
RING_2FA_CODE=
RING_TOKEN_PATH=./data/ring-token.json
```

For a first run, leave `RING_2FA_CODE` empty and try to start the listener. If Ring
requires two-factor authentication, the command will fail with a 2FA message and Ring
will send you a code. Put that code in `RING_2FA_CODE`, run the listener again, and
then remove `RING_2FA_CODE` from `.env` after `./data/ring-token.json` is created.
Future runs use the saved refresh token instead of your password and 2FA code.

### 3. Run the Ring listener

The app does not automatically load `.env` when running locally, so export it into your
shell before starting the listener:

```sh
set -a
source .env
set +a
npm run listen-smoke
```

When authentication succeeds, you should see one `subscribed to camera` line per Ring
camera and then a `ring listen smoke ready` message. Leave the process running. Motion
events will be logged as `ring motion started`, and Ring push notifications will be
logged as `ring notification`.

To print the full Ring notification payload while debugging, add this to `.env`:

```sh
RING_DEBUG_NOTIFICATIONS=true
```

### Full app configuration

The broader `ring-ai` app configuration is also defined in `.env.example`. It currently
requires `CAPTION_PROVIDER`, `CAPTION_API_KEY`, and `WEBHOOK_TARGETS` if you run
`npm start`, but that path is still a skeleton and does not yet process Ring motion
events end to end.
