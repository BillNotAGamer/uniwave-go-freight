export const AUDIT_VIEWER_TIME_ZONE = "Asia/Ho_Chi_Minh";

const auditDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: AUDIT_VIEWER_TIME_ZONE,
});

export function formatAuditViewerDateTime(value: Date): string {
  return auditDateTimeFormatter.format(value);
}
