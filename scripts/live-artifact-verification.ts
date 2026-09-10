import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { google } from "googleapis";

import type { User } from "../src/lib/db/schema";

function loadLocalEnvironment(): void {
  for (const envPath of [".env.local", ".env"]) {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function optionalEnvPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function toRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `LIVE11J-${stamp}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function safeDatabaseDescriptor(databaseUrl: string) {
  const parsed = new URL(databaseUrl);

  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || "(default)",
    databaseName: decodeURIComponent(parsed.pathname.replace(/^\/+/, "")),
    sslModePresent: parsed.searchParams.has("sslmode"),
  };
}

function assertLiveArtifactAuthorization(): void {
  if (process.env.LIVE_ARTIFACT_VERIFICATION_AUTHORIZED !== "true") {
    throw new Error(
      "LIVE_ARTIFACT_VERIFICATION_AUTHORIZED=true is required for live R2/Drive verification.",
    );
  }
}

function buildR2Client(config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function textFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  loadLocalEnvironment();
  assertLiveArtifactAuthorization();

  const runId = process.env.LIVE_ARTIFACT_RUN_ID?.trim() || toRunId();
  Object.assign(process.env, { NODE_ENV: "test" });

  let cleanupFailed = false;

  const [
    { sql },
    schema,
    database,
    databaseAuthorization,
    cleanupModule,
    userFixtures,
    shippingFixtures,
    taxFixtures,
    shippingMutations,
    shippingValidators,
    exportQueries,
    exportGenerator,
    exportMutations,
    exportArtifacts,
    exportDownload,
    artifactChecksum,
    r2Module,
    driveConfigModule,
    driveModule,
    driveService,
  ] = await Promise.all([
    import("drizzle-orm"),
    import("../src/lib/db/schema"),
    import("../tests/integration/setup/database"),
    import("../tests/integration/setup/database-authorization"),
    import("../tests/integration/setup/cleanup"),
    import("../tests/integration/fixtures/users"),
    import("../tests/integration/fixtures/shipping-notes"),
    import("../tests/integration/fixtures/tax-rules"),
    import("../src/features/shipping-notes/mutations"),
    import("../src/features/shipping-notes/validators"),
    import("../src/features/shipping-notes/export/queries"),
    import("../src/features/shipping-notes/export/generator"),
    import("../src/features/shipping-notes/export/mutations"),
    import("../src/features/shipping-notes/export/artifacts"),
    import("../src/features/shipping-notes/export/download"),
    import("../src/lib/artifact-storage/checksum"),
    import("../src/lib/artifact-storage/r2"),
    import("../src/lib/drive/config"),
    import("../src/lib/drive/google-drive"),
    import("../src/features/shipping-notes/export/drive/service"),
  ]);

  const target = databaseAuthorization.assertAuthorizedIntegrationDatabaseTarget();
  const db = database.db;
  const {
    shippingNoteExports,
  } = schema;

  const r2Config = r2Module.readR2ArtifactStorageConfig();
  const driveConfig = driveConfigModule.readGoogleDriveConfig();
  const r2Client = buildR2Client(r2Config);
  const driveUploader = new driveModule.GoogleDriveArtifactUploader(driveConfig);
  const driveApi = google.drive({
    version: "v3",
    auth: new google.auth.GoogleAuth({
      credentials: driveConfig.credentials,
      scopes: [driveConfig.scope],
    }),
  });

  const r2Keys = new Set<string>();
  const driveFileIds = new Set<string>();
  const evidence: Record<string, unknown> = {
    runId,
    databaseTarget: safeDatabaseDescriptor(requiredEnv("DATABASE_URL")),
    authorizedTarget: target,
    configurationPresence: {
      ARTIFACT_R2_ACCOUNT_ID: optionalEnvPresent("ARTIFACT_R2_ACCOUNT_ID"),
      ARTIFACT_R2_ACCESS_KEY_ID: optionalEnvPresent("ARTIFACT_R2_ACCESS_KEY_ID"),
      ARTIFACT_R2_SECRET_ACCESS_KEY: optionalEnvPresent("ARTIFACT_R2_SECRET_ACCESS_KEY"),
      ARTIFACT_R2_BUCKET_NAME: optionalEnvPresent("ARTIFACT_R2_BUCKET_NAME"),
      GOOGLE_SERVICE_ACCOUNT_JSON: optionalEnvPresent("GOOGLE_SERVICE_ACCOUNT_JSON"),
      GOOGLE_DRIVE_ROOT_FOLDER_ID: optionalEnvPresent("GOOGLE_DRIVE_ROOT_FOLDER_ID"),
    },
    r2: {
      configured: true,
      bucketName: r2Config.bucketName,
      endpointHost: `${r2Config.accountId}.r2.cloudflarestorage.com`,
      region: "auto",
    },
    drive: {
      serviceAccountConfigured: true,
      rootFolderConfigured: true,
      rootFolderId: driveConfig.rootFolderId,
    },
  };

  async function countResidue() {
    const markerPattern = `%${runId}%`;
    const emailPattern = `%${runId.toLowerCase()}%`;
    const [row] = await database.queryRows<Record<string, string>>(sql`
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
      ),
      fixture_exports as (
        select id
        from shipping_note_exports
        where shipping_note_id in (select id from fixture_notes)
           or coalesce(file_name, '') like ${markerPattern}
      )
      select
        (select count(*)::text from users where id in (select id from fixture_users)) as users,
        (select count(*)::text from accounts where user_id in (select id from fixture_users)) as accounts,
        (select count(*)::text from sessions where user_id in (select id from fixture_users)) as sessions,
        (select count(*)::text from verifications where lower(identifier) like ${emailPattern} or coalesce(value, '') like ${markerPattern}) as verifications,
        (select count(*)::text from shipping_notes where id in (select id from fixture_notes)) as shipping_notes,
        (select count(*)::text from shipping_note_charges where id in (select id from fixture_charges)) as shipping_note_charges,
        (select count(*)::text from shipping_note_exports where id in (select id from fixture_exports)) as shipping_note_exports,
        (select count(*)::text from tax_rules where code like ${markerPattern} or name like ${markerPattern} or coalesce(description, '') like ${markerPattern}) as tax_rules,
        (
          select count(*)::text
          from audit_logs
          where actor_user_id in (select id from fixture_users)
             or entity_id in (select id from fixture_notes)
             or entity_id in (select id from fixture_charges)
             or entity_id in (select id from fixture_exports)
             or coalesce(before::text, '') like ${markerPattern}
             or coalesce(after::text, '') like ${markerPattern}
        ) as audit_logs
    `);

    return row;
  }

  async function cleanupExternal() {
    const r2Cleanup: Array<Record<string, unknown>> = [];
    for (const key of r2Keys) {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
      }));

      let absent = false;
      try {
        await r2Client.send(new HeadObjectCommand({
          Bucket: r2Config.bucketName,
          Key: key,
        }));
      } catch {
        absent = true;
      }
      r2Cleanup.push({ key, deleted: true, absentAfterDelete: absent });
    }

    const driveCleanup: Array<Record<string, unknown>> = [];
    for (const fileId of driveFileIds) {
      const metadata = await driveApi.files.get({
        fileId,
        fields: "id,name,parents,trashed",
        supportsAllDrives: true,
      });
      const name = metadata.data.name ?? "";
      const parents = metadata.data.parents ?? [];

      if (!name.includes(runId) || !parents.includes(driveConfig.rootFolderId)) {
        throw new Error("Refusing to delete Drive file without Phase 11J ownership proof.");
      }

      await driveApi.files.delete({
        fileId,
        supportsAllDrives: true,
      });

      let absent = false;
      try {
        await driveApi.files.get({
          fileId,
          fields: "id,trashed",
          supportsAllDrives: true,
        });
      } catch {
        absent = true;
      }
      driveCleanup.push({ fileId, name, deleted: true, absentAfterDelete: absent });
    }

    evidence.externalCleanup = { r2Cleanup, driveCleanup };
  }

  async function createCheckedNote(label: string, actors: Awaited<
    ReturnType<typeof userFixtures.createIntegrationActors>
  >) {
    const sellingTaxRule = await taxFixtures.createTaxRuleFixture({
      runId,
      label: `${label}-SELL-VAT`,
      actor: actors.admin,
      chargeSection: "selling",
    });
    const buyingTaxRule = await taxFixtures.createTaxRuleFixture({
      runId,
      label: `${label}-BUY-VAT`,
      actor: actors.admin,
      chargeSection: "buying",
    });

    const draft = await shippingFixtures.createDraftFor(
      actors.saleA,
      runId,
      label,
    );
    await shippingMutations.createSellingChargeForNote(
      shippingValidators.createSellingChargeInputSchema.parse({
        shippingNoteId: draft.id,
        chargeName: `${runId}-${label}-SELL`,
        description: `${runId} live selling ${label}`,
        quantity: "1.000",
        unit: "shipment",
        unitPrice: "250.0000",
        currency: "VND",
      }),
      actors.saleA,
    );
    const submitted = await shippingMutations.submitShippingNote(
      { id: draft.id },
      actors.saleA,
    );
    await shippingMutations.createBuyingChargeForNote(
      submitted.id,
      shippingValidators.createBuyingChargeInputSchema.parse({
        shippingNoteId: submitted.id,
        chargeName: `${runId}-${label}-BUY`,
        description: `${runId} live buying ${label}`,
        quantity: "1.000",
        unit: "shipment",
        unitPrice: "100.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} vendor ${label}`,
      }),
      actors.accountant,
    );
    await taxFixtures.classifyNoteCharges({
      noteId: submitted.id,
      actor: actors.accountant,
      sellingTaxRuleId: sellingTaxRule.id,
      buyingTaxRuleId: buyingTaxRule.id,
    });
    const reviewing = await shippingMutations.startAccountingReview(
      { id: submitted.id },
      actors.accountant,
    );
    return shippingMutations.markShippingNoteChecked(
      { id: reviewing.id },
      actors.accountant,
    );
  }

  async function createGeneratedExport(input: {
    label: string;
    noteId: string;
    user: User;
  }) {
    const generatedAt = new Date();
    const exportData = await exportQueries.getInternalShippingNoteExportDataForUser(
      input.noteId,
      input.user,
    );

    if (!exportData) {
      throw new Error("Export data was not found.");
    }

    const fileName = `${runId}-${input.label}.xlsx`;
    const pending = await exportMutations.createPendingInternalXlsxExportRecord({
      shippingNoteId: exportData.note.id,
      fileName,
      user: input.user,
    });
    const generated = await exportGenerator.generateInternalShippingNoteXlsx(
      exportData,
      generatedAt,
    );
    const stored = await exportArtifacts.persistGeneratedExportArtifact({
      exportId: pending.id,
      exportType: "excel",
      bytes: generated.buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksumSha256: generated.checksumSha256,
    });
    r2Keys.add(stored.artifactStorageKey);
    const record = await exportMutations.markInternalXlsxExportGenerated({
      exportId: pending.id,
      fileName,
      checksumSha256: generated.checksumSha256,
      artifactStorageKey: stored.artifactStorageKey,
      artifactSizeBytes: stored.artifactSizeBytes,
      artifactMimeType: stored.artifactMimeType,
      sellingChargeCount: exportData.summary.sellingChargeCount,
      buyingChargeCount: exportData.summary.buyingChargeCount,
      generatedAt,
      user: input.user,
    });

    return {
      record,
      generatedBytes: Buffer.from(generated.buffer),
      checksum: generated.checksumSha256,
    };
  }

  async function headR2Object(key: string) {
    const result = await r2Client.send(new HeadObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key,
    }));

    return {
      key,
      contentLength: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
      sha256MetadataPresent: Boolean(result.Metadata?.sha256),
    };
  }

  async function listDriveByExportId(exportId: string) {
    const found = await driveUploader.findByExportId(exportId);
    return found.files.map((file) => ({
      id: file.id,
      name: file.name,
      parents: file.parents,
      appProperties: {
        uniwaveExportId: file.appProperties.uniwaveExportId,
        uniwaveShippingNoteId: file.appProperties.uniwaveShippingNoteId,
        uniwaveExportType: file.appProperties.uniwaveExportType,
        uniwaveExportVersion: file.appProperties.uniwaveExportVersion,
        uniwaveChecksumSha256Present: Boolean(file.appProperties.uniwaveChecksumSha256),
      },
    }));
  }

  try {
    evidence.preRunResidue = await countResidue();
    await cleanupModule.cleanupIntegrationRun(runId);

    const actors = await userFixtures.createIntegrationActors(runId);
    const checked = await createCheckedNote("ARTIFACT", actors);
    const approved = await shippingMutations.approveShippingNote(
      { id: checked.id },
      actors.admin,
    );
    const locked = await shippingMutations.lockShippingNote(
      { id: approved.id, lockReason: `${runId} live artifact verification` },
      actors.admin,
    );

    evidence.fixture = {
      actors: ["sale", "accountant", "admin", "inactive-sale", "deleted-sale"],
      shippingNoteId: locked.id,
      jobsheetNo: locked.jobsheetNo,
      finalStatus: locked.status,
    };

    const primaryExport = await createGeneratedExport({
      label: "PRIMARY",
      noteId: locked.id,
      user: actors.admin,
    });
    evidence.r2Upload = {
      exportId: primaryExport.record.id,
      status: primaryExport.record.status,
      artifactStorageKey: primaryExport.record.artifactStorageKey,
      artifactSizeBytes: primaryExport.record.artifactSizeBytes,
      artifactMimeType: primaryExport.record.artifactMimeType,
      checksumMatchesGenerated: primaryExport.record.checksum === primaryExport.checksum,
    };
    evidence.r2Head = await headR2Object(primaryExport.record.artifactStorageKey ?? "");

    const historical = await exportDownload.getHistoricalExportDownloadForUser(
      primaryExport.record.id,
      actors.admin,
    );
    evidence.historicalDownload = {
      exportId: historical.exportId,
      fileName: historical.fileName,
      mimeType: historical.mimeType,
      sizeBytes: historical.bytes.byteLength,
      checksumMatches: artifactChecksum.calculateArtifactSha256(historical.bytes) ===
        primaryExport.record.checksum,
    };

    const driveUpload = await driveService.uploadShippingNoteExportToDrive(
      primaryExport.record.id,
      actors.admin,
    );
    driveFileIds.add(driveUpload.driveFileId);
    evidence.driveUpload = {
      exportId: driveUpload.exportId,
      driveUploadStatus: driveUpload.driveUploadStatus,
      driveFileId: driveUpload.driveFileId,
      reconciledFromDrive: driveUpload.reconciledFromDrive,
    };
    evidence.driveIndependent = await listDriveByExportId(primaryExport.record.id);

    const idempotent = await driveService.uploadShippingNoteExportToDrive(
      primaryExport.record.id,
      actors.admin,
    );
    const afterIdempotentFiles = await listDriveByExportId(primaryExport.record.id);
    evidence.idempotency = {
      sameDriveFileId: idempotent.driveFileId === driveUpload.driveFileId,
      matchingDriveFileCount: afterIdempotentFiles.length,
      contract: "already-uploaded export returns existing DB Drive metadata",
    };

    const reconcileExport = await createGeneratedExport({
      label: "RECONCILE",
      noteId: locked.id,
      user: actors.admin,
    });
    const bytes = await exportDownload.getHistoricalExportDownloadForUser(
      reconcileExport.record.id,
      actors.admin,
    );
    const manualDriveFile = await driveUploader.upload({
      fileName: `${runId}-RECONCILE.xlsx`,
      mimeType: bytes.mimeType,
      bytes: bytes.bytes,
      parentFolderId: driveConfig.rootFolderId,
      appProperties: {
        uniwaveExportId: reconcileExport.record.id,
        uniwaveShippingNoteId: reconcileExport.record.shippingNoteId,
        uniwaveExportType: reconcileExport.record.exportType,
        uniwaveExportVersion: reconcileExport.record.version.toString(),
        uniwaveChecksumSha256: reconcileExport.record.checksum ?? "",
      },
    });
    driveFileIds.add(manualDriveFile.file.id);
    await db
      .update(shippingNoteExports)
      .set({
        driveUploadStatus: "upload_failed",
        driveErrorMessage: "DRIVE_UPLOAD_FAILED",
      })
      .where(sql`${shippingNoteExports.id} = ${reconcileExport.record.id}`);
    const reconciled = await driveService.uploadShippingNoteExportToDrive(
      reconcileExport.record.id,
      actors.admin,
    );
    evidence.retryReconcile = {
      initialState: "upload_failed",
      providerHadExactMatchingFile: true,
      finalStatus: reconciled.driveUploadStatus,
      reconciledFromDrive: reconciled.reconciledFromDrive,
      sameDriveFileId: reconciled.driveFileId === manualDriveFile.file.id,
    };

    evidence.postOperationResidue = await countResidue();
  } finally {
    try {
      await cleanupExternal();
    } catch (error) {
      cleanupFailed = true;
      evidence.externalCleanupError = textFromUnknown(error);
    }

    await cleanupModule.cleanupIntegrationRun(runId);
    evidence.finalResidue = await countResidue();

    const finalDriveResidue = [];
    for (const fileId of driveFileIds) {
      try {
        const metadata = await driveApi.files.get({
          fileId,
          fields: "id,name,trashed",
          supportsAllDrives: true,
        });
        finalDriveResidue.push({
          fileId,
          name: metadata.data.name,
          trashed: metadata.data.trashed,
        });
      } catch {
        // Missing exact test-owned file is the expected cleanup result.
      }
    }
    evidence.finalExternalResidue = {
      r2KeysTracked: r2Keys.size,
      driveFileIdsTracked: driveFileIds.size,
      driveResidue: finalDriveResidue,
    };

    console.log(JSON.stringify(evidence, null, 2));

    if (cleanupFailed) {
      throw new Error("Phase 11J external cleanup failed.");
    }
  }
}

main().catch((error: unknown) => {
  console.error(textFromUnknown(error));
  process.exitCode = 1;
});
