import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  jwtToAddress,
  getZkLoginSignature,
  genAddressSeed,
  computeZkLoginAddressFromSeed,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
import { SessionManager } from './session';

const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface DecodedJWT {
  email: string;
  sub: string;
  aud: string | string[];
  iss: string;
  name?: string;
  picture?: string;
  nonce: string;
  [key: string]: any;
}

export class ZkLoginService {
  static async initializeSession() {
    const ephemeralKeyPair = new Ed25519Keypair();
    const ephemeralPublicKey = ephemeralKeyPair.getPublicKey().toSuiPublicKey();

    const nonceRes = await fetch(process.env.NEXT_PUBLIC_ENOKI_NONCE_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_ENOKI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        ephemeralPublicKey,
        additionalEpochs: 2,
      }),
    });

    if (!nonceRes.ok) {
      const errText = await nonceRes.text();
      throw new Error(`Enoki nonce error (${nonceRes.status}): ${errText}`);
    }

    const { data } = await nonceRes.json();
    const { nonce, randomness, maxEpoch } = data;

    SessionManager.saveSession({
      ephemeralPrivateKey: ephemeralKeyPair.getSecretKey(),
      randomness,
      maxEpoch: maxEpoch.toString(),
      nonce,
    });

    return { ephemeralKeyPair, nonce, randomness, maxEpoch };
  }

  static getOAuthUrl(nonce: string, clientId: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      state: 'pinaivu_' + Date.now(),
    });
    return `${OAUTH_URL}?${params.toString()}`;
  }

  static recreateKeyPair(secretKeyBech32: string): Ed25519Keypair {
    return Ed25519Keypair.fromSecretKey(secretKeyBech32);
  }

  static async fetchZkProof(params: {
    jwtToken: string;
    ephemeralKeyPair: Ed25519Keypair;
    randomness: string;
    maxEpoch: number;
    userSalt: string;
  }) {
    const ephemeralPublicKey = params.ephemeralKeyPair.getPublicKey().toSuiPublicKey();

    const response = await fetch(process.env.NEXT_PUBLIC_ENOKI_ZKP_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_ENOKI_API_KEY}`,
        'Content-Type': 'application/json',
        'zklogin-jwt': params.jwtToken,
      },
      body: JSON.stringify({
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        ephemeralPublicKey,
        maxEpoch: params.maxEpoch,
        randomness: params.randomness,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Enoki ZKP error (${response.status}): ${errText}`);
    }

    const json = await response.json();
    return json.data || json;
  }

  static createTransactionSignature(
    zkProof: any,
    maxEpoch: number,
    ephemeralSignature: string,
    jwtToken: string,
    userSalt: string,
  ): string {
    const decodedJWT = jwtDecode<DecodedJWT>(jwtToken);
    const aud = Array.isArray(decodedJWT.aud) ? decodedJWT.aud[0] : decodedJWT.aud;

    const partialZkProof = {
      proofPoints: zkProof.proofPoints,
      issBase64Details: zkProof.issBase64Details,
      headerBase64: zkProof.headerBase64,
    };

    let addressSeed: string;
    if (zkProof.addressSeed) {
      addressSeed = zkProof.addressSeed;
    } else {
      addressSeed = genAddressSeed(
        BigInt(userSalt),
        'sub',
        decodedJWT.sub,
        aud,
      ).toString();
    }

    return getZkLoginSignature({
      inputs: { ...partialZkProof, addressSeed },
      maxEpoch,
      userSignature: ephemeralSignature,
    });
  }

  static getZkLoginAddress(jwtToken: string, userSalt: string, addressSeed?: string): string {
    if (addressSeed) {
      const decodedJWT = jwtDecode<DecodedJWT>(jwtToken);
      return computeZkLoginAddressFromSeed(
        BigInt(addressSeed),
        decodedJWT.iss,
        false,
      );
    }
    return jwtToAddress(jwtToken, userSalt, false);
  }
}
