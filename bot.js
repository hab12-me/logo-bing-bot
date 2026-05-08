const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

// ==================== CONFIGURATION ====================
// REPLACE WITH YOUR ACTUAL BOT TOKEN FROM @BotFather
const BOT_TOKEN = '8762888807:AAHFSr4vrIME6cB8hY9JY8um8a2QR2zYORs';

// REPLACE WITH YOUR NETLIFY FRONTEND URL
const WEBAPP_URL = 'https://eloquent-dasik-4d9770.netlify.app/';

const PORT = process.env.PORT || 3000;

// ==================== DATABASE (In-Memory) ====================
// In production, replace with Redis or PostgreSQL
const users = new Map();
const pendingDeposits = new Map();
const pendingWithdrawals = new Map();
const gameHistory = new Map();

// ==================== BOT INITIALIZATION ====================
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== HELPER FUNCTIONS ====================

function getUser(telegramId) {
    if (!users.has(telegramId)) {
        users.set(telegramId, {
            id: telegramId,
            username: null,
            firstName: null,
            lastName: null,
            phoneNumber: null,
            registered: false,
            balance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            totalWon: 0,
            totalBet: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            cards: [],
            currentGame: null,
            createdAt: new Date(),
            lastSeen: new Date()
        });
    }
    const user = users.get(telegramId);
    user.lastSeen = new Date();
    return user;
}

function saveUser(user) {
    users.set(user.id, user);
}

function formatBalance(balance) {
    return `${balance.toFixed(2)} ETB`;
}

function isAdmin(telegramId) {
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    return adminIds.includes(telegramId);
}

// ==================== BOT COMMANDS ====================

// Start command
bot.start(async (ctx) => {
    const user = getUser(ctx.from.id);
    user.username = ctx.from.username;
    user.firstName = ctx.from.first_name;
    user.lastName = ctx.from.last_name;
    saveUser(user);
    
    const message = `
🎯 <b>WELCOME TO LOGO BING BINGO!</b> 🎯

━━━━━━━━━━━━━━━━━━━━
👋 Hello ${user.firstName}!

💰 <b>Get 10 ETB Welcome Bonus!</b>
━━━━━━━━━━━━━━━━━━━━

📝 <b>Commands:</b>
/register - Complete your registration
/play - Launch the game
/deposit - Deposit funds
/withdraw - Withdraw winnings
/balance - Check your balance
/instruction - How to play
/help - All commands

🎮 <b>How to Play:</b>
1. Use /register to register
2. Tap any card to buy (10 ETB each)
3. Game auto-starts after 30 seconds
4. Click BINGO when you have a winning pattern!

━━━━━━━━━━━━━━━━━━━━
<b>💰 Prize: 500 ETB per win!</b>
    `;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
    // Auto-register with 10 ETB bonus
    if (!user.registered) {
        user.registered = true;
        user.balance = 10;
        user.totalDeposited = 10;
        saveUser(user);
        await ctx.reply('✅ <b>Welcome bonus of 10 ETB added to your wallet!</b>\n\nUse /play to start playing! 🎮', { parse_mode: 'HTML' });
    }
});

// Register command
bot.command('register', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    if (user.registered && user.phoneNumber) {
        await ctx.reply(
            `✅ <b>You are already registered!</b>\n\n` +
            `📱 Phone: ${user.phoneNumber}\n` +
            `💰 Balance: ${formatBalance(user.balance)}\n\n` +
            `Use /play to play! 🎮`,
            { parse_mode: 'HTML' }
        );
        return;
    }
    
    const keyboard = Markup.keyboard([
        [Markup.button.contactRequest('📞 Share Phone Number')]
    ]).resize();
    
    await ctx.reply(
        `📝 <b>Registration Required</b>\n\n` +
        `Please share your phone number to complete registration.\n\n` +
        `⚠️ Your phone number is required for withdrawals.\n` +
        `🔒 Your data is kept private and secure.`,
        { parse_mode: 'HTML', reply_markup: keyboard }
    );
});

