type TableDefinition<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  id: string;
  display_name: string;
  locale: string;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  id: string;
  role_key: string;
  created_at: string;
};

type PermissionRow = {
  id: string;
  permission_key: string;
  description: string;
  created_at: string;
};

type RolePermissionRow = {
  role_id: string;
  permission_id: string;
  created_at: string;
};

type ProfileRoleRow = {
  profile_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
};

type GameRow = {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  category: string;
  credit_label: string;
  currency: string;
  image_url: string | null;
  fulfillment_method: "automatic" | "manual";
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type GameFieldRow = {
  id: string;
  game_id: string;
  field_key: string;
  label: string;
  field_type: "text" | "email" | "number";
  placeholder: string | null;
  help_text: string | null;
  validation_pattern: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type GamePackageRow = {
  id: string;
  game_id: string;
  package_code: string;
  amount_label: string;
  bonus_label: string | null;
  price_minor: number;
  supplier_cost_minor: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  idempotency_key: string;
  status: "pending_payment" | "processing" | "completed" | "cancelled";
  total_minor: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  package_id: string;
  product_title: string;
  package_code: string;
  package_label: string;
  unit_price_minor: number;
  currency: string;
  created_at: string;
};

type OrderItemInputRow = {
  id: string;
  order_item_id: string;
  field_key: string;
  field_label: string;
  value: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  provider: "bakong" | "aba_payway";
  provider_reference: string;
  provider_transaction_id: string | null;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  amount_minor: number;
  currency: string;
  qr_payload: string | null;
  qr_md5: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentEventRow = {
  id: string;
  payment_id: string;
  event_type: string;
  provider_event_id: string | null;
  payload_sha256: string | null;
  details: Record<string, unknown>;
  verified_at: string | null;
  changed_by: string | null;
  created_at: string;
};

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  adapter_key: string;
  contact_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PackageSupplierMappingRow = {
  id: string;
  package_id: string;
  supplier_id: string;
  supplier_product_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FulfillmentStatus = "queued" | "processing" | "completed" | "failed" | "needs_review";

type FulfillmentJobRow = {
  id: string;
  order_item_id: string;
  supplier_id: string | null;
  adapter_key: string;
  supplier_product_code: string | null;
  status: FulfillmentStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  external_reference: string | null;
  last_error: string | null;
  staff_note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type FulfillmentEventRow = {
  id: string;
  job_id: string;
  from_status: FulfillmentStatus | null;
  to_status: FulfillmentStatus;
  note: string;
  changed_by: string | null;
  created_at: string;
};

type RefundStatus = "requested" | "processing" | "completed" | "failed";

type RefundRow = {
  id: string;
  payment_id: string;
  amount_minor: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  provider_refund_reference: string | null;
  staff_note: string;
  requested_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AdminAuditEventRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        never,
        Partial<Pick<ProfileRow, "display_name" | "locale">>
      >;
      roles: TableDefinition<RoleRow, never, never>;
      permissions: TableDefinition<PermissionRow, never, never>;
      role_permissions: TableDefinition<RolePermissionRow, never, never>;
      profile_roles: TableDefinition<ProfileRoleRow, never, never>;
      games: TableDefinition<
        GameRow,
        Pick<GameRow, "slug" | "title" | "category" | "credit_label"> &
          Partial<Omit<GameRow, "slug" | "title" | "category" | "credit_label">>,
        Partial<Omit<GameRow, "id" | "created_at">>
      >;
      game_fields: TableDefinition<
        GameFieldRow,
        Pick<GameFieldRow, "game_id" | "field_key" | "label"> &
          Partial<
            Omit<GameFieldRow, "game_id" | "field_key" | "label">
          >,
        Partial<Omit<GameFieldRow, "id" | "created_at">>
      >;
      game_packages: TableDefinition<
        GamePackageRow,
        Pick<
          GamePackageRow,
          "game_id" | "package_code" | "amount_label" | "price_minor" | "supplier_cost_minor"
        > &
          Partial<
            Omit<
              GamePackageRow,
              "game_id" | "package_code" | "amount_label" | "price_minor"
            >
          >,
        Partial<Omit<GamePackageRow, "id" | "created_at">>
      >;
      orders: TableDefinition<OrderRow, never, never>;
      order_items: TableDefinition<OrderItemRow, never, never>;
      order_item_inputs: TableDefinition<OrderItemInputRow, never, never>;
      payments: TableDefinition<
        PaymentRow,
        never,
        Partial<Pick<PaymentRow, "qr_payload" | "qr_md5" | "checkout_url" | "provider_transaction_id" | "status" | "paid_at">>
      >;
      payment_events: TableDefinition<
        PaymentEventRow,
        Pick<PaymentEventRow, "payment_id" | "event_type"> & Partial<Omit<PaymentEventRow, "id" | "payment_id" | "event_type" | "created_at">>,
        never
      >;
      suppliers: TableDefinition<
        SupplierRow,
        Pick<SupplierRow, "code" | "name"> & Partial<Omit<SupplierRow, "id" | "code" | "name" | "created_at">>,
        Partial<Omit<SupplierRow, "id" | "created_at">>
      >;
      package_supplier_mappings: TableDefinition<
        PackageSupplierMappingRow,
        Pick<PackageSupplierMappingRow, "package_id" | "supplier_id" | "supplier_product_code"> & Partial<Pick<PackageSupplierMappingRow, "is_active">>,
        Partial<Omit<PackageSupplierMappingRow, "id" | "created_at">>
      >;
      fulfillment_jobs: TableDefinition<FulfillmentJobRow, never, never>;
      fulfillment_events: TableDefinition<FulfillmentEventRow, never, never>;
      refunds: TableDefinition<RefundRow, never, never>;
      admin_audit_events: TableDefinition<AdminAuditEventRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { _profile_id: string; _role_key: string };
        Returns: boolean;
      };
      is_staff: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      create_order: {
        Args: { _package_id: string; _idempotency_key: string; _inputs?: Record<string, string> };
        Returns: Pick<OrderRow, "id" | "order_number" | "total_minor" | "currency">[];
      };
      create_order_from_cart: {
        Args: { _items: Json; _idempotency_key: string };
        Returns: Pick<OrderRow, "id" | "order_number" | "total_minor" | "currency">[];
      };
      begin_payment: {
        Args: { _order_number: string; _provider: "bakong" | "aba_payway" };
        Returns: Pick<PaymentRow, "id" | "provider_reference" | "amount_minor" | "currency" | "expires_at">[];
      };
      verify_bakong_payment: {
        Args: {
          _payment_id: string;
          _transaction_hash: string;
          _verified_amount_minor: number;
          _verified_currency: string;
          _verified_to_account: string;
          _expected_to_account: string;
          _provider_details?: Record<string, unknown>;
        };
        Returns: boolean;
      };
      verify_payway_payment: {
        Args: {
          _payment_id: string;
          _transaction_id: string;
          _verified_amount_minor: number;
          _verified_currency: string;
          _provider_details?: Record<string, unknown>;
        };
        Returns: boolean;
      };
      expire_pending_payments: {
        Args: Record<never, never>;
        Returns: number;
      };
      update_fulfillment_job: {
        Args: { _job_id: string; _next_status: FulfillmentStatus; _note?: string; _external_reference?: string | null };
        Returns: FulfillmentStatus;
      };
      request_refund: {
        Args: { _payment_id: string; _amount_minor: number; _reason: string };
        Returns: string;
      };
      update_refund: {
        Args: { _refund_id: string; _next_status: RefundStatus; _provider_reference?: string | null; _note?: string };
        Returns: RefundStatus;
      };
      check_user_rate_limit: {
        Args: { _action_key: string; _limit: number; _window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      game_field_type: "text" | "email" | "number";
      payment_provider: "bakong" | "aba_payway";
      payment_status: "pending" | "paid" | "failed" | "expired" | "refunded";
      fulfillment_status: FulfillmentStatus;
      order_status: "pending_payment" | "processing" | "completed" | "cancelled";
      refund_status: RefundStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
