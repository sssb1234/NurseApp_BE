/**
 * TOTP / MFA helpers using otplib (RFC 6238 compliant).
 * Secrets are stored encrypted (pgcrypto) in mfa_configs.totp_secret.
 */
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config';

authenticator.options = { window: 1 }; // allow ±30s clock skew

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function getTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, config.mfa.issuer, secret);
}

export async function getTotpQrBase64(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
