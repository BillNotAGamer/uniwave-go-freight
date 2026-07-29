import { sql } from "drizzle-orm";

import { db } from "./database";

export async function cleanupIntegrationRun(runId: string): Promise<void> {
  if (process.env.INTEGRATION_TEST_PRESERVE_DATA === "true") {
    console.log(`integration-data-preserved runId=${runId}`);
    return;
  }

  const markerPattern = `%${runId}%`;
  const emailPattern = `%${runId.toLowerCase()}%`;

  await db.execute(sql`
    delete from audit_logs
    where actor_user_id in (
      select id from users where email like ${emailPattern}
    )
      or entity_id in (
        select id from shipping_notes where jobsheet_no like ${markerPattern}
      )
      or entity_id in (
        select id
        from shipping_note_charges
        where charge_name like ${markerPattern}
           or coalesce(description, '') like ${markerPattern}
           or coalesce(vendor_or_agent_text, '') like ${markerPattern}
      )
      or coalesce(before::text, '') like ${markerPattern}
      or coalesce(after::text, '') like ${markerPattern}
  `);

  await db.execute(sql`
    delete from shipping_note_exports
    where shipping_note_id in (
      select id from shipping_notes where jobsheet_no like ${markerPattern}
    )
      or coalesce(file_name, '') like ${markerPattern}
  `);

  await db.execute(sql`
    delete from shipping_note_charges
    where shipping_note_id in (
      select id from shipping_notes where jobsheet_no like ${markerPattern}
    )
      or charge_name like ${markerPattern}
      or coalesce(description, '') like ${markerPattern}
      or coalesce(vendor_or_agent_text, '') like ${markerPattern}
  `);

  await db.execute(sql`
    delete from tax_rules
    where code like ${markerPattern}
      or name like ${markerPattern}
      or coalesce(description, '') like ${markerPattern}
  `);

  await db.execute(sql`
    delete from shipping_notes
    where jobsheet_no like ${markerPattern}
      or coalesce(mawb_hawb_no, '') like ${markerPattern}
  `);

  await db.execute(sql`
    delete from sessions
    where user_id in (select id from users where email like ${emailPattern})
  `);

  await db.execute(sql`
    delete from accounts
    where user_id in (select id from users where email like ${emailPattern})
  `);

  await db.execute(sql`
    delete from verifications
    where identifier like ${emailPattern}
       or value like ${markerPattern}
  `);

  await db.execute(sql`
    delete from users
    where email like ${emailPattern}
  `);
}
