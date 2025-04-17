const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Telegram bot with webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    webHook: {
        port: process.env.PORT
    }
});

// Set webhook
const webhookUrl = process.env.VERCEL_URL ? 
    `https://${process.env.VERCEL_URL}/api` : 
    process.env.WEBHOOK_URL;

bot.setWebHook(webhookUrl);

// Required channels (replace with your actual channel usernames)
const REQUIRED_CHANNELS = [
    { id: -1002221175352, username: '@nastydeed', name: 'CryptoMarket Updates 24/7' },
    { id: -1002404972514, username: '@popymovies', name: 'Free Movies' }
];

// Function to check if user is in required channels
async function checkUserChannels(userId) {
    const results = await Promise.all(REQUIRED_CHANNELS.map(async (channel) => {
        try {
            const member = await bot.getChatMember(channel.id, userId);
            return {
                channel: channel,
                isMember: ['member', 'administrator', 'creator'].includes(member.status)
            };
        } catch (error) {
            console.error(`Error checking channel ${channel.username}:`, error);
            return { channel: channel, isMember: false };
        }
    }));

    const notJoined = results.filter(r => !r.isMember).map(r => r.channel);
    return notJoined;
}

// Function to send welcome message
async function sendWelcomeMessage(chatId, botUsername) {
    bot.sendMessage(chatId, 
        `👋 Welcome to Image Search Bot! 🖼️\n\n` +
        `🔍 Search and share high-quality images instantly\n` +
        `🎨 Millions of free-to-use images from Pixabay\n` +
        `📸 Professional photos with photographer credits\n` +
        `⚡ Fast and easy to use in any chat\n\n` +
        `To use the bot, simply type @${botUsername} followed by your search query in any chat!\n\n` +
        `Example: @${botUsername} cats`
    );
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const botUsername = (await bot.getMe()).username;

    const notJoined = await checkUserChannels(userId);
    
    if (notJoined.length > 0) {
        const message = `👋 Welcome to Image Search Bot! 🖼️\n\n` +
            `To use this bot, please join our channels first:\n` +
            notJoined.map(channel => `• ${channel.name} - ${channel.username}`).join('\n') +
            `\n\nAfter joining, use the bot in any chat by typing @${botUsername} <query>`;
        
        const keyboard = {
            inline_keyboard: notJoined.map(channel => [{
                text: `Join ${channel.name}`,
                url: `https://t.me/${channel.username.replace('@', '')}`
            }])
        };

        bot.sendMessage(chatId, message, { reply_markup: keyboard });
        return;
    }

    await sendWelcomeMessage(chatId, botUsername);
});

// Handle any other message
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const botUsername = (await bot.getMe()).username;

        const notJoined = await checkUserChannels(userId);
        
        if (notJoined.length > 0) {
            const message = `Please join our channels to use this bot:\n` +
                notJoined.map(channel => `• ${channel.name} - ${channel.username}`).join('\n');
            
            const keyboard = {
                inline_keyboard: notJoined.map(channel => [{
                    text: `Join ${channel.name}`,
                    url: `https://t.me/${channel.username.replace('@', '')}`
                }])
            };

            bot.sendMessage(chatId, message, { reply_markup: keyboard });
            return;
        }

        // If user has joined all channels, send confirmation
        bot.sendMessage(chatId, 
            `✅ Great! You've joined all required channels!\n\n` +
            `You can now use the bot in any chat by typing @${botUsername} followed by your search query.\n\n` +
            `Example: @${botUsername} cats`
        );
    }
});

// Handle inline queries
bot.on('inline_query', async (query) => {
    const userId = query.from.id;
    const notJoined = await checkUserChannels(userId);
    
    if (notJoined.length > 0) {
        const message = `Please join our channels to use this bot:\n` +
            notJoined.map(channel => `• ${channel.name} - ${channel.username}`).join('\n');
        
        bot.answerInlineQuery(query.id, [], {
            switch_pm_text: 'Join Required Channels',
            switch_pm_parameter: 'join_channels'
        });
        return;
    }

    const searchQuery = query.query.trim();
    
    if (!searchQuery) {
        return;
    }

    try {
        // Search for images using Pixabay API
        const response = await axios.get('https://pixabay.com/api/', {
            params: {
                key: process.env.PIXABAY_API_KEY,
                q: searchQuery,
                image_type: 'photo',
                per_page: 20,
                safesearch: true
            }
        });

        const hits = response.data.hits;

        if (hits.length === 0) {
            return;
        }

        // Create inline results
        const results = hits.map((hit, index) => ({
            type: 'photo',
            id: String(index),
            photo_url: hit.webformatURL,
            thumb_url: hit.previewURL,
            photo_width: hit.imageWidth,
            photo_height: hit.imageHeight,
            title: `Image by ${hit.user}`,
            description: `Click to send this image`,
            caption: `Photo by ${hit.user} on Pixabay`
        }));

        // Answer the inline query
        bot.answerInlineQuery(query.id, results, {
            cache_time: 0,
            is_personal: false
        });

    } catch (error) {
        console.error('Error processing inline query:', error);
    }
});

// Handle chosen inline result
bot.on('chosen_inline_result', (result) => {
    console.log('Chosen inline result:', result);
});

// Export the handler
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const update = req.body;
        await bot.handleUpdate(update);
    }
    res.status(200).send('OK');
}; 