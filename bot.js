const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');

const BOT_TOKEN = '8762888807:AAHFSr4vrIME6cB8hY9JY8um8a2QR2zYORs';
const WEBAPP_URL = 'https://eloquent-dasik-4d9770.netlify.app';
const PORT = process.env.PORT || 10000;

const users = new Map();
const pendingDeposits = new Map();
const pendingWithdrawals = new Map();

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(cors());
app.use(express.json());

function getUser(telegramId) {
    if (!users.has(telegramId)) {
        users.set(telegramId, {
            id: telegramId,
            username: null,
            firstName: null,
            lastName: null,
            phoneNumber: null,
            registered: true,
            balance: 10,
            totalDeposited: 10,
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

function formatBalance(balance) {
    return `${balance.toFixed(2)} ETB`;
}

function isAdmin(telegramId) {
    const adminIds = ['1765057062', '1044688332', '6499874707'];
    return adminIds.includes(telegramId);
}

bot.start(async (ctx) => {
    const user = getUser(ctx.from.id);
    user.username = ctx.from.username;
    user.firstName = ctx.from.first_name;
    user.lastName = ctx.from.last_name;
    
    const message = `
🎯 <b>WELCOME TO LOGO BING BINGO!</b> 🎯

━━━━━━━━━━━━━━━━━━━━
👋 Hello ${user.firstName}!

💰 <b>Balance: ${formatBalance(user.balance)}</b>
━━━━━━━━━━━━━━━━━━━━

📝 <b>Commands:</b>
/play - Launch the game 🎮
/deposit - Deposit funds 💰
/withdraw - Withdraw winnings 💸
/balance - Check your wallet 💵
/help - Show all commands ❓

━━━━━━━━━━━━━━━━━━━━
<b>🎮 How to Play:</b>
1. Tap any card number to buy (10 ETB each)
2. Maximum 2 cards per player
3. Game auto-starts after 30 seconds
4. Click BINGO when you complete a pattern!

<b>💰 Prize: 500 ETB per win!</b>
    `;
    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('play', async (ctx) => {
    const user = getUser(ctx.from.id);
    const message = `
🎮 <b>Logo Bing Bingo</b> 🎮

━━━━━━━━━━━━━━━━━━━━
👤 Player: ${user.firstName}
💰 Balance: ${formatBalance(user.balance)}
🏆 Games Won: ${user.gamesWon}
━━━━━━━━━━━━━━━━━━━━

Click below to play!
    `;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🎯 PLAY NOW', WEBAPP_URL)]
    ]);
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
});

bot.command('balance', async (ctx) => {
    const user = getUser(ctx.from.id);
    const message = `
💰 <b>Your Wallet</b> 💰

━━━━━━━━━━━━━━━━━━━━
👤 Name: ${user.firstName}
📱 Phone: ${user.phoneNumber || 'Not set'}
━━━━━━━━━━━━━━━━━━━━
💰 Balance: ${formatBalance(user.balance)}
💵 Deposited: ${formatBalance(user.totalDeposited)}
💸 Withdrawn: ${formatBalance(user.totalWithdrawn)}
🏆 Won: ${formatBalance(user.totalWon)}
🎲 Bet: ${formatBalance(user.totalBet)}
━━━━━━━━━━━━━━━━━━━━
🎮 Games: ${user.gamesPlayed} played, ${user.gamesWon} won
    `;
    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('deposit', async (ctx) => {
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (args.length < 3) {
        const instructions = `
💰 <b>Deposit - Telebirr</b> 💰

━━━━━━━━━━━━━━━━━━━━
📱 Send to: <code>0931721793</code>
👤 Account: Logo Bing Bingo
━━━━━━━━━━━━━━━━━━━━

<b>Usage:</b>
<code>/deposit [AMOUNT] [TRANSACTION_ID]</code>

<b>Example:</b>
<code>/deposit 100 TXN123456789</code>

💰 Min: 10 ETB | Max: 50,000 ETB
⏳ Verification: 5-15 min
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
    const user = getUser(ctx.from.id);
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
        await ctx.reply(`💸 Withdrawal\n\n💰 Balance: ${formatBalance(user.balance)}\n💸 Min: 10 ETB\n\nUsage: /withdraw [AMOUNT]`);
        return;
    }
    
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount < 10) {
        await ctx.reply('❌ Minimum withdrawal is 10 ETB.');
        return;
    }
    
    if (amount > user.balance) {
        await ctx.reply(`❌ Insufficient balance! Balance: ${formatBalance(user.balance)}`);
        return;
    }
    
    const withdrawalId = 'WDR_' + Date.now() + '_' + user.id;
    pendingWithdrawals.set(withdrawalId, {
        id: withdrawalId,
        userId: user.id,
        amount: amount,
        createdAt: new Date()
    });
    
    await ctx.reply(
        `✅ <b>Withdrawal Request Submitted!</b>\n\n` +
        `📝 ID: ${withdrawalId}\n` +
        `💰 Amount: ${amount} ETB\n\n` +
        `⏳ Admin will process within 5-30 minutes.`,
        { parse_mode: 'HTML' }
    );
    
    for (const adminId of ['1765057062', '1044688332', '6499874707']) {
        try {
            await bot.telegram.sendMessage(adminId,
                `💸 WITHDRAWAL REQUEST\n📝 ${withdrawalId}\n👤 ${user.firstName}\n💰 ${amount} ETB\n💵 Balance: ${formatBalance(user.balance)}\n\n/approve_withdraw ${withdrawalId}`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    }
});

bot.command('help', async (ctx) => {
    const user = getUser(ctx.from.id);
    const message = `
📚 <b>Logo Bing Commands</b>

━━━━━━━━━━━━━━━━━━━━
/play - Launch game 🎮
/deposit - Deposit funds 💰
/withdraw - Withdraw winnings 💸
/balance - Check wallet 💵
/help - This menu ❓

━━━━━━━━━━━━━━━━━━━━
💰 Balance: ${formatBalance(user.balance)}
    `;
    await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('approve_deposit', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return;
    const depositId = args[1];
    const deposit = pendingDeposits.get(depositId);
    if (!deposit) return;
    const user = getUser(deposit.userId);
    user.balance += deposit.amount;
    user.totalDeposited += deposit.amount;
    pendingDeposits.delete(depositId);
    await ctx.reply(`✅ Deposit approved! +${deposit.amount} ETB`);
    await bot.telegram.sendMessage(deposit.userId, `✅ Deposit approved! +${deposit.amount} ETB\nNew balance: ${formatBalance(user.balance)}`);
});

bot.command('approve_withdraw', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return;
    const withdrawalId = args[1];
    const withdrawal = pendingWithdrawals.get(withdrawalId);
    if (!withdrawal) return;
    const user = getUser(withdrawal.userId);
    user.balance -= withdrawal.amount;
    user.totalWithdrawn += withdrawal.amount;
    pendingWithdrawals.delete(withdrawalId);
    await ctx.reply(`✅ Withdrawal approved! -${withdrawal.amount} ETB`);
    await bot.telegram.sendMessage(withdrawal.userId, `✅ Withdrawal approved!\nNew balance: ${formatBalance(user.balance)}`);
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/user/:telegramId', (req, res) => {
    const user = getUser(req.params.telegramId);
    res.json({ success: true, balance: user.balance, firstName: user.firstName || 'Player' });
});

app.post('/api/game', (req, res) => {
    const { telegramId, action, data } = req.body;
    const user = getUser(telegramId);
    if (action === 'updateBalance') {
        user.balance = data.balance;
        user.totalBet += data.betAmount || 0;
    } else if (action === 'recordWin') {
        user.balance = data.newBalance;
        user.totalWon += data.winAmount;
        user.gamesWon++;
        user.gamesPlayed++;
    }
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
console.log('🤖 Bot launched');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
