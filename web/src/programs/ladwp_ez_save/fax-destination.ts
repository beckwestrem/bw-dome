import { LADWP_EZ_SAVE_WORKFLOW } from "./workflow";

export const ADMIN_TEST_FAX_NUMBER = "(844) 652-1615";

export function resolveLadwpEzSaveFaxDestination(adminFaxTest?: boolean) {
  return adminFaxTest
    ? {
        faxNumber: ADMIN_TEST_FAX_NUMBER,
        label: "admin test fax",
        adminTest: true,
      }
    : {
        faxNumber: LADWP_EZ_SAVE_WORKFLOW.faxNumber,
        label: "LADWP",
        adminTest: false,
      };
}
