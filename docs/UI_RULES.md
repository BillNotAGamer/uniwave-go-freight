# UI Rules

## UI Direction

This is a back-office business application, not a marketing website.

Prioritize:
- Fast data entry
- Accuracy
- Readability
- Clear status
- Role-based visibility
- Desktop-first workflows
- Easy review and export

Avoid:
- Landing-page aesthetics
- Excessive animation
- Decorative gradients
- Large hero sections
- Unnecessary charts
- Overly clever layouts
- Mobile-first compromises that hurt desktop data entry

## Preferred UI Stack

- Tailwind CSS
- shadcn/ui
- Radix primitives when needed
- React Hook Form
- Zod
- TanStack Table
- date-fns
- lucide-react
- Sonner

## Layout

Use:
- Sidebar navigation
- Topbar with user/role/session actions
- Main content area
- Cards for form sections
- Tables for lists and accounting review
- Drawer/dialog only when it improves workflow

## Shipping Note Form

Use sectioned cards:
1. General Information
2. Parties
3. Shipment Details
4. Selling Charges
5. Buying Charges — accountant/admin only
6. Tax & Accounting — accountant/admin only
7. Approval & Export

Do not copy the Excel layout exactly into the web form. The web form should optimize data entry. Excel/PDF export should preserve the official output format.

## Tables

For accounting and shipping note lists:
- Use clear columns.
- Add filters only when needed.
- Keep totals visible where useful.
- Do not build complex BI dashboards prematurely.

## Status Badges

Use clear statuses:
- Draft
- Submitted
- Accounting Reviewing
- Checked
- Approved
- Exported
- Locked
- Cancelled

## Accessibility

Use semantic controls and accessible primitives. Inputs must have labels. Errors must be visible and understandable.