// Handle contact sharing
bot.on('contact', async (ctx) => {
    const user = getUser(ctx.from.id);
    const contact = ctx.message.contact;
    
    user.phoneNumber = contact.phone_number;
    user.registered = true;
    
    if (user.balance === 0) {
        user.balance = 10;
        user.totalDeposited = 10;
    }
    
    saveUser(user);
    
    await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `📱 Phone: ${user.phoneNumber}\n` +
        `💰 Balance: ${formatBalance(user.balance)}\n\n` +
        `Use /play to start playing! 🎮`,
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    
    // Notify admins of new registration
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `📝 <b>NEW USER REGISTERED</b>\n\n` +
                `👤 Name: ${user.firstName} ${user.lastName || ''}\n` +
                `🆔 ID: ${user.id}\n` +
                `📞 Username: @${user.username || 'N/A'}\n` +
                `📱 Phone: ${user.phoneNumber}\n` +
                `💰 Balance: ${formatBalance(user.balance)}`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

// Play command - Launch Mini App
bot.command('play', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /register first to complete registration!');
        return;
    }
    
    const message = `
🎮 <b>Logo Bing Bingo</b> 🎮

━━━━━━━━━━━━━━━━━━━━
👤 Player: ${user.firstName}
💰 Balance: ${formatBalance(user.balance)}
🎴 Active Cards: ${user.cards.length}
🏆 Games Won: ${user.gamesWon}
━━━━━━━━━━━━━━━━━━━━

<b>How to Play:</b>
• Tap any card number to buy (10 ETB each)
• Max 2 cards per player
• Game auto-starts after 30 seconds
• Click BINGO when you complete a pattern!

━━━━━━━━━━━━━━━━━━━━
<b>🎯 Winning Patterns:</b>
• Any horizontal row
• Any vertical column
• Any diagonal

<b>🏆 Prize: 500 ETB per win!</b>

Click the button below to launch the game!
    `;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🎯 PLAY NOW', WEBAPP_URL)]
    ]);
    
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
});

// Deposit command
bot.command('deposit', async (ctx) => {
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /register first!');
        return;
    }
    
    if (args.length < 3) {
        const message = `
💰 <b>Deposit Instructions - Telebirr</b> 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Send to: <code>0931721793</code>
👤 Account Name: Logo Bing Bingo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 <b>How to Deposit:</b>

1️⃣ Send money to <b>0931721793</b> via Telebirr

2️⃣ After sending, <b>COPY the Transaction ID</b> from the receipt

3️⃣ Send command:
<code>/deposit [AMOUNT] [TRANSACTION_ID]</code>

<b>Example:</b>
<code>/deposit 100 TXN123456789</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Minimum:</b> 10 ETB
💰 <b>Maximum:</b> 50,000 ETB
⏳ <b>Verification:</b> 5-15 minutes

⚠️ Deposits are verified manually by admin
        `;
        await ctx.reply(message, { parse_mode: 'HTML' });
        return;
    }
    
    const amount = parseFloat(args[1]);
    const transactionId = args[2];
    
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Invalid amount! Minimum deposit is 10 ETB.');
        return;
    }
    
    if (amount > 50000) {
        await ctx.reply('❌ Amount too high! Maximum deposit is 50,000 ETB.');
        return;
    }
    
    if (!transactionId || transactionId.length < 5) {
        await ctx.reply('❌ Invalid Transaction ID! Please provide a valid Telebirr transaction ID.');
        return;
    }
    
    const depositId = 'DEP_' + Date.now() + '_' + user.id;
    pendingDeposits.set(depositId, {
        id: depositId,
        userId: user.id,
        amount: amount,
        transactionId: transactionId,
        status: 'PENDING',
        createdAt: new Date()
    });
    
    await ctx.reply(
        `✅ <b>Deposit Request Submitted!</b>\n\n` +
        `📝 <b>Request ID:</b> <code>${depositId}</code>\n` +
        `💰 <b>Amount:</b> ${amount} ETB\n` +
        `🔢 <b>Transaction ID:</b> <code>${transactionId}</code>\n\n` +
        `⏳ Admin will verify within 5-15 minutes.\n` +
        `You will receive confirmation once approved.\n\n` +
        `Thank you for your deposit! 🎯`,
        { parse_mode: 'HTML' }
    );
    
    // Notify admins
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💰 <b>NEW DEPOSIT REQUEST</b>\n\n` +
                `📝 <b>ID:</b> <code>${depositId}</code>\n` +
                `👤 <b>User:</b> ${user.firstName} (@${user.username || 'N/A'})\n` +
                `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
                `💰 <b>Amount:</b> ${amount} ETB\n` +
                `🔢 <b>TXN:</b> <code>${transactionId}</code>\n` +
                `📱 <b>Phone:</b> ${user.phoneNumber || 'N/A'}\n\n` +
                `<b>Commands:</b>\n` +
                `/approve_deposit ${depositId}\n` +
                `/reject_deposit ${depositId} [reason]`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

