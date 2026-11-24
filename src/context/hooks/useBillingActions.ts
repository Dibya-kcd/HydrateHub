import {
  type UseBillingActionsParams,
  createBillingDocHelpers,
} from "./billing/billingShared";
import { createBillCheckoutActions } from "./billing/useBillCheckoutActions";
import { createBillEditDeleteSplitActions } from "./billing/useBillEditDeleteSplitActions";
import { useBillRepairActions } from "./billing/useBillRepairActions";
import { createBillReturnsAndCancelActions } from "./billing/useBillReturnsAndCancelActions";

export type { UseBillingActionsParams };

export function useBillingActions(rawParams: UseBillingActionsParams) {
  const params = {
    ...rawParams,
    salesmen: rawParams.salesmen ?? [],
  };

  const docHelpers = createBillingDocHelpers(params);
  const checkoutActions = createBillCheckoutActions(params, docHelpers);
  const returnsAndCancel = createBillReturnsAndCancelActions(params);
  const editDeleteSplit = createBillEditDeleteSplitActions(
    params,
    docHelpers,
    returnsAndCancel.dropUntouchedReturnScrap,
  );
  const repairActions = useBillRepairActions(
    params,
    docHelpers,
    editDeleteSplit.updateBill,
  );

  return {
    ...checkoutActions,
    cancelBill: returnsAndCancel.cancelBill,
    createSalesReturn: returnsAndCancel.createSalesReturn,
    cancelSalesReturn: returnsAndCancel.cancelSalesReturn,
    editSalesReturn: returnsAndCancel.editSalesReturn,
    ...editDeleteSplit,
    ...repairActions,
  };
}
