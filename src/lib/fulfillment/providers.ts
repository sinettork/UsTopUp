export type FulfillmentRequest = {
  internalReference: string;
  supplierProductCode: string;
  customerDetails: Record<string, string>;
};

export type FulfillmentSubmission = {
  accepted: boolean;
  externalReference?: string;
  response?: Record<string, unknown>;
  error?: string;
};

export type FulfillmentStatusResult = {
  status: "processing" | "completed" | "failed" | "needs_review";
  externalReference?: string;
  details?: Record<string, unknown>;
};

/** Supplier integrations implement this server-only contract. */
export interface FulfillmentProvider {
  submit(request: FulfillmentRequest): Promise<FulfillmentSubmission>;
  checkStatus(externalReference: string): Promise<FulfillmentStatusResult>;
}

export function getFulfillmentProvider(adapterKey: string): FulfillmentProvider {
  if (adapterKey === "manual") {
    return {
      async submit() {
        return { accepted: false, error: "This order requires staff fulfillment." };
      },
      async checkStatus() {
        return { status: "needs_review", details: { reason: "Manual fulfillment has no supplier status API." } };
      },
    };
  }

  throw new Error(`Fulfillment adapter "${adapterKey}" is not registered.`);
}