// Withdraw command
bot.command('withdraw', async (ctx) => {
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /register first!');
        return;
    }
    
    if (args.length < 2) {
        await ctx.reply(
            `💸 <b>Withdrawal</b>\n\n` +
            `💰 <b>Your Balance:</b> ${formatBalance(user.balance)}\n` +
            `💸 <b>Minimum:</b> 10 ETB\n` +
            `📱 <b>Registered Phone:</b> ${user.phoneNumber || 'Not set'}\n\n` +
            `<b>Usage:</b>\n` +
            `<code>/withdraw [AMOUNT]</code>\n\n` +
            `<b>Example:</b>\n` +
            `<code>/withdraw 100</code>\n\n` +
            `⚠️ Withdrawals are processed manually (5-30 min)`,
            { parse_mode: 'HTML' }
        );
        return;
    }
    
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Invalid amount! Minimum withdrawal is 10 ETB.');
        return;
    }
    
    if (amount > user.balance) {
        await ctx.reply(`❌ Insufficient balance!\n\n💰 Your balance: ${formatBalance(user.balance)}`);
        return;
    }
    
    if (!user.phoneNumber) {
        await ctx.reply('❌ Please complete registration with phone number first!\n\nUse /register to share your phone number.');
        return;
    }
    
    const withdrawalId = 'WDR_' + Date.now() + '_' + user.id;
    pendingWithdrawals.set(withdrawalId, {
        id: withdrawalId,
        userId: user.id,
        amount: amount,
        phoneNumber: user.phoneNumber,
        name: user.firstName + ' ' + (user.lastName || ''),
        status: 'PENDING',
        createdAt: new Date()
    });
    
    await ctx.reply(
        `✅ <b>Withdrawal Request Submitted!</b>\n\n` +
        `📝 <b>Request ID:</b> <code>${withdrawalId}</code>\n` +
        `💰 <b>Amount:</b> ${amount} ETB\n` +
        `📱 <b>Will be sent to:</b> ${user.phoneNumber}\n\n` +
        `⏳ Admin will process within 5-30 minutes.\n` +
        `You will receive confirmation once sent.\n\n` +
        `Thank you for playing at Logo Bing! 🎉`,
        { parse_mode: 'HTML' }
    );
    
    // Notify admins
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💸 <b>NEW WITHDRAWAL REQUEST</b>\n\n` +
                `📝 <b>ID:</b> <code>${withdrawalId}</code>\n` +
                `👤 <b>User:</b> ${user.firstName} (@${user.username || 'N/A'})\n` +
                `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
                `💰 <b>Amount:</b> ${amount} ETB\n` +
                `📱 <b>Send to:</b> ${user.phoneNumber}\n` +
                `💵 <b>Balance:</b> ${formatBalance(user.balance)}\n\n` +
                `<b>Commands:</b>\n` +
                `/approve_withdraw ${withdrawalId}\n` +
                `/reject_withdraw ${withdrawalId} [reason]`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

