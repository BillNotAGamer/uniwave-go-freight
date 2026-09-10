import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

function loadLocalEnvironment(): void {
  for (const envPath of [".env.local", ".env"]) {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function toEmailToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function setup() {
  loadLocalEnvironment();

  const runId = requiredEnv("AUTH_E2E_RUN_ID");
  const salePassword = requiredEnv("AUTH_E2E_SALE_PASSWORD");
  const accountantPassword = requiredEnv("AUTH_E2E_ACCOUNTANT_PASSWORD");
  const adminPassword = requiredEnv("AUTH_E2E_ADMIN_PASSWORD");
  const token = toEmailToken(runId);

  const [{ eq, sql }, schema, credentials, shippingMutations, shippingValidators, taxFixtures, cleanup, database] =
    await Promise.all([
      import("drizzle-orm"),
      import("../src/lib/db/schema"),
      import("../src/lib/auth/credentials"),
      import("../src/features/shipping-notes/mutations"),
      import("../src/features/shipping-notes/validators"),
      import("../tests/integration/fixtures/tax-rules"),
      import("../tests/integration/setup/cleanup"),
      import("../tests/integration/setup/database"),
    ]);

  await cleanup.cleanupIntegrationRun(runId);

  const { db } = database;
  const { users, accounts, shippingNotes } = schema;
  const {
    buildCredentialAccountValues,
    hashCredentialPassword,
  } = credentials;
  const {
    createBuyingChargeForNote,
    createSellingChargeForNote,
    lockShippingNote,
    submitShippingNote,
  } = shippingMutations;
  const {
    createBuyingChargeInputSchema,
    createSellingChargeInputSchema,
    shippingNoteDraftInputSchema,
  } = shippingValidators;

  async function createLoginUser(input: {
    label: string;
    role: "sale" | "accountant" | "admin";
    password: string;
  }) {
    const now = new Date();
    const userId = randomUUID();
    const email = `${input.label}.${token}@e2e.invalid`;
    const passwordHash = await hashCredentialPassword(input.password);

    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        name: `${input.label} ${runId}`,
        role: input.role,
        isActive: true,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!user) {
      throw new Error(`Failed to create ${input.label} user.`);
    }

    await db.insert(accounts).values({
      id: randomUUID(),
      ...buildCredentialAccountValues({
        userId,
        passwordHash,
      }),
      createdAt: now,
      updatedAt: now,
    });

    return user;
  }

  const sale = await createLoginUser({
    label: "sale",
    role: "sale",
    password: salePassword,
  });
  const accountant = await createLoginUser({
    label: "accountant",
    role: "accountant",
    password: accountantPassword,
  });
  const admin = await createLoginUser({
    label: "admin",
    role: "admin",
    password: adminPassword,
  });

  const sellingTaxRule = await taxFixtures.createTaxRuleFixture({
    runId,
    label: "E2E-SELL-VAT",
    actor: admin,
    chargeSection: "selling",
  });
  const buyingTaxRule = await taxFixtures.createTaxRuleFixture({
    runId,
    label: "E2E-BUY-VAT",
    actor: admin,
    chargeSection: "buying",
  });

  async function createAccountingReadySubmittedNote(label: string) {
    const [draft] = await db
      .insert(shippingNotes)
      .values({
        id: randomUUID(),
        jobsheetNo: `${runId}-${label}`,
        mawbHawbNo: `${runId}-MAWB-${label}`,
        shippingMode: "sea_export",
        shipperText: `${runId} Shipper ${label}`,
        consigneeText: `${runId} Consignee ${label}`,
        customerText: `${runId} Customer ${label}`,
        agentText: `${runId} Agent ${label}`,
        aol: "SGN",
        aod: "LAX",
        finalDestination: "Los Angeles",
        volumeValue: "2.500",
        volumeUnit: "cbm",
        exchangeRate: "25000",
        status: "draft",
        createdById: sale.id,
      })
      .returning();

    if (!draft) {
      throw new Error(`Failed to create ${label} shipping note.`);
    }

    await createSellingChargeForNote(
      createSellingChargeInputSchema.parse({
        shippingNoteId: draft.id,
        chargeName: `${runId}-${label}-SELL`,
        description: `${runId} selling charge ${label}`,
        quantity: "1.000",
        unit: "shipment",
        unitPrice: "250.0000",
        currency: "VND",
      }),
      sale,
    );
    const submitted = await submitShippingNote({ id: draft.id }, sale);
    await taxFixtures.classifyNoteCharges({
      noteId: submitted.id,
      actor: accountant,
      sellingTaxRuleId: sellingTaxRule.id,
    });
    await createBuyingChargeForNote(
      submitted.id,
      createBuyingChargeInputSchema.parse({
        shippingNoteId: submitted.id,
        chargeName: `${runId}-${label}-BUY`,
        description: `${runId} buying charge ${label}`,
        quantity: "1.000",
        unit: "shipment",
        unitPrice: "100.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} vendor ${label}`,
      }),
      accountant,
    );
    await taxFixtures.classifyNoteCharges({
      noteId: submitted.id,
      actor: accountant,
      buyingTaxRuleId: buyingTaxRule.id,
    });

    return submitted;
  }

  const workflowNote = await createAccountingReadySubmittedNote("WORKFLOW");
  const lockedBaseNote = await createAccountingReadySubmittedNote("LOCKED");
  const reviewing = await shippingMutations.startAccountingReview(
    { id: lockedBaseNote.id },
    accountant,
  );
  const checked = await shippingMutations.markShippingNoteChecked(
    { id: reviewing.id },
    accountant,
  );
  const approved = await shippingMutations.approveShippingNote(
    { id: checked.id },
    admin,
  );
  const locked = await lockShippingNote(
    { id: approved.id, lockReason: `${runId} seeded locked note` },
    admin,
  );

  const smokeDraftInput = shippingNoteDraftInputSchema.parse({
    jobsheetNo: `${runId}-BROWSER-DRAFT`,
    shippingMode: "sea_export",
    mawbHawbNo: `${runId}-BROWSER-MAWB`,
    shipperText: `${runId} Browser Shipper`,
    consigneeText: `${runId} Browser Consignee`,
    customerText: `${runId} Browser Customer`,
    agentText: `${runId} Browser Agent`,
    aol: "SGN",
    aod: "LAX",
    finalDestination: "Los Angeles",
    volumeValue: "1.5",
    volumeUnit: "cbm",
    exchangeRate: "25000",
  });

  await db.execute(sql`select 1`);
  const existingBrowserDraft = await db
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(eq(shippingNotes.jobsheetNo, smokeDraftInput.jobsheetNo))
    .limit(1);

  if (existingBrowserDraft.length > 0) {
    throw new Error("Unexpected pre-existing authenticated E2E browser draft.");
  }

  return {
    runId,
    users: {
      sale: { email: sale.email },
      accountant: { email: accountant.email },
      admin: { email: admin.email },
    },
    notes: {
      workflow: {
        id: workflowNote.id,
        jobsheetNo: workflowNote.jobsheetNo,
      },
      locked: {
        id: locked.id,
        jobsheetNo: locked.jobsheetNo,
      },
      browserDraft: {
        jobsheetNo: smokeDraftInput.jobsheetNo,
        mawbHawbNo: smokeDraftInput.mawbHawbNo,
      },
    },
  };
}

async function countResidue(runId: string) {
  loadLocalEnvironment();

  const [{ sql }, database] = await Promise.all([
    import("drizzle-orm"),
    import("../tests/integration/setup/database"),
  ]);

  const markerPattern = `%${runId}%`;
  const emailPattern = `%${toEmailToken(runId)}%`;
  const { queryRows } = database;

  const [row] = await queryRows<Record<string, string>>(sql`
    with fixture_users as (
      select id from users where lower(email) like ${emailPattern}
    ),
    fixture_notes as (
      select id
      from shipping_notes
      where jobsheet_no like ${markerPattern}
         or coalesce(mawb_hawb_no, '') like ${markerPattern}
    ),
    fixture_charges as (
      select id
      from shipping_note_charges
      where shipping_note_id in (select id from fixture_notes)
         or charge_name like ${markerPattern}
         or coalesce(description, '') like ${markerPattern}
         or coalesce(vendor_or_agent_text, '') like ${markerPattern}
    )
    select
      (select count(*)::text from users where id in (select id from fixture_users)) as users,
      (select count(*)::text from accounts where user_id in (select id from fixture_users)) as accounts,
      (select count(*)::text from sessions where user_id in (select id from fixture_users)) as sessions,
      (select count(*)::text from verifications where lower(identifier) like ${emailPattern} or coalesce(value, '') like ${markerPattern}) as verifications,
      (select count(*)::text from shipping_notes where id in (select id from fixture_notes)) as shipping_notes,
      (select count(*)::text from shipping_note_charges where id in (select id from fixture_charges)) as shipping_note_charges,
      (select count(*)::text from shipping_note_exports where shipping_note_id in (select id from fixture_notes) or coalesce(file_name, '') like ${markerPattern}) as shipping_note_exports,
      (select count(*)::text from tax_rules where code like ${markerPattern} or name like ${markerPattern} or coalesce(description, '') like ${markerPattern}) as tax_rules,
      (
        select count(*)::text
        from audit_logs
        where actor_user_id in (select id from fixture_users)
           or entity_id in (select id from fixture_notes)
           or entity_id in (select id from fixture_charges)
           or coalesce(before::text, '') like ${markerPattern}
           or coalesce(after::text, '') like ${markerPattern}
      ) as audit_logs
  `);

  return row;
}

async function cleanup(runId: string) {
  loadLocalEnvironment();

  const cleanupModule = await import("../tests/integration/setup/cleanup");
  await cleanupModule.cleanupIntegrationRun(runId);
  return countResidue(runId);
}

async function main() {
  const command = process.argv[2];

  if (command === "setup") {
    console.log(JSON.stringify(await setup()));
    return;
  }

  if (command === "cleanup" || command === "verify") {
    const runId = requiredEnv("AUTH_E2E_RUN_ID");
    const result =
      command === "cleanup" ? await cleanup(runId) : await countResidue(runId);
    console.log(JSON.stringify({ runId, counts: result }));
    return;
  }

  throw new Error("Usage: auth-e2e-fixtures.ts <setup|cleanup|verify>");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
