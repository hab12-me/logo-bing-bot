/**
 * LOGO BING BINGO - TELEGRAM BOT
 * Complete Production Version with Persistent Storage
 */

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');

// ============================================
// CONFIGURATION
// ============================================
const BOT_TOKEN = '8762888807:AAHFSr4vrIME6cB8hY9JY8um8a2QR2zYORs';
const WEBAPP_URL = 'https://beautiful-sundae-eb636f.netlify.app/';
const API_URL = 'https://logo-bingo-complete-gfdjsdo.onrender.com';
const PORT = process.env.PORT || 10000;

// ============================================
// DATABASE (In-Memory with API Sync)
// ============================================
const users = new Map();
const pendingDeposits = new Map();
const pendingWithdrawals = new Map();

// ============================================
// INITIALIZATION
// ============================================
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// API CALLS TO BACKEND FOR PERSISTENCE
// ============================================

async function syncUserToBackend(telegramId) {
    const user = users.get(telegramId);
    if (!user) return;
    
    try {
        await fetch(`${API_URL}/api/user/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                registered: user.registered,
                balance: user.balance,
                totalDeposited: user.totalDeposited,
                totalWithdrawn: user.totalWithdrawn,
                totalWon: user.totalWon,
                totalBet: user.totalBet,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon
            })
        });
    } catch(e) { console.error('Sync error:', e); }
}

async function loadUserFromBackend(telegramId) {
    try {
        const response = await fetch(`${API_URL}/api/user/${telegramId}`);
        const data = await response.json();
        if (data.success && data.user) {
            users.set(telegramId, data.user);
            return data.user;
        }
    } catch(e) { console.error('Load error:', e); }
    return null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUser(telegramId) {
    if (!users.has(telegramId)) {
        // Try to load from backend first
        const backendUser = await loadUserFromBackend(telegramId);
        if (backendUser) {
            return backendUser;
        }
        
        // Create new user
        const newUser = {
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
            createdAt: new Date()
        };
        users.set(telegramId, newUser);
        return newUser;
    }
    return users.get(telegramId);
}

function formatBalance(balance) {
    return `${balance.toFixed(2)} ETB`;
}

function isAdmin(telegramId) {
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    return adminIds.includes(telegramId);
}

// ============================================
// BOT COMMANDS
// ============================================

bot.command('start', async (ctx) => {
    const user = await getUser(ctx.from.id);
    user.username = ctx.from.username;
    user.firstName = ctx.from.first_name;
    user.lastName = ctx.from.last_name;
    
    if (user.registered) {
        await ctx.reply(
            `✅ <b>You are already registered!</b>\n\n` +
            `👤 Name: ${user.firstName}\n` +
            `💰 Balance: ${formatBalance(user.balance)}\n\n` +
            `Use /play to start playing! 🎮`,
            { parse_mode: 'HTML' }
        );
        await syncUserToBackend(ctx.from.id);
        return;
    }
    
    // New user - give 10 ETB welcome bonus ONLY ONCE
    user.registered = true;
    user.balance = 10;
    user.totalDeposited = 10;
    await syncUserToBackend(ctx.from.id);
    
    const message = `
🎯 <b>WELCOME TO LOGO BING BINGO!</b> 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Hello ${user.firstName}!

💰 <b>Welcome Bonus: 10 ETB Added!</b>
💵 <b>Your Balance:</b> ${formatBalance(user.balance)}
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
5️⃣ Click BINGO when you complete a pattern!

<b>🏆 Winning Patterns:</b>
• Any horizontal row (5 numbers)
• Any vertical column (5 numbers)
• Any diagonal (5 numbers)

<b>💰 Prize: 500 ETB per win!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Click /play to start playing! 🎯
    `;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('play', async (ctx) => {
    const user = await getUser(ctx.from.id);
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /start first to register and get your welcome bonus!');
        return;
    }
    
    const message = `
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
    
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
});

bot.command('register', async (ctx) => {
    const user = await getUser(ctx.from.id);
    
    if (user.registered && user.phoneNumber) {
        await ctx.reply(
            `✅ <b>You are already registered!</b>\n\n` +
            `📱 Phone: ${user.phoneNumber}\n` +
            `💰 Balance: ${formatBalance(user.balance)}\n\n` +
            `Use /play to start playing! 🎮`,
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

bot.on('contact', async (ctx) => {
    const user = await getUser(ctx.from.id);
    const contact = ctx.message.contact;
    
    user.phoneNumber = contact.phone_number;
    user.registered = true;
    
    if (user.balance === 0) {
        user.balance = 10;
        user.totalDeposited = 10;
    }
    
    await syncUserToBackend(ctx.from.id);
    
    await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `📱 Phone: ${user.phoneNumber}\n` +
        `💰 Balance: ${formatBalance(user.balance)}\n\n` +
        `Use /play to start playing! 🎮`,
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
});

bot.command('balance', async (ctx) => {
    const user = await getUser(ctx.from.id);
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /start first to register!');
        return;
    }
    
    await syncUserToBackend(ctx.from.id);
    
    const message = `
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
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('deposit', async (ctx) => {
    const user = await getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /start first to register!');
        return;
    }
    
    if (args.length < 3) {
        const instructions = `
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
        await ctx.reply(instructions, { parse_mode: 'HTML' });
        return;
    }
    
    const amount = parseFloat(args[1]);
    const transactionId = args[2];
    
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Minimum deposit is 10 ETB.');
        return;
    }
    
    if (amount > 50000) {
        await ctx.reply('❌ Maximum deposit is 50,000 ETB.');
        return;
    }
    
    const depositId = 'DEP_' + Date.now() + '_' + user.id;
    pendingDeposits.set(depositId, {
        id: depositId,
        userId: user.id,
        amount: amount,
        transactionId: transactionId,
        createdAt: new Date()
    });
    
    await ctx.reply(
        `✅ <b>Deposit Request Submitted!</b>\n\n` +
        `📝 ID: ${depositId}\n` +
        `💰 Amount: ${amount} ETB\n` +
        `🔢 TXN: ${transactionId}\n\n` +
        `⏳ Admin will verify within 5-15 minutes.`,
        { parse_mode: 'HTML' }
    );
    
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💰 DEPOSIT REQUEST\n📝 ${depositId}\n👤 ${user.firstName}\n💰 ${amount} ETB\n🔢 ${transactionId}\n\n/approve_deposit ${depositId}`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

bot.command('withdraw', async (ctx) => {
    const user = await getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (!user.registered) {
        await ctx.reply('⚠️ Please use /start first to register!');
        return;
    }
    
    if (args.length < 2) {
        await ctx.reply(
            `💸 <b>Withdrawal</b>\n\n` +
            `💰 Balance: ${formatBalance(user.balance)}\n` +
            `💸 Min: 10 ETB\n\n` +
            `Usage: /withdraw [AMOUNT]\n` +
            `Example: /withdraw 100`,
            { parse_mode: 'HTML' }
        );
        return;
    }
    
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Minimum withdrawal is 10 ETB.');
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
        name: user.firstName,
        createdAt: new Date()
    });
    
    await ctx.reply(
        `✅ <b>Withdrawal Request Submitted!</b>\n\n` +
        `📝 ID: ${withdrawalId}\n` +
        `💰 Amount: ${amount} ETB\n` +
        `📱 Sent to: ${user.phoneNumber}\n\n` +
        `⏳ Admin will process within 5-30 minutes.`,
        { parse_mode: 'HTML' }
    );
    
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💸 WITHDRAWAL REQUEST\n📝 ${withdrawalId}\n👤 ${user.firstName}\n💰 ${amount} ETB\n📱 ${user.phoneNumber}\n\n/approve_withdraw ${withdrawalId}`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

bot.command('help', async (ctx) => {
    const user = await getUser(ctx.from.id);
    const isUserAdmin = isAdmin(ctx.from.id);
    
    let message = `
📚 <b>LOGO BING BINGO - COMMANDS</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎮 PLAYER COMMANDS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/start - 🎯 Register and get 10 ETB bonus (ONLY ONCE)
/play - 🎮 Launch the game
/register - 📝 Complete registration with phone
/deposit - 💰 Deposit funds via Telebirr
/withdraw - 💸 Withdraw your winnings
/balance - 💵 Check your wallet balance
/help - ❓ Show this menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💰 YOUR STATS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Player: ${user.firstName || 'Not registered'}
💰 Balance: ${formatBalance(user.balance)}
🎮 Games: ${user.gamesPlayed} played, ${user.gamesWon} won
    `;
    
    if (isUserAdmin) {
        message += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👑 ADMIN COMMANDS:</b>
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
    
    await ctx.reply(message, { parse_mode: 'HTML' });
});

// ============================================
// ADMIN COMMANDS
// ============================================

bot.command('approve_deposit', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return;
    
    const depositId = args[1];
    const deposit = pendingDeposits.get(depositId);
    if (!deposit) return;
    
    const user = await getUser(deposit.userId);
    user.balance += deposit.amount;
    user.totalDeposited += deposit.amount;
    await syncUserToBackend(deposit.userId);
    pendingDeposits.delete(depositId);
    
    await ctx.reply(`✅ Deposit approved! +${deposit.amount} ETB`);
    await bot.telegram.sendMessage(user.id, `✅ Deposit approved! +${deposit.amount} ETB\nNew balance: ${formatBalance(user.balance)}`);
});

bot.command('approve_withdraw', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return;
    
    const withdrawalId = args[1];
    const withdrawal = pendingWithdrawals.get(withdrawalId);
    if (!withdrawal) return;
    
    const user = await getUser(withdrawal.userId);
    user.balance -= withdrawal.amount;
    user.totalWithdrawn += withdrawal.amount;
    await syncUserToBackend(withdrawal.userId);
    pendingWithdrawals.delete(withdrawalId);
    
    await ctx.reply(`✅ Withdrawal approved! -${withdrawal.amount} ETB`);
    await bot.telegram.sendMessage(user.id, `✅ Withdrawal approved!\nNew balance: ${formatBalance(user.balance)}`);
});

bot.command('pending_deposits', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    if (pendingDeposits.size === 0) return ctx.reply('✅ No pending deposits.');
    
    let msg = '📋 Pending Deposits:\n\n';
    for (const [id, d] of pendingDeposits) {
        msg += `📝 ID: ${id}\n👤 User: ${d.userId}\n💰 Amount: ${d.amount} ETB\n🔢 TXN: ${d.transactionId}\n\n`;
    }
    await ctx.reply(msg);
});

bot.command('pending_withdrawals', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    if (pendingWithdrawals.size === 0) return ctx.reply('✅ No pending withdrawals.');
    
    let msg = '📋 Pending Withdrawals:\n\n';
    for (const [id, w] of pendingWithdrawals) {
        msg += `📝 ID: ${id}\n👤 User: ${w.userId}\n💰 Amount: ${w.amount} ETB\n📱 Phone: ${w.phoneNumber}\n\n`;
    }
    await ctx.reply(msg);
});

bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    let totalBalance = 0, totalGames = 0, totalWins = 0, registered = 0;
    for (const u of users.values()) {
        totalBalance += u.balance;
        totalGames += u.gamesPlayed;
        totalWins += u.gamesWon;
        if (u.registered) registered++;
    }
    
    await ctx.reply(
        `📊 Game Statistics\n\n` +
        `👥 Total Users: ${users.size}\n` +
        `✅ Registered: ${registered}\n` +
        `💰 Total Balance: ${formatBalance(totalBalance)}\n` +
        `🎮 Games Played: ${totalGames}\n` +
        `🏆 Games Won: ${totalWins}\n` +
        `⏳ Pending Deposits: ${pendingDeposits.size}\n` +
        `⏳ Pending Withdrawals: ${pendingWithdrawals.size}`
    );
});

// ============================================
// API ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/user/:telegramId', async (req, res) => {
    const user = await getUser(req.params.telegramId);
    res.json({ success: true, user: user });
});

app.post('/api/user/sync', async (req, res) => {
    const userData = req.body;
    users.set(userData.telegramId, userData);
    res.json({ success: true });
});

app.post('/api/game', async (req, res) => {
    const { telegramId, action, data } = req.body;
    const user = await getUser(telegramId);
    
    if (action === 'updateBalance') {
        user.balance = data.balance;
        user.totalBet += data.betAmount || 0;
    } else if (action === 'recordWin') {
        user.balance = data.newBalance;
        user.totalWon += data.winAmount;
        user.gamesWon++;
        user.gamesPlayed++;
    }
    await syncUserToBackend(telegramId);
    res.json({ success: true });
});

app.post('/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`✅ Bot running on port ${PORT}`);
    console.log(`🎮 WebApp URL: ${WEBAPP_URL}`);
});

bot.launch();