// Balance command
bot.command('balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    
    const message = `
💰 <b>Your Wallet Details</b> 💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${user.firstName} ${user.lastName || ''}
📱 <b>Phone:</b> ${user.phoneNumber || 'Not set'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Balance:</b> ${formatBalance(user.balance)}
💵 <b>Total Deposited:</b> ${formatBalance(user.totalDeposited)}
💸 <b>Total Withdrawn:</b> ${formatBalance(user.totalWithdrawn)}
🏆 <b>Total Won:</b> ${formatBalance(user.totalWon)}
🎲 <b>Total Bet:</b> ${formatBalance(user.totalBet)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 <b>Games Played:</b> ${user.gamesPlayed}
🏅 <b>Games Won:</b> ${user.gamesWon}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use /deposit to add funds or /withdraw to withdraw!
    `;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

// Instruction command
bot.command('instruction', async (ctx) => {
    const message = `
🎯 <b>How to Play Logo Bing Bingo</b> 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Quick Start Guide:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>1️⃣ Register</b>
   • Use /register to complete registration
   • Get 10 ETB welcome bonus!

<b>2️⃣ Buy Cards</b>
   • Use /play to launch the game
   • Tap any card number to buy (10 ETB each)
   • Maximum 2 cards per player

<b>3️⃣ Gameplay</b>
   • Game auto-starts after 30 seconds
   • Numbers are called every 3 seconds
   • Called numbers turn GREEN on your card

<b>4️⃣ Winning Patterns</b>
   • ✅ Any horizontal row (5 numbers)
   • ✅ Any vertical column (5 numbers)
   • ✅ Any diagonal (5 numbers)

<b>5️⃣ Claim Bingo</b>
   • When you have a pattern, click BINGO button
   • Game verifies your card
   • If valid, YOU WIN 500 ETB!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>Pro Tips:</b>
• Wait for 4+ numbers before claiming
• Check your card carefully
• Invalid claims are not allowed
• Buy 2 cards to increase winning chances!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Deposit via Telebirr:</b> <code>0931721793</code>
📞 <b>Support:</b> Contact @LogoBingSupport

Use /play to start playing! 🎮
    `;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

// Help command
bot.command('help', async (ctx) => {
    const user = getUser(ctx.from.id);
    const isUserAdmin = isAdmin(ctx.from.id);
    
    let message = `
📚 <b>Logo Bing Bingo - Help Center</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎮 Player Commands:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/start - Welcome message
/register - Complete registration
/play - Launch the game 🎯
/deposit - Deposit funds 💰
/withdraw - Withdraw winnings 💸
/balance - Check your wallet 💵
/instruction - Game rules 📖
/help - This menu ❓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💰 Your Stats:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Player: ${user.firstName}
💸 Balance: ${formatBalance(user.balance)}
🎮 Games: ${user.gamesPlayed} played, ${user.gamesWon} won
    `;
    
    if (isUserAdmin) {
        message += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👑 Admin Commands:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/approve_deposit [ID] - Approve deposit
/reject_deposit [ID] [reason] - Reject deposit
/approve_withdraw [ID] - Approve withdrawal
/reject_withdraw [ID] [reason] - Reject withdrawal
/pending_deposits - List pending deposits
/pending_withdrawals - List pending withdrawals
/stats - Game statistics
        `;
    }
    
    message += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 <b>Need Help?</b>
Contact: @LogoBingSupport

Use /play to start playing! 🎮
    `;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

// ==================== ADMIN COMMANDS ====================

// Approve deposit
bot.command('approve_deposit', async (ctx) => {
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
    saveUser(user);
    
    pendingDeposits.delete(depositId);
    
    await ctx.reply(`✅ <b>Deposit Approved!</b>\n\n📝 ID: ${depositId}\n👤 User: ${user.firstName}\n💰 Amount: ${deposit.amount} ETB\n💵 New Balance: ${formatBalance(user.balance)}`, { parse_mode: 'HTML' });
    
    try {
        await bot.telegram.sendMessage(user.id,
            `✅ <b>DEPOSIT APPROVED!</b>\n\n` +
            `💰 <b>Amount:</b> ${deposit.amount} ETB\n` +
            `💵 <b>New Balance:</b> ${formatBalance(user.balance)}\n\n` +
            `🎮 Use /play to start playing!\n\n` +
            `Thank you for choosing Logo Bing! 🎉`,
            { parse_mode: 'HTML' }
        );
    } catch(e) {}
});

// Reject deposit
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
    
    await ctx.reply(`❌ Deposit rejected.\n\nID: ${depositId}\nReason: ${reason}`);
    
    try {
        await bot.telegram.sendMessage(deposit.userId,
            `❌ <b>DEPOSIT REJECTED</b>\n\n` +
            `💰 Amount: ${deposit.amount} ETB\n` +
            `📌 Reason: ${reason}\n\n` +
            `Please submit a new deposit request with correct information.\n` +
            `Contact support if you need assistance.`,
            { parse_mode: 'HTML' }
        );
    } catch(e) {}
});

// Approve withdrawal
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
    saveUser(user);
    
    pendingWithdrawals.delete(withdrawalId);
    
    await ctx.reply(`✅ Withdrawal approved!\n\nID: ${withdrawalId}\nAmount: ${withdrawal.amount} ETB\nSent to: ${withdrawal.phoneNumber}\nNew Balance: ${formatBalance(user.balance)}`);
    
    try {
        await bot.telegram.sendMessage(user.id,
            `✅ <b>WITHDRAWAL COMPLETED!</b>\n\n` +
            `💰 Amount: ${withdrawal.amount} ETB\n` +
            `📱 Sent to: ${withdrawal.phoneNumber}\n` +
            `💵 New Balance: ${formatBalance(user.balance)}\n\n` +
            `Thank you for playing at Logo Bing! 🎉`,
            { parse_mode: 'HTML' }
        );
    } catch(e) {}
});

// Reject withdrawal
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
    
    await ctx.reply(`❌ Withdrawal rejected.\n\nID: ${withdrawalId}\nReason: ${reason}`);
    
    try {
        await bot.telegram.sendMessage(withdrawal.userId,
            `❌ <b>WITHDRAWAL REJECTED</b>\n\n` +
            `💰 Amount: ${withdrawal.amount} ETB\n` +
            `📌 Reason: ${reason}\n\n` +
            `Please contact support for assistance.`,
            { parse_mode: 'HTML' }
        );
    } catch(e) {}
});

