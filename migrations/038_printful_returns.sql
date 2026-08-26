BEGIN;
ALTER TABLE commerce_orders DROP CONSTRAINT commerce_orders_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_status_check CHECK(status IN ('READY','WAITING','HELD','REJECTED','ALREADY_PROCESSED','SUBMITTED','RETURNED'));
ALTER TABLE order_exception_actions DROP CONSTRAINT order_exception_actions_action_check;
ALTER TABLE order_exception_actions ADD CONSTRAINT order_exception_actions_action_check CHECK(action IN ('REVALIDATE','MANUAL_APPROVE','REJECT','SHOPIFY_CANCELLED','PRINTFUL_RETURNED'));
COMMIT;
