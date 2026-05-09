/**
 * LOGO BING BINGO - TELEGRAM BOT
 * Complete Commercial Version
 * 
 * This bot handles:
 * - User registration
 * - Balance management
 * - Deposit/Withdrawal requests
 * - Game launching
 * - Admin commands
 */

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');

// ============================================
// CONFIGURATION
// ============================================

// Your Telegram Bot Token from @BotFather
const BOT_TOKEN = '8762888807:AAHFSr4vrIME6cB8hY9JY8um8a2QR2zYORs';

// Your Netlify Frontend URL
const WEBAPP_URL = 'https://unique-cassata-81ef19.netlify.app';

// Port for the web server (Render provides this)
const PORT = process.env.PORT || 10000;

// ============================================
// DATABASE (In-Memory for simplicity)
// In production, replace with PostgreSQL or Redis
// ============================================

// Store all users
const users = new Map();

// Store pending deposit requests for admin approval
const pendingDeposits = new Map();

// Store pending withdrawal requests for admin approval
const pendingWithdrawals = new Map();

// ============================================
// TELEGRAM BOT INITIALIZATION
// ============================================

const bot = new Telegraf(BOT_TOKEN);

// ============================================
// EXPRESS SERVER FOR WEBHOOK AND API
// ============================================

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get or create a user in the database
 * @param {string} telegramId - The user's Telegram ID
 * @returns {object} User object with balance and stats
 */
function getUser(telegramId) {
    if (!users.has(telegramId)) {
        users.set(telegramId, {
            id: telegramId,
            username: null,
            firstName: null,
            lastName: null,
            phoneNumber: null,
            registered: true,
            balance: 100,                      // Starting balance 100 ETB
            totalDeposited: 100,
            totalWithdrawn: 0,
            totalWon: 0,
            totalBet: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            createdAt: new Date(),
            lastSeen: new Date()
        });
    }
    const user = users.get(telegramId);
    user.lastSeen = new Date();
    return user;
}

/**
 * Format balance with ETB currency
 * @param {number} balance - The balance to format
 * @returns {string} Formatted balance string
 */
function formatBalance(balance) {
    return `${balance.toFixed(2)} ETB`;
}

/**
 * Check if a user is an admin
 * @param {string} telegramId - The user's Telegram ID
 * @returns {boolean} True if user is admin
 */
function isAdmin(telegramId) {
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    return adminIds.includes(telegramId);
}

// ============================================
// BOT COMMANDS
// ============================================

/**
 * /start command - Welcome message and introduction
 */
bot.start(async (ctx) => {
    const user = getUser(ctx.from.id);
    user.username = ctx.from.username;
    user.firstName = ctx.from.first_name;
    user.lastName = ctx.from.last_name;
    
    const welcomeMessage = `
🎯 <b>WELCOME TO LOGO BING BINGO!</b> 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 <b>Hello ${user.firstName}!</b>

💰 <b>Your Balance:</b> ${formatBalance(user.balance)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 <b>Available Commands:</b>

/play - 🎮 Launch the game
/deposit - 💰 Deposit funds via Telebirr
/withdraw - 💸 Withdraw your winnings
/balance - 💵 Check your wallet balance
/help - ❓ Show all commands

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎮 How to Play:</b>

1️⃣ Tap any card number to buy (10 ETB each)
2️⃣ Maximum 2 cards per player
3️⃣ Game automatically starts after 30 seconds
4️⃣ Numbers are called every 3 seconds
5️⃣ Click BINGO when you complete a winning pattern!

<b>🏆 Winning Patterns:</b>
• Any horizontal row (5 numbers)
• Any vertical column (5 numbers)
• Any diagonal (5 numbers)

<b>💰 Prize: 500 ETB per win!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Click /play to start playing! 🎯
    `;
    
    await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
});

/**
 * /play command - Launch the game mini app
 */
