-- Expand admin audit actions for Shopify customer list import.
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
      'user_suspend',
      'user_ban',
      'user_unsuspend',
      'catalog_exercise_save',
      'catalog_challenge_save',
      'training_rules_save',
      'content_item_save',
      'content_item_delete',
      'content_report_resolve',
      'activity_hide',
      'activity_unhide',
      'comment_hide',
      'comment_unhide',
      'shopify_customers_import'
    )
  );
