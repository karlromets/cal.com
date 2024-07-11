import handleMarkNoShow from "@calcom/features/handleMarkNoShow";

import type { TNoShowInputSchema } from "./markNoShow.schema";

type NoShowOptions = {
  input: TNoShowInputSchema;
};

export const markNoShow = async ({ input }: NoShowOptions) => {
  const { bookingUid, noShowHost } = input;

  return handleMarkNoShow({ bookingUid, noShowHost });
};

export default markNoShow;
