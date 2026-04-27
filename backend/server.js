const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-zkp-key';

// In-memory mock database for KYC (Aadhaar/DigiLocker)
const mockDigiLockerDB = {
    '123456789012': { name: 'Alice Smith', isVerified: true },
    '987654321098': { name: 'Bob Jones', isVerified: true }
};

// Route: Send OTP (Simulated)
app.post('/api/kyc/send-otp', (req, res) => {
    const { aadhaarNumber } = req.body;
    
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ error: 'Invalid Aadhaar Number (must be 12 digits)' });
    }

    if (!mockDigiLockerDB[aadhaarNumber]) {
        return res.status(404).json({ error: 'Identity not found in DigiLocker Database' });
    }

    // Simulate sending OTP to the user's phone
    console.log(`[DigiLocker API] Sending OTP "1234" to registered mobile for ${aadhaarNumber}`);
    res.json({ message: 'OTP sent successfully', success: true });
});

// Route: Verify OTP and Issue Token
app.post('/api/kyc/verify-otp', (req, res) => {
    const { aadhaarNumber, otp, walletAddress } = req.body;

    if (otp !== '1234') {
        return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required for token binding' });
    }

    const userData = mockDigiLockerDB[aadhaarNumber];
    
    // Generate a secure JWT that ties the real-world identity to the wallet address.
    // In a real-world scenario, this signature would be verified by the smart contract 
    // or used to generate a ZK Proof off-chain.
    const token = jwt.sign(
        { 
            kycId: aadhaarNumber,
            wallet: walletAddress,
            verifiedAt: new Date().toISOString()
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );

    console.log(`[Identity Service] Issued verified token for ${userData.name} to wallet ${walletAddress}`);

    res.json({
        success: true,
        message: 'Identity Verified Successfully',
        voterToken: token,
        name: userData.name
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Identity API Online' });
});

app.listen(PORT, () => {
    console.log(`[Identity Service] Server running on port ${PORT}`);
    console.log(`[Identity Service] Ready to process KYC verifications.`);
});
