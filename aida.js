const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const readline = require('readline');

// Define banner
const banner = `
       ██╗   ██╗██████╗ ██████╗     ██████╗  ██████╗ ████████╗
       ╚██╗ ██╔╝██╔══██╗██╔══██╗    ██╔══██╗██╔═══██╗╚══██╔══╝
        ╚████╔╝ ██████╔╝██████╔╝    ██████╔╝██║   ██║   ██║   
         ╚██╔╝  ██╔══██╗██╔══██╗    ██╔══██╗██║   ██║   ██║   
          ██║   ██████╔╝██████╔╝    ██████╔╝╚██████╔╝   ██║   
          ╚═╝   ╚═════╝ ╚═════╝     ╚═════╝  ╚═════╝    ╚═╝   
`;

// Configuration
const config = {
    baseUrl: 'https://back.aidapp.com',
    campaignId: '6b963d81-a8e9-4046-b14f-8454bc3e6eb2',
    excludedMissionId: 'f8edb0b4-ac7d-4a32-8522-65c5fb053725',
    headers: {
        'accept': '*/*',
        'origin': 'https://my.aidapp.com',
        'referer': 'https://my.aidapp.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    }
};

// Hardcoded task IDs from the second script
const taskIds = [
    'f8a1de65-613d-4500-85e9-f7c572af3248',
    '34ec5840-3820-4bdd-b065-66a127dd1930',
    '2daf1a21-6c69-49f0-8c5c-4bca2f3c4e40',
    'df2a34a4-05a9-4bde-856a-7f5b8768889a'
];

// Readline Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Loading Animation
async function loadingAnimation(message, duration = 3000) {
    const frames = ['-', '\\', '|', '/'];
    let i = 0;
    process.stdout.write(`\r${message} ${frames[i]}`);
    const interval = setInterval(() => {
        process.stdout.write(`\r${message} ${frames[i = (i + 1) % frames.length]}`);
    }, 200);
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);
    process.stdout.write(`\r${message} ✅\n`);
}

// Read Tokens
async function readTokens(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(token => token.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Create Wallet
function createWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`New Wallet: ${wallet.address}`);
    return wallet;
}

// Save Account
async function saveAccount(wallet, refCode) {
    await loadingAnimation("Saving account", 2000);
    const data = `Address: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nRefCode: ${refCode}\n\n`;
    await fs.appendFile('accounts.txt', data);
    console.log(`Account saved successfully!`);
}

// Save Token
async function saveToken(token) {
    await loadingAnimation("Storing access token", 2000);
    await fs.appendFile('token.txt', `${token.access_token}\n`);
    console.log(`Token saved successfully!`);
}

// Sign Message
async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
}

// Login Function
async function login(wallet, inviterCode) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);

    const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${inviterCode}`;

    await loadingAnimation("Connecting to server", 3000);

    try {
        const response = await axios.get(url, { headers: config.headers });
        console.log(`Login Successful!`);
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
        return true;
    } catch (error) {
        console.error(`Login Failed:`, error.response?.data || error.message);
        return false;
    }
}

// Complete Mission
async function completeMission(missionId, accessToken) {
    try {
        await loadingAnimation(`Completing mission ${missionId}`, 3000);
        await axios.post(
            `${config.baseUrl}/questing/mission-activity/${missionId}`,
            {},
            { headers: { ...config.headers, 'authorization': `Bearer ${accessToken}`, 'content-length': '0' } }
        );
        console.log(`Mission ${missionId} completed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error completing mission ${missionId}:`, error.response?.data || error.message);
        return false;
    }
}

// Claim Mission Reward
async function claimMissionReward(missionId, accessToken) {
    try {
        await loadingAnimation(`Claiming reward for mission ${missionId}`, 3000);
        await axios.post(
            `${config.baseUrl}/questing/mission-reward/${missionId}`,
            {},
            { headers: { ...config.headers, 'authorization': `Bearer ${accessToken}`, 'content-length': '0' } }
        );
        console.log(`Reward for mission ${missionId} claimed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error claiming reward ${missionId}:`, error.response?.data || error.message);
        return false;
    }
}

// Refer Create Function with Task Completion
async function runReferCreate() {
    console.log(banner);
    const inviterCode = await askQuestion('Enter referral code: ');
    const numAccounts = parseInt(await askQuestion('Enter number of accounts to create: '), 10);

    for (let i = 0; i < numAccounts; i++) {
        console.log(`\nCreating account ${i + 1}/${numAccounts}...`);
        const wallet = createWallet();
        const loginSuccess = await login(wallet, inviterCode);

        if (loginSuccess) {
            const tokens = await readTokens('token.txt');
            const accessToken = tokens[tokens.length - 1]; // Get the latest token
            console.log(`Using access token: ${accessToken.slice(0, 20)}...`);

            // Complete and claim all hardcoded tasks
            for (const missionId of taskIds) {
                console.log(`Processing mission: ${missionId}`);
                const completed = await completeMission(missionId, accessToken);
                if (completed) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await claimMissionReward(missionId, accessToken);
                }
                await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between tasks
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between accounts
    }
    console.log('\nRefer create process completed!');
}

// Do Task Function (unchanged)
async function runDoTask() {
    console.log(banner);
    const tokens = await readTokens('token.txt');
    if (tokens.length === 0) {
        console.error('No tokens found in token.txt');
        return;
    }

    console.log(`Found ${tokens.length} tokens to process...`);
    for (let i = 0; i < tokens.length; i++) {
        const accessToken = tokens[i];
        console.log(`\nProcessing token ${i + 1}/${tokens.length}: ${accessToken.slice(0, 20)}...`);
        for (const missionId of taskIds) {
            console.log(`Processing mission: ${missionId}`);
            const completed = await completeMission(missionId, accessToken);
            if (completed) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await claimMissionReward(missionId, accessToken);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.log('\nTask processing completed!');
}

// Main Menu
async function main() {
    console.log(banner);
    console.log('Select an option:');
    console.log('1. Refer Create');
    console.log('2. Do Task');
    const choice = await askQuestion('Enter your choice (1 or 2): ');

    if (choice === '1') {
        await runReferCreate();
    } else if (choice === '2') {
        await runDoTask();
    } else {
        console.log('Invalid choice! Please select 1 or 2.');
    }

    rl.close();
}

main().catch(error => console.error('Bot encountered an error:', error));
