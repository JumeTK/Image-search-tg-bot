require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Telegram bot with inline mode
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
    polling: true,
    filepath: false // Disable file downloading
});

// Required channels (replace with your actual channel usernames)
const REQUIRED_CHANNELS = [
    { id: -1002221175352, username: '@trumpXbtc24', name: 'CryptoMarket Updates 24/7' },
    { id: -1002404972514, username: '@popymovies', name: 'Free Movies' }
];

// Create images directory if it doesn't exist
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// Store active searches for each user
const activeSearches = new Map();

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

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const notJoined = await checkUserChannels(userId);
    
    if (notJoined.length > 0) {
        const message = `👋 Welcome to Image Search Bot! 🖼️\n\n` +
            `To use this bot, please join our channels first:\n` +
            notJoined.map(channel => `• ${channel.name} - ${channel.username}`).join('\n') +
            `\n\nAfter joining, use the bot in any chat by typing @${(await bot.getMe()).username} <query>`;
        
        const keyboard = {
            inline_keyboard: notJoined.map(channel => [{
                text: `Join ${channel.name}`,
                url: `https://t.me/${channel.username.replace('@', '')}`
            }])
        };

        bot.sendMessage(chatId, message, { reply_markup: keyboard });
        return;
    }

    bot.sendMessage(chatId, 
        `👋 Welcome to Image Search Bot! 🖼️\n\n` +
        `🔍 Search and share high-quality images instantly\n` +
        `🎨 Millions of free-to-use images from Pixabay\n` +
        `📸 Professional photos with photographer credits\n` +
        `⚡ Fast and easy to use in any chat\n\n` +
        `To use the bot, simply type @${(await bot.getMe()).username} followed by your search query in any chat!\n\n` +
        `Example: @${(await bot.getMe()).username} cats`
    );
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

// Handle /search command
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];

    // Check if user already has an active search
    if (activeSearches.has(chatId)) {
        bot.sendMessage(chatId, 'You already have an active search. Please wait for it to complete or use /stop to cancel it.');
        return;
    }

    // Mark search as active immediately
    activeSearches.set(chatId, true);

    // Send initial message
    const statusMsg = await bot.sendMessage(chatId, `🔍 Starting image search for "${query}"...`);

    // Create stop button
    const stopKeyboard = {
        inline_keyboard: [[
            {
                text: '🛑 Stop Search',
                callback_data: `stop_${chatId}`
            }
        ]]
    };

    // Update message with stop button
    await bot.editMessageText(`🔍 Searching for "${query}"...\nImages will appear below.`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        reply_markup: stopKeyboard
    });

    // Start continuous search
    let page = 1;
    let totalImages = 0;

    // Function to stop the search
    const stopSearch = () => {
        activeSearches.delete(chatId);
        bot.editMessageText(`✅ Search completed for "${query}"`, {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
    };

    // Start processing images immediately
    (async function processImages() {
        while (activeSearches.has(chatId)) {
            try {
                // Search for images using Pixabay API
                const response = await axios.get('https://pixabay.com/api/', {
                    params: {
                        key: process.env.PIXABAY_API_KEY,
                        q: query,
                        image_type: 'photo',
                        page: page,
                        per_page: 20,
                        safesearch: true
                    }
                });

                const hits = response.data.hits;

                if (hits.length === 0) {
                    stopSearch();
                    break;
                }

                // Process images in parallel for faster delivery
                await Promise.all(hits.map(async (hit) => {
                    if (!activeSearches.has(chatId)) return;

                    try {
                        // Download image
                        const imageResponse = await axios({
                            method: 'GET',
                            url: hit.webformatURL,
                            responseType: 'stream'
                        });

                        const imagePath = path.join(imagesDir, `image_${Date.now()}_${Math.random()}.jpg`);
                        const writer = fs.createWriteStream(imagePath);

                        imageResponse.data.pipe(writer);

                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });

                        // Send image to user
                        await bot.sendPhoto(chatId, imagePath, {
                            caption: `Photo by ${hit.user} on Pixabay`
                        });

                        // Delete the downloaded image
                        fs.unlinkSync(imagePath);

                        totalImages++;
                        
                        // Update status message less frequently to reduce API calls
                        if (totalImages % 5 === 0) {
                            await bot.editMessageText(`🔍 Found ${totalImages} images for "${query}"...`, {
                                chat_id: chatId,
                                message_id: statusMsg.message_id,
                                reply_markup: stopKeyboard
                            });
                        }

                    } catch (error) {
                        console.error('Error processing image:', error);
                    }
                }));

                page++;
                
                // Small delay between pages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error('Error in search loop:', error);
                stopSearch();
                break;
            }
        }
    })();
});

// Handle /stop command
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (activeSearches.has(chatId)) {
        activeSearches.delete(chatId);
        bot.sendMessage(chatId, 'Search stopped. You can start a new search with /search <query>');
    } else {
        bot.sendMessage(chatId, 'No active search to stop.');
    }
});

// Handle stop button clicks
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data.startsWith('stop_')) {
        const chatId = data.split('_')[1];
        if (activeSearches.has(chatId)) {
            activeSearches.delete(chatId);
            bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Search stopped',
                show_alert: true
            });
        }
    }
});

// Handle any other text message
bot.on('message', (msg) => {
    if (!msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Please use the /search command followed by your search query.\nExample: /search cats');
    }
});

console.log('Bot is running...'); 