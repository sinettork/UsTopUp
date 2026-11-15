declare module "bakong-khqr" {
  export const khqrData: {
    currency: { khr: number; usd: number };
  };

  export class IndividualInfo {
    constructor(
      bakongAccountId: string,
      merchantName: string,
      merchantCity: string,
      optional?: {
        currency?: number;
        amount?: number;
        billNumber?: string;
        purposeOfTransaction?: string;
      },
    );
  }

  export class BakongKHQR {
    generateIndividual(info: IndividualInfo): {
      status?: { code: number; message?: string };
      data?: { qr: string; md5: string };
    };
  }
}
