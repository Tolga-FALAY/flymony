import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { createRequire } from 'module';
import db from './database.js';

const require = createRequire(import.meta.url);
const { generateSecret, generateURI, verifySync } = require('otplib');

const JWT_SECRET = process.env.JWT_SECRET || 'flymony_jwt_super_secret_key_change_in_production_2026';
const TOKEN_EXPIRY = '7d';

/**
 * Initialize Users table & seed default admin if not exists
 */
export function initializeAuthDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            UserID INTEGER PRIMARY KEY AUTOINCREMENT,
            Username TEXT NOT NULL UNIQUE,
            Email TEXT UNIQUE,
            PasswordHash TEXT NOT NULL,
            Role TEXT NOT NULL DEFAULT 'guest',
            TwoFactorSecret TEXT,
            TwoFactorEnabled INTEGER DEFAULT 0,
            BackupCodes TEXT,
            LastLogin DATETIME,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure columns exist if table was partially created
    try {
        const cols = db.prepare("PRAGMA table_info(Users)").all();
        if (!cols.some(c => c.name === 'TwoFactorSecret')) {
            db.exec("ALTER TABLE Users ADD COLUMN TwoFactorSecret TEXT;");
        }
        if (!cols.some(c => c.name === 'TwoFactorEnabled')) {
            db.exec("ALTER TABLE Users ADD COLUMN TwoFactorEnabled INTEGER DEFAULT 0;");
        }
        if (!cols.some(c => c.name === 'BackupCodes')) {
            db.exec("ALTER TABLE Users ADD COLUMN BackupCodes TEXT;");
        }
    } catch (err) {
        console.warn("Users migration check:", err);
    }

    // Seed default admin if no users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get().count;
    if (userCount === 0) {
        const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
        const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'FlymonyAdmin2026!';
        const defaultEmail = process.env.ADMIN_EMAIL || 'admin@flymony.local';
        
        const salt = bcrypt.genSaltSync(12);
        const hash = bcrypt.hashSync(defaultPassword, salt);

        db.prepare(`
            INSERT INTO Users (Username, Email, PasswordHash, Role, TwoFactorEnabled)
            VALUES (?, ?, ?, 'admin', 0)
        `).run(defaultUsername, defaultEmail, hash);

        console.log(`[AUTH] Default admin created: Username: '${defaultUsername}' (Please change default password or enable 2FA)`);
    }
}

/**
 * Password Hashing & Verification
 */
export async function hashPassword(plainText) {
    return bcrypt.hash(plainText, 12);
}

export async function comparePassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
}

/**
 * JWT Creation & Verification
 */
export function generateToken(payload, expiresIn = TOKEN_EXPIRY) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * 2FA (TOTP) Helpers
 */
export function generate2FASecret(username) {
    const secret = generateSecret();
    const serviceName = 'Flymony';
    const otpAuthUrl = generateURI({ label: username, issuer: serviceName, secret });
    return { secret, otpAuthUrl };
}

export async function generateQRCodeDataUrl(otpAuthUrl) {
    return QRCode.toDataURL(otpAuthUrl);
}

export function verify2FACode(code, secret) {
    if (!code || !secret) return false;
    try {
        const result = verifySync({ token: code.toString().trim(), secret });
        return Boolean(result && result.valid);
    } catch (e) {
        return false;
    }
}

export function generateBackupCodes(count = 5) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char hex e.g. A3F8-91BC
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
}

/**
 * Express Authentication Middleware
 */
export function authenticateToken(req, res, next) {
    // 1. Try HttpOnly cookie
    let token = req.cookies?.flymony_token;

    // 2. Fallback to Authorization: Bearer <token>
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) {
        req.user = null;
        return next();
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.UserID) {
        req.user = null;
        return next();
    }

    // Verify user still exists in DB
    const user = db.prepare('SELECT UserID, Username, Email, Role, TwoFactorEnabled FROM Users WHERE UserID = ?').get(decoded.UserID);
    if (!user) {
        req.user = null;
        return next();
    }

    req.user = user;
    next();
}

/**
 * Require Logged In User
 */
export function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor. Lütfen giriş yapın.' });
    }
    next();
}

/**
 * Require Admin Role
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Bu işlem için yetkiniz yok. Lütfen giriş yapın.' });
    }
    if (req.user.Role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için Admin yetkisi gereklidir.' });
    }
    next();
}
