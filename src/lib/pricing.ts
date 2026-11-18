import type { Category, EventConfig } from "./domain";

export function registrationFee(
  event: Pick<EventConfig, "amount">,
  category?: Pick<Category, "registration_fee">,
) {
  return Number(category?.registration_fee ?? event.amount);
}