bot.command('play', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    const playMessage = `
🎮 <b>LOGO BING BINGO GAME</b> 🎮

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Player:</b> ${user.firstName}
💰 <b>Balance:</b> ${formatBalance(user.balance)}
🏆 <b>Games Won:</b> ${user.gamesWon}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>How to Play:</b>
• Tap any card number to buy (10 ETB each)
• Maximum 2 cards per player
• Game auto-starts after 30 seconds
• Click BINGO when you complete a pattern!

<b>🎯 Prize: 500 ETB per win!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click the button below to launch the game!
    `;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🎯 PLAY NOW', WEBAPP_URL)]
    ]);
    
    await ctx.reply(playMessage, { parse_mode: 'HTML', ...keyboard });
});

/**
 * /balance command - Check wallet balance and statistics
 */
bot.command('balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    const balanceMessage = `
💰 <b>YOUR WALLET DETAILS</b> 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${user.firstName} ${user.lastName || ''}
📱 <b>Phone:</b> ${user.phoneNumber || 'Not set'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Current Balance:</b> ${formatBalance(user.balance)}
💵 <b>Total Deposited:</b> ${formatBalance(user.totalDeposited)}
💸 <b>Total Withdrawn:</b> ${formatBalance(user.totalWithdrawn)}
🏆 <b>Total Won:</b> ${formatBalance(user.totalWon)}
🎲 <b>Total Bet:</b> ${formatBalance(user.totalBet)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 <b>Games Played:</b> ${user.gamesPlayed}
🏅 <b>Games Won:</b> ${user.gamesWon}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use /deposit to add funds or /withdraw to cash out!
    `;
    
    await ctx.reply(balanceMessage, { parse_mode: 'HTML' });
});

/**
 * /deposit command - Request a deposit via Telebirr
 */
bot.command('deposit', async (ctx) => {
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    // If not enough arguments, show instructions
    if (args.length < 3) {
        const depositInstructions = `
💰 <b>DEPOSIT INSTRUCTIONS - TELEBIRR</b> 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 <b>Send to:</b> <code>0931721793</code>
👤 <b>Account Name:</b> Logo Bing Bingo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 <b>How to Deposit:</b>

1️⃣ Send money to <b>0931721793</b> via Telebirr

2️⃣ After sending, <b>COPY the Transaction ID</b> from the receipt

3️⃣ Send the command with your details:
<code>/deposit [AMOUNT] [TRANSACTION_ID]</code>

<b>Example:</b>
<code>/deposit 100 TXN123456789</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Minimum:</b> 10 ETB
💰 <b>Maximum:</b> 50,000 ETB
⏳ <b>Verification Time:</b> 5-15 minutes

⚠️ Deposits are verified manually by admin
        `;
        await ctx.reply(depositInstructions, { parse_mode: 'HTML' });
        return;
    }
    
    // Parse deposit request
    const amount = parseFloat(args[1]);
    const transactionId = args[2];
    
    // Validate amount
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Invalid amount! Minimum deposit is 10 ETB.');
        return;
    }
    
    if (amount > 50000) {
        await ctx.reply('❌ Amount too high! Maximum deposit is 50,000 ETB.');
        return;
    }
    
    // Validate transaction ID
    if (!transactionId || transactionId.length < 5) {
        await ctx.reply('❌ Invalid Transaction ID! Please provide a valid Telebirr transaction ID.');
        return;
    }
    
    // Create deposit request
    const depositId = 'DEP_' + Date.now() + '_' + user.id;
    pendingDeposits.set(depositId, {
        id: depositId,
        userId: user.id,
        amount: amount,
        transactionId: transactionId,
        createdAt: new Date()
    });
    
    // Confirm to user
    await ctx.reply(
        `✅ <b>DEPOSIT REQUEST SUBMITTED!</b>\n\n` +
        `📝 <b>Request ID:</b> <code>${depositId}</code>\n` +
        `💰 <b>Amount:</b> ${amount} ETB\n` +
        `🔢 <b>Transaction ID:</b> <code>${transactionId}</code>\n\n` +
        `⏳ Admin will verify within 5-15 minutes.\n` +
        `You will receive confirmation once approved.\n\n` +
        `Thank you for your deposit! 🎯`,
        { parse_mode: 'HTML' }
    );
    
    // Notify all admins
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    for (const adminId of adminIds) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💰 <b>NEW DEPOSIT REQUEST</b>\n\n` +
                `📝 <b>ID:</b> <code>${depositId}</code>\n` +
                `👤 <b>User:</b> ${user.firstName} (@${user.username || 'N/A'})\n` +
                `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
                `💰 <b>Amount:</b> ${amount} ETB\n` +
                `🔢 <b>TXN:</b> <code>${transactionId}</code>\n\n` +
                `<b>Commands:</b>\n` +
                `/approve_deposit ${depositId}\n` +
                `/reject_deposit ${depositId} [reason]`,
                { parse_mode: 'HTML' }
            );
        } catch(error) {
            console.error('Failed to notify admin:', error);
        }
    }
});

/**
 * /withdraw command - Request a withdrawal
 */
bot.command('withdraw', async (ctx) => {
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    // If no amount provided, show balance
    if (args.length < 2) {
        const withdrawInstructions = `
💸 <b>WITHDRAWAL</b> 💸

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Your Balance:</b> ${formatBalance(user.balance)}
💸 <b>Minimum Withdrawal:</b> 10 ETB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 <b>How to Withdraw:</b>

Simply send the command with the amount:
<code>/withdraw [AMOUNT]</code>

<b>Example:</b>
<code>/withdraw 100</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ <b>Processing Time:</b> 5-30 minutes
📱 Funds will be sent to your registered phone number

⚠️ Withdrawals are processed manually by admin
        `;
        await ctx.reply(withdrawInstructions, { parse_mode: 'HTML' });
        return;
    }
    
    const amount = parseFloat(args[1]);
    
    // Validate amount
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Invalid amount! Minimum withdrawal is 10 ETB.');
        return;
    }
    
    if (amount > user.balance) {
        await ctx.reply(`❌ Insufficient balance!\n\n💰 Your balance: ${formatBalance(user.balance)}`);
        return;
    }
    
    // Check if user has phone number registered
    if (!user.phoneNumber) {
        await ctx.reply('❌ Please complete registration with phone number first!\n\nUse /register to share your phone number.');
        return;
    }
    
    // Create withdrawal request
    const withdrawalId = 'WDR_' + Date.now() + '_' + user.id;
    pendingWithdrawals.set(withdrawalId, {
        id: withdrawalId,
        userId: user.id,
        amount: amount,
        phoneNumber: user.phoneNumber,
        name: user.firstName + ' ' + (user.lastName || ''),
        createdAt: new Date()
    });
    
    // Confirm to user
    await ctx.reply(
        `✅ <b>WITHDRAWAL REQUEST SUBMITTED!</b>\n\n` +
        `📝 <b>Request ID:</b> <code>${withdrawalId}</code>\n` +
        `💰 <b>Amount:</b> ${amount} ETB\n` +
        `📱 <b>Will be sent to:</b> ${user.phoneNumber}\n\n` +
        `⏳ Admin will process within 5-30 minutes.\n` +
        `You will receive confirmation once sent.\n\n` +
        `Thank you for playing at Logo Bing! 🎉`,
        { parse_mode: 'HTML' }
    );
    
    // Notify all admins
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    for (const adminId of adminIds) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💸 <b>NEW WITHDRAWAL REQUEST</b>\n\n` +
                `📝 <b>ID:</b> <code>${withdrawalId}</code>\n` +
                `👤 <b>User:</b> ${user.firstName} (@${user.username || 'N/A'})\n` +
                `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
                `💰 <b>Amount:</b> ${amount} ETB\n` +
                `📱 <b>Send to:</b> ${user.phoneNumber}\n` +
                `💵 <b>Current Balance:</b> ${formatBalance(user.balance)}\n\n` +
                `<b>Commands:</b>\n` +
                `/approve_withdraw ${withdrawalId}\n` +
                `/reject_withdraw ${withdrawalId} [reason]`,
                { parse_mode: 'HTML' }
            );
        } catch(error) {
            console.error('Failed to notify admin:', error);
        }
    }
});

/**
 * /help command - Show all available commands
 */
bot.command('help', async (ctx) => {
    const user = getUser(ctx.from.id);
    const isUserAdmin = isAdmin(ctx.from.id);
    
    let helpMessage = `
📚 <b>LOGO BING BINGO - HELP CENTER</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎮 PLAYER COMMANDS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/start - 🎯 Welcome message and introduction
/play - 🎮 Launch the game
/deposit - 💰 Deposit funds via Telebirr
/withdraw - 💸 Withdraw your winnings
/balance - 💵 Check your wallet balance
/help - ❓ Show this help menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💰 YOUR STATISTICS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Player: ${user.firstName}
💰 Balance: ${formatBalance(user.balance)}
🎮 Games Played: ${user.gamesPlayed}
🏆 Games Won: ${user.gamesWon}
    `;
    
    // Add admin commands if user is admin
    if (isUserAdmin) {
        helpMessage += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👑 ADMIN COMMANDS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/approve_deposit [ID] - Approve a deposit request
/reject_deposit [ID] [reason] - Reject a deposit request
/approve_withdraw [ID] - Approve a withdrawal request
/reject_withdraw [ID] [reason] - Reject a withdrawal request
/pending_deposits - List all pending deposits
/pending_withdrawals - List all pending withdrawals
/stats - View game statistics
        `;
    }
    
    helpMessage += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 <b>NEED HELP?</b>
Contact support: @LogoBingSupport

Use /play to start playing! 🎮
    `;
    
    await ctx.reply(helpMessage, { parse_mode: 'HTML' });
});

// ============================================
// ADMIN COMMANDS
// ============================================

/**
 * /approve_deposit - Admin approves a deposit request
 */
bot.command('approve_deposit', async (ctx) => {
    // Check if user is admin
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ This command is for admins only!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('📝 Usage: /approve_deposit [REQUEST_ID]\n\nExample: /approve_deposit DEP_1234567890_123456789');
        return;
    }
    
    const depositId = args[1];
    const deposit = pendingDeposits.get(depositId);
    
    if (!deposit) {
        await ctx.reply(`❌ Deposit request not found!\n\nID: ${depositId}`);
        return;
    }
    
    const user = getUser(deposit.userId);
    user.balance += deposit.amount;
    user.totalDeposited += deposit.amount;
    
    pendingDeposits.delete(depositId);
    
    // Confirm to admin
    await ctx.reply(
        `✅ <b>DEPOSIT APPROVED!</b>\n\n` +
        `📝 ID: ${depositId}\n` +
        `👤 User: ${user.firstName}\n` +
        `💰 Amount: ${deposit.amount} ETB\n` +
        `💵 New Balance: ${formatBalance(user.balance)}`,
        { parse_mode: 'HTML' }
    );
    
    // Notify user
    try {
        await bot.telegram.sendMessage(user.id,
            `✅ <b>DEPOSIT APPROVED!</b>\n\n` +
            `💰 <b>Amount:</b> ${deposit.amount} ETB\n` +
            `💵 <b>New Balance:</b> ${formatBalance(user.balance)}\n\n` +
            `🎮 Use /play to start playing!\n\n` +
            `Thank you for choosing Logo Bing! 🎉`,
            { parse_mode: 'HTML' }
        );
    } catch(error) {
        console.error('Failed to notify user:', error);
    }
});

/**
 * /reject_deposit - Admin rejects a deposit request
 */
bot.command('reject_deposit', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /reject_deposit [REQUEST_ID] [REASON]');
        return;
    }
    
    const depositId = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const deposit = pendingDeposits.get(depositId);
    
    if (!deposit) {
        await ctx.reply('❌ Deposit request not found!');
        return;
    }
    
    pendingDeposits.delete(depositId);
    
    await ctx.reply(`❌ Deposit ${depositId} rejected.\n\nReason: ${reason}`);
    
    try {
        await bot.telegram.sendMessage(deposit.userId,
            `❌ <b>DEPOSIT REJECTED</b>\n\n` +
            `💰 Amount: ${deposit.amount} ETB\n` +
            `📌 Reason: ${reason}\n\n` +
            `Please submit a new deposit request with correct information.\n` +
            `Contact support if you need assistance.`,
            { parse_mode: 'HTML' }
        );
    } catch(error) {
        console.error('Failed to notify user:', error);
    }
});

/**
 * /approve_withdraw - Admin approves a withdrawal request
 */
bot.command('approve_withdraw', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /approve_withdraw [REQUEST_ID]');
        return;
    }
    
    const withdrawalId = args[1];
    const withdrawal = pendingWithdrawals.get(withdrawalId);
    
    if (!withdrawal) {
        await ctx.reply('❌ Withdrawal request not found!');
        return;
    }
    
    const user = getUser(withdrawal.userId);
    user.balance -= withdrawal.amount;
    user.totalWithdrawn += withdrawal.amount;
    
    pendingWithdrawals.delete(withdrawalId);
    
    await ctx.reply(
        `✅ <b>WITHDRAWAL APPROVED!</b>\n\n` +
        `📝 ID: ${withdrawalId}\n` +
        `💰 Amount: ${withdrawal.amount} ETB\n` +
        `📱 Sent to: ${withdrawal.phoneNumber}\n` +
        `💵 New Balance: ${formatBalance(user.balance)}`,
        { parse_mode: 'HTML' }
    );
    
    try {
        await bot.telegram.sendMessage(user.id,
            `✅ <b>WITHDRAWAL COMPLETED!</b>\n\n` +
            `💰 Amount: ${withdrawal.amount} ETB\n` +
            `📱 Sent to: ${withdrawal.phoneNumber}\n` +
            `💵 New Balance: ${formatBalance(user.balance)}\n\n` +
            `Thank you for playing at Logo Bing! 🎉`,
            { parse_mode: 'HTML' }
        );
    } catch(error) {
        console.error('Failed to notify user:', error);
    }
});

/**
 * /reject_withdraw - Admin rejects a withdrawal request
 */
bot.command('reject_withdraw', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /reject_withdraw [REQUEST_ID] [REASON]');
        return;
    }
    
    const withdrawalId = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const withdrawal = pendingWithdrawals.get(withdrawalId);
    
    if (!withdrawal) {
        await ctx.reply('❌ Withdrawal request not found!');
        return;
    }
    
    pendingWithdrawals.delete(withdrawalId);
    
    await ctx.reply(`❌ Withdrawal ${withdrawalId} rejected.\n\nReason: ${reason}`);
    
    try {
        await bot.telegram.sendMessage(withdrawal.userId,
            `❌ <b>WITHDRAWAL REJECTED</b>\n\n` +
            `💰 Amount: ${withdrawal.amount} ETB\n` +
            `📌 Reason: ${reason}\n\n` +
            `Please contact support for assistance.`,
            { parse_mode: 'HTML' }
        );
    } catch(error) {
        console.error('Failed to notify user:', error);
    }
});

/**
 * /pending_deposits - List all pending deposit requests
 */
bot.command('pending_deposits', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    if (pendingDeposits.size === 0) {
        await ctx.reply('✅ No pending deposits.');
        return;
    }
    
    let message = '📋 <b>PENDING DEPOSITS</b>\n\n';
    for (const [id, deposit] of pendingDeposits) {
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📝 <b>ID:</b> <code>${id}</code>\n`;
        message += `👤 <b>User:</b> ${deposit.userId}\n`;
        message += `💰 <b>Amount:</b> ${deposit.amount} ETB\n`;
        message += `🔢 <b>TXN:</b> <code>${deposit.transactionId}</code>\n`;
        message += `⏰ <b>Time:</b> ${deposit.createdAt.toLocaleString()}\n\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

/**
 * /pending_withdrawals - List all pending withdrawal requests
 */
bot.command('pending_withdrawals', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    if (pendingWithdrawals.size === 0) {
        await ctx.reply('✅ No pending withdrawals.');
        return;
    }
    
    let message = '📋 <b>PENDING WITHDRAWALS</b>\n\n';
    for (const [id, withdrawal] of pendingWithdrawals) {
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📝 <b>ID:</b> <code>${id}</code>\n`;
        message += `👤 <b>User:</b> ${withdrawal.userId}\n`;
        message += `💰 <b>Amount:</b> ${withdrawal.amount} ETB\n`;
        message += `📱 <b>Phone:</b> ${withdrawal.phoneNumber}\n`;
        message += `⏰ <b>Time:</b> ${withdrawal.createdAt.toLocaleString()}\n\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

/**
 * /stats - Game statistics for admin
 */
bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    let totalBalance = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalGames = 0;
    let totalWins = 0;
    let registeredCount = 0;
    
    for (const [id, user] of users) {
        totalBalance += user.balance;
        totalDeposits += user.totalDeposited;
        totalWithdrawals += user.totalWithdrawn;
        totalGames += user.gamesPlayed;
        totalWins += user.gamesWon;
        if (user.registered) registeredCount++;
    }
    
    const statsMessage = `
📊 <b>GAME STATISTICS</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 <b>Total Users:</b> ${users.size}
✅ <b>Registered:</b> ${registeredCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Total Balance:</b> ${formatBalance(totalBalance)}
💵 <b>Total Deposits:</b> ${formatBalance(totalDeposits)}
💸 <b>Total Withdrawals:</b> ${formatBalance(totalWithdrawals)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 <b>Total Games:</b> ${totalGames}
🏆 <b>Total Wins:</b> ${totalWins}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ <b>Pending Actions:</b>
💰 Pending Deposits: ${pendingDeposits.size}
💸 Pending Withdrawals: ${pendingWithdrawals.size}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 <b>Admin Telebirr:</b> <code>0931721793</code>
    `;
    
    await ctx.reply(statsMessage, { parse_mode: 'HTML' });
});

// ============================================
// WEBHOOK AND API ENDPOINTS
// ============================================

/**
 * Health check endpoint for Render
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        users: users.size,
        pendingDeposits: pendingDeposits.size,
        pendingWithdrawals: pendingWithdrawals.size
    });
});

/**
 * Get user data for frontend game
 */
app.get('/api/user/:telegramId', (req, res) => {
    const user = getUser(req.params.telegramId);
    res.json({
        success: true,
        balance: user.balance,
        firstName: user.firstName || 'Player',
        registered: true,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
    });
});

/**
 * Update game data from frontend
 */
app.post('/api/game', (req, res) => {
    const { telegramId, action, data } = req.body;
    const user = getUser(telegramId);
    
    if (action === 'updateBalance') {
        user.balance = data.balance;
        user.totalBet += data.betAmount || 0;
        res.json({ success: true });
    } else if (action === 'recordWin') {
        user.balance = data.newBalance;
        user.totalWon += data.winAmount;
        user.gamesWon++;
        user.gamesPlayed++;
        res.json({ success: true });
    } else {
        res.json({ success: true });
    }
});

/**
 * Webhook endpoint for Telegram
 */
app.post('/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// ============================================
// START THE SERVER
// ============================================

const server = app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ LOGO BING TELEGRAM BOT - RUNNING SUCCESSFULLY');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🎮 WebApp URL: ${WEBAPP_URL}`);
    console.log(`📱 Admin IDs: 1765057062, 1044688332, 6499874707`);
    console.log('═══════════════════════════════════════════════════');
});

// Launch the bot
bot.launch();
console.log('🤖 Telegram bot launched successfully');

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGINT');
    server.close();
});
process.once('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGTERM');
    server.close();
});
