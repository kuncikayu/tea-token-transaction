const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { setTimeout } = require("timers/promises");
const csvParser = require("csv-parser");

// Provider untuk menghubungkan dengan jaringan blockchain
const provider = new ethers.JsonRpcProvider(process.env.TEA_RPC_URL); // Pastikan TEA_RPC_URL sudah diatur di .env

// Fungsi untuk load wallets dari JSON
const loadWallets = () => {
    return new Promise((resolve, reject) => {
        fs.readFile("wallets.json", "utf8", (err, data) => {
            if (err) return reject(err);
            try {
                const wallets = JSON.parse(data);
                resolve(wallets);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
};

// Fungsi untuk load recipients dari CSV
const loadRecipients = () => {
    return new Promise((resolve, reject) => {
        const recipients = [];
        fs.createReadStream("recipients.csv")
            .pipe(csvParser())
            .on("data", (row) => {
                recipients.push({ address: row.wallet, amount: row.amount });
            })
            .on("end", () => resolve(recipients))
            .on("error", reject);
    });
};

// Fungsi untuk mendapatkan nama token dari contract address
const getTokenName = async (tokenAddress) => {
    const tokenContract = new ethers.Contract(tokenAddress, [
        "function name() view returns (string)",
    ], provider);

    try {
        const tokenName = await tokenContract.name();
        console.log(`💵 Token Name: ${tokenName}`);
        return tokenName;
    } catch (error) {
        console.error(`Gagal mendapatkan nama token untuk ${tokenAddress}:`, error);
        return null;
    }
};

// Fungsi untuk mengirim token ERC-20
const sendToken = async (senderWallet, tokenAddress, recipients) => {
    const tokenContract = new ethers.Contract(tokenAddress, [
        "function transfer(address to, uint256 amount) public returns (bool)",
    ], senderWallet);

    for (const recipient of recipients) {
        try {
            const amountInWei = ethers.parseUnits(recipient.amount, 18); // Pastikan desimal sesuai dengan token Anda

            const tx = await tokenContract.transfer(recipient.address, amountInWei);
            const tokenName = await getTokenName(tokenAddress); // Ambil nama token

            console.log(`➡️  Mengirim ${tokenName} ${recipient.amount} token ke ${recipient.address}. Tx Hash: ${tx.hash}`);
            console.log(`✅ Explorer Link: https://sepolia.tea.xyz/tx/${tx.hash}`);
            console.log(`----------------------------------------------------------------------------------------------------`);
            await tx.wait();

            // Interval acak antara 5 hingga 20 detik
            const randomDelay = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
            await setTimeout(randomDelay);
        } catch (error) {
            console.error(`Gagal mengirim ke ${recipient.address}:`, error);
        }
    }
};

// Fungsi untuk memilih item secara acak dari array
const getRandomItem = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

(async () => {
    // Memuat wallets dan recipients
    const wallets = await loadWallets();
    const recipients = await loadRecipients();

    console.log(`♾️ Jumlah wallet pengirim: ${wallets.length}`);
    console.log(`♾️ Jumlah penerima: ${recipients.length}`);

    // Mengirim token dari setiap wallet pengirim ke penerima secara acak
    for (let i = 0; i < recipients.length; i++) {
        const sender = getRandomItem(wallets); // Memilih pengirim secara acak
        const senderWallet = new ethers.Wallet(sender.privateKey, provider); // Sekarang provider sudah didefinisikan
        const tokenAddress = sender.tokenAddress;

        // Menampilkan nama token sebelum memulai transaksi
        const tokenName = await getTokenName(tokenAddress);
        if (tokenName) {
            console.log(`🪙  Token yang digunakan: ${tokenName}`);
        }

        console.log(`💰 Mengirim dari wallet: ${sender.address}`);

        // Mengirim token ke penerima yang dipilih secara acak
        const recipient = getRandomItem(recipients); // Memilih penerima secara acak
        console.log(`👨 Penerima yang dipilih: ${recipient.address}`);

        await sendToken(senderWallet, tokenAddress, [recipient]);
    }
})();
