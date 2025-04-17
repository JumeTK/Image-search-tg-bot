# Image Search Telegram Bot

A Telegram bot that allows users to search and download images from Pixabay using inline queries.

## Features

- Instant image previews as you type
- Search in any chat using @botname
- High-quality images from Pixabay
- Photographer attribution
- Safe search enabled by default
- No need to send messages to the bot
- Channel membership required

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a Telegram bot:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use the `/newbot` command to create a new bot
   - Enable inline mode with `/setinline`
   - Copy the bot token

3. Configure required channels:
   - Update the `REQUIRED_CHANNELS` array in `index.js`
   - Add your channel IDs and usernames
   - Make sure the bot is an admin in these channels

4. Get Pixabay API Key:
   - Go to [Pixabay API](https://pixabay.com/api/docs/)
   - Sign up for a free account
   - Get your API key from your account dashboard

5. Configure environment variables:
   - Create a `.env` file
   - Add your tokens:
     ```
     TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
     PIXABAY_API_KEY=your_pixabay_api_key_here
     ```

## Deployment

### GitHub Deployment

1. Initialize Git repository:
```bash
git init
```

2. Add files to Git:
```bash
git add .
```

3. Commit changes:
```bash
git commit -m "Initial commit"
```

4. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Choose a repository name
   - Don't initialize with README

5. Link your local repository to GitHub:
```bash
git remote add origin https://github.com/your-username/your-repo-name.git
git branch -M main
git push -u origin main
```

### Deploying to Hosting Platforms

#### Vercel
1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

#### Render
1. Create a new Web Service
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

## Usage

1. Start the bot:
```bash
npm start
```

2. Using the bot:
   - Users must join required channels first
   - In any chat, type `@your_bot_name` followed by your search query
   - Images will appear instantly as you type
   - Click on any image to send it to the chat
   - Each image shows the photographer's name

## Channel Requirements

Users must join the following channels to use the bot:
- Channel 1 (@your_channel1)
- Channel 2 (@your_channel2)

The bot will check channel membership and prompt users to join if they haven't already.

## Notes

- Shows up to 20 images per search
- Images are sent directly from Pixabay
- All images include photographer attribution
- Free tier allows 5000 requests per hour
- Safe search is enabled by default 