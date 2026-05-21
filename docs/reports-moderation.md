# Module 14: Reports and Moderation

## Overview

The Reports and Moderation module provides tools for users to flag inappropriate content or behavior, and gives administrators a dedicated interface to review and act upon these reports.

## Architecture

This module introduces two main database tables:
1. `public.reports` - Stores user-submitted reports with a strict status lifecycle.
2. `public.admin_actions` - An immutable audit log recording every moderation action taken by administrators.

### Target Types
Users can currently report:
- `creator`
- `listing`
- `review`
- `inquiry`
- `user`

### Status Lifecycle
Reports follow a strict flow:
- `pending`: Newly submitted by user
- `reviewed`: Admin has seen it but taken no action yet
- `resolved`: Action taken (or determined valid)
- `rejected`: Determined invalid or unactionable

## Key Features

### For Users
- **Report Content**: Accessible from creator profiles and listing pages.
- **My Reports Dashboard**: View history and status of submitted reports (`/dashboard/buyer/reports`).

### For Admins
- **Admin Dashboard**: A unified view to filter and review pending reports (`/dashboard/admin/reports`).
- **Safe Moderation Actions**: Admins can execute specific actions directly from the report view:
  - Mark Reviewed
  - Resolve (Valid)
  - Reject (Invalid)
  - Hide Review
  - Suspend Listing
  - Suspend User

## Security & Validation
- **Row Level Security**: Authenticated users can only insert and select their *own* reports.
- **Target Validation**: The API layer verifies that the reported entity actually exists before saving the report.
- **Self-Report Prevention**: Users cannot report themselves.
- **Duplicate Prevention**: A user cannot open multiple pending reports against the same target.
- **Audit Logging**: Any destructive action (e.g., hiding a review, suspending a user) is strictly logged in `admin_actions`.
