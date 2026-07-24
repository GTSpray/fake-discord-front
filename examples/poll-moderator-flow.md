# Create a poll

Moderators can create a poll directly from Discord with `/poll create`.

## Preview

![Create a poll](../tests/snapshots/poll-moderator-flow.gif)

## Usage

1. Type `/poll create` in a text channel.
2. Fill in the form:
   - **Poll title** — name shown to members
   - **Voters role** _(optional)_ — RoleSelect; restricts voting to a role
   - **Publish channel** — ChannelSelect; where the poll is posted
   - **Poll duration** — StringSelect; how long the poll stays open
   - **Poll question** — the question being asked
   - **Description** _(optional)_ — context for voters
3. Submit the modal.

### Modal selects in this playback

The create-poll modal demonstrates the three select kinds supported by doc-studio:

| Field           | Discord type  | `type` | Option UI                         |
| --------------- | ------------- | ------ | --------------------------------- |
| Voters role     | RoleSelect    | `6`    | Shield + role name + member count |
| Publish channel | ChannelSelect | `8`    | `#` / voice icon + channel name   |
| Poll duration   | StringSelect  | `3`    | Label ± description               |

In the playback JSON, each choice is driven by a `selectModalOption` action
(fake cursor opens the select, then picks an option).

The bot replies with an ephemeral message showing a poll preview and three actions:

| Button       | Effect                        |
| ------------ | ----------------------------- |
| Add choices  | Adds answer options           |
| New question | Adds a question to the poll   |
| Publish poll | Posts the poll in the channel |

## After publishing

The poll appears in the channel with a **I vote!** button to vote and **Summary** to view results.

Playback file: [`poll-moderator-flow.json`](poll-moderator-flow.json)