// List pending deposits
bot.command('pending_deposits', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    if (pendingDeposits.size === 0) {
        await ctx.reply('✅ No pending deposits.');
        return;
    }
    
    let message = '📋 <b>Pending Deposits</b>\n\n';
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

// List pending withdrawals
bot.command('pending_withdrawals', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Admin only command!');
        return;
    }
    
    if (pendingWithdrawals.size === 0) {
        await ctx.reply('✅ No pending withdrawals.');
        return;
    }
    
    let message = '📋 <b>Pending Withdrawals</b>\n\n';
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

// Statistics command
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
    
    const message = `
📊 <b>Game Statistics</b>

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
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

// ==================== WEBAPP API ENDPOINTS ====================

// Get user data
app.get('/api/user/:telegramId', async (req, res) => {
    const user = getUser(req.params.telegramId);
    res.json({
        success: true,
        balance: user.balance,
        firstName: user.firstName,
        registered: user.registered,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
    });
});

// Update game data
app.post('/api/game', async (req, res) => {
    const { telegramId, action, data } = req.body;
    const user = getUser(telegramId);
    
    switch (action) {
        case 'getUser':
            res.json({ success: true, balance: user.balance, firstName: user.firstName });
            break;
        case 'updateBalance':
            user.balance = data.balance;
            user.totalBet += data.betAmount || 0;
            saveUser(user);
            res.json({ success: true });
            break;
        case 'recordWin':
            user.balance = data.newBalance;
            user.totalWon += data.winAmount;
            user.gamesWon++;
            user.gamesPlayed++;
            saveUser(user);
            res.json({ success: true });
            break;
        case 'recordGame':
            user.gamesPlayed++;
            saveUser(user);
            res.json({ success: true });
            break;
        default:
            res.json({ success: false, error: 'Unknown action' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), users: users.size });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot ready! WebApp URL: ${WEBAPP_URL}`);
    console.log(`📱 Admin IDs: 1765057062, 1044688332, 6499874707`);
});

// Launch bot with webhook (for production) or polling (for development)
if (process.env.NODE_ENV === 'production') {
    bot.launch({
        webhook: {
            domain: process.env.WEBHOOK_DOMAIN || 'https://your-bot.onrender.com',
            path: '/webhook',
            port: PORT
        }
    });
} else {
    bot.launch();
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
